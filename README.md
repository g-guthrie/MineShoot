# Mayhem Arena PvP

Local browser PvP shooter using the Highchair runtime and the forked
Highchair client. This is the active path because the Highchair animation
engine is part of the game experience.

The old Cloudflare Worker/Durable Object rewrite is not the active runtime.
Keep it as reference code only unless the animation engine is replaced.

## Active Stack

- `highchair-game/` - authoritative Highchair game server, Mayhem arena map,
  deathmatch round flow, bots, weapons, loadouts, building, damage, ranks.
- `highchair-client/` - browser client and rendering/animation engine.
- `highchair-game/assets/maps/mayhem-arena.json` - active PvP world.
- `highchair-game/assets/maps/mayhem-arena.meta.json` - PvP spawn, item, and
  chest metadata generated alongside the arena.
- `scripts/dev-games.sh` - one-command local PvP launcher.
- `scripts/local-highchair-proxy.mjs` - dev-only HTTP/WS proxy from
  `127.0.0.1:8083` to the Highchair TLS server on `127.0.0.1:8082`.

## Run Locally

Install package dependencies once:

```sh
npm --prefix highchair-game install
npm --prefix highchair-client install
```

Start PvP:

```sh
npm run dev
```

Open:

```text
http://localhost:5173/?join=127.0.0.1:8083
```

The script starts:

- PvP server: `https://127.0.0.1:8082`
- Local proxy: `http://127.0.0.1:8083`
- Browser client: `http://localhost:5173`

## Verify

```sh
npm run typecheck
npm run build
```

`npm run build` builds both `highchair-game` and `highchair-client`.

## Map Pipeline

The current arena was built in two steps:

1. `highchair-game/tools/import-boxman.mjs` imports the Boxman/MineShoot world
   into `boxman-arena.json` plus metadata.
2. `highchair-game/tools/build-mayhem.mjs` rebuilds that layout into the
   textured 9-biome `mayhem-arena.json` used by PvP.

Run the Mayhem generator from `highchair-game/` if the arena source changes:

```sh
node tools/build-mayhem.mjs
```

## Archived Reference

The root `client/`, `sim/`, `protocol/`, `worker/`, `e2e/`, and
`wrangler.jsonc` files are from the Cloudflare-native Zombies experiment. They
are not the product direction now.
