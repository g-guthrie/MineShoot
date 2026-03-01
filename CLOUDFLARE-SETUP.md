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
