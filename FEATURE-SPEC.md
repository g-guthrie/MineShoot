# Feature Spec: MAYHEM Web FPS MVP

## Product Goal
Fast browser shooter with one-click session entry:
- Open URL
- Menu is immediately interactive
- Click `PLAY`
- Enter a live room quickly on almost any machine

The design priority is low complexity for strong frame pacing and network responsiveness while still delivering strong visual identity.

## Runtime Architecture
- Entry HTML: `index.html`
- Startup handoff: `js/shell.js`
- Runtime composition entry: `js/app/runtime-entry.js`
- Shared cross-runtime config: `shared/protocol.js`, `shared/gameplay-tuning.js`
- Server authority: Cloudflare Worker + Durable Object room

## Current Menu
- Single entrypoint: `PLAY`
- Runtime profile: public authoritative FFA
- Backend path: Cloudflare Worker matchmaking + Durable Object room

## Environment V2 (Phases 1-4 Implemented)

### Phase 1: Visual Foundation
- Prototype ground grid removed from default view.
- Debug grid only via URL: `?debugGrid=1` (also supports `true`/`on`).
- Deterministic ground color breakup with biome blending.
- Updated sky/fog palette for better biome readability.
- Renderer pixel ratio capped to reduce high-DPI spikes.

### Phase 2: Landmark Pass
- Deterministic desert mesa/cliff landmark clusters.
- Deterministic arctic mountain hero landmark with stepped traversal surfaces.
- Landmark spawn exclusion zones to avoid invalid spawns inside hero geometry.
- Central combat readability preserved (no over-cluttering of core lanes).
- Open sightline density rebalance: jungle `-40%`, arctic/desert `-60%`.

### Phase 3: Waterfall Hero Feature
- Static rock cut + basin geometry.
- Waterfall planes with animated UV scrolling.
- Lightweight mist cards (no heavy particle systems).
- `GameWorld.update(dtSec)` introduced for world animation updates.
- Main loop calls `GameWorld.update(dtSec)` every frame.

### Phase 4: Multiplayer Safety Hardening
- Server sends authoritative world metadata on `WELCOME`:
  - `worldSeed: string`
  - `worldProfileVersion: number`
  - `worldFlags: { envV2: boolean, terrainPhysicsV2: boolean }`
- Client uses server metadata for multiplayer world generation.
- Deterministic world generation preserved across clients in a room.
- Fallback path exists if metadata is missing/timed out, with warning notice.

## Phase 5: Terrain Authority Sync (Human Players)
- Shared deterministic terrain sampler is used by browser and Cloudflare Worker runtime.
- Server-side human-player grounding now samples terrain for:
  - Input y-floor clamping
  - Player spawn/respawn y placement
  - Projectile terrain impact and bounce checks
- Terrain physics remains rollback-safe through `worldFlags.terrainPhysicsV2`.

Out of scope for this phase:
- Bot-specific locomotion updates are intentionally deferred.

## Current Public Interfaces
- `GameWorld.create(scene, options?)`
  - `options.worldMeta` accepted for multiplayer-authoritative world boot.
- `GameWorld.update(dtSec)`
- `GameWorld.getWorldMeta()`
- `GameNet.getWorldMeta()`
- `GameNet.getExpectedWorldMeta()`

## Determinism and Performance Constraints
- Decorative movement favors UV/card animation over heavy simulation.
- Deterministic seed/profile controls landmark placement.
- Pixel ratio cap used in renderer bootstrap + resize paths.
- No post-processing requirement.
- Startup path should stay lazy and chunked.

## Acceptance Checklist
- [ ] `PLAY` launches the public authoritative room path.
- [ ] Grid hidden by default; visible only with `?debugGrid=1`.
- [ ] Desert/arctic landmarks spawn deterministically for same world seed.
- [ ] Waterfall animates continuously without large frame-time spikes.
- [ ] Multiplayer clients in same room receive identical world metadata.
- [ ] Core combat loop (join/input/fire/throw/damage) has no regression.
- [ ] Human-player terrain authority remains deterministic across browser/server for a room seed.
- [ ] Human player y never sinks below sampled terrain eye height on server.
- [ ] Server projectile terrain impacts use sampled ground height (not hardcoded zero plane).
