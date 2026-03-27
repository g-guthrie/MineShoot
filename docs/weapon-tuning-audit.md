# Weapon Tuning Audit

Date: March 23, 2026

## Current State

The current sandbox is built around one shared gameplay source of truth:

- [shared/gameplay-tuning.js](/Users/gguthrie/Desktop/code bs/minecraft-fps/shared/gameplay-tuning.js)
- [shared/entity-constants.js](/Users/gguthrie/Desktop/code bs/minecraft-fps/shared/entity-constants.js)
- [shared/survivability.js](/Users/gguthrie/Desktop/code bs/minecraft-fps/shared/survivability.js)
- [shared/match-rules.js](/Users/gguthrie/Desktop/code bs/minecraft-fps/shared/match-rules.js)

## Live Match Snapshot

| Knob | Live value |
| --- | ---: |
| Match style | Stock-based FFA |
| Starting lives | `3` |
| Max earned bonus lives | `2` |
| Max total lives | `5` |
| Extra-life gain | `1%` per `40` damage |
| Progress reset on death | No |

## Live Survivability Snapshot

| Knob | Live value |
| --- | ---: |
| Health max | `400` |
| Shield max in code (`armorMax`) | `100` |
| Total fresh durability | `500` |
| Shield regen delay | `12.0s` |
| Shield regen rate | `25/s` |
| Spawn invulnerability | `1000ms` |
| Respawn delay | `2200ms` |

Notes:

- the code still uses `armor` naming for the shield layer
- recovery is intentionally limited in the live sandbox

## Live Movement Snapshot

| Knob | Live value |
| --- | ---: |
| Base normal move speed | `7` |
| Base sprint speed | `11` |

## Canonical Weapon Snapshot

| Internal id | Display role | Cooldown ms | Reload ms | Mag | Body | Head | Move mult | ADS move mult |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `machinegun` | Auto Rifle | `133` | `1800` | `32` | `18` | `27` | `1.04` | `0.95` |
| `pistol` | Hand Cannon | `430` | `2050` | `10` | `60` | `90` | `1.10` | `0.90` |
| `rifle` | Scout Rifle | `400` | `1850` | `14` | `50` | `78` | `0.96` | `0.75` |
| `shotgun` | Shotgun | `900` | `2100` | `5` | `20` pellet | `22` pellet | `1.00` | `0.90` |
| `sniper` | Sniper | `1800` | `2400` | `4` | `180` | `420` | `0.85` | `0.60` |

## Falloff Ownership

The old stepped falloff bands are gone as the main tuning model.

The live game now uses one simple profile per weapon:

- `falloff.start`
- `falloff.end`
- `falloff.minScalar`

That profile is consumed by both the local hitscan path and the authoritative damage path.

## Remaining Findings

### [P2] Presentation feel is still split across shared tuning and local presentation code

Gameplay numbers are now centralized, but feel still spans:

- weapon presentation values in shared tuning
- local camera/animation timing
- HUD copy and temporary toasts

That is acceptable for now, but it remains the biggest place where feel can drift if not reviewed after major tuning changes.
