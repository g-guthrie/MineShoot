# Mayhem Ownership Map

This document defines the single-owner boundaries for Mayhem's live runtime.

If two systems appear to own the same behavior, treat that as a bug until proven otherwise.

## Core Rule

Mayhem must have one owner for each of these:

- authoritative movement
- authoritative world bounds and collision
- input receipt, queueing, and ack semantics
- hitscan authority
- player identity and socket ownership
- menu launch/runtime state

Everything else should consume those owners, not recreate them.

## Ownership Table

### 1. Movement Authority

Owner:
- [shared/authoritative-movement.js](/Users/gguthrie/Desktop/code%20bs/minecraft-fps/shared/authoritative-movement.js)

Consumed by:
- server authoritative step in [cloudflare/server/room/GlobalArenaRoom.js](/Users/gguthrie/Desktop/code%20bs/minecraft-fps/cloudflare/server/room/GlobalArenaRoom.js)
- client online local step in [js/player.js](/Users/gguthrie/Desktop/code%20bs/minecraft-fps/js/player.js)
- replay correction in [shared/authoritative-reconciliation.js](/Users/gguthrie/Desktop/code%20bs/minecraft-fps/shared/authoritative-reconciliation.js)

Must own:
- forward/back/strafe motion
- jump and jump hold
- gravity
- grounded state
- sprint and ADS move scaling
- collision stepping against authoritative boxes

Must not be reimplemented elsewhere.

### 2. World Bounds and Collision

Owner:
- layout in [shared/world-layout.js](/Users/gguthrie/Desktop/code%20bs/minecraft-fps/shared/world-layout.js)
- headless/server collision build in [shared/world-collision.js](/Users/gguthrie/Desktop/code%20bs/minecraft-fps/shared/world-collision.js)
- rendered world assembly in [js/world.js](/Users/gguthrie/Desktop/code%20bs/minecraft-fps/js/world.js)

Server consumers:
- [cloudflare/server/room/GlobalArenaRoom.js](/Users/gguthrie/Desktop/code%20bs/minecraft-fps/cloudflare/server/room/GlobalArenaRoom.js)
- [cloudflare/server/room/RoomRuntime.js](/Users/gguthrie/Desktop/code%20bs/minecraft-fps/cloudflare/server/room/RoomRuntime.js)
- [cloudflare/server/room/RoomCombatRuntime.js](/Users/gguthrie/Desktop/code%20bs/minecraft-fps/cloudflare/server/room/RoomCombatRuntime.js)

Client consumers:
- [js/player-world.js](/Users/gguthrie/Desktop/code%20bs/minecraft-fps/js/player-world.js)
- [js/hitscan.js](/Users/gguthrie/Desktop/code%20bs/minecraft-fps/js/hitscan.js)
- [js/player-view.js](/Users/gguthrie/Desktop/code%20bs/minecraft-fps/js/player-view.js)

Must own:
- playable bounds
- seam geometry
- biome edge blockers
- spawn exclusion zones
- world collision boxes
- terrain floor heights

Known invariant:
- server and client must derive the same playable bounds and collision field from shared sources.

### 3. Input Receipt, Queueing, and Ack

Owner:
- client send/history in [js/net/runtime-core.js](/Users/gguthrie/Desktop/code%20bs/minecraft-fps/js/net/runtime-core.js)
- server queue/ack in [cloudflare/server/room/RoomRuntime.js](/Users/gguthrie/Desktop/code%20bs/minecraft-fps/cloudflare/server/room/RoomRuntime.js)
- server socket input dispatch in [cloudflare/server/room/RoomSocket.js](/Users/gguthrie/Desktop/code%20bs/minecraft-fps/cloudflare/server/room/RoomSocket.js)

Must distinguish:
- received input seq
- queued input seq
- applied/simulated input seq

Rule:
- only applied/simulated seq may be serialized back to the client as `entity.seq`

If ack happens at receive time, the client will replay against stale authority and jitter.

### 4. Self Reconciliation

Owner:
- [js/net/self-sync.js](/Users/gguthrie/Desktop/code%20bs/minecraft-fps/js/net/self-sync.js)

Consumes:
- authoritative self snapshots from [js/network.js](/Users/gguthrie/Desktop/code%20bs/minecraft-fps/js/network.js)
- pending input history from [js/net/state-view.js](/Users/gguthrie/Desktop/code%20bs/minecraft-fps/js/net/state-view.js)
- replay helper from [shared/authoritative-reconciliation.js](/Users/gguthrie/Desktop/code%20bs/minecraft-fps/shared/authoritative-reconciliation.js)

Must own:
- when to reconcile
- when to replay pending input
- when to ignore identical snapshots
- when to hard snap vs no correction

Must not own:
- an alternate movement model

### 5. Hitscan Authority

Owner:
- [shared/hitscan-authority.js](/Users/gguthrie/Desktop/code%20bs/minecraft-fps/shared/hitscan-authority.js)

Server fire envelope:
- [cloudflare/server/room/RoomCombatRuntime.js](/Users/gguthrie/Desktop/code%20bs/minecraft-fps/cloudflare/server/room/RoomCombatRuntime.js)

Client fire payload:
- [js/net/runtime-access.js](/Users/gguthrie/Desktop/code%20bs/minecraft-fps/js/net/runtime-access.js)

Client feedback:
- [js/net/feedback-sync.js](/Users/gguthrie/Desktop/code%20bs/minecraft-fps/js/net/feedback-sync.js)

Must own:
- ray direction
- spread
- target choice
- world obstruction
- damage hit classification

Known invariant:
- server hit resolution uses the player eye origin, not the third-person shoulder camera fallback, when eye data is available.

### 6. Player Identity and Socket Ownership

Owner:
- client identity in [js/net/auth.js](/Users/gguthrie/Desktop/code%20bs/minecraft-fps/js/net/auth.js)
- websocket upgrade in [cloudflare/server/ws-upgrade.js](/Users/gguthrie/Desktop/code%20bs/minecraft-fps/cloudflare/server/ws-upgrade.js)
- socket replacement in [cloudflare/server/room/RoomTransport.js](/Users/gguthrie/Desktop/code%20bs/minecraft-fps/cloudflare/server/room/RoomTransport.js)

Must own:
- guest/account identity
- socket player id
- actor id
- duplicate socket replacement
- multi-tab identity conflict handling

Known invariant:
- opening a second tab must either create a distinct playable identity or intentionally supersede the older socket. It must never silently create two tabs fighting over one authoritative player state.

### 7. Menu Launch and Runtime State

Owner:
- menu launch flow in [js/app/lobby-controller.js](/Users/gguthrie/Desktop/code%20bs/minecraft-fps/js/app/lobby-controller.js)
- menu session polling in [js/app/lobby-session.js](/Users/gguthrie/Desktop/code%20bs/minecraft-fps/js/app/lobby-session.js)
- gameplay runtime/session bridge in [js/app/runtime-shell.js](/Users/gguthrie/Desktop/code%20bs/minecraft-fps/js/app/runtime-shell.js), [js/app/runtime-session.js](/Users/gguthrie/Desktop/code%20bs/minecraft-fps/js/app/runtime-session.js), and [js/app/runtime-coordinator.js](/Users/gguthrie/Desktop/code%20bs/minecraft-fps/js/app/runtime-coordinator.js)

Must own:
- matchmaking pending state
- room join/create state
- runtime loading
- input capture prompt state
- private room lobby state
- resume vs first-entry behavior

Must not own:
- server room start policy
- gameplay movement logic

## Known Root-Cause Bugs Already Found

These bugs were real and were caused by ownership drift:

- server used stale hardcoded world bounds while client rendered the full 3x3 world
- seam geometry was treated as solid in authoritative collision
- room state probes rebuilt world metadata on every `/state` request
- server acknowledged input seq before simulation
- server collapsed multiple client input samples into one latest state per tick
- client replayed corrections against stale acknowledgements
- online fire payload used the wrong fallback origin

## Debugging Rules

When a live bug appears, check in this order:

1. identity/socket ownership
2. world bounds/collision parity
3. input queue vs ack semantics
4. authoritative movement parity
5. self reconciliation policy
6. hit authority payloads and feedback

Do not start with UI feel tuning unless the correction stream is already known to be clean.

## Practical Rule For Future Changes

For any multiplayer bug fix, add or update:

- one direct unit/integration test on the owning module
- one note in this document if the ownership boundary changed

If a fix touches more than one owner, the change needs a short comment or test proving why.
