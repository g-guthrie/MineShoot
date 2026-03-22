# net

Owns client protocol, transport, prediction, reconciliation, state views, authoritative sync, and room connection behavior.

Status:
- Rewrite landing zone created.
- Authoritative room, self, match, world, input-history, and queue state now starts in `js/net/runtime-state.js`.
- Net effects and helper state now start in `js/net/effects.js`.
- The public browser networking surface now starts in `js/net/facade.js`.
- The live browser networking surface remains `js/net/network.js`, with ownership split across `js/net/runtime-state.js`, `js/net/runtime-core.js`, `js/net/state-view.js`, `js/net/effects.js`, `js/net/facade.js`, and neighboring helpers.

Networking tests:
- Run `npm run test:networking`.
- This starts the local Wrangler backend, opens multiple headless WebSocket clients, and exercises real room join, movement, server-authoritative damage, reconnect, delayed-input, reload, cooldown, and observer-sync scenarios.
- If you want Codex to run it later, you can simply say: `run the networking tests`.
