use common::graph::{Edge, Node};
use common::namespace::{DEFAULT_MUTABILITY_WINDOW_MS, NAMESPACE_EXPANSION_THRESHOLD};
use common::trace_event::{EdgeRef, Mutation, MutationOp};
use common::valkey;
use common::TraceEvent;
use redis::AsyncCommands;

/// How long a node remains mutable after last write.
const MUTABILITY_WINDOW_MS: u64 = DEFAULT_MUTABILITY_WINDOW_MS;

pub struct GraphStore {
    valkey: redis::aio::MultiplexedConnection,
}

impl GraphStore {
    pub fn new(valkey: redis::aio::MultiplexedConnection) -> Self {
        Self { valkey }
    }

    /// Apply a trace event to the graph, enforcing mutability policies.
    /// Returns (applied_mutations, newly_activated_namespaces).
    pub async fn apply_trace_event(
        &mut self,
        event: &TraceEvent,
    ) -> (Vec<AppliedMutation>, Vec<String>) {
        let agent_id = self.resolve_agent_id(&event.agent_id).await;
        let mut applied = Vec::new();
        let mut newly_activated: Vec<String> = Vec::new();

        for mutation in &event.mutations {
            let ns = &mutation.namespace;

            // Gate check: namespace must be active
            let is_active: bool = redis::cmd("SISMEMBER")
                .arg(valkey::ACTIVE_NAMESPACES)
                .arg(ns)
                .query_async(&mut self.valkey)
                .await
                .unwrap_or(false);
            if !is_active {
                continue;
            }

            match mutation.op {
                MutationOp::CreateNode => {
                    if let Some(result) = self
                        .apply_create_node(ns, mutation, agent_id, event)
                        .await
                    {
                        applied.push(result);

                        // Check namespace expansion
                        let count: i64 = redis::cmd("HGET")
                            .arg(valkey::NAMESPACE_NODE_COUNT)
                            .arg(ns)
                            .query_async(&mut self.valkey)
                            .await
                            .unwrap_or(0);

                        if count >= NAMESPACE_EXPANSION_THRESHOLD {
                            let expanded_ns = format!("{}:expanded", ns);
                            let added: i64 = redis::cmd("SADD")
                                .arg(valkey::ACTIVE_NAMESPACES)
                                .arg(&expanded_ns)
                                .query_async(&mut self.valkey)
                                .await
                                .unwrap_or(0);
                            if added == 1 {
                                newly_activated.push(expanded_ns);
                            }
                        }
                    }
                }
                MutationOp::UpdateNode => {
                    if let Some(result) =
                        self.apply_update_node(ns, mutation, agent_id, event).await
                    {
                        applied.push(result);
                    }
                }
                MutationOp::DeleteNode => {
                    if let Some(result) =
                        self.apply_delete_node(ns, mutation, agent_id, event).await
                    {
                        applied.push(result);
                    }
                }
                MutationOp::CreateEdge => {
                    if let Some(result) =
                        self.apply_create_edge(ns, mutation, agent_id, event).await
                    {
                        applied.push(result);
                    }
                }
                MutationOp::DeleteEdge => {
                    if let Some(result) =
                        self.apply_delete_edge(ns, mutation, agent_id).await
                    {
                        applied.push(result);
                    }
                }
            }
        }

        // Trim old timestamps from affected namespaces
        if !applied.is_empty() {
            let mut seen = std::collections::HashSet::new();
            for a in &applied {
                if a.node_id.is_some() && seen.insert(a.namespace.as_str()) {
                    let one_hour_ago =
                        event.block_timestamp_ms.saturating_sub(MUTABILITY_WINDOW_MS);
                    let _: () = redis::cmd("ZREMRANGEBYSCORE")
                        .arg(valkey::node_ts_key(&a.namespace))
                        .arg(0u64)
                        .arg(one_hour_ago)
                        .query_async(&mut self.valkey)
                        .await
                        .unwrap_or_default();
                }
            }
        }

        (applied, newly_activated)
    }

    async fn apply_create_node(
        &mut self,
        ns: &str,
        mutation: &Mutation,
        agent_id: u32,
        event: &TraceEvent,
    ) -> Option<AppliedMutation> {
        let node_id = mutation.node_id.as_ref()?;

        let exists: bool = self
            .valkey
            .exists(valkey::node_key(ns, node_id))
            .await
            .unwrap_or(false);
        if exists {
            return None;
        }

        let node_type = mutation
            .data
            .get("node_type")
            .and_then(|v| v.as_str())
            .unwrap_or("context")
            .to_string();

        let node = Node {
            id: node_id.clone(),
            namespace: ns.to_string(),
            node_type,
            data: mutation.data.clone(),
            agent_id,
            created_at_ms: event.block_timestamp_ms,
            updated_at_ms: event.block_timestamp_ms,
        };
        let node_json = serde_json::to_string(&node).unwrap();

        let mut pipe = redis::pipe();
        pipe.set(valkey::node_key(ns, node_id), &node_json).ignore();
        pipe.cmd("SADD")
            .arg(valkey::ns_nodes_key(ns))
            .arg(node_id.as_str())
            .ignore();
        pipe.cmd("ZADD")
            .arg(valkey::node_ts_key(ns))
            .arg(event.block_timestamp_ms as f64)
            .arg(node_id.as_str())
            .ignore();
        pipe.cmd("HINCRBY")
            .arg(valkey::NAMESPACE_NODE_COUNT)
            .arg(ns)
            .arg(1i64)
            .ignore();
        pipe.cmd("HINCRBY")
            .arg(valkey::AGENT_NODE_COUNT)
            .arg(agent_id)
            .arg(1i64)
            .ignore();
        pipe.cmd("HSET")
            .arg(valkey::namespace_meta_key(ns))
            .arg("last_updated")
            .arg(event.block_timestamp_ms)
            .ignore();

        let _: () = pipe.query_async(&mut self.valkey).await.unwrap_or_else(|e| {
            tracing::error!("Failed to create node {}/{}: {}", ns, node_id, e);
        });

        Some(AppliedMutation {
            op: MutationOp::CreateNode,
            namespace: ns.to_string(),
            node_id: Some(node_id.clone()),
            edge: None,
            agent_id,
            data: mutation.data.clone(),
        })
    }

    async fn apply_update_node(
        &mut self,
        ns: &str,
        mutation: &Mutation,
        agent_id: u32,
        event: &TraceEvent,
    ) -> Option<AppliedMutation> {
        let node_id = mutation.node_id.as_ref()?;

        let existing_json: Option<String> = self
            .valkey
            .get(valkey::node_key(ns, node_id))
            .await
            .unwrap_or(None);
        let existing: Node = serde_json::from_str(existing_json.as_ref()?).ok()?;

        // Check mutability window
        if !self
            .check_mutability(ns, node_id, existing.agent_id, agent_id, event.block_timestamp_ms)
            .await
        {
            return None;
        }

        let updated = Node {
            data: mutation.data.clone(),
            updated_at_ms: event.block_timestamp_ms,
            ..existing
        };
        let node_json = serde_json::to_string(&updated).unwrap();

        let mut pipe = redis::pipe();
        pipe.set(valkey::node_key(ns, node_id), &node_json).ignore();
        pipe.cmd("ZADD")
            .arg(valkey::node_ts_key(ns))
            .arg(event.block_timestamp_ms as f64)
            .arg(node_id.as_str())
            .ignore();
        pipe.cmd("HSET")
            .arg(valkey::namespace_meta_key(ns))
            .arg("last_updated")
            .arg(event.block_timestamp_ms)
            .ignore();

        let _: () = pipe.query_async(&mut self.valkey).await.unwrap_or_else(|e| {
            tracing::error!("Failed to update node {}/{}: {}", ns, node_id, e);
        });

        Some(AppliedMutation {
            op: MutationOp::UpdateNode,
            namespace: ns.to_string(),
            node_id: Some(node_id.clone()),
            edge: None,
            agent_id,
            data: mutation.data.clone(),
        })
    }

    async fn apply_delete_node(
        &mut self,
        ns: &str,
        mutation: &Mutation,
        agent_id: u32,
        event: &TraceEvent,
    ) -> Option<AppliedMutation> {
        let node_id = mutation.node_id.as_ref()?;

        let existing_json: Option<String> = self
            .valkey
            .get(valkey::node_key(ns, node_id))
            .await
            .unwrap_or(None);
        let existing: Node = serde_json::from_str(existing_json.as_ref()?).ok()?;

        if !self
            .check_mutability(ns, node_id, existing.agent_id, agent_id, event.block_timestamp_ms)
            .await
        {
            return None;
        }

        // Remove edges referencing this node from the edges sorted set,
        // and clean up adjacency sets on the OTHER nodes involved.
        let edges_json: Vec<String> = redis::cmd("ZRANGE")
            .arg(valkey::edges_key(ns))
            .arg(0i64)
            .arg(-1i64)
            .query_async(&mut self.valkey)
            .await
            .unwrap_or_default();

        let mut pipe = redis::pipe();
        for ej in &edges_json {
            if let Ok(edge) = serde_json::from_str::<Edge>(ej) {
                if edge.source.as_str() == node_id {
                    // Outbound edge from deleted node: remove from edges zset
                    // and remove from the target's inbound adjacency set
                    pipe.cmd("ZREM")
                        .arg(valkey::edges_key(ns))
                        .arg(ej)
                        .ignore();
                    pipe.cmd("SREM")
                        .arg(valkey::adj_in_key(ns, &edge.target))
                        .arg(format!("{}\0{}", edge.label, node_id))
                        .ignore();
                } else if edge.target.as_str() == node_id {
                    // Inbound edge to deleted node: remove from edges zset
                    // and remove from the source's outbound adjacency set
                    pipe.cmd("ZREM")
                        .arg(valkey::edges_key(ns))
                        .arg(ej)
                        .ignore();
                    pipe.cmd("SREM")
                        .arg(valkey::adj_key(ns, &edge.source))
                        .arg(format!("{}\0{}", edge.label, node_id))
                        .ignore();
                }
            }
        }

        pipe.del(valkey::node_key(ns, node_id)).ignore();
        pipe.cmd("SREM")
            .arg(valkey::ns_nodes_key(ns))
            .arg(node_id.as_str())
            .ignore();
        pipe.cmd("ZREM")
            .arg(valkey::node_ts_key(ns))
            .arg(node_id.as_str())
            .ignore();
        pipe.cmd("HINCRBY")
            .arg(valkey::NAMESPACE_NODE_COUNT)
            .arg(ns)
            .arg(-1i64)
            .ignore();
        pipe.cmd("HINCRBY")
            .arg(valkey::AGENT_NODE_COUNT)
            .arg(existing.agent_id)
            .arg(-1i64)
            .ignore();
        pipe.del(valkey::adj_key(ns, node_id)).ignore();
        pipe.del(valkey::adj_in_key(ns, node_id)).ignore();

        let _: () = pipe.query_async(&mut self.valkey).await.unwrap_or_else(|e| {
            tracing::error!("Failed to delete node {}/{}: {}", ns, node_id, e);
        });

        Some(AppliedMutation {
            op: MutationOp::DeleteNode,
            namespace: ns.to_string(),
            node_id: Some(node_id.clone()),
            edge: None,
            agent_id,
            data: serde_json::Value::Null,
        })
    }

    async fn apply_create_edge(
        &mut self,
        ns: &str,
        mutation: &Mutation,
        agent_id: u32,
        event: &TraceEvent,
    ) -> Option<AppliedMutation> {
        let edge_ref = mutation.edge.as_ref()?;

        // Validate both endpoints exist
        let source_exists: bool = self
            .valkey
            .exists(valkey::node_key(ns, &edge_ref.source))
            .await
            .unwrap_or(false);
        let target_exists: bool = self
            .valkey
            .exists(valkey::node_key(ns, &edge_ref.target))
            .await
            .unwrap_or(false);
        if !source_exists || !target_exists {
            return None;
        }

        let edge = Edge {
            source: edge_ref.source.clone(),
            target: edge_ref.target.clone(),
            label: edge_ref.label.clone(),
            namespace: ns.to_string(),
            agent_id,
            created_at_ms: event.block_timestamp_ms,
            data: mutation.data.clone(),
        };
        let edge_json = serde_json::to_string(&edge).unwrap();

        let mut pipe = redis::pipe();
        pipe.cmd("ZADD")
            .arg(valkey::edges_key(ns))
            .arg(event.block_timestamp_ms as f64)
            .arg(&edge_json)
            .ignore();
        pipe.cmd("SADD")
            .arg(valkey::adj_key(ns, &edge_ref.source))
            .arg(format!("{}\0{}", edge_ref.label, edge_ref.target))
            .ignore();
        pipe.cmd("SADD")
            .arg(valkey::adj_in_key(ns, &edge_ref.target))
            .arg(format!("{}\0{}", edge_ref.label, edge_ref.source))
            .ignore();

        let _: () = pipe.query_async(&mut self.valkey).await.unwrap_or_else(|e| {
            tracing::error!("Failed to create edge in {}: {}", ns, e);
        });

        Some(AppliedMutation {
            op: MutationOp::CreateEdge,
            namespace: ns.to_string(),
            node_id: None,
            edge: Some(edge_ref.clone()),
            agent_id,
            data: mutation.data.clone(),
        })
    }

    async fn apply_delete_edge(
        &mut self,
        ns: &str,
        mutation: &Mutation,
        agent_id: u32,
    ) -> Option<AppliedMutation> {
        let edge_ref = mutation.edge.as_ref()?;

        // Find and remove matching edge(s) from the edges sorted set
        let edges_json: Vec<String> = redis::cmd("ZRANGE")
            .arg(valkey::edges_key(ns))
            .arg(0i64)
            .arg(-1i64)
            .query_async(&mut self.valkey)
            .await
            .unwrap_or_default();

        let mut pipe = redis::pipe();
        for ej in &edges_json {
            if let Ok(edge) = serde_json::from_str::<Edge>(ej) {
                if edge.source == edge_ref.source
                    && edge.target == edge_ref.target
                    && edge.label == edge_ref.label
                {
                    pipe.cmd("ZREM")
                        .arg(valkey::edges_key(ns))
                        .arg(ej)
                        .ignore();
                }
            }
        }

        pipe.cmd("SREM")
            .arg(valkey::adj_key(ns, &edge_ref.source))
            .arg(format!("{}\0{}", edge_ref.label, edge_ref.target))
            .ignore();
        pipe.cmd("SREM")
            .arg(valkey::adj_in_key(ns, &edge_ref.target))
            .arg(format!("{}\0{}", edge_ref.label, edge_ref.source))
            .ignore();

        let _: () = pipe.query_async(&mut self.valkey).await.unwrap_or_else(|e| {
            tracing::error!("Failed to delete edge in {}: {}", ns, e);
        });

        Some(AppliedMutation {
            op: MutationOp::DeleteEdge,
            namespace: ns.to_string(),
            node_id: None,
            edge: Some(edge_ref.clone()),
            agent_id,
            data: serde_json::Value::Null,
        })
    }

    /// Check if a node is still mutable and the agent is allowed to modify it.
    async fn check_mutability(
        &mut self,
        ns: &str,
        node_id: &str,
        owner_agent_id: u32,
        requesting_agent_id: u32,
        current_timestamp_ms: u64,
    ) -> bool {
        let ts: Option<f64> = redis::cmd("ZSCORE")
            .arg(valkey::node_ts_key(ns))
            .arg(node_id)
            .query_async(&mut self.valkey)
            .await
            .unwrap_or(None);

        match ts {
            None => false, // No timestamp = permanent
            Some(ts_f64) => {
                let ts_ms = ts_f64 as u64;
                let age = current_timestamp_ms.saturating_sub(ts_ms);
                if age >= MUTABILITY_WINDOW_MS {
                    return false; // Past mutability window
                }
                // Within window: only the creating agent can modify
                owner_agent_id == requesting_agent_id
            }
        }
    }

    /// Get a node by namespace and ID.
    pub async fn get_node(&mut self, ns: &str, node_id: &str) -> Option<Node> {
        let json: Option<String> = self
            .valkey
            .get(valkey::node_key(ns, node_id))
            .await
            .unwrap_or(None);
        json.and_then(|j| serde_json::from_str(&j).ok())
    }

    /// Get all nodes in a namespace using the ns_nodes set for O(1) key lookup.
    pub async fn get_namespace_nodes(&mut self, ns: &str) -> Vec<Node> {
        let node_ids: Vec<String> = self
            .valkey
            .smembers(valkey::ns_nodes_key(ns))
            .await
            .unwrap_or_default();

        if node_ids.is_empty() {
            return Vec::new();
        }

        let keys: Vec<String> = node_ids
            .iter()
            .map(|id| valkey::node_key(ns, id))
            .collect();

        let values: Vec<Option<String>> = redis::cmd("MGET")
            .arg(&keys)
            .query_async(&mut self.valkey)
            .await
            .unwrap_or_default();

        values
            .into_iter()
            .flatten()
            .filter_map(|v| serde_json::from_str::<Node>(&v).ok())
            .collect()
    }

    /// Get all edges in a namespace.
    pub async fn get_namespace_edges(&mut self, ns: &str) -> Vec<Edge> {
        let edges_json: Vec<String> = redis::cmd("ZRANGE")
            .arg(valkey::edges_key(ns))
            .arg(0i64)
            .arg(-1i64)
            .query_async(&mut self.valkey)
            .await
            .unwrap_or_default();

        edges_json
            .into_iter()
            .filter_map(|j| serde_json::from_str::<Edge>(&j).ok())
            .collect()
    }

    /// Get neighbors of a node (1-hop outbound) with full edge metadata.
    pub async fn get_neighbors(&mut self, ns: &str, node_id: &str) -> (Vec<Node>, Vec<Edge>) {
        let adj_members: Vec<String> = self
            .valkey
            .smembers(valkey::adj_key(ns, node_id))
            .await
            .unwrap_or_default();

        if adj_members.is_empty() {
            return (Vec::new(), Vec::new());
        }

        // Collect neighbor IDs from adjacency set
        let neighbor_ids: Vec<(&str, &str)> = adj_members
            .iter()
            .filter_map(|m| m.split_once('\0'))
            .collect();

        // Fetch full edge data from the edges sorted set to get real metadata
        let all_edges = self.get_namespace_edges(ns).await;

        let mut nodes = Vec::new();
        let mut edges = Vec::new();

        for (label, target_id) in &neighbor_ids {
            if let Some(node) = self.get_node(ns, target_id).await {
                // Find the matching edge with full metadata
                let full_edge = all_edges.iter().find(|e| {
                    e.source == node_id && e.target == *target_id && e.label == *label
                });

                edges.push(match full_edge {
                    Some(e) => e.clone(),
                    None => Edge {
                        source: node_id.to_string(),
                        target: target_id.to_string(),
                        label: label.to_string(),
                        namespace: ns.to_string(),
                        agent_id: 0,
                        created_at_ms: 0,
                        data: serde_json::Value::Null,
                    },
                });
                nodes.push(node);
            }
        }

        (nodes, edges)
    }

    /// Resolve an account_id to a u32 agent index, creating a new one if needed.
    /// IDs start at 1; 0 is reserved as the "system" sentinel.
    async fn resolve_agent_id(&mut self, account_id: &str) -> u32 {
        let existing: Option<u32> = self
            .valkey
            .hget(valkey::AGENT_TO_ID, account_id)
            .await
            .unwrap_or(None);

        if let Some(id) = existing {
            return id;
        }

        let new_id: u32 = self
            .valkey
            .hlen::<_, u32>(valkey::AGENT_TO_ID)
            .await
            .unwrap_or(0)
            + 1;

        let _: () = redis::pipe()
            .hset(valkey::AGENT_TO_ID, account_id, new_id)
            .ignore()
            .hset(valkey::ID_TO_AGENT, new_id, account_id)
            .ignore()
            .query_async(&mut self.valkey)
            .await
            .unwrap_or_else(|e| {
                tracing::error!("Failed to set agent mappings for {}: {}", account_id, e);
            });

        new_id
    }
}

#[derive(Debug, Clone)]
pub struct AppliedMutation {
    pub op: MutationOp,
    pub namespace: String,
    pub node_id: Option<String>,
    pub edge: Option<EdgeRef>,
    pub agent_id: u32,
    pub data: serde_json::Value,
}
