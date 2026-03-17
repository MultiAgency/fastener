# Fastener

### The Context Layer for Agent Systems on NEAR

Fastener fastens agent harnesses with context — binding execution to policies, permissions, and shared state so agents act within defined boundaries.

It turns a real-time surface into a **live, shared context graph for agents**.

> Fastener is a shared, real-time context graph that agents read from and write to before acting.

**API:** https://api.fastener.fastnear.com
**Contract:** `fastgraph.near`

## Quick Start

### 1. Start infrastructure
```bash
docker compose up -d    # Valkey on port 6379
```

### 2. Build & start the server
```bash
cd frontend && npm install && npm run build   # Build frontend
cd backend && cargo run -p server             # Serves API + frontend on :3000
```

### 3. Start the indexer (requires deployed contract)
```bash
START_BLOCK_HEIGHT=140000000 cargo run -p indexer   # Set to a recent mainnet block
```

### 4. Open http://localhost:3000

### 5. Run an agent example
```bash
cd examples/ts-agent && npm install
NEAR_ACCOUNT_ID=your-account.near npx tsx agent.ts
```

## Deploy Contract

```bash
cd contract && ./build.sh
near contract deploy fastgraph.near use-file res/fastener_contract.wasm without-init-call network-config mainnet sign-with-keychain send
```

## Architecture

```
NEAR blockchain → Indexer → Valkey queue → Server → WebSocket → Frontend/Agents
                                             ↕
                                      Valkey (graph store)
```

- **Contract** (`contract/`) — Minimal NEAR smart contract with a single `commit()` method. Exists only so transactions can be sent; the indexer reads args directly from chain data.
- **Indexer** (`backend/indexer/`) — Streams blocks from NEAR via `fastnear-neardata-fetcher`, filters `commit` calls, validates mutations, and pushes trace events to a Valkey queue.
- **Server** (`backend/server/`) — Axum HTTP/WebSocket server. Consumes trace events, applies mutability policies, updates the graph in Valkey, broadcasts live updates. Also serves the frontend static files.
- **Frontend** (`frontend/`) — React + React Flow graph dashboard with `@hot-labs/near-connect` for wallet connection.

## Agent Examples

| Example | Language | Run |
|---------|----------|-----|
| [ts-agent](examples/ts-agent/) | TypeScript | `npx tsx agent.ts` |
| [py-agent](examples/py-agent/) | Python | `python agent.py` |
| [coding-agent](examples/coding-agent/) | Any coding agent | Read AGENTS.md instructions |

Each example demonstrates the agent loop: read context, decide, commit trace, observe result.

## Data Model

Agents interact with the context graph through **nodes** and **edges** organized into **namespaces**.

### Node Types
- `context` — accumulated knowledge/state
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

## Documentation

- [API.md](API.md) — Full API reference (HTTP endpoints, WebSocket protocol, data formats)
- [TESTING.md](TESTING.md) — End-to-end test walkthrough
- [examples/coding-agent/AGENTS.md](examples/coding-agent/AGENTS.md) — Instructions for any coding agent
