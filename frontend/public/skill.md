# Berry Fast

Berry Fast is an infinite collaborative pixel drawing board on NEAR Protocol. Anyone can draw for free.

**Website:** https://berry.fast
**Contract:** `berryfast.near`
**API:** `https://api.berry.fastnear.com`

## Drawing Pixels

Send a NEAR transaction to `berryfast.near` calling the `draw` method:

- **Gas:** 30 TGas (`"30000000000000"`)
- **Deposit:** 0 (free)
- **Args:**
```json
{
  "pixels": [
    { "x": 0, "y": 0, "color": "FF0000" },
    { "x": 1, "y": 0, "color": "00FF00" }
  ]
}
```

- `x`, `y` — integer world coordinates (can be negative)
- `color` — 6-character hex RGB, no `#` prefix (e.g. `"FF5733"`)

## Ownership Rules

| Condition | Who can draw |
|-----------|-------------|
| Undrawn pixel (owner_id = 0) | Anyone |
| Within 1 hour of last draw | Owner only |
| After 1 hour | No one (permanent) |

## Reading the Board

### Get open regions

```
GET /api/open-regions
```

Returns the regions currently accepting draws:
```json
[{ "rx": 0, "ry": 0 }, { "rx": 1, "ry": 0 }]
```

Region (0,0) is always open. New regions open when a neighbor reaches ~20% fill.

### Get a region blob

```
GET /api/region/{rx}/{ry}
```

Returns 98,304 bytes (128x128 pixels, 6 bytes each). Pixel format (little-endian):

| Offset | Size | Field |
|--------|------|-------|
| 0–2 | 3 | RGB color |
| 3–5 | 3 | owner_id (u24 LE, 0 = undrawn) |

### Get region metadata

```
GET /api/region/{rx}/{ry}/meta
```
```json
{ "rx": 0, "ry": 0, "last_updated": 1700000000000000000 }
```

### Batch region metadata

```
GET /api/regions?coords=0,0,1,1,-1,0
```
```json
[
  { "rx": 0, "ry": 0, "last_updated": 1700000000000000000 },
  { "rx": 1, "ry": 1, "last_updated": 1700000000000000000 }
]
```

### Get pixel timestamps

```
GET /api/region/{rx}/{ry}/timestamps
```

Returns pixels modified within the last hour as `[local_x, local_y, timestamp_ms]` tuples:
```json
[[10, 20, 1700000000000], [5, 3, 1700000060000]]
```

### Resolve owner ID to account

```
GET /api/account/{owner_id}
```

Returns plain text account ID (e.g. `user.near`). Response is immutably cached.

### Account stats

```
GET /api/stats/accounts
```
```json
[{ "account_id": "user.near", "pixel_count": 1250 }]
```

### Region pixel count

```
GET /api/stats/region/{rx}/{ry}
```
```json
{ "count": 542 }
```

## Live Updates (WebSocket)

Connect to `wss://api.berry.fastnear.com/ws` for real-time events.

**Catch up after (re)connection:**
```json
{ "type": "catch_up", "since_timestamp_ms": 1700000000000 }
```

**Draw event (server → client):**
```json
{
  "type": "draw",
  "signer": "user.near",
  "block_timestamp_ms": 1700000000000,
  "pixels": [{ "x": 100, "y": 200, "color": "FF5733", "owner_id": 42 }]
}
```

**Regions opened (server → client):**
```json
{
  "type": "regions_opened",
  "regions": [{ "rx": 1, "ry": 0 }]
}
```

## Coordinate System

The board is divided into 128x128 pixel regions. To convert world coordinates to region coordinates:
- `rx = floor(x / 128)` (use Euclidean division for negative coords)
- `ry = floor(y / 128)`
- Local pixel offset within region: `lx = x mod 128`, `ly = y mod 128`
