# Testing Fastener End-to-End

## Prerequisites

- Docker (for Valkey)
- Rust toolchain
- Node.js 18+
- A NEAR mainnet account with credentials in `~/.near-credentials/mainnet/`
- Contract deployed to `fastgraph.near`

## Start All Services

```bash
# Terminal 1: Valkey
docker compose up

# Terminal 2: Server (serves API + frontend)
cd frontend && npm run build
cd backend && cargo run -p server

# Terminal 3: Indexer
START_BLOCK_HEIGHT=140000000 cargo run -p indexer
```

## Verify Services

```bash
# Health check
curl -s localhost:3000/api/health | jq .
# Should return: {"status":"ok","last_processed_block":...,"queue_length":0}

# Active namespaces
curl -s localhost:3000/api/namespaces/active | jq .
# Should return: ["default"]

# Frontend
open http://localhost:3000
# Should show the Fastener dashboard with empty default namespace
```

## Test the Full Agent Loop

### 1. Run the TypeScript agent

```bash
cd examples/ts-agent && npm install
NEAR_ACCOUNT_ID=your-account.near npx tsx agent.ts
```

Expected output:
```
=== Fastener TypeScript Agent ===

1. Reading context...
   Found 0 nodes, 0 edges

2. Making decision...
   Will create 1 mutations
   Reasoning: Observed 0 existing nodes. Creating observation node to record current state.

3. Submitting to NEAR chain...
   Transaction: 7abc...

4. Waiting for trace event...
   Trace event received!
   Agent: your-account.near
   Mutations applied: 1
```

### 2. Check the dashboard

Open http://localhost:3000 — you should see:
- A node in the graph view labeled with the observation ID
- The trace timeline at the bottom showing the event
- Click the node to see its data in the detail panel

### 3. Run the Python agent

```bash
cd examples/py-agent
pip install -r requirements.txt
NEAR_ACCOUNT_ID=your-account.near NEAR_PRIVATE_KEY=ed25519:... python agent.py
```

This creates a second node linked to the first via a `follows` edge.

### 4. Verify mutability

Try updating the first node from a DIFFERENT account — it should be rejected (only the creating agent can update within 1 hour).

### 5. Verify WebSocket real-time

Open the dashboard in a browser. Run another agent. The new node should appear in the graph without refreshing.

## API Smoke Tests

```bash
# List nodes
curl -s localhost:3000/api/namespace/default | jq length

# Get specific node
curl -s localhost:3000/api/node/default/observation-{timestamp} | jq .

# Get edges
curl -s localhost:3000/api/namespace/default/edges | jq .

# Get neighbors
curl -s localhost:3000/api/graph/default/neighbors/observation-{timestamp} | jq .

# Recent traces
curl -s localhost:3000/api/trace/recent | jq length

# Agent stats
curl -s localhost:3000/api/stats/agents | jq .
```
