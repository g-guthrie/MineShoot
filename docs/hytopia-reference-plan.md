# HYTOPIA Reference Plan

Date: March 10, 2026

Primary sources reviewed:
- https://github.com/hytopiagg/sdk
- https://github.com/hytopiagg/hytopia-source
- https://dev.hytopia.com/getting-started/initial-setup

This note is not a migration plan to HYTOPIA. It is a list of ideas worth copying into this repo's existing Three.js + Cloudflare architecture.

## Current repo shape

The current game already has some good building blocks:
- `cloudflare/server/room/GlobalArenaRoom.js` runs the authoritative room simulation and broadcasts snapshots.
- `js/net/network.js` applies authoritative snapshots and exposes the multiplayer client state surface.
- `js/world/world.js` and `js/world/quadrant-*.js` build the world with authored imperative scene code.
- `shared/headless-world-runtime.js` already shows the right instinct: keep a headless world path for non-rendering logic.

The main gaps compared with HYTOPIA are:
- input packets currently include client position and rotation instead of intent-only movement inputs
- all live traffic is effectively on one reliable WebSocket path
- terrain is authored mesh-by-mesh instead of chunk-first data with worker meshing
- mobile support is still mostly "touch can press play", not a real input mode
- there is no map/editor/atlas pipeline for voxel assets

## 1. Networking and authority

### Copy

- Keep the server as the single source of truth for movement, combat, projectiles, and match state.
- Separate fixed simulation rate from network flush rate.
- Split high-frequency pose traffic from reliable gameplay events.
- Add a reconnect window and explicit resync path.
- Move toward binary packets and optional compression for larger payloads.

### Why it matters here

`js/net/network.js` currently maintains the multiplayer client state, while `js/net/runtime-core.js` sends intent packets on a fixed cadence and the room sim resolves the real outcome. That is the right direction, but HYTOPIA's model is stricter: clients send input, the server simulates, and transport/replication are kept even more explicit.

`cloudflare/server/room/GlobalArenaRoom.js` already has the right coarse structure:
- fixed room tick
- separate snapshot cadence
- changed-entity diffing

The next step is to tighten the protocol, not rewrite the whole backend.

### Recommended changes

1. Replace position-in-input with intent-in-input.
   Client to server should send:
   - move axes or forward/back/left/right flags
   - jump, sprint, crouch
   - aim yaw and pitch
   - fire / ability / interact edges
   - local sequence number

2. Simulate player locomotion fully on the server.
   Reuse shared movement constants where possible so local feel stays close, but let the room own final position, velocity, grounded state, and cooldown legality.

3. Split replication into two classes.
   - Unreliable or lossy-tolerant stream: transforms, facing, animation hints, remote camera data.
   - Reliable stream: spawns, despawns, damage events, match state, loadout changes, throws, ability casts, room transitions.

4. Add snapshot acks and periodic full resyncs.
   The current delta/full snapshot approach is good. Make it more explicit with a snapshot id and recovery path when the client detects a hole.

5. Switch from JSON packets to a compact binary format.
   HYTOPIA uses msgpack plus gzip for large payloads. We do not need their exact stack, but we should stop paying JSON costs for high-rate snapshots.

6. Add a reconnect grace window.
   Preserve room/player state for a short interval and allow fast socket replacement instead of treating every close as a hard leave.

### Suggested local targets

- `js/net/network.js`
- `js/net/transport.js`
- `cloudflare/server/room/GlobalArenaRoom.js`
- `shared/protocol.js`
- `shared/hitscan-authority.js`

## 2. Voxel client architecture and chunk meshing

### Copy

- Treat terrain as chunked world data, not just authored scene meshes.
- Build chunk geometry off the main thread.
- Rebuild only dirty chunks or chunk batches.
- Add view-distance based scene attachment/removal.
- Keep server/headless collision data derived from the same terrain source.

### Why it matters here

This repo's world is currently authored in code through biome and quadrant builders. That gives art control, but it does not scale to:
- large editable spaces
- procedural terrain
- selective rebuilds
- map tooling
- cheap LOD or view-distance control

HYTOPIA's useful pattern is not "voxel look". It is the architecture:
- chunk lattice as source of truth
- worker meshing
- batched geometry
- dirty-region rebuilds

### Recommended changes

1. Introduce a terrain data model separate from render meshes.
   Start with a small chunk format for solid blocks, materials, and flags. Keep props and bespoke set pieces outside that system at first.

2. Add a worker meshing pipeline.
   The first version can be simple face culling plus typed arrays. Greedy meshing and AO can come after the pipeline exists.

3. Batch terrain by chunk groups.
   HYTOPIA batches multiple chunks and adds or removes those meshes from the scene by distance. That is a good fit for this game's arena if we want denser terrain without main-thread spikes.

4. Reuse one terrain source for render and collision.
   `shared/headless-world-runtime.js` is already the seed of this idea. Extend it so terrain collision, spawn validation, and future editor output all read the same world data.

5. Keep authored hero pieces outside the voxel system.
   Waterfalls, custom biome landmarks, and one-off set dressing do not need to become blocks on day one.

### Suggested local targets

- `js/world/world.js`
- `shared/world-layout.js`
- `shared/world-collision.js`
- `shared/headless-world-runtime.js`
- new files under `js/world/worker-*` or `js/world/chunks/*`

## 3. Mobile and input handling

### Copy

- Make mobile a first-class input path, not a desktop fallback.
- Separate input abstraction from gameplay code.
- Send continuous camera and movement updates at a controlled rate.
- Support dual-stick touch controls and pinch zoom.
- Allow pointer lock to be temporarily decoupled when UI is open.

### Why it matters here

Current local input is still desktop-first:
- `js/actors/player.js` assumes pointer lock for real play
- the current gameplay handoff still assumes pointer lock and only lightly handles touch
- there is no joystick layer, touch camera layer, or mobile-specific UI behavior

HYTOPIA's `InputManager` and `MobileManager` are worth copying almost directly as patterns.

### Recommended changes

1. Add a `GameInput` module that becomes the only place reading browser input events.
2. Move keyboard, mouse, touch, and future gamepad state behind one normalized input shape.
3. Add mobile controls:
   - left stick for movement
   - right stick for camera
   - tap buttons for fire, jump, ability, reload, throwables
   - pinch for zoom or sensitivity-adjusted aim modifier
4. Rate-limit continuous input sends separately from one-shot actions.
5. Allow menus and overlays to temporarily release pointer lock without breaking held-input state.

### Suggested local targets

- `js/actors/player.js`
- `js/app/runtime-session.js`
- `js/app/runtime-coordinator.js`
- `js/presentation/ui.js`
- `js/net/network.js`
- new files under `js/input/*`

## 4. World editor and asset pipeline

### Copy

- Use a data format for maps instead of only imperative JS builders.
- Introduce an asset folder convention for blocks, maps, props, audio, and UI.
- Generate and cache a block texture atlas.
- Keep import/export simple enough that an editor can target it later.

### Why it matters here

The current authored-world approach is fast for custom arena work but weak for iteration by non-programmers. HYTOPIA's `map.json`, `World.loadMap`, and atlas generation pipeline make the tooling path obvious:
- maps are portable data
- textures are standardized assets
- runtime loading is deterministic

### Recommended changes

1. Define a repo asset layout.
   Example:
   - `assets/blocks`
   - `assets/maps`
   - `assets/models`
   - `assets/audio`

2. Add a map schema for terrain and authored props.
   Keep it simple:
   - block types
   - block placements or chunk payloads
   - entity/prop placements
   - spawn points
   - biome metadata

3. Build a texture-atlas script.
   Use a cached manifest so atlas rebuilds happen only when inputs change.

4. Convert one existing arena slice to data.
   Do this before committing to a full editor path.

5. Only then evaluate editor UX.
   The runtime data model should exist before picking an editor.

### Suggested local targets

- `scripts/`
- `shared/world-layout.js`
- `js/world/quadrant-*.js`
- new `assets/` and `maps/` folders

## Proposed adoption order

### Phase 1: protocol cleanup

Goal:
- stronger authority without changing the visual world pipeline

Work:
- move client packets to intent-only movement
- add sequence ids and clearer snapshot ids
- classify reliable vs lossy-tolerant messages
- add reconnect/resync behavior

### Phase 2: mobile input

Goal:
- playable touch build without requiring pointer lock

Work:
- create normalized input module
- add dual-stick controls
- add mobile HUD buttons
- preserve desktop input behavior

### Phase 3: chunk terrain prototype

Goal:
- prove worker meshing and chunk-based collision on one biome or test map

Work:
- create a minimal chunk data model
- build worker meshing path
- attach/detach chunk meshes by distance
- feed shared collision from the same terrain data

### Phase 4: data-driven map pipeline

Goal:
- reduce level iteration cost and unlock future editor work

Work:
- define map schema
- add atlas generation
- load one map from data
- keep custom hero props as authored JS until needed

## What not to copy

- HYTOPIA's full platform assumptions: hosting model, client shell, world switching, platform auth.
- A wholesale move to their engine abstractions.
- Their exact rendering stack. The useful part is worker meshing and batching, not the whole renderer.

## Best immediate next step for this repo

If we want maximum return with minimum rewrite, do these in order:

1. Tighten the network protocol around intent-only input and stronger server simulation.
2. Add a proper input abstraction with mobile controls.
3. Prototype chunk meshing in one isolated test arena.

That order improves cheat resistance and device support now, while setting up the larger terrain/tooling work without forcing a big-bang rewrite.
