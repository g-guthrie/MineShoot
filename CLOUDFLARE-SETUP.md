# Cloudflare Multiplayer Setup (Single Worker Ground Truth)

The Worker now serves static assets, auth APIs, world bootstrap, and WebSocket authority from one origin.

## 0) Use Node 20+

Wrangler 4 requires Node `>=20`. From repo root:

```bash
nvm install
nvm use
node -v
```

## 1) Authenticate Wrangler

```bash
npx wrangler login
```

If your first deploy returns Cloudflare error `10063`, open the Workers section in the dashboard once to initialize your account `workers.dev` subdomain, then retry deploy.

## 2) Create D1 databases

Run once for each environment you use (`local`, `staging`, `production`):

```bash
npx wrangler d1 create minecraft-fps-db-local
npx wrangler d1 create minecraft-fps-db-staging
npx wrangler d1 create minecraft-fps-db-prod
```

Copy each returned `database_id` into [wrangler.toml](/Users/gguthrie/Desktop/minecraft-fps/wrangler.toml).

## 3) Apply migrations (includes auth hardening)

```bash
npx wrangler d1 execute minecraft-fps-db-local --file=./migrations/0001_init.sql --env local
npx wrangler d1 execute minecraft-fps-db-local --file=./migrations/0002_auth_security.sql --env local

npx wrangler d1 execute minecraft-fps-db-staging --file=./migrations/0001_init.sql --env staging
npx wrangler d1 execute minecraft-fps-db-staging --file=./migrations/0002_auth_security.sql --env staging

npx wrangler d1 execute minecraft-fps-db-prod --file=./migrations/0001_init.sql --env production
npx wrangler d1 execute minecraft-fps-db-prod --file=./migrations/0002_auth_security.sql --env production
```

## 4) Deploy Worker + Durable Object

```bash
npm run cf:deploy:prod
```

No separate Pages deployment is required for core gameplay flow.

## 5) Route your game domain to Worker

Ensure the final domain sends both static and API/WS traffic to this Worker:
- `GET /` and static files
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/me`
- `GET /api/world/bootstrap`
- `GET /api/ws` (WebSocket upgrade)

## 6) Verify parity

1. Run local Worker and open two windows to the same local origin.
2. Login with two users and verify both join one authoritative room.
3. Confirm movement, reconcile, throwables, and beam behavior in both clients.
4. Run the two-window checklist in [TWO-WINDOW-SMOKE.md](/Users/gguthrie/Desktop/minecraft-fps/TWO-WINDOW-SMOKE.md).
