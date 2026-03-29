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
  - owner-player correction and runtime handoff
  - transport, reconnect, stale-packet, and clock behavior
  - remote interpolation and state-view helpers
  - server room runtime, snapshot, serializer, and socket behavior
  - combat, rewind, and hit-feedback behavior
  - real-worker multiplayer integration scenarios

If you need the full repo-wide sweep after that, run `npm run test:all`.

Useful slices while debugging:

- `npm run test:networking:owner`
- `npm run test:networking:transport`
- `npm run test:networking:client`
- `npm run test:networking:server`
- `npm run test:networking:combat`
- `npm run test:networking:integration`

## 2.5. Remember the shipped input baseline

- The runtime base input cadence is intentionally `60 Hz`.
- It is not “60 Hz only”.
- Immediate sends still happen on jump, movement state changes, look deltas, and cumulative unsent drift.
- When debugging packet volume, treat the 60 Hz interval as the idle floor, not the whole policy.

## 3. Read the right metrics

For correction problems, check:

- correction count
- largest correction distance
- delayed movement convergence
- giant teleport step size
- respawn scheduling after clock alignment

For trust problems in the suite itself, check:

- whether the test is driving the real owner path or only helpers
- whether it measures final presented motion or only raw snapshots
- whether it covers server-to-client impairment, not just client-to-server impairment
- whether a passing result depends on loose thresholds that still allow visible hitching

## 4. Ignore stale references

- The old alternate room-runtime path has been removed.
- If you find older notes or historical discussion that mention it, use the canonical live room files listed above instead.
