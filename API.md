# API Documentation

Base URL: `https://api.berry.fastnear.com/`

## HTTP Endpoints

### GET /api/region/{rx}/{ry}

Fetch a 128×128 pixel region as a binary blob.

**Path Parameters:**
- `rx` (i32) — Region X coordinate
- `ry` (i32) — Region Y coordinate

**Response:**
- **Content-Type:** `application/octet-stream`
- **Body:** 98,304 bytes (128 × 128 × 6 bytes per pixel)
- **Headers:**
  - `x-last-updated` — Last update timestamp (nanoseconds), empty if never updated
  - `Cache-Control: no-cache, must-revalidate`

**Pixel format** (6 bytes, little-endian):

| Offset | Size | Field |
|--------|------|-------|
| 0–2 | 3 | RGB color |
| 3–5 | 3 | owner_id (u24 LE, 0 = undrawn) |

---

### GET /api/region/{rx}/{ry}/meta

Get metadata for a region without the full blob.

**Response:** JSON
```json
{
  "rx": 0,
  "ry": 0,
  "last_updated": 1700000000000000000
}
```

`last_updated` is in nanoseconds since UNIX epoch.

---

### GET /api/regions?coords=...

Batch-fetch metadata for multiple regions.

**Query Parameters:**
- `coords` — Comma-separated coordinate pairs: `rx1,ry1,rx2,ry2,...`

**Example:** `/api/regions?coords=0,0,1,1,-1,0`

**Response:** JSON array
```json
[
  { "rx": 0, "ry": 0, "last_updated": 1700000000000000000 },
  { "rx": 1, "ry": 1, "last_updated": 1700000000000000000 }
]
```

---

### GET /api/region/{rx}/{ry}/timestamps

Get pixel ownership timestamps for a region. Only returns pixels modified within the last hour.

**Response:** JSON array of `[local_x, local_y, timestamp_ms]` tuples
```json
[
  [10, 20, 1700000000000],
  [5, 3, 1700000060000]
]
```

---

### GET /api/account/{owner_id}

Resolve a numeric owner ID to a NEAR account name.

**Path Parameters:**
- `owner_id` (u32) — Numeric owner identifier (1-indexed; 0 is reserved)

**Response:**
- **200:** Plain text account ID (e.g. `user.near`)
- **404:** Owner ID not found

**Headers (200):** `Cache-Control: public, max-age=31536000, immutable`

---

### GET /api/open-regions

Get the set of regions currently open for drawing.

**Response:** JSON array
```json
[
  { "rx": 0, "ry": 0 },
  { "rx": 1, "ry": 0 }
]
```

Region (0,0) is always open. Neighbors open when a region reaches ~20% fill (3,277 pixels).

---

### GET /api/stats/accounts

Get pixel count per account.

**Response:** JSON array
```json
[
  { "account_id": "user.near", "pixel_count": 1250 }
]
```

---

### GET /api/stats/region/{rx}/{ry}

Get drawn pixel count for a region.

**Response:** JSON
```json
{ "count": 542 }
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

**Draw event** — broadcast when pixels are drawn:
```json
{
  "type": "draw",
  "signer": "user.near",
  "block_timestamp_ms": 1700000000000,
  "pixels": [
    {
      "x": 100,
      "y": 200,
      "color": "FF5733",
      "owner_id": 42
    }
  ]
}
```

- `color` is 6-digit hex RGB (no `#` prefix)
- `owner_id` is the numeric owner identifier

**Regions opened** — broadcast when new regions become drawable:
```json
{
  "type": "regions_opened",
  "regions": [
    { "rx": 1, "ry": 0 },
    { "rx": -1, "ry": 0 }
  ]
}
```

---

## Ownership Rules

| Condition | Who can draw |
|-----------|-------------|
| Undrawn pixel (owner_id = 0) | Anyone |
| Within 1 hour of last draw | Owner only |
| After 1 hour | No one (permanent) |
