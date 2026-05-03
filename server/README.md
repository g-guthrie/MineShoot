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

- Run `npm run test:networking` for the explicit Node networking guardrail.
- Run `npm run test:networking:smoke` for the Node guardrail plus the live browser/Worker integration proof.
- Run `npm run test:networking:full` for broader networking-adjacent support coverage.
- Run `npm run test:smoke` for build plus the behavior-first networking smoke gate.
- Keep room-runtime, snapshot, serializer, and transport tests green alongside the smoke command.
