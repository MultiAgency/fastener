# Berry Fast

An infinite collaborative pixel drawing board on NEAR Protocol. Free to draw.

**Website:** https://berry.fast
**API:** https://api.berry.fastnear.com
**Contract:** `berryfast.near`

## Components

- **Contract** (`contract/`) — Minimal NEAR smart contract with a single `draw()` method. Exists only so transactions can be sent; the indexer reads args directly from chain data.
- **Indexer** (`backend/indexer/`) — Streams blocks from NEAR via `fastnear-neardata-fetcher`, filters draw calls, validates pixel JSON, and pushes events to a Valkey queue.
- **Server** (`backend/server/`) — Axum HTTP/WebSocket server. Consumes draw events from the queue, applies ownership rules, updates region blobs in Valkey, and broadcasts live updates.
- **Frontend** (`frontend/`) — Vite/React app. Full-viewport canvas with Google Maps-style pan/zoom, NEAR Wallet Selector for signing transactions, and IndexedDB caching.

## Rules

- Anyone can draw on an undrawn pixel
- The owner can change their pixel within 1 hour
- After 1 hour the pixel becomes permanent

## Documentation

- [API.md](API.md) — Full API reference (HTTP endpoints, WebSocket protocol, data formats)
- [skill.md](https://berry.fast/skill.md) — Agent-readable skill file describing how to interact with Berry Fast programmatically
