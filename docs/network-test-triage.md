# Networking Test Triage

This tracker exists so networking tests do not stay green for the wrong reasons.

## Keep

- `tests/actors/player-movement-parity.test.js`
- `tests/gameplay-runtime-loop.test.js`
- `tests/transport.test.js`
- `tests/net/connection-timing.test.js`
- `tests/net/runtime-state.test.js`
- `tests/server/room/room-runtime.test.js`
- `tests/server/room/room-state.test.js`
- `tests/server/room/room-snapshot-runtime.test.js`
- `tests/shared/hitscan-authority.test.js`
- `tests/net/feedback-sync.test.js`

## Rewrite

- `tests/integration/real-worker-multiplayer.test.js`
  The movement smoke currently measures observer snapshot messages more directly than final presented motion.
- `tests/helpers/real-worker-harness.js`
  The harness currently models outbound impairment better than inbound impairment and still exposes direct `sendFire` paths that bypass the real local firing flow.
- `tests/server/room/room-idle-tick.test.js`
  The current test hand-simulates tick logic instead of driving the live room timer path.

## Known Gaps

- Browser Playwright netcode smokes still need serial-run stability before they can replace the last browser-side gap note.

## Covered

- `e2e/netcode-runtime.spec.js`
  - end-to-end shooting through the real local firing path under impaired links
  - live render-path smoke for `js/net/remote-sync.js` under inbound delay/loss/reorder
  - end-to-end owner correction smoke under delay, jitter, loss, and reconnect
  - degraded-viewer cadence proof using unique snapshot sequences in a shared server-time window

The browser netcode smokes intentionally run on the fixed local shared network mode (`single_dev_server` with `local-shared`) so they measure transport behavior instead of public or private room allocation timing.

## Temporary Compatibility Notes

- `npm run test:smoke` is retained as a compatibility alias to `npm run test:all`.
- `npm run test:networking` is the networking gate and should be treated as the required networking guardrail.
