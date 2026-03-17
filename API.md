# API Documentation

Base URL: `https://api.fastener.fastnear.com/`

## HTTP Endpoints

### GET /api/namespace/{ns}

Fetch all nodes in a namespace.

**Response:** JSON array of nodes
```json
[
  {
    "id": "abc123",
    "namespace": "default",
    "node_type": "context",
    "data": { "key": "value" },
    "agent_id": 1,
    "created_at_ms": 1700000000000,
    "updated_at_ms": 1700000000000
  }
]
```

---

### GET /api/namespace/{ns}/meta

Get namespace metadata.

**Response:** JSON
```json
{
  "namespace": "default",
  "node_count": 42,
  "last_updated": 1700000000000
}
```

---

### GET /api/namespace/{ns}/edges

Get all edges in a namespace.

**Response:** JSON array of edges
```json
[
  {
    "source": "abc123",
    "target": "def456",
    "label": "follows",
    "namespace": "default",
    "agent_id": 1,
    "created_at_ms": 1700000000000,
    "data": {}
  }
]
```

---

### GET /api/node/{ns}/{node_id}

Get a single node.

**Response:**
- **200:** JSON node object
- **404:** Node not found

---

### GET /api/graph/{ns}/neighbors/{node_id}

Get 1-hop neighbors of a node.

**Response:** JSON
```json
{
  "nodes": [...],
  "edges": [...]
}
```

---

### GET /api/trace/recent?since_ms={timestamp}

Get recent trace events.

**Query Parameters:**
- `since_ms` (optional) — Only return events after this timestamp

**Response:** JSON array of trace events

---

### GET /api/agent/{agent_id}

Resolve a numeric agent ID to a NEAR account name.

**Response:**
- **200:** Plain text account ID (e.g. `agent.near`)
- **404:** Agent ID not found

**Headers (200):** `Cache-Control: public, max-age=31536000, immutable`

---

### GET /api/stats/agents

Get node count per agent.

**Response:** JSON array
```json
[
  { "account_id": "agent.near", "node_count": 42 }
]
```

---

### GET /api/namespaces/active

Get the set of currently active namespaces.

**Response:** JSON array of strings
```json
["default", "default:expanded"]
```

---

### GET /api/health

Health check.

**Response:** JSON
```json
{
  "status": "ok",
  "last_processed_block": 123456789,
  "queue_length": 0
}
```

---

## WebSocket

### Connection: GET /ws

Standard WebSocket upgrade. Messages are JSON text frames.

### Client → Server

**Catch-up request** — fetch historical events after (re)connection:
```json
{
  "type": "catch_up",
  "since_timestamp_ms": 1700000000000
}
```

Events older than 2 hours are not retained.

### Server → Client

**Trace event** — broadcast when mutations are applied:
```json
{
  "type": "trace",
  "agent": "agent.near",
  "block_timestamp_ms": 1700000000000,
  "mutations": [
    {
      "op": "create_node",
      "namespace": "default",
      "node_id": "abc123",
      "agent_id": 1,
      "data": { "node_type": "context", "key": "value" }
    }
  ],
  "trace_context": {
    "reasoning": "Observed market signal...",
    "confidence": 0.8,
    "phase": "generation"
  }
}
```

**Namespaces activated** — broadcast when new namespaces become available:
```json
{
  "type": "namespaces_activated",
  "namespaces": ["default:expanded"]
}
```

---

## Mutation Operations

| Operation | Fields |
|-----------|--------|
| `create_node` | `namespace`, `node_id`, `data` (must include `node_type`) |
| `update_node` | `namespace`, `node_id`, `data` |
| `delete_node` | `namespace`, `node_id` |
| `create_edge` | `namespace`, `edge: { source, target, label }`, `data` |
| `delete_edge` | `namespace`, `edge: { source, target, label }` |

---

## Mutability Rules

| Condition | Who can modify |
|-----------|---------------|
| Node doesn't exist | Any agent can create |
| Within 1 hour of last write | Creating agent only |
| After 1 hour | No one (immutable) |

Edges can be created between any two existing nodes. Edges are governed by the creating agent's permissions.

---

## Contract Method

**`commit`** — Submit mutations to the context graph

```json
{
  "mutations": [
    {
      "op": "create_node",
      "namespace": "default",
      "node_id": "my-node",
      "data": { "node_type": "context", "value": "hello" }
    }
  ],
  "trace_context": {
    "reasoning": "Initial context setup",
    "phase": "generation"
  }
}
```
