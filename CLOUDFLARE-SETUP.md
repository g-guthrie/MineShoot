# Cloudflare Multiplayer Setup

## 1) Install and login

```bash
npm i -g wrangler
wrangler login
```

## 2) Create D1 database

```bash
wrangler d1 create minecraft-fps-db
```

Copy the returned `database_id` into `wrangler.toml`.

## 3) Apply schema

```bash
wrangler d1 execute minecraft-fps-db --file=./migrations/0001_init.sql
```

## 4) Create Durable Object migration and deploy Worker

```bash
wrangler deploy
```

## 5) Deploy frontend (Cloudflare Pages)

Deploy this repository to Cloudflare Pages and make sure the frontend build runs `npm run build` with `dist/` as the output directory.

## 6) Route API to Worker

Set a route so your frontend origin can call:
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/me`
- `GET /api/ws` (WebSocket)

Backend ownership notes:

- `cloudflare/worker.js` is the primary backend entrypoint.
- `functions/api/[[path]].js` is intentional Pages proxy glue for the same `/api/*` contract. Keep it only as compatibility routing, not as a second backend source of truth.

## 7) Repo map

- `js/` contains the browser runtime, menu flow, and gameplay client code.
- `cloudflare/` contains the Worker runtime and server-side room, auth, and matchmaking code.
- `shared/` contains gameplay, protocol, and tuning code shared by client and Worker.
- `tests/` contains node-driven tests; `e2e/` contains Playwright browser flows.
- `functions/` contains the Pages proxy compatibility surface for `/api/*`, not the primary backend implementation.
- `dist/` is generated output only. Do not treat it as source, and do not recreate `.cf-deploy/`.

## 8) Verify multiplayer

Open two browser windows to the deployed URL:
1. Login with two different usernames and 4-digit PINs.
2. Confirm both users appear in the same arena.
3. Confirm overhead health/armor bars render for bots + other players.
4. Press `H` and verify hitboxes + wallhack circle hide/show together while silhouettes still work in range.

## 9) Unified local dev

Run the default dev command:

```bash
npm run dev
```

This serves the same Cloudflare Worker + static asset architecture used in production, locally through Wrangler, using the current `dist/` build output.

If `dist/` is missing or stale, rebuild it first:

```bash
npm run build
```

The localhost menu now exposes four runtime modes:

- `Multiplayer Cloudflare`
- `Single Cloudflare`
- `Single Dev Server`
- `Single Full Sandbox`

Use `Single Dev Server` for the fast local client/server loop. Use `Single Full Sandbox` only for offline experiments.

For frontend-only iteration without the Worker runtime, use:

```bash
npm run dev:frontend
```

Generated directory notes:

- `dist/` is the only supported frontend build artifact for local serving and deploy validation.
- `.wrangler/` stores local Worker state and logs.
- Git history is the archive for the removed `.cf-deploy/` legacy bundle. Do not recreate or recommit it.

## 10) Offline local multiplayer dev

Run the local Worker + local Pages stack:

```bash
./scripts/dev-offline.sh
```

Then open:

- `http://127.0.0.1:8787/`

For guest flow testing, open two tabs and click `Multiplayer` in both tabs.

Notes:

- This runs the Worker locally with static assets from `dist/`.
- `dist/` is the only supported local asset bundle. If it is missing or stale, run `npm run build`.
- It gives you real client/server multiplayer behavior offline (same WS/backend model, local runtime).

## 11) Repeatable deploy checklist

Use this exact flow when you want to push current work to production again.

Important:

- A "push" is not complete when only the Worker/backend is deployed.
- A "push" is only complete when all three are true:
  1. `main` is pushed to GitHub
  2. the Worker/backend deploy is live
  3. the Pages/frontend deploy is live and serving the new build
- If the frontend is still serving the previous Pages build, treat the push as incomplete.

### A) Verify locally

Build first:

```bash
npm run build
```

Run the targeted tests you care about, or at minimum the current smoke path:

```bash
node --experimental-default-type=module --test tests/app/menu-click-paths.test.js
```

For a local Cloudflare-style run before shipping:

```bash
npm run dev
```

Open:

- `http://127.0.0.1:8787/`

### B) Push to `main`

Check the worktree:

```bash
git status -sb
```

Commit and push:

```bash
git add -A
git commit -m "Describe the change"
git push origin main
```

Do not stop here. This only triggers the Pages/frontend deploy. It does not mean the new frontend is already live.

### C) Deploy the Worker/backend

Deploy the Worker with the repo-local Wrangler wrapper:

```bash
./scripts/wrangler.sh deploy
```

Expected backend URL for this project:

- `https://mayhem.gguthrie-minecraft-fps.workers.dev`

### D) Pages/frontend note

The frontend Pages deploy is Git-driven from `main`.

Current frontend URL:

- `https://mayhem-9uj.pages.dev/`

That means:

- pushing `main` is the Pages/frontend deploy trigger
- `wrangler deploy` updates the Worker/backend/API side

Important:

- `git push origin main` only starts the Pages deploy.
- You still need to verify that the Pages site is actually serving the new frontend before calling the push complete.
- If Pages is delayed, still building, or failed, the push is not done.

### E) Quick verification

Check both endpoints respond:

```bash
curl -I https://mayhem.gguthrie-minecraft-fps.workers.dev/
curl -I https://mayhem-9uj.pages.dev/
```

Then verify the live frontend actually contains the expected change, not just a `200`:

```bash
curl -s https://mayhem-9uj.pages.dev/ | rg "some-expected-marker-from-your-change"
```

Examples:

- a new button id
- a changed button label
- a new asset hash if you know which bundle changed

If the expected marker is missing, the Pages/frontend deploy has not gone live yet.

If you want to verify the exact pushed commit:

```bash
git rev-parse --short HEAD
```

Definition of done for production pushes:

- GitHub `main` contains the commit you expect
- Worker deploy succeeded
- Pages site is live with the new frontend behavior you changed
