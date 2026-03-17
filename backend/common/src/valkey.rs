/// Valkey key for the commit event queue (indexer LPUSH, server RPOP).
pub const COMMIT_QUEUE: &str = "commit_queue";

/// Valkey key for the processing queue (RPOPLPUSH target).
pub const PROCESSING_QUEUE: &str = "processing_queue";

/// Valkey key for the last processed block height.
pub const LAST_PROCESSED_BLOCK: &str = "last_processed_block";

/// Valkey key for account_id -> u32 agent index mapping.
pub const AGENT_TO_ID: &str = "agent_to_id";

/// Valkey key for u32 agent index -> account_id reverse mapping.
pub const ID_TO_AGENT: &str = "id_to_agent";

/// Valkey sorted set for recent trace events (for WebSocket catch-up).
pub const TRACE_EVENTS_ZSET: &str = "trace_events";

/// Hash: agent_id (u32) → node count (i64). Tracks how many nodes each agent owns.
pub const AGENT_NODE_COUNT: &str = "agent_node_count";

/// Hash: namespace → node count (i64). Tracks nodes per namespace.
pub const NAMESPACE_NODE_COUNT: &str = "namespace_node_count";

/// Set of namespace names that are active.
pub const ACTIVE_NAMESPACES: &str = "active_namespaces";

/// Build the Valkey key for namespace metadata.
pub fn namespace_meta_key(ns: &str) -> String {
    format!("ns_meta//{ns}")
}

/// Build the Valkey key for per-namespace node timestamp sorted set.
pub fn node_ts_key(ns: &str) -> String {
    format!("node_ts//{ns}")
}

/// Build the Valkey key for an individual node.
/// Uses `//` as delimiter to avoid ambiguity if ns or node_id contain `:`.
pub fn node_key(ns: &str, node_id: &str) -> String {
    format!("node//{ns}//{node_id}")
}

/// Build the Valkey key for a namespace's edges sorted set.
pub fn edges_key(ns: &str) -> String {
    format!("edges//{ns}")
}

/// Build the Valkey key for a node's outbound adjacency set (namespace-scoped).
pub fn adj_key(ns: &str, node_id: &str) -> String {
    format!("adj//{ns}//{node_id}")
}

/// Build the Valkey key for a node's inbound adjacency set (namespace-scoped).
pub fn adj_in_key(ns: &str, node_id: &str) -> String {
    format!("adj_in//{ns}//{node_id}")
}
