# server

Canonical server networking ownership:

- `cloudflare/server/room/GlobalArenaRoom.js` owns the live authoritative room loop.
- `cloudflare/server/room/RoomRuntime.js` owns queued authoritative input handling, spawn helpers, and live room movement planning.
- `cloudflare/server/room/RoomSnapshotRuntime.js` owns snapshot frame collection and per-viewer sends.
- `cloudflare/server/room/EntitySerializer.js` owns wire-facing entity, projectile, and fire-zone snapshot shapes.
- `cloudflare/server/room/RoomState.js` owns welcome payloads, snapshot payloads, and per-viewer snapshot cadence.

Rules:

- The live room path above is the gameplay truth.
- `cloudflare/server/room/runtime/*.mjs` is not part of the canonical live path and should not be used to reason about current movement behavior.
- Any future experimental room runtime must stay clearly isolated from live imports and live ownership docs.

Validation:

- Run `npm run test:networking` for the stable smoke path that combines real-worker networking and measured correction scenarios.
- Run `npm run test:networking:full` for the broader live-worker and measured correction suites.
- Keep room-runtime, snapshot, serializer, and transport tests green alongside the smoke command.
