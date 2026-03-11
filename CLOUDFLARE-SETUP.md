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

Deploy this repository to Cloudflare Pages and make sure static assets are served from the project root.

## 6) Route API to Worker

Set a route so your frontend origin can call:
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/me`
- `GET /api/ws` (WebSocket)

## 7) Verify multiplayer

Open two browser windows to the deployed URL:
1. Login with two different usernames and 4-digit PINs.
2. Confirm both users appear in the same arena.
3. Confirm overhead health/armor bars render for bots + other players.
4. Press `H` and verify hitboxes + wallhack circle hide/show together while silhouettes still work in range.

## 8) Unified local dev

Run the default dev command:

```bash
npm run dev
```

This is the same Cloudflare Worker + static asset architecture used in production, served locally through Wrangler.

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

- `dist/` is the primary Vite build output.
- `.wrangler/` stores local Worker state and logs.
- `.cf-deploy/` is a quarantined legacy asset bundle kept only for compatibility/manual staging.

## 9) Offline local multiplayer dev

Run the local Worker + local Pages stack:

```bash
./scripts/dev-offline.sh
```

Then open:

- `http://127.0.0.1:8787/`

For guest flow testing, open two tabs and click `Multiplayer` in both tabs.

Notes:

- This runs the Worker locally with static assets from `.cf-deploy/`, which is kept as a quarantined legacy compatibility bundle.
- `dist/` remains the main frontend build output; `.cf-deploy/` is not the primary source of truth for app code.
- It gives you real client/server multiplayer behavior offline (same WS/backend model, local runtime).

## 10) Repeatable deploy checklist

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
node --experimental-default-type=module --test tests/menu-click-paths.test.js
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

`main` pushes can deploy the Worker automatically through GitHub Actions if these repo secrets are set:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

The workflow lives at [.github/workflows/deploy-worker.yml](/Users/gguthrie/Desktop/code%20bs/minecraft-fps/.github/workflows/deploy-worker.yml).

Manual fallback:

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
- if the GitHub Action secrets are set, the same push also deploys the Worker/backend/API side
- without those secrets, use `./scripts/wrangler.sh deploy`

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
