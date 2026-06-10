# MineShoot

Online browser multiplayer Minecraft-style arena shooter.

A clean-slate rebuild around the original procedural world environment:
nine biome quadrants (arctic, desert, jungle, quarry, volcano, pirate cove,
river arches, nuclear, whoville) built entirely from blocky three.js
geometry, with the classic blocky avatar rig and the toon-shooter weapon
assets.

## Gameplay

- Free-for-all deathmatch in one shared arena room
- Four hitscan weapons: AK, shotgun, sniper, revolver (keys 1-4 / wheel)
- Right-click places blocks on a grid (Minecraft-style building);
  blocks are shared with everyone, block movement, and break after 3 hits
- Blocks regenerate over time, up to a carried cap

## Architecture

| Layer | Location | Notes |
|---|---|---|
| Client | `index.html`, `src/` | three.js, pointer-lock FPS, snapshot interpolation |
| World | `js/world/`, `shared/world-*.js` | procedural arena, shared AABB collision |
| Movement | `shared/authoritative-movement.js` | deterministic solver tuned to the world |
| Avatars | `src/avatar-rig.js` | classic blocky humanoid rig (pre-boxman) |
| Server | `server/` | Cloudflare Worker + `GlobalArenaRoom` Durable Object |
| Shared combat | `shared/combat.js` | weapon/block tuning used by client and server |

The server relays client-simulated movement and validates combat
(fire-rate, range, health, kills, block ownership) so scores stay honest.

## Development

```bash
npm install
npm run dev:server   # wrangler dev on :8787 (the arena room)
npm run dev          # vite on :3000, proxies /api/ws to the worker
```

Open http://127.0.0.1:3000 in two windows to play against yourself.

## Tests

```bash
npm run build
npm test             # playwright: boots worker + preview, two-client smoke
```

## Deploy

```bash
npm run deploy:prod  # worker (wrangler.worker.toml) + Cloudflare Pages (dist/)
```

`blender-assets/` contains the Blender authoring sources for the world
geometry; they are not loaded at runtime.
