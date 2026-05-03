# Networking Test Triage

This tracker exists so networking tests do not stay green for the wrong reasons.

## Current Gates

- `npm run test:networking`
  - Canonical behavior-first Node networking guardrail.
  - Uses explicit file lists, not broad `tests/net/*.test.js` or `tests/server/room/*.test.js` wildcards.
  - Covers owner-player correction, transport/reconnect, jitter-buffering, state-view wiring, server room runtime, snapshot deltas, socket handling, combat rewind, and hit feedback.
- `npm run test:networking:integration`
  - Real Playwright plus local Worker guardrail.
  - Runs:
    - `e2e/live-websocket-gameplay.spec.js`
    - `e2e/quick-match-handoff.spec.js`
    - `e2e/social.spec.js`
- `npm run test:smoke`
  - Build plus `test:networking:smoke`.
  - This is the high-signal default smoke for networking correctness.
- `npm run test:networking:full`
  - Broader networking-adjacent coverage, including auth/client helpers, room rules, private-room config, architecture ownership guards, and the live browser/Worker integration proof.
  - Use this when changing surrounding room or auth behavior; do not treat every included test as smoke proof.
- `npm run test:full`
  - Build plus every Node test plus every Playwright spec.
  - Use this for broad release confidence, not as the fast networking smoke.

## Keep As Networking Proof

- `tests/net/runtime-state.test.js`
- `tests/net/network-runtime.test.js`
- `tests/net/runtime-core.test.js`
- `tests/net/commands.test.js`
- `tests/net/join-state.test.js`
- `tests/net/network-state-view-wiring.test.js`
- `tests/net/remote-entities.test.js`
- `tests/net/remote-sync.test.js`
- `tests/net/connection-timing.test.js`
- `tests/transport.test.js`
- `tests/server/room/entity-serializer.test.js`
- `tests/server/room/room-helper-stack.test.js`
- `tests/server/room/room-idle-tick.test.js`
- `tests/server/room/room-runtime.test.js`
- `tests/server/room/room-snapshot-runtime.test.js`
- `tests/server/room/room-state.test.js`
- `tests/server/room/room-socket.test.js`
- `tests/server/room/room-transport.test.js`
- `tests/server/room/projectile-service.test.js`
- `tests/shared/authoritative-reconciliation.test.js`
- `tests/shared/authoritative-movement.test.js`
- `tests/shared/hitscan-authority.test.js`
- `tests/net/feedback-sync.test.js`
- `e2e/live-websocket-gameplay.spec.js`
- `e2e/quick-match-handoff.spec.js`
- `e2e/social.spec.js`

## Do Not Treat As Networking Proof

- `tests/net/auth-client.test.js`
  - Useful auth/session/client security coverage, but not a motion, transport, or snapshot proof.
- `tests/net/state-view.test.js`
  - Useful selector coverage, but historically contained implementation-shape assertions. Smoke should prove the state-view wiring path instead.
- `tests/server/room/room-loadout.test.js`
  - Useful loadout/game-state coverage, not a networking quality gate.
- `tests/server/room/room-match.test.js`
  - Useful match rules, not transport or interpolation proof.
- `tests/server/room/room-private-config.test.js`
  - Useful private-room config coverage, not a core live socket proof.
- `tests/server/room/canonical-runtime-ownership.test.js`
  - Useful architecture guard, but lint-like rather than runtime behavior.
- `tests/server/lobby-smoke.test.js`
  - Useful API coverage, but it is a fake-D1 handler suite, not a live socket or motion proof.
- `e2e/menu-shell.spec.js`
  - Useful UI/layout coverage, but not a networking quality gate.
- `e2e/weapon-swap-input.spec.js`
  - Useful browser input wiring coverage, but not a transport, snapshot, or reconciliation proof.

## Removed Stale Assumptions

- There is no current `e2e/netcode-runtime.spec.js` gate.
- There is no current `tests/integration/real-worker-multiplayer.test.js` gate.
- `test:smoke` is not an alias for all tests. It is the build plus networking proof gate.

## Remaining Gaps

- Add an end-to-end browser impairment proof that drives inbound delay, loss, and reordering against final presented remote motion.
- Add an end-to-end owner correction proof under delay, jitter, loss, and reconnect.
- Keep thresholds tied to visible behavior: final presented motion, correction magnitude, and stale-frame rejection matter more than raw message counts.
