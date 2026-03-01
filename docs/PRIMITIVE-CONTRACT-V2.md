# Primitive Contract v2

## Purpose
Define one shared contract for coordinates, entity primitives, rig primitives, and network payloads so simulation, rendering, and animation all reference the same foundations.

## Canonical Coordinates
1. World basis: right-handed, `+Y` up.
2. Entity origin: feet center (`x`, `feetY`, `z`).
3. Camera and sockets derive from feet-origin offsets in `shared/game-primitives.js`.
4. Render code must not hardcode vertical offsets that duplicate primitives.

## Primitive Sources
1. `shared/game-primitives.js` is the source of truth for:
- coordinate offsets (`eye_offset_y`, `body_hitbox_offset_y`, `head_hitbox_offset_y`)
- capsule dimensions
- rig dimensions and anchor offsets
- weapon profile sockets and style data
2. Gameplay and rendering modules consume these values rather than redefining constants.

## Network Contract
Client -> Server messages:
1. `input`: `moveX`, `moveZ`, `jumpHeld`, `sprint`, `yaw`, `pitch`, `seq`, optional `cameraMode`, `actions`
2. `fire_intent`: `weaponId`, optional `targetId`, `hitType`, `seq`
3. `beam_intent`: `weaponId`, `active`, `seq`
4. `throw_intent`: `throwableId`
5. `equip_weapon`, `class_queue`, `chunk_subscribe`, `ping`

Server -> Client messages:
1. `entity_snapshot` (authoritative entities)
2. `throwable_snapshot`
3. `server_reconcile` (player correction)
4. events: `damage_event`, `death_respawn`, `class_queued`, `error`, `pong`

## Simulation and Rendering Split
1. Server simulation is authoritative and fixed-step.
2. Client render state interpolates from authoritative snapshots.
3. Local animation uses simulation state fields (`moveSpeedNorm`, `sprinting`, `aimPitch`, `animState`, `animPhase`, `gripMode`), not ad-hoc inference across modules.

## Rig Primitive
Required node hierarchy:
1. `root` (feet-origin)
2. `hips`
3. `spine`
4. `head`
5. `shoulder_l`, `upperarm_l`, `forearm_l`, `hand_l`
6. `shoulder_r`, `upperarm_r`, `forearm_r`, `hand_r`
7. `hip_l`, `thigh_l`, `shin_l`, `foot_l`
8. `hip_r`, `thigh_r`, `shin_r`, `foot_r`
9. sockets: `core_anchor`, `muzzle_socket`, `weapon_mount`, `overhead_anchor`

## Immediate Baseline Rules
1. No character model should be lifted by arbitrary visual-only `+Y` offsets.
2. Remote hitboxes and visuals must use `feetY` from snapshots.
3. Debug grid is opt-in to avoid floor shimmer in normal play.

## Decisions To Confirm
1. Exact Minecraft yaw semantics vs preserving current aim feel with feet-origin contract.
2. Initial server tick and interpolation delay targets (default recommendation: 20 Hz server, 80-120 ms interpolation buffer).
3. Rig authoring path: procedural block rig only vs future Blockbench/glTF pipeline while preserving this runtime API.
