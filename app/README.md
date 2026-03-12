# app

Owns boot, routing, menus, settings, session flow, matchmaking UI, play/start flow, and pause/resume flow.

Status:
- Rewrite landing zone created.
- Gameplay session lifecycle ownership now starts in `js/app/runtime-session.js`.
- Runtime launch and boot ownership now starts in `js/app/runtime-shell.js`.
- Current implementation still lives primarily under `js/app` and selected gameplay orchestration code in `js/main.js`.
