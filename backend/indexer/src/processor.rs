use common::valkey;
use common::CommitArgs;
use common::TraceEvent;
use fastnear_primitives::block_with_tx_hash::BlockWithTxHashes;
use fastnear_primitives::near_primitives::views::{ActionView, ReceiptEnumView};
use redis::AsyncCommands;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tokio::sync::mpsc;

pub async fn process_blocks(
    mut blocks_rx: mpsc::Receiver<BlockWithTxHashes>,
    mut con: redis::aio::MultiplexedConnection,
    is_running: Arc<AtomicBool>,
    contract_account: &str,
) {
    let mut blocks_processed: u64 = 0;

    while is_running.load(Ordering::SeqCst) {
        let block = match blocks_rx.recv().await {
            Some(block) => block,
            None => break,
        };

        let block_height = block.block.header.height;
        let block_timestamp = block.block.header.timestamp_nanosec;
        let block_timestamp_ms = block_timestamp / 1_000_000;

        let mut events = Vec::new();

        for shard in &block.shards {
            for outcome in &shard.receipt_execution_outcomes {
                let receipt = &outcome.receipt;

                if receipt.receiver_id.as_str() != contract_account {
                    continue;
                }

                let actions = match &receipt.receipt {
                    ReceiptEnumView::Action {
                        actions, ..
                    } => actions,
                    _ => continue,
                };

                let predecessor_id = receipt.predecessor_id.to_string();

                for action in actions {
                    if let ActionView::FunctionCall {
                        method_name, args, ..
                    } = action
                    {
                        if method_name != "commit" {
                            continue;
                        }

                        match serde_json::from_slice::<CommitArgs>(&args) {
                            Ok(commit_args) => {
                                // Validate mutations have non-empty namespaces
                                let valid_mutations: Vec<_> = commit_args
                                    .mutations
                                    .into_iter()
                                    .filter(|m| !m.namespace.is_empty())
                                    .collect();

                                if !valid_mutations.is_empty() {
                                    events.push(TraceEvent {
                                        agent_id: predecessor_id.clone(),
                                        block_height,
                                        block_timestamp_ms,
                                        mutations: valid_mutations,
                                        trace_context: commit_args.trace_context,
                                    });
                                }
                            }
                            Err(e) => {
                                tracing::warn!(
                                    "Failed to parse commit args at block {}: {}",
                                    block_height,
                                    e
                                );
                            }
                        }
                    }
                }
            }
        }

        if !events.is_empty() {
            let serialized: Vec<String> = events
                .iter()
                .map(|e| serde_json::to_string(e).unwrap())
                .collect();

            for event_json in &serialized {
                let _: () = con
                    .lpush(valkey::COMMIT_QUEUE, event_json)
                    .await
                    .unwrap_or_else(|e| {
                        tracing::error!("Failed to LPUSH trace event: {}", e);
                    });
            }

            tracing::info!(
                "Block {}: pushed {} trace events ({} total mutations)",
                block_height,
                events.len(),
                events.iter().map(|e| e.mutations.len()).sum::<usize>()
            );
        }

        let _: () = con
            .set(valkey::LAST_PROCESSED_BLOCK, block_height)
            .await
            .unwrap_or_else(|e| {
                tracing::error!("Failed to update last_processed_block: {}", e);
            });

        blocks_processed += 1;
        if blocks_processed % 1000 == 0 {
            tracing::info!(
                "Processed {} blocks (latest: {})",
                blocks_processed,
                block_height
            );
        }
    }
}
