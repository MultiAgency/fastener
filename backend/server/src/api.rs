use axum::extract::{Path, Query, State, WebSocketUpgrade};
use axum::response::IntoResponse;
use axum::routing::get;
use axum::Router;
use redis::AsyncCommands;
use serde::Deserialize;
use std::sync::Arc;
use tokio::sync::{broadcast, RwLock};

use crate::graph_store::GraphStore;
use crate::ws;

#[derive(Clone)]
pub struct AppState {
    pub graph_store: Arc<RwLock<GraphStore>>,
    pub valkey: redis::aio::MultiplexedConnection,
    pub broadcast_tx: broadcast::Sender<String>,
}

pub fn router(state: AppState) -> Router {
    Router::new()
        .route("/api/namespace/{ns}", get(get_namespace))
        .route("/api/namespace/{ns}/meta", get(get_namespace_meta))
        .route("/api/namespace/{ns}/edges", get(get_namespace_edges))
        .route("/api/node/{ns}/{node_id}", get(get_node))
        .route(
            "/api/graph/{ns}/neighbors/{node_id}",
            get(get_neighbors),
        )
        .route("/api/trace/recent", get(get_recent_traces))
        .route("/api/agent/{agent_id}", get(get_agent_by_id))
        .route("/api/stats/agents", get(get_agent_stats))
        .route("/api/namespaces/active", get(get_active_namespaces))
        .route("/api/health", get(health))
        .route("/ws", get(ws_upgrade))
        .with_state(state)
}

async fn get_namespace(
    State(state): State<AppState>,
    Path(ns): Path<String>,
) -> impl IntoResponse {
    let nodes = {
        let mut store = state.graph_store.write().await;
        store.get_namespace_nodes(&ns).await
    };
    axum::Json(nodes)
}

async fn get_namespace_meta(
    State(state): State<AppState>,
    Path(ns): Path<String>,
) -> impl IntoResponse {
    let node_count: i64 = state
        .valkey
        .clone()
        .hget(common::valkey::NAMESPACE_NODE_COUNT, &ns)
        .await
        .unwrap_or(0);

    let last_updated: Option<u64> = state
        .valkey
        .clone()
        .hget(common::valkey::namespace_meta_key(&ns), "last_updated")
        .await
        .unwrap_or(None);

    axum::Json(serde_json::json!({
        "namespace": ns,
        "node_count": node_count,
        "last_updated": last_updated.unwrap_or(0)
    }))
}

async fn get_namespace_edges(
    State(state): State<AppState>,
    Path(ns): Path<String>,
) -> impl IntoResponse {
    let edges = {
        let mut store = state.graph_store.write().await;
        store.get_namespace_edges(&ns).await
    };
    axum::Json(edges)
}

async fn get_node(
    State(state): State<AppState>,
    Path((ns, node_id)): Path<(String, String)>,
) -> impl IntoResponse {
    let node = {
        let mut store = state.graph_store.write().await;
        store.get_node(&ns, &node_id).await
    };
    match node {
        Some(n) => axum::Json(serde_json::to_value(n).unwrap()).into_response(),
        None => axum::http::StatusCode::NOT_FOUND.into_response(),
    }
}

async fn get_neighbors(
    State(state): State<AppState>,
    Path((ns, node_id)): Path<(String, String)>,
) -> impl IntoResponse {
    let (nodes, edges) = {
        let mut store = state.graph_store.write().await;
        store.get_neighbors(&ns, &node_id).await
    };
    axum::Json(serde_json::json!({
        "nodes": nodes,
        "edges": edges,
    }))
}

#[derive(Deserialize)]
struct RecentTracesQuery {
    since_ms: Option<u64>,
}

async fn get_recent_traces(
    State(state): State<AppState>,
    Query(query): Query<RecentTracesQuery>,
) -> impl IntoResponse {
    let since = query.since_ms.unwrap_or(0);
    let events: Vec<String> = state
        .valkey
        .clone()
        .zrangebyscore(common::valkey::TRACE_EVENTS_ZSET, since, "+inf")
        .await
        .unwrap_or_default();

    let parsed: Vec<serde_json::Value> = events
        .into_iter()
        .filter_map(|e| serde_json::from_str(&e).ok())
        .collect();

    axum::Json(parsed)
}

async fn get_agent_by_id(
    State(state): State<AppState>,
    Path(agent_id): Path<u32>,
) -> impl IntoResponse {
    let account: Option<String> = state
        .valkey
        .clone()
        .hget(common::valkey::ID_TO_AGENT, agent_id)
        .await
        .unwrap_or(None);

    match account {
        Some(id) => (
            [(
                axum::http::header::CACHE_CONTROL,
                "public, max-age=31536000, immutable",
            )],
            id,
        )
            .into_response(),
        None => axum::http::StatusCode::NOT_FOUND.into_response(),
    }
}

async fn get_agent_stats(State(state): State<AppState>) -> impl IntoResponse {
    let mut valkey = state.valkey.clone();

    let counts: Vec<(String, i64)> = valkey
        .hgetall(common::valkey::AGENT_NODE_COUNT)
        .await
        .unwrap_or_default();

    let id_to_agent: Vec<(String, String)> = valkey
        .hgetall(common::valkey::ID_TO_AGENT)
        .await
        .unwrap_or_default();

    let agent_map: std::collections::HashMap<String, String> =
        id_to_agent.into_iter().collect();

    let results: Vec<serde_json::Value> = counts
        .into_iter()
        .filter_map(|(agent_id, count)| {
            let account_id = agent_map.get(&agent_id)?;
            Some(serde_json::json!({
                "account_id": account_id,
                "node_count": count,
            }))
        })
        .collect();

    axum::Json(results)
}

async fn get_active_namespaces(State(state): State<AppState>) -> impl IntoResponse {
    let members: Vec<String> = state
        .valkey
        .clone()
        .smembers(common::valkey::ACTIVE_NAMESPACES)
        .await
        .unwrap_or_default();

    axum::Json(members)
}

async fn health(State(state): State<AppState>) -> impl IntoResponse {
    let last_block: Option<u64> = state
        .valkey
        .clone()
        .get(common::valkey::LAST_PROCESSED_BLOCK)
        .await
        .unwrap_or(None);

    let queue_len: Option<u64> = state
        .valkey
        .clone()
        .llen(common::valkey::COMMIT_QUEUE)
        .await
        .unwrap_or(None);

    axum::Json(serde_json::json!({
        "status": "ok",
        "last_processed_block": last_block,
        "queue_length": queue_len.unwrap_or(0)
    }))
}

async fn ws_upgrade(
    ws: WebSocketUpgrade,
    State(state): State<AppState>,
) -> impl IntoResponse {
    ws.on_upgrade(move |socket| ws::handle_socket(socket, state))
}
