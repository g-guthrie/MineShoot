# net

Canonical client networking ownership:

- `js/net/network.js` composes the live browser networking surface.
- `js/net/runtime-state.js` owns authoritative net state, pending input history, and snapshot maps.
- `js/net/runtime-core.js` owns socket lifecycle, input send cadence, and frame-time network updates.
- `js/net/state-view.js` exposes read-only selectors and the self-reconciliation contract.
- `js/net/effects.js` owns net-driven gameplay side effects and spawn sync.
- `js/net/self-motion-sync.js` owns local authoritative motion correction decisions.
- `js/net/remote-entities.js` plus `js/net/interpolation.js` own canonical remote presentation buffering and smoothing.

Rules:

- The browser net lane reads from the live server room path only.
- `state-view` should consume canonical remote presentation data, not re-implement smoothing rules.
- Wiring files should pass data between owners, not hide movement policy.

Validation:

- Run `npm run test:networking` for the explicit Node networking guardrail.
- Run `npm run test:networking:smoke` for the Node guardrail plus the live browser/Worker integration proof.
- Run `npm run test:networking:full` for broader networking-adjacent support coverage.
- Run `npm run test:smoke` for build plus the behavior-first networking smoke gate.
- See [network-debugging.md](/Users/gguthrie/Desktop/Folders%20Lately/code%20bs/minecraft-fps/docs/network-debugging.md) for the canonical debugging path.
