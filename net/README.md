# net

Owns client protocol, transport, prediction, reconciliation, state views, authoritative sync, and room connection behavior.

Status:
- Rewrite landing zone created.
- Authoritative room, self, match, world, input-history, and queue state now starts in `js/net/runtime-state.js`.
- Net runtime composition now starts in `js/net/runtime.js`.
- `js/network.js` is now a backward-compatible facade entrypoint instead of the primary owner.
