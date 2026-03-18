# AGENTS.md

## Project Overview

Fastener is a shared, real-time context graph for AI agent systems on NEAR Protocol. Agents commit graph mutations (nodes and edges) as NEAR transactions, which are indexed, validated, and served over WebSocket to a React-based visualization frontend. Think of it as a shared memory layer where multiple agents can read and write structured context.

**Key concept:** Agents don't talk to each other directly — they coordinate through the graph. Each agent commits nodes (observations, decisions, actions, etc.) and edges (relationships between them), creating a shared situational awareness layer.

## Prerequisites

- **Rust** (stable, 2021 edition) with `wasm32-unknown-unknown` target for contract builds
- **Node.js** ≥ 18 with npm
- **Docker** for Valkey (Redis-compatible store)
- NEAR CLI (optional, for contract deployment)

```bash
# One-time setup
rustup target add wasm32-unknown-unknown
cd frontend && npm install
docker compose up -d                # Start Valkey on port 6379
```

## Build & Run Commands

### Backend (Rust workspace)

```bash
cd backend && cargo build              # Build all: common, indexer, server
cd backend && cargo build -p server    # Build only the server
cd backend && cargo build -p indexer   # Build only the indexer
cd backend && cargo run -p server      # Run the server (port 3000)
cd backend && cargo run -p indexer     # Run the indexer
```

### Contract (NEAR wasm)

```bash
cd contract && cargo build --target wasm32-unknown-unknown --release
# Or use: cd contract && ./build.sh
```

### Frontend (Vite + React + TypeScript)

```bash
cd frontend && npm install
cd frontend && npm run dev         # Dev server with proxy to backend
cd frontend && npm run build       # Production build (runs tsc + vite)
```

### Infrastructure

```bash
docker compose up                  # Start Valkey (Redis-compatible) on port 6379
```

## Testing & Verification

```bash
cd backend && cargo check              # Fast type-check all Rust code
cd backend && cargo clippy             # Lint Rust code
cd frontend && npx tsc --noEmit        # Type-check frontend
cd frontend && npm run build           # Full production build (tsc + vite)
```

No test suite exists yet. Verify changes by building successfully and checking behavior against a running Valkey instance.

## Architecture

Shared real-time context graph. Four components connected via Valkey (Redis-compatible):

```
NEAR blockchain → Indexer → Valkey queue → Server → WebSocket → Frontend
                                             ↕
                                      Valkey (graph store)
```

**Contract** (`contract/`): Minimal — single `commit()` method with empty body. Exists only so transactions can be sent; the indexer reads args directly from chain data.

**Indexer** (`backend/indexer/`): Streams blocks via `fastnear-neardata-fetcher`, filters receipts to `fastgraph.near` with method `commit`, validates mutation JSON, LPUSHes `TraceEvent` to Valkey `commit_queue`. Imports types from `fastnear_primitives`.

**Server** (`backend/server/`): Axum HTTP/WS server. Consumer task RPOPLPUSHes from `commit_queue` to `processing_queue`, applies trace events to graph (mutability rules), broadcasts via `tokio::sync::broadcast`, LREMs after success. Serves graph data over REST and streams trace events over WebSocket.

**Frontend** (`frontend/`): Vite/React app with React Flow (`@xyflow/react`) for graph visualization. Uses `@hot-labs/near-connect` for wallet connection and transaction signing. WebSocket for live trace event updates.

## Code Style

- **Rust**: Edition 2021, use `anyhow` for error handling, `tracing` for logging. Follow standard `cargo fmt` / `cargo clippy` conventions.
- **Frontend**: TypeScript strict mode, React 19, functional components only. Use npm (not yarn).
- **Naming**: Rust uses snake_case, TypeScript uses camelCase for variables and PascalCase for components.
- **Commits**: Keep commit messages concise, focused on the "why."

## Security & Mutability Rules

The graph enforces write-access rules in `backend/server/src/graph_store.rs`:

1. **Node doesn't exist** → any agent can create
2. **Within 1 hour of last write** → only the creating agent can modify
3. **After 1 hour** → node is immutable
4. **No timestamp found** → treated as immutable

These rules are critical — do not weaken or bypass them. They prevent agents from overwriting each other's context.

## Data Model

### Nodes

JSON objects stored individually in Valkey as `node//{namespace}//{node_id}`.

```json
{
  "id": "abc123",
  "namespace": "default",
  "node_type": "context|observation|action|decision|reflection|policy",
  "data": {},
  "agent_id": 1,
  "created_at_ms": 1700000000000,
  "updated_at_ms": 1700000000000
}
```

### Edges

Stored in sorted sets `edges//{namespace}` (scored by created_at_ms).
Adjacency indexes: `adj//{ns}//{node_id}` (outbound), `adj_in//{ns}//{node_id}` (inbound).

### Mutations

Each `commit` transaction contains an array of mutations:

- `create_node`, `update_node`, `delete_node`
- `create_edge`, `delete_edge`

### Trace Events

A `TraceEvent` wraps mutations with agent identity and block metadata, plus optional `trace_context` for decision reasoning.

### Namespaces

Named partitions of the graph. `default` is always active. When a namespace reaches 100+ nodes, expansion namespaces are auto-activated.

### Agent IDs

Each NEAR account gets a u32 index assigned on first commit (starting at 1; 0 is reserved as "system" sentinel). Bidirectional lookup via `agent_to_id` / `id_to_agent` Valkey hashes.

## Key Valkey Keys

- `commit_queue` / `processing_queue` — reliable queue pattern (RPOPLPUSH + LREM)
- `node//{ns}//{id}` — individual node JSON (uses `//` delimiter to avoid key collisions)
- `ns_nodes//{ns}` — set of node IDs in a namespace (for efficient listing without SCAN)
- `edges//{ns}` — sorted set of edge JSON (score=created_at_ms)
- `adj//{ns}//{node_id}` / `adj_in//{ns}//{node_id}` — namespace-scoped adjacency sets
- `node_ts//{ns}` — sorted set of node timestamps (score=last_updated_ms, member=node_id)
- `ns_meta//{ns}` — hash with `last_updated` timestamp
- `namespace_node_count` — hash: namespace → count
- `agent_node_count` — hash: agent_id → count
- `active_namespaces` — set of active namespace names
- `trace_events` — sorted set for WS catch-up (trimmed to 2h)
- `last_processed_block` — indexer resume point
- `agent_to_id` / `id_to_agent` — agent ID mappings

## Environment Variables

- `CONTRACT_ID` — NEAR contract account (default: `fastgraph.near`), used by indexer
- `VALKEY_URL` — Valkey connection (default: `redis://127.0.0.1:6379`), used by both indexer and server
- `LISTEN_ADDR` — Server listen address (default: `0.0.0.0:3000`)
