use common::valkey;
use common::TraceEvent;
use redis::AsyncCommands;
use std::sync::Arc;
use tokio::sync::{broadcast, RwLock};

use crate::graph_store::GraphStore;

/// Two hours in milliseconds (for trimming the WS catch-up sorted set).
const CATCHUP_RETENTION_MS: u64 = 7_200_000;

/// Consume trace events from the Valkey queue and apply them to the graph store.
pub async fn run(
    mut con: redis::aio::MultiplexedConnection,
    graph_store: Arc<RwLock<GraphStore>>,
    broadcast_tx: broadcast::Sender<String>,
) {
    tracing::info!("Consumer started");

    loop {
        // RPOPLPUSH: atomically move from commit_queue to processing_queue
        let event_json: Option<String> = match redis::cmd("RPOPLPUSH")
            .arg(valkey::COMMIT_QUEUE)
            .arg(valkey::PROCESSING_QUEUE)
            .query_async(&mut con)
            .await
        {
            Ok(v) => v,
            Err(e) => {
                tracing::error!("RPOPLPUSH failed: {}", e);
                tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
                continue;
            }
        };

        let event_json = match event_json {
            Some(json) => json,
            None => {
                tokio::time::sleep(tokio::time::Duration::from_millis(50)).await;
                continue;
            }
        };

        // Parse and apply
        let event: TraceEvent = match serde_json::from_str(&event_json) {
            Ok(e) => e,
            Err(e) => {
                tracing::error!("Failed to parse trace event: {}", e);
                let _: () = con
                    .lrem(valkey::PROCESSING_QUEUE, 1, &event_json)
                    .await
                    .unwrap_or_default();
                continue;
            }
        };

        // Apply to graph store
        let (applied, newly_activated) = {
            let mut store = graph_store.write().await;
            store.apply_trace_event(&event).await
        };

        // Store in sorted set for WebSocket catch-up
        if !applied.is_empty() {
            let ws_event = serde_json::json!({
                "type": "trace",
                "agent": event.agent_id,
                "block_timestamp_ms": event.block_timestamp_ms,
                "mutations": applied.iter().map(|m| {
                    let mut obj = serde_json::json!({
                        "op": m.op,
                        "namespace": m.namespace,
                        "agent_id": m.agent_id,
                    });
                    if let Some(ref node_id) = m.node_id {
                        obj["node_id"] = serde_json::json!(node_id);
                    }
                    if let Some(ref edge) = m.edge {
                        obj["edge"] = serde_json::json!(edge);
                    }
                    if !m.data.is_null() {
                        obj["data"] = m.data.clone();
                    }
                    obj
                }).collect::<Vec<_>>(),
                "trace_context": event.trace_context,
            });

            let ws_json = ws_event.to_string();

            let two_hours_ago = event.block_timestamp_ms.saturating_sub(CATCHUP_RETENTION_MS);
            let _: () = redis::pipe()
                .zadd(valkey::TRACE_EVENTS_ZSET, &ws_json, event.block_timestamp_ms as f64)
                .ignore()
                .zrembyscore(valkey::TRACE_EVENTS_ZSET, 0u64, two_hours_ago)
                .ignore()
                .lrem(valkey::PROCESSING_QUEUE, 1, &event_json)
                .ignore()
                .query_async(&mut con)
                .await
                .unwrap_or_default();

            // Broadcast to WebSocket subscribers
            let _ = broadcast_tx.send(ws_json);

            // Broadcast newly activated namespaces
            if !newly_activated.is_empty() {
                let ns_event = serde_json::json!({
                    "type": "namespaces_activated",
                    "namespaces": newly_activated,
                });
                let _ = broadcast_tx.send(ns_event.to_string());
            }
        } else {
            let _: () = con
                .lrem(valkey::PROCESSING_QUEUE, 1, &event_json)
                .await
                .unwrap_or_default();
        }
    }
}
