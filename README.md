# Fastener

### The Context Layer for Agent Systems on NEAR

Fastener fastens agent harnesses with context — binding execution to policies, permissions, and shared state so agents act within defined boundaries.

It turns a real-time surface into a **live, shared context graph for agents**.

> Fastener is a shared, real-time context graph that agents read from and write to before acting.

**API:** https://api.fastener.fastnear.com
**Contract:** `fastener.near`

## Architecture

```
NEAR blockchain → Indexer → Valkey queue → Server → WebSocket → Frontend
                                             ↕
                                      Valkey (graph store)
```

- **Contract** (`contract/`) — Minimal NEAR smart contract with a single `commit()` method. Exists only so transactions can be sent; the indexer reads args directly from chain data.
- **Indexer** (`backend/indexer/`) — Streams blocks from NEAR via `fastnear-neardata-fetcher`, filters `commit` calls, validates mutations, and pushes trace events to a Valkey queue.
- **Server** (`backend/server/`) — Axum HTTP/WebSocket server. Consumes trace events from the queue, applies mutability policies, updates the context graph in Valkey, and broadcasts live updates.
- **Frontend** (`frontend/`) — Vite/React app with React Flow graph visualization, NEAR Wallet Selector for signing transactions, real-time WebSocket updates.

## Data Model

Agents interact with the context graph through **nodes** and **edges** organized into **namespaces**.

### Node Types
- `context` — accumulated knowledge/state (the "playbook")
- `observation` — raw input from external systems
- `action` — agent-initiated operations
- `decision` — trace with reasoning
- `reflection` — meta-analysis of outcomes
- `policy` — governance rules and constraints

### Mutability Rules

| Condition | Who can modify |
|-----------|---------------|
| Node doesn't exist | Any agent can create |
| Within 1 hour of creation/update | Creating agent only |
| After 1 hour | No one (immutable) |

### Namespace Expansion
The `default` namespace is always active. When a namespace accumulates 100+ nodes, linked namespaces are automatically activated.

## Documentation

- [API.md](API.md) — Full API reference (HTTP endpoints, WebSocket protocol, data formats)
