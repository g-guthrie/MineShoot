# Weapon Tuning Audit

Date: March 13, 2026

Scope:
- shared weapon gameplay stats
- authoritative server fire/ammo enforcement
- canonical client weapon catalog/loadout wiring
- ADS/spread/range/falloff ownership
- remaining presentation-only weapon tuning

## Current state

Weapon gameplay has one canonical source:
- [shared/gameplay-tuning.js](/Users/gguthrie/Desktop/code bs/minecraft-fps/shared/gameplay-tuning.js)

That shared module owns:
- weapon stats
- selectable weapon order
- default loadout
- aim profile resolution
- falloff profiles

The main canonical consumers are:
- [js/combat/hitscan.js](/Users/gguthrie/Desktop/code bs/minecraft-fps/js/combat/hitscan.js)
- [js/combat/combat-tuning.js](/Users/gguthrie/Desktop/code bs/minecraft-fps/js/combat/combat-tuning.js)
- [cloudflare/server/room/RoomCombatRuntime.js](/Users/gguthrie/Desktop/code bs/minecraft-fps/cloudflare/server/room/RoomCombatRuntime.js)
- [cloudflare/server/room/CombatService.js](/Users/gguthrie/Desktop/code bs/minecraft-fps/cloudflare/server/room/CombatService.js)

## Fixed in this remediation

### [done] Client weapon range/falloff fallback ownership was removed

Before this pass, the old root-level `js/combat-tuning.js` mirror carried duplicate weapon defaults, including stale falloff values. The canonical compatibility facade now lives at [js/combat/combat-tuning.js](/Users/gguthrie/Desktop/code bs/minecraft-fps/js/combat/combat-tuning.js) and reads from shared tuning instead of redefining weapon numbers.

### [done] Client hitscan catalog/order now derives from shared weapon ownership

The canonical hitscan runtime at [js/combat/hitscan.js](/Users/gguthrie/Desktop/code bs/minecraft-fps/js/combat/hitscan.js) builds its weapon catalog, spread rules, and falloff inputs from shared tuning.

### [done] Server ammo/reload ownership is authoritative

Authoritative weapon validation, cooldowns, reload lockout, ammo consumption, rewinded hitscan resolution, and damage broadcast shaping now live in:
- [cloudflare/server/room/RoomCombatRuntime.js](/Users/gguthrie/Desktop/code bs/minecraft-fps/cloudflare/server/room/RoomCombatRuntime.js)
- [cloudflare/server/room/CombatService.js](/Users/gguthrie/Desktop/code bs/minecraft-fps/cloudflare/server/room/CombatService.js)
- [shared/hitscan-authority.js](/Users/gguthrie/Desktop/code bs/minecraft-fps/shared/hitscan-authority.js)

## Canonical gameplay stats

Primary source:
- [shared/gameplay-tuning.js](/Users/gguthrie/Desktop/code bs/minecraft-fps/shared/gameplay-tuning.js#L79)

| Weapon | Type | Auto | Cooldown ms | Reload ms | Mag | Body dmg | Head dmg | Pellets | Hip spread | ADS spread | Hip range | ADS range |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `rifle` | `hitscan_single` | no | 260 | 1550 | 15 | 44 | 104 | 1 | 0.024 | 0.000 | 110 | 132 |
| `pistol` | `hitscan_multi` | no | 360 | 1350 | 10 | 46 | 150 | 12 | 0.156 | 0.156 | 24 | 28 |
| `machinegun` | `hitscan_single` | yes | 82 | 1388 | 45 | 15 | 23 | 1 | 0.046 | 0.046 | 58 | 72 |
| `shotgun` | `hitscan_multi` | no | 1000 | 1850 | 6 | 17 | 25 | 12 | 0.190 | 0.190 | 26 | 26 |
| `sniper` | `hitscan_single` | no | 1450 | 2100 | 5 | 230 | 500 | 1 | 0.320 | 0.000 | 160 | 160 |

Notes:
- pistol remains a multi-pellet trace weapon, but `singleHitFromPellets` keeps it on a single-winner damage path
- shotgun damage is per pellet before authoritative aggregation
- sniper remains ADS-gated in the authoritative fire path
- the default selectable loadout order is `machinegun`, `shotgun`, `rifle`, `pistol`, `sniper`

## Remaining findings

### [P2] Presentation tuning is still decentralized

These are still local presentation knobs rather than shared gameplay data:
- tracer timing/length in [js/combat/hitscan.js](/Users/gguthrie/Desktop/code bs/minecraft-fps/js/combat/hitscan.js)
- audio sample gain/rate in [js/presentation/audio.js](/Users/gguthrie/Desktop/code bs/minecraft-fps/js/presentation/audio.js)
- recoil and firing pose in [js/actors/player.js](/Users/gguthrie/Desktop/code bs/minecraft-fps/js/actors/player.js)

That is acceptable for correctness, but balancing feel still spans multiple files.

### [P3] HUD reload flash timing is still a local presentation constant

`RELOADED_FLASH_MS` in [js/combat/hitscan.js](/Users/gguthrie/Desktop/code bs/minecraft-fps/js/combat/hitscan.js) is still a local presentation constant. That is acceptable while it remains purely visual.

## Recommended next steps

1. Keep gameplay numbers in shared tuning only.
2. Move weapon feel tuning into shared only if it needs cross-client consistency.
3. Leave purely visual weapon feedback local unless designers need shared ownership.
