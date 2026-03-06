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

## 9) Offline local multiplayer dev

Run the local Worker + local Pages stack:

```bash
./scripts/dev-offline.sh
```

Then open:

- `http://127.0.0.1:8787/`

For guest flow testing, open two tabs and click `Multiplayer` in both tabs.

Notes:

- This runs the Worker locally with static assets (`--assets .`) so frontend + `/api` + WebSocket are all same-origin.
- It gives you real client/server multiplayer behavior offline (same WS/backend model, local runtime).
