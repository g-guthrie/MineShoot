# Mansion Zombies

Browser-native multiplayer zombies shooter. One Cloudflare URL: the page,
the assets, and the multiplayer rooms all come from a single Cloudflare
Worker — no Node game server, no proxy, no game-engine SDK in production.

## Architecture

```
client (browser)            worker (Cloudflare)
┌──────────────────┐        ┌─────────────────────────────┐
│ Three.js renderer│  WS    │ /api/room/:code/ws          │
│ input → protocol ├───────►│   └► ZombiesRoom (DO)       │
│ HUD (DOM)        │◄───────┤        ticks sim @ 20Hz     │
│ prediction       │ snaps  │        broadcasts snapshots │
└────────┬─────────┘        │ everything else → assets    │
         │ shared code      └─────────────┬───────────────┘
         ▼                                ▼
   ┌──────────┐  pure rules        ┌─────────────┐
   │   sim/   │◄───────────────────┤  protocol/  │ typed messages
   └──────────┘                    └─────────────┘
```

- **`sim/`** — the entire game as pure TypeScript: voxel-map collision,
  player movement, hitscan weapons, zombie/boss AI, waves, economy,
  downed/revive. No sockets, no renderer, no wall clock, no `Math.random`
  (seeded RNG). Unit-tested with vitest. The same movement code runs on the
  server (authority) and in the browser (prediction), so reconciliation
  converges exactly.
- **`protocol/`** — typed WebSocket messages and snapshot building.
  Clients send inputs; they never send game outcomes. All input is
  validated/clamped at the server boundary.
- **`worker/`** — the Worker entrypoint plus `ZombiesRoom`, a Durable
  Object per room code. It accepts WebSockets, applies inputs, ticks the
  sim at 20Hz while anyone is connected, and broadcasts full snapshots.
- **`client/`** — Vite + Three.js. Builds the mansion mesh from
  `terrain.json` with a runtime texture atlas, renders remote entities
  interpolated ~120ms in the past, predicts the local player, and ports the
  reference HUD as a DOM overlay.
- **`assets/`** — terrain, block textures, weapon icons, SFX. Copied into
  the client build and served as Cloudflare static assets.

## Develop

```sh
npm install
npm run dev        # wrangler dev (worker+DO, :8787) + vite (client, :5173)
npm test           # sim unit tests
npm run typecheck  # all four tsconfigs
npm run e2e        # builds nothing; runs two WS clients against wrangler dev
```

Open `http://localhost:5173` (vite, hot reload, proxies /api to wrangler) or
`http://localhost:8787` (the real worker serving the built client — run
`npm run build` first). Two tabs with the same room code join the same room.
`?countdown=5` shortens the 45s lobby countdown for testing.

## Deploy

```sh
npm run deploy
```

CI deploys `main` automatically via `.github/workflows/deploy.yml` using the
`CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` repo secrets.

## Reference builds (do not extend)

The pre-rewrite stacks are kept as gameplay/visual reference only:

- `zombies-game/` — the original Node + Hytopia-SDK game server. The sim's
  rules (weapon stats, wave pacing, economy, revive) were ported from here;
  its `gameConfig.ts` coordinates match `sim/mapConfig.ts`.
- `highchair-game/`, `highchair-client/` — the SDK arena game and forked
  SDK client.
- `scripts/dev-games.sh` — runs the legacy stacks locally.

## Known v1 simplifications

- Enemies chase in a straight line with step-up/jump (no A* pathfinding);
  they pass through windows and barriers like the original by design.
- Snapshots are full-state JSON at 20Hz; delta/binary encoding is a later
  optimization if rooms get big.
- Entities render as capsules; GLB character/weapon models, animations and
  the first-person viewmodel are the next visual milestone.
- A hard cap of 80 live enemies protects the room (the reference had none).
