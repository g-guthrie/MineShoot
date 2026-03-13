# gameplay

Owns player movement, combat, abilities, throwables, HUD, camera, awareness, input, local simulation helpers, and runtime coordination.

Status:
- Rewrite landing zone created.
- Live frame-step ownership now starts in `gameplay/runtime-loop.js`.
- Current implementation still lives primarily under `js/`, `shared/`, and the extracted gameplay loop owner.
