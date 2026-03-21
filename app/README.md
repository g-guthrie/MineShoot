# app

Owns boot, routing, menus, settings, session flow, matchmaking UI, play/start flow, and pause/resume flow.

Status:
- Rewrite landing zone created.
- Gameplay session lifecycle ownership now starts in `js/app/runtime-session.js`.
- Runtime launch and boot ownership now starts in `js/app/runtime-shell.js`.
- Gameplay match actions now start in `js/app/runtime-match-actions.js`.
- Gameplay runtime hosting now starts in `js/app/runtime-match-host.js`.
- Shared runtime assembly now starts in `js/app/runtime-assembly.js`.
- Menu shell rendering now starts in `js/app/lobby-renderer.js`.
- Menu shell behavior now starts in `js/app/lobby-actions.js`.
- Current implementation still lives primarily under `js/app`, with gameplay boot flowing through `js/app/gameplay-modules.js`.

Local verification:
- Browser worker on a caller-supplied port: `WORKER_PORT=8891 WRANGLER_PERSIST_DIR=.wrangler/review-state npm run dev:e2e:worker`
- Frontend on a caller-supplied port: `FRONTEND_PORT=4273 WORKER_PROXY_PORT=8891 npm run dev:frontend:test`
- Playwright on caller-supplied ports: `E2E_FRONTEND_PORT=4273 E2E_WORKER_PORT=8891 npm run test:e2e`
- Reuse an already-running local stack: `E2E_REUSE_SERVERS=1 npm run test:e2e`
