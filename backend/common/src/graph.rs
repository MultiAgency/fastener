use serde::{Deserialize, Serialize};

/// A node in the context graph.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Node {
    pub id: String,
    pub namespace: String,
    pub node_type: String,
    pub data: serde_json::Value,
    pub agent_id: u32,
    pub created_at_ms: u64,
    pub updated_at_ms: u64,
}

/// An edge in the context graph.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Edge {
    pub source: String,
    pub target: String,
    pub label: String,
    pub namespace: String,
    pub agent_id: u32,
    pub created_at_ms: u64,
    #[serde(default)]
    pub data: serde_json::Value,
}
