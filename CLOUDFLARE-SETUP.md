# Cloudflare Multiplayer Setup

## 1) Install and login

```bash
npm i -g wrangler
wrangler login
```

Use Wrangler for every deploy. Do not rely on GitHub-triggered Pages or Worker deploys for this repo.

After any completed code change, run `npm test` and then manually deploy both the Worker and Pages with Wrangler before considering the task done.

Canonical production URLs:

- Pages: `https://mayhem-9uj.pages.dev/`
- Worker: `https://mayhem.gguthrie-minecraft-fps.workers.dev/`

Treat per-deploy `*.pages.dev` preview aliases as temporary, not canonical.

`wrangler.toml` is the Worker deploy config.
`wrangler.pages.toml` stores the Pages config values.
`npm run stage:pages` builds the Vite bundle into `dist/` and stages the deployable Pages asset tree in `.cf-stage-current/`.

The shipped frontend is split into:

- a lightweight shell that makes `PLAY` interactive immediately
- a lazy-loaded game runtime that loads only after `PLAY`

## 2) Create the Pages project once

```bash
wrangler pages project create mayhem
```

Keep the Pages project disconnected from GitHub. Deploy it directly with Wrangler.

## 3) Create D1 database

```bash
wrangler d1 create minecraft-fps-db
```

Copy the returned `database_id` into `wrangler.toml`.

## 4) Apply schema

```bash
wrangler d1 execute minecraft-fps-db --file=./migrations/0001_init.sql
```

## 5) Deploy the Worker

```bash
npx wrangler deploy --config wrangler.toml
```

## 6) Deploy Pages

```bash
./scripts/stage-pages.sh
cp wrangler.toml /tmp/wrangler.toml.worker.backup
cp wrangler.pages.toml wrangler.toml
npx wrangler pages deploy .cf-stage-current --project-name mayhem --branch main --commit-dirty=true
mv /tmp/wrangler.toml.worker.backup wrangler.toml
```

Wrangler Pages does not support a custom config path for `pages deploy`, so temporarily swap `wrangler.pages.toml` into `wrangler.toml` for the command and then restore the Worker config.

## 7) Deploy both together

```bash
npm test
npx wrangler deploy --config wrangler.toml
./scripts/stage-pages.sh
cp wrangler.toml /tmp/wrangler.toml.worker.backup
cp wrangler.pages.toml wrangler.toml
npx wrangler pages deploy .cf-stage-current --project-name mayhem --branch main --commit-dirty=true
mv /tmp/wrangler.toml.worker.backup wrangler.toml
```

## 8) Route API to Worker

Set a route so your frontend origin can call:
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/me`
- `GET /api/ws` (WebSocket)

## 9) Verify multiplayer

Open two browser windows to the deployed URL:
1. Login with two different usernames and 4-digit PINs.
2. Confirm both users appear in the same arena.
3. Confirm overhead health/armor bars render for bots + other players.
4. Press `H` and verify hitboxes + wallhack circle hide/show together while silhouettes still work in range.

## 10) Unified local dev

Run the default dev command:

```bash
npm run dev
```

This is the same Cloudflare Worker + static asset architecture used in production, served locally through Wrangler.

The shipped menu path is now `QUICK MATCH (FFA)` only.

For frontend-only iteration without the Worker runtime, use:

```bash
npm run dev:frontend
```

## 11) Offline local multiplayer dev

Run the local Worker + local Pages stack:

```bash
./scripts/dev-offline.sh
```

Then open:

- `http://127.0.0.1:8787/`

For guest flow testing, open two tabs and use `QUICK MATCH (FFA)`.

Notes:

- This runs the Worker locally with static assets (`--assets .`) so frontend + `/api` + WebSocket are all same-origin.
- It gives you real client/server multiplayer behavior offline (same WS/backend model, local runtime).
