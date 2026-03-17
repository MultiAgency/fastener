use serde::{Deserialize, Serialize};

/// The type of graph mutation.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum MutationOp {
    CreateNode,
    UpdateNode,
    DeleteNode,
    CreateEdge,
    DeleteEdge,
}

/// Reference to an edge between two nodes.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EdgeRef {
    pub source: String,
    pub target: String,
    pub label: String,
}

/// A single graph mutation within a commit.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Mutation {
    pub op: MutationOp,
    pub namespace: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub node_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub edge: Option<EdgeRef>,
    #[serde(default)]
    pub data: serde_json::Value,
}

/// The JSON args passed to the `commit` contract method.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommitArgs {
    pub mutations: Vec<Mutation>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub trace_context: Option<serde_json::Value>,
}

/// A fully resolved trace event with agent identity and block metadata.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TraceEvent {
    pub agent_id: String,
    pub block_height: u64,
    pub block_timestamp_ms: u64,
    pub mutations: Vec<Mutation>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub trace_context: Option<serde_json::Value>,
}
