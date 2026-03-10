# Weapon Tuning Audit

Date: March 10, 2026

Scope:
- shared weapon gameplay stats
- authoritative server fire/ammo enforcement
- client weapon catalog/loadout wiring
- ADS/spread/range/falloff ownership
- remaining presentation-only weapon tuning

## Current state

Weapon gameplay now has one canonical source:
- [shared/gameplay-tuning.js](/Users/gguthrie/Desktop/code bs/minecraft-fps/shared/gameplay-tuning.js)

That shared module now owns:
- weapon stats
- selectable weapon order
- default loadout
- aim profile resolution
- falloff profiles

The main client/server consumers are:
- [js/hitscan.js](/Users/gguthrie/Desktop/code bs/minecraft-fps/js/hitscan.js)
- [cloudflare/server/room/GlobalArenaRoom.js](/Users/gguthrie/Desktop/code bs/minecraft-fps/cloudflare/server/room/GlobalArenaRoom.js)

## Fixed in this remediation

### [done] Client weapon range/falloff fallback ownership was removed

Before this pass, [js/combat-tuning.js](/Users/gguthrie/Desktop/code bs/minecraft-fps/js/combat-tuning.js) carried duplicate weapon defaults, including a stale machinegun falloff profile. It now acts as a compatibility facade that reads weapon data from shared tuning instead of redefining it.

### [done] Client hitscan catalog/order now derives from shared weapon ownership

Before this pass, [js/hitscan.js](/Users/gguthrie/Desktop/code bs/minecraft-fps/js/hitscan.js) hard-coded the selectable weapon order and separately cached weapon falloff. It now builds its weapon catalog and falloff data from shared tuning.

### [done] The audit no longer claims server ammo/reload are missing

The old audit was stale. The authoritative room already enforces cooldown, reload, ammo depletion, and reload completion in [cloudflare/server/room/GlobalArenaRoom.js](/Users/gguthrie/Desktop/code bs/minecraft-fps/cloudflare/server/room/GlobalArenaRoom.js#L1712).

## Canonical gameplay stats

Primary source:
- [shared/gameplay-tuning.js](/Users/gguthrie/Desktop/code bs/minecraft-fps/shared/gameplay-tuning.js#L70)

| Weapon | Type | Auto | Cooldown ms | Reload ms | Mag | Body dmg | Head dmg | Pellets | Hip spread | ADS spread | Hip range | ADS range |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| `rifle` | `hitscan_single` | no | 260 | 1550 | 15 | 44 | 104 | 1 | 0.016 | 0.000 | 110 | 132 |
| `pistol` | `hitscan_single` | no | 360 | 1350 | 12 | 46 | 150 | 1 | 0.024 | 0.024 | 54 | 60 |
| `machinegun` | `hitscan_single` | yes | 82 | 1850 | 40 | 15 | 23 | 1 | 0.046 | 0.046 | 58 | 72 |
| `shotgun` | `hitscan_multi` | no | 1000 | 1850 | 6 | 17 | 25 | 12 | 0.190 | 0.190 | 26 | 26 |
| `sniper` | `hitscan_single` | no | 1450 | 2100 | 5 | 230 | 500 | 1 | 0.320 | 0.000 | 160 | 160 |

Notes:
- shotgun damage is per pellet
- sniper is still ADS-sensitive in the fire path
- the default selectable loadout order is `machinegun`, `shotgun`, `rifle`, `pistol`, `sniper`

## Server enforcement status

Authoritative room fire handling currently enforces:
- valid weapon id
- loadout membership
- cooldown
- reload lockout
- magazine/ammo depletion
- reload completion
- spread/range/falloff via shared hitscan math

Primary sources:
- [cloudflare/server/room/GlobalArenaRoom.js](/Users/gguthrie/Desktop/code bs/minecraft-fps/cloudflare/server/room/GlobalArenaRoom.js#L1712)
- [shared/hitscan-authority.js](/Users/gguthrie/Desktop/code bs/minecraft-fps/shared/hitscan-authority.js)

## Remaining findings

### [P2] Presentation tuning is still decentralized

These are still local presentation knobs rather than shared gameplay data:
- tracer timing/length in [js/hitscan.js](/Users/gguthrie/Desktop/code bs/minecraft-fps/js/hitscan.js)
- audio sample gain/rate in [js/audio.js](/Users/gguthrie/Desktop/code bs/minecraft-fps/js/audio.js)
- recoil and firing pose in [js/player.js](/Users/gguthrie/Desktop/code bs/minecraft-fps/js/player.js)

That is acceptable for correctness, but balancing “feel” still spans multiple files.

### [P3] HUD reload flash timing is still a local presentation constant

`RELOADED_FLASH_MS` in [js/hitscan.js](/Users/gguthrie/Desktop/code bs/minecraft-fps/js/hitscan.js) is still local UI timing. That is fine if it stays presentation-only.

## Recommended next steps

1. Keep gameplay numbers in shared tuning only.
2. Move any future weapon feel tuning into shared only if it needs cross-client consistency.
3. Leave purely visual weapon feedback local unless designers need shared ownership.
