# Authoritative Runtime Audit

## Keep As-Is

- `js/world.js` and `js/world/*`: the authored environment, terrain sampling, collision meshes, and spawn exclusion data already form the world/environment layer we want to preserve.
- `shared/protocol.js`, `shared/gameplay-tuning.js`, `shared/world-layout.js`, `shared/terrain-sampler.js`, `shared/damage.js`, `shared/spawn-logic.js`: these already fit the "canonical truths only" rule for shared code.
- `js/net/transport.js`: transport primitive is small and reusable.
- `js/net/remote-entities.js`: remote visual ownership is presentation-side and should stay outside the pure net runtime.
- `js/player.js`: the current local motion/camera/jump/sprint implementation is the right motor to wrap first rather than rewrite immediately.
- `cloudflare/server/ws-upgrade.js`, `cloudflare/server/matchmaking.js`, `cloudflare/server/transport.js`: they already sit at the transport and allocation edge.

## Wrap And Reuse

- `js/network.js`: keep the public `GameNet` facade for now, but make it an adapter over a pure client net runtime plus the existing remote-visual presenter.
- `js/main.js`: keep the boot and overlay shell, but move gameplay orchestration behind a match/runtime coordinator.
- `js/player-combat.js`: keep combat presentation/state sync, but let the coordinator sequence it.
- `cloudflare/server/room/GlobalArenaRoom.js`: keep the Durable Object boundary, but push player motor and snapshot diffing into dedicated room-runtime modules.
- `cloudflare/server/room/CombatService.js` and `EntitySerializer.js`: keep as reusable canonical simulation helpers.

## Replace

- `js/network.js` internal state ownership: replace with explicit self-channel, remote-channel, event-queue, and client-net runtime owners.
- `js/main.js` gameplay sequencing: replace direct gameplay ownership with a coordinator.
- `GlobalArenaRoom` inlined player movement/respawn/snapshot code: replace with room-runtime modules.

## Target Architecture

### Client Net Runtime

- Owns websocket transport lifecycle.
- Owns input history and periodic input sends.
- Owns snapshot ingest.
- Owns event queues for notices, outgoing damage feedback, incoming damage feedback, and self lifecycle commands.
- Does not know about Three.js, meshes, HUD, or pointer lock.

### Server Room Simulation

- Owns canonical entity state.
- Applies client input into canonical player state through the room player motor.
- Applies authoritative fire and damage through combat helpers.
- Produces snapshot deltas for transport.

### Player Motor

- Client player motor: local movement/jump/look/sprint application, camera, local animation state.
- Server player motor: canonical bounds clamp, terrain floor enforcement, spawn/respawn application, armor regen, and action-lock aware input application.

### Self Authoritative Channel

- Receives backend-assigned identity.
- Tracks authoritative self state, world metadata, match state, and respawn timing.
- Emits self lifecycle commands like initial spawn application and respawn application.

### Remote Entity Channel

- Tracks the remote snapshot set only.
- Emits upsert/remove events to presentation-side remote entity rendering.
- Remains presentation-agnostic itself.

### Event Queue

- Small bounded queues for net-to-runtime handoff.
- Used for notices, combat feedback, and self lifecycle commands.
- Coordinator drains them and forwards them to presentation/runtime owners.

### Match/Runtime Coordinator

- Wires world, player runtime, player combat state, hitscan, net facade, audio, and HUD together.
- Sequences per-frame updates and self command application.
- Does not own gameplay rules or protocol details.
