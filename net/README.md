# net

Owns client protocol, transport, prediction, reconciliation, state views, authoritative sync, and room connection behavior.

Status:
- Rewrite landing zone created.
- Authoritative room, self, match, world, input-history, and queue state now starts in `js/net/runtime-state.js`.
- Active multiplayer client entrypoint is `js/net/network.js`.
- Connection lifecycle and send cadence live in `js/net/runtime-core.js`.
