# Local Ground-Truth Dev (Cloudflare Worker + WS)

This project is now designed to run the same authority stack locally and in cloud:
- Static assets from Worker
- Auth API from Worker
- World bootstrap from Worker
- Durable Object authoritative simulation over WebSocket
- D1-backed sessions/users/profiles

## Prerequisites

```bash
node -v
npm -v
```

Use Node `>=20` (Wrangler 4 requires Node 20+). If you use `nvm`:

```bash
nvm install
nvm use
```

Install/upgrade Wrangler via `npx` on demand (no global install required).

## One-time setup

1. Login:

```bash
npx wrangler login
```

2. Create local D1 database and copy its `database_id` into `[env.local]` in [wrangler.toml](/Users/gguthrie/Desktop/minecraft-fps/wrangler.toml).

```bash
npx wrangler d1 create minecraft-fps-db-local
```

3. Apply migrations:

```bash
npx wrangler d1 execute minecraft-fps-db-local --file=./migrations/0001_init.sql --env local
npx wrangler d1 execute minecraft-fps-db-local --file=./migrations/0002_auth_security.sql --env local
```

## Daily local run

```bash
./scripts/dev-ground-truth.sh
```

The script starts the Worker in local mode with persistent state.

## Player-parity verification loop

1. Open two browser windows to the same local URL.
2. Login in both windows with username + 4-digit PIN.
3. Verify both players are visible, moving, and synchronized.
4. Run [TWO-WINDOW-SMOKE.md](/Users/gguthrie/Desktop/minecraft-fps/TWO-WINDOW-SMOKE.md).

## Pre-merge parity gate

Run staging remote-dev parity against Cloudflare bindings:

```bash
npx wrangler dev --env staging --remote
```

Then repeat two-window smoke on the staging URL. If behavior diverges from local, block merge.
