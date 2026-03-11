# Demonic Master Plan

Purpose:
- Establish the canonical plan for the `Demonic` parallel rebuild.
- Give future threads and parallel agents one reference point for architecture, subsystem boundaries, rollout order, and non-goals.
- Preserve `Mayhem` as the stable reference implementation while `Demonic` is rebuilt beside it.

## Core Intent

`Demonic` is not a live-path refactor.

It is a sibling game path inside the same repo with:
- the same core feel as `Mayhem`
- the same weapon, ability, movement, camera, and hitscan behavior in v1
- better encapsulation
- safer iteration
- a stronger weapon/content/menu pipeline

`Mayhem` remains playable and unchanged while `Demonic` is built.

## High-Level Structure

```text
MAYHEM (unchanged)                    DEMONIC (parallel rebuild)
+------------------+                  +---------------------------+
| current menu     | --button-------> | new menu shell           |
| current runtime  |                  | new gameplay runtime     |
| current sandbox  |                  | same modes + sandbox     |
+------------------+                  +---------------------------+

                 shared truth where needed
         +--------------------------------------+
         | ids | mode registry | protocol | tuning |
         +--------------------------------------+
```

## System Sketch

```text
+-------------------- MAYHEM --------------------+
| current menu / current runtime / unchanged     |
|                                                |
|   [ PLAY MAYHEM ]   [ PLAY DEMONIC ]           |
+--------------------------+---------------------+
                           |
                           v
+----------------------- DEMONIC -----------------------+
|                    Demonic Menu Shell                 |
|         purple Pip-Boy / ASCII / same feature set     |
+--------------------------+----------------------------+
                           |
                           v
+-------------------------------------------------------+
|                 Demonic App Runtime                   |
|                                                       |
|  +------------------- Platform --------------------+  |
|  | bootstrap | router | runtime loader | profile   |  |
|  +----------------------+--------------------------+  |
|                         |                             |
|  +----------------------v--------------------------+  |
|  |                 Match Runtime                   |  |
|  |                                                |  |
|  |  input -> player/camera -> combat -> feedback  |  |
|  |              |            |          |          |  |
|  |              v            v          v          |  |
|  |           world       abilities     UI/HUD      |  |
|  |              \            |          /          |  |
|  |               +------ presentation -----+       |  |
|  |                        |                        |  |
|  |                  avatar / weapons / FX         |  |
|  +------------------------+-----------------------+  |
|                           |                          |
|  +------------------------v-----------------------+  |
|  |            Shared Content + Rules Layer        |  |
|  | weapons | abilities | biomes | tuning | ids    |  |
|  +------------------------+-----------------------+  |
|                           |                          |
|  +------------------------v-----------------------+  |
|  |          Network / Sync / Cloudflare Bridge    |  |
|  +------------------------------------------------+  |
+-------------------------------------------------------+
```

## Architectural Rules

- `Mayhem` is the behavior oracle until `Demonic` reaches parity.
- `Demonic` is a sibling app, not a hidden branch inside the current gameplay runtime.
- Parity comes before redesign.
- Any subsystem in `Demonic` must be testable without booting the whole game.
- Shared contracts should be reused where parity matters: IDs, mode registry, tuning semantics, and protocol shapes.
- New gameplay modes must be defined once and flow automatically into sandbox-capable surfaces.

## Canonical Mode Rule

There must be one canonical mode registry.

That registry drives:
- the main Mayhem mode list
- the Demonic mode list
- sandbox options
- future mode-specific routing and visibility

Modes must not be manually duplicated across menu and sandbox surfaces.

Recommended mode fields:
- `id`
- `label`
- `backendKind`
- `authorityMode`
- `supportsSandbox`
- `supportsDemonic`
- `visibleWhen`
- `rulesetOptions`

## Major Subsystems

### 1. App Shell

```text
+----------------------+
| Demonic Shell        |
| branding             |
| menu boot            |
| runtime loader       |
| route to menu/game   |
+----------+-----------+
           |
           v
+----------------------+
| match session start  |
| or docs/manual       |
+----------------------+
```

Responsibilities:
- app entrypoint
- Demonic branding
- cross-app navigation
- runtime boot routing
- docs/manual routing

Non-goals:
- no gameplay logic here
- no direct ownership of weapons, world, or player state

### 2. Shared Compatibility Layer

```text
+-----------------------------+
| shared compat               |
| movement tuning             |
| weapon stats                |
| ability defs                |
| protocol ids                |
| room/mode contracts         |
+-----------------------------+
```

Responsibilities:
- preserve current `Mayhem` behavior in `Demonic` v1
- mirror shared movement and combat semantics
- keep IDs and protocol-safe contracts stable

Owns:
- movement tuning
- weapon timings
- ability cooldowns and targeting parameters
- loadout defaults
- runtime mode compatibility assumptions

### 3. Menu System

```text
+-----------------------------+
| Demonic Menu                |
| purple Pip-Boy ASCII shell  |
+-------------+---------------+
              |
   +----------+----------+----------+
   v                     v          v
+--------+          +--------+  +--------+
| play   |          | social |  | loadout|
+--------+          +--------+  +--------+
              \         |         /
               \        |        /
                +-------+-------+
                        v
                 launch orchestrator
```

Responsibilities:
- matchmaking surface
- sandbox launch
- social/friends/private rooms
- loadout editing
- docs/manual access

Design direction:
- Pip-Boy ASCII
- purple variant
- better grouping and scanability than current menu
- same features as Mayhem in v1

### 4. Match Runtime

```text
+-------------------------------+
| match runtime                 |
| boot                          |
| subsystem wiring              |
| update loop                   |
| pause/resume                  |
| mode/session state            |
+-------------------------------+
```

Responsibilities:
- create/dispose subsystems
- host the main loop
- manage runtime state transitions
- own match lifecycle

Non-goal:
- avoid a second monolithic `main.js`

### 5. Player and Camera

```text
input ---> movement sim ---> player state ---> camera view
              |                  |                |
              v                  v                v
         collision/world     action locks     ADS/recoil blend
```

Responsibilities:
- input collection
- movement simulation
- player state
- camera state
- action lock evaluation

Parity requirements:
- same sprint feel
- same jump timing
- same ADS blend
- same scope behavior
- same camera offsets

### 6. Combat and Weapons

```text
weapon rules ---> combat runtime ---> hit resolve ---> feedback
      |                 |                 |              |
      v                 v                 v              v
  ammo/reload       spread/FOV       damage/falloff   tracer/muzzle
```

Responsibilities:
- hitscan
- reload/ammo
- weapon selection
- reticle/bloom outputs
- tracer and muzzle state

Weapon structure:
- `rules`
- `presentation`
- `build`

`rules`:
- damage
- spread
- range
- cooldown
- reload
- ammo

`presentation`:
- recoil
- tracer
- audio
- readability

`build`:
- body/receiver
- barrel
- stock
- grip
- scope
- magazine
- muzzle attachment
- foregrip

### 7. Ability Runtime

```text
ability input -> cast validation -> targeting -> local sim -> FX hooks
                                      |
                                      v
                                 network payload
```

Responsibilities:
- cast validation
- target acquisition
- cooldown ownership
- local preview and local sim hooks
- network cast packaging

Parity target abilities:
- choke
- hook
- heal
- missile
- deadeye

### 8. World and Biomes

```text
biome content ---> world assembler ---> collidables/navigation ---> runtime world
```

Responsibilities:
- biome content assembly
- collision geometry
- material recipes
- spawn-safe hooks
- navigation/traversal constraints

V1 target:
- preserve current playability first
- improve biome authoring after parity

### 9. Presentation Runtime

```text
actor state ---> presentation runtime ---> avatar rig ---> weapon builder
      |                   |                    |              |
      +-------------------+--------------------+--------------+
                                      |
                                      v
                               FX / HUD pose state
```

Responsibilities:
- actor presentation
- avatar rig
- weapon builder
- pose state outputs
- FX/HUD hooks

This is where the major structural improvement lives.

Rules:
- simulation does not own presentation
- Demonic gets the weapon-first firearm system
- premium-friendly modular weapon surfaces are first-class

### 10. Networking

```text
transport -> snapshot/state view -> self sync -> remote sync -> feedback sync
```

Responsibilities:
- transport/socket
- snapshot ingest
- room/match state view
- self sync
- remote sync
- feedback sync

V1 rule:
- keep client protocol-compatible with the current server path

### 11. Audio and Feedback

```text
combat/ability/world events ---> feedback bus ---> audio + visual responses
```

Responsibilities:
- weapon audio
- ability audio
- hit feedback
- UI feedback
- event-driven presentation hooks

### 12. Persistence and Profile

```text
auth/profile ---> loadout state ---> menu/game runtime consumption
```

Responsibilities:
- auth/profile access
- persisted loadout state
- menu/game runtime consumption of account state

Rule:
- reuse existing profile/loadout semantics first

### 13. Test and Parity Harness

```text
MAYHEM reference --------+
                         |
                         v
                  parity harness
                         |
                         v
                  DEMONIC output
```

This is mandatory.

Parity checks must cover:
- movement timing
- camera offsets
- ADS blend
- fire/reload/ammo behavior
- ability timing and targeting
- menu launch flow
- sandbox mode behavior
- HUD outputs

Manual review must cover:
- idle
- walk
- sprint
- jump
- ADS
- fire
- reload
- ability states

## 12-Agent Workstream Split

```text
A1  App Shell
A2  Mode Registry
A3  Menu UX
A4  Match Runtime
A5  Player View
A6  Combat Core
A7  Abilities
A8  Presentation
A9  Weapons
A10 World
A11 Networking
A12 Parity QA
```

Detailed ownership:

1. `A1` App Shell
- Demonic app entry, boot routing, and cross-app navigation

2. `A2` Mode Registry
- Canonical runtime mode and sandbox option registry

3. `A3` Menu UX
- Purple Pip-Boy ASCII menu, launch flow, social surfaces, loadout flow

4. `A4` Match Runtime
- Runtime coordinator, lifecycle, loop, and subsystem wiring

5. `A5` Player View
- Input, movement, camera, ADS, sprint, jump, and feel parity

6. `A6` Combat Core
- Hitscan, reload, ammo, bloom, reticle, tracer, and muzzle parity

7. `A7` Ability Runtime
- Ability targeting, cast validation, local sim, cooldowns, and cast prep

8. `A8` Presentation
- Actor runtime, avatar rig, FX hooks, and pose state plumbing

9. `A9` Weapons
- Weapon-first schema, modular gun builder, and skin/readability surfaces

10. `A10` World
- Biome content pipeline, world assembly, collidables, and spawn-safe structure

11. `A11` Networking
- Transport, snapshots, self sync, remote sync, room/session state, and feedback sync

12. `A12` Parity QA
- Regression harness, automated parity checks, and manual A/B approval

## Build Order

```text
1. shell + button + loader
2. mode registry + compat layer
3. Demonic menu
4. match runtime skeleton
5. player/camera parity
6. combat parity
7. ability parity
8. network parity
9. presentation + weapon builder
10. world assembly
11. polish
12. default-path decision later
```

## Folder Shape

```text
/demonic
  /app
  /platform
  /menu
  /runtime
  /shared-compat
  /content
    /modes
    /weapons
    /abilities
    /biomes
    /ui
  /gameplay
    /player
    /combat
    /abilities
    /world
    /presentation
    /audio
    /net
  /tests
    /parity
    /runtime
    /menu
```

## Defaults and Non-Goals

Defaults:
- `Mayhem` remains the default path
- `Demonic` is parallel-only until parity is accepted
- runtime mode surface is preserved, including sandbox
- new modes should auto-flow from one mode registry into sandbox and menu surfaces
- IDs remain stable in v1

Non-goals:
- no server/protocol redesign in v1
- no full animation stack rewrite
- no asset-pipeline overreach before weapon/content formats stabilize
- no “design drift” that turns Demonic into a different game before parity is reached

## First Active Milestones

1. Demonic shell and cross-app routing
2. Canonical mode registry with sandbox derivation
3. Demonic menu parity
4. Match runtime skeleton
5. Player/camera parity harness

## Thread Usage Guidance

Future threads should use this document as the source of truth when:
- assigning subsystem work
- defining boundaries
- deciding if a change belongs in `Mayhem` or `Demonic`
- checking whether a proposed improvement is in scope for parity phase

If a future plan conflicts with this document, update this document first or explicitly note the divergence.
