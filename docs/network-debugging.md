# Networking Debugging

Use this order when debugging multiplayer motion issues.

## 1. Identify the canonical owner

- Local correction policy: `js/net/self-motion-sync.js` plus `js/actors/player.js`
- Shared replay-step building: `shared/authoritative-reconciliation.js`
- Live authoritative input consumption: `cloudflare/server/room/RoomRuntime.js`
- Remote presentation buffering and smoothing: `js/net/remote-entities.js` plus `js/net/interpolation.js`
- Snapshot creation and send cadence: `cloudflare/server/room/RoomSnapshotRuntime.js` plus `cloudflare/server/room/RoomState.js`
- Clock translation and reconnect behavior: `js/net/runtime-core.js`, `js/net/transport.js`, and `js/net/message-router.js`

## 2. Use the smoke command first

- Run `npm run test:networking`
- This covers:
  - real-worker multiplayer movement and reconnect scenarios
  - measured jump/move/shoot correction scenarios

If you need the broader suites after that, run `npm run test:networking:full`.

## 3. Read the right metrics

For correction problems, check:

- correction count
- largest correction distance
- delayed movement convergence
- giant teleport step size
- respawn scheduling after clock alignment

## 4. Ignore stale side paths

- Do not use `cloudflare/server/room/runtime/*.mjs` as the source of truth for live room behavior.
- If live code and an isolated runtime path disagree, the live room path wins.
