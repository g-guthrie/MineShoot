This folder is isolated from the live room path.

Canonical live server authority:

- `cloudflare/server/room/GlobalArenaRoom.js`
- `cloudflare/server/room/RoomRuntime.js`
- `cloudflare/server/room/RoomSnapshotRuntime.js`
- `cloudflare/server/room/RoomState.js`
- `cloudflare/server/room/EntitySerializer.js`

Rules:

- Do not import this folder from live server files.
- Do not use this folder as the source of truth for current multiplayer movement behavior.
- If code here is kept for experiments or future work, it must stay explicitly isolated from the live room path.
