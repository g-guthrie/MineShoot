# Weapon Tuning Audit

Date: March 10, 2026

Scope:
- shared weapon gameplay stats
- authoritative server use of weapon stats
- client reload/ammo state
- ADS/spread/range/falloff
- tracer/audio/recoil presentation tuning
- special-case weapon handling

## Findings

### [P1] Reload and magazine tuning exist, but the server does not enforce them

The canonical weapon definitions include `reloadMs` and `magazineSize` in [shared/gameplay-tuning.js](/Users/gguthrie/Desktop/code%20bs/minecraft-fps/shared/gameplay-tuning.js#L70), and the client fully models reload/ammo in [js/hitscan.js](/Users/gguthrie/Desktop/code%20bs/minecraft-fps/js/hitscan.js#L400). But the multiplayer server fire path in [cloudflare/server/room/GlobalArenaRoom.js](/Users/gguthrie/Desktop/code%20bs/minecraft-fps/cloudflare/server/room/GlobalArenaRoom.js#L1784) only enforces `cooldownMs`.

Practical effect:
- reload is currently a client-side behavior only
- magazine size is currently a client-side behavior only
- a malicious client could bypass reload/ammo constraints in multiplayer

This is the most important weapon-tuning gap in the repo.

### [P2] Weapon tuning is split across multiple layers, and some of it is duplicated

Weapon behavior is not defined in one place. It is spread across:
- [shared/gameplay-tuning.js](/Users/gguthrie/Desktop/code%20bs/minecraft-fps/shared/gameplay-tuning.js)
- [js/hitscan.js](/Users/gguthrie/Desktop/code%20bs/minecraft-fps/js/hitscan.js)
- [js/combat-tuning.js](/Users/gguthrie/Desktop/code%20bs/minecraft-fps/js/combat-tuning.js)
- [js/player.js](/Users/gguthrie/Desktop/code%20bs/minecraft-fps/js/player.js)
- [js/audio.js](/Users/gguthrie/Desktop/code%20bs/minecraft-fps/js/audio.js)
- [shared/seek-profiles.js](/Users/gguthrie/Desktop/code%20bs/minecraft-fps/shared/seek-profiles.js)

The biggest duplication risk is `maxRange` and `weaponFalloff`, which are canonical in shared tuning but also have fallback defaults in [js/combat-tuning.js](/Users/gguthrie/Desktop/code%20bs/minecraft-fps/js/combat-tuning.js#L41). They are currently aligned, but the structure makes drift easy.

### [P2] `seekergun` is not treated like the other five weapons

`seekergun` exists in shared weapon stats at [shared/gameplay-tuning.js](/Users/gguthrie/Desktop/code%20bs/minecraft-fps/shared/gameplay-tuning.js#L76), but it is intentionally excluded from:
- `defaultWeaponLoadout`
- `selectableWeaponIds`
- the normal `weaponCatalogOrder` in [js/hitscan.js](/Users/gguthrie/Desktop/code%20bs/minecraft-fps/js/hitscan.js#L102)

It also lacks:
- `reloadMs`
- `magazineSize`

That may be correct, but it means any “weapon tuning” pass has to treat `seekergun` as a special system, not just another weapon row.

### [P3] Presentation tuning is not centralized

These are still hard-coded in runtime files rather than shared tuning:
- reload flash duration in [js/hitscan.js](/Users/gguthrie/Desktop/code%20bs/minecraft-fps/js/hitscan.js#L120)
- tracer life/speed/segment length in [js/hitscan.js](/Users/gguthrie/Desktop/code%20bs/minecraft-fps/js/hitscan.js#L323)
- weapon audio sample gain/rate in [js/audio.js](/Users/gguthrie/Desktop/code%20bs/minecraft-fps/js/audio.js#L14)
- recoil and firing pose tuning in [js/player.js](/Users/gguthrie/Desktop/code%20bs/minecraft-fps/js/player.js#L1106)

This is not a correctness bug, but it makes balancing slower because gameplay and presentation live in different places.

### [P3] Machine gun audio is piggybacking on the rifle sample

In [js/audio.js](/Users/gguthrie/Desktop/code%20bs/minecraft-fps/js/audio.js#L29), `machinegun` uses the rifle sample with different playback rate/gain. That may be acceptable, but it is worth calling out because it affects perceived weapon identity during tuning.

## Canonical gameplay stats

Primary source:
- [shared/gameplay-tuning.js](/Users/gguthrie/Desktop/code%20bs/minecraft-fps/shared/gameplay-tuning.js#L70)

| Weapon | Type | Auto | Cooldown ms | Reload ms | Mag | Body dmg | Head dmg | Pellets | Hip spread | ADS spread | Hip range | ADS range |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| `rifle` | `hitscan_single` | no | 260 | 1550 | 15 | 44 | 104 | 1 | 0.016 | 0.000 | 110 | 132 |
| `pistol` | `hitscan_single` | no | 360 | 1350 | 12 | 46 | 132 | 1 | 0.024 | 0.018 | 54 | 60 |
| `machinegun` | `hitscan_single` | yes | 82 | 2200 | 40 | 15 | 23 | 1 | 0.046 | 0.030 | 58 | 72 |
| `shotgun` | `hitscan_multi` | no | 1000 | 1850 | 6 | 17 | 25 | 12 | 0.190 | 0.160 | 26 | 26 |
| `sniper` | `hitscan_single` | no | 1450 | 2100 | 5 | 230 | 500 | 1 | 0.320 | 0.000 | 160 | 160 |
| `seekergun` | `projectile_homing` | yes | 380 | n/a | n/a | 72 | 72 | 1 | 0.000 | 0.000 | 28 | 28 |

Notes:
- `shotgun` damage is per pellet. Trigger-level damage is `17 * 12 = 204` body and `25 * 12 = 300` head before falloff.
- `sniper` is additionally gated by ADS in both client and server fire paths.
- `seekergun` is not part of the normal player loadout/cycle path.

## Falloff profiles

Primary source:
- [shared/gameplay-tuning.js](/Users/gguthrie/Desktop/code%20bs/minecraft-fps/shared/gameplay-tuning.js#L25)

Consumers:
- authoritative damage in [cloudflare/server/room/GlobalArenaRoom.js](/Users/gguthrie/Desktop/code%20bs/minecraft-fps/cloudflare/server/room/GlobalArenaRoom.js#L1811)
- client tuning cache in [js/hitscan.js](/Users/gguthrie/Desktop/code%20bs/minecraft-fps/js/hitscan.js#L110)
- duplicate fallback defaults in [js/combat-tuning.js](/Users/gguthrie/Desktop/code%20bs/minecraft-fps/js/combat-tuning.js#L41)

Profiles:
- `rifle`: `32@1.0`, `58@0.95`, `90@0.86`, `120@0.76`
- `pistol`: `16@1.0`, `28@0.88`, `42@0.72`, `54@0.56`
- `machinegun`: `16@1.0`, `30@0.92`, `48@0.78`, `72@0.64`
- `shotgun`: `7@1.0`, `12@0.8`, `18@0.55`, `26@0.28`
- `sniper`: `99999@1.0`
- `seekergun`: `28@1.0`

## Client reload/ammo state

Primary source:
- [js/hitscan.js](/Users/gguthrie/Desktop/code%20bs/minecraft-fps/js/hitscan.js#L400)

Variables:
- `reloadMs`
- `magazineSize`
- per-weapon `ammoInMag`
- `reloadUntil`
- `reloadedFlashUntil`
- `RELOADED_FLASH_MS = 900`

Behavior:
- reload begins automatically when ammo reaches zero
- ADS is dropped on reload start
- HUD state reports `reloading`, `cooldown`, `reloaded`, `ready`

Audit note:
- all of this is local/client-side today
- none of it is authoritative on the server

## Authoritative server weapon checks

Primary source:
- [cloudflare/server/room/GlobalArenaRoom.js](/Users/gguthrie/Desktop/code%20bs/minecraft-fps/cloudflare/server/room/GlobalArenaRoom.js#L1784)

Enforced on server today:
- `weaponId` validity
- loadout membership
- `cooldownMs`
- sniper ADS requirement
- damage, range, falloff, pellet count

Not enforced on server today:
- `reloadMs`
- `magazineSize`
- ammo remaining
- client reload state

## Derived/hidden tuning in client hitscan

Primary source:
- [js/hitscan.js](/Users/gguthrie/Desktop/code%20bs/minecraft-fps/js/hitscan.js)

Variables:
- `weaponCatalogOrder = ['rifle', 'pistol', 'machinegun', 'shotgun', 'sniper']`
- `RELOADED_FLASH_MS = 900`
- `hipfireBloomScale` / `adsBloomScale` default to `1`
- tracer life:
  - `machinegun: 0.075`
  - `shotgun: 0.1`
  - `sniper: 0.12`
  - default: `0.11`
- tracer speed:
  - `machinegun: 260`
  - `shotgun: 230`
  - `sniper: 320`
  - default: `280`
- tracer segment length:
  - `machinegun: 1.25`
  - `shotgun: 1.9`
  - `sniper: 2.6`
  - default: `2.1`

Notes:
- these are presentation variables, but they affect perceived weapon feel strongly
- `seekergun` is intentionally outside the normal `weaponCatalogOrder`

## Seek / seeker special-case tuning

Primary source:
- [shared/seek-profiles.js](/Users/gguthrie/Desktop/code%20bs/minecraft-fps/shared/seek-profiles.js)

Variables for `seekergun_shot`:
- `cooldownMs`
- `maxRange`
- `hipfireMaxRange`
- `adsMaxRange`
- `lockBoxPx`
- `hipfireLockBoxPx`
- `adsLockBoxPx`
- `coneHalfAngleDeg`
- `hipfireConeHalfAngleDeg`
- `adsConeHalfAngleDeg`
- homing:
  - `speed`
  - `boost`
  - `lerp`

Audit note:
- seeker aim/lock tuning is not stored purely in `weaponStats`
- it lives in a separate profile system

## Audio tuning

Primary source:
- [js/audio.js](/Users/gguthrie/Desktop/code%20bs/minecraft-fps/js/audio.js#L14)

Variables by weapon:
- sample URL
- `gain`
- `playbackRateMin`
- `playbackRateMax`

Current mapping:
- `pistol` -> `pistol.mp3`
- `rifle` -> `rifle.mp3`
- `machinegun` -> `rifle.mp3`
- `shotgun` -> `shotgun.mp3`
- `sniper` -> `sniper.mp3`

## Recoil / firing pose tuning

Primary source:
- [js/player.js](/Users/gguthrie/Desktop/code%20bs/minecraft-fps/js/player.js#L1106)
- [js/avatar-rig.js](/Users/gguthrie/Desktop/code%20bs/minecraft-fps/js/avatar-rig.js#L531)

Variables by weapon:
- `z` recoil
- `x` palm recoil
- camera `pitch`
- camera `yaw`
- camera `roll`
- arm extension multipliers `armR`, `armL`
- `muzzleMs`

Notes:
- these are currently presentation-only
- they are not shared or authoritative
- they matter a lot for perceived weapon power and identity

## Reticle / bloom / ADS presentation

Sources:
- [js/bloom-reticle.js](/Users/gguthrie/Desktop/code%20bs/minecraft-fps/js/bloom-reticle.js)
- [js/hitscan.js](/Users/gguthrie/Desktop/code%20bs/minecraft-fps/js/hitscan.js#L517)
- [shared/hitscan-authority.js](/Users/gguthrie/Desktop/code%20bs/minecraft-fps/shared/hitscan-authority.js#L48)

Variables:
- hip/ADS spread
- spread-derived bloom radius in pixels
- shotgun reticle size
- seeker lock box size
- camera FOV assumptions:
  - base FOV `75`
  - ADS FOV `56`
  - sniper ADS FOV `24`

## Recommendations

1. Move reload/ammo enforcement to the server.
   This is the biggest correctness issue in the audit.

2. Define one canonical weapon schema for all gameplay-facing variables.
   `shared/gameplay-tuning.js` should stay canonical, with fewer fallback duplicates elsewhere.

3. Decide explicitly whether presentation tuning belongs in shared data.
   Recoil, tracer, audio, and bloom are currently scattered but they are legitimate tuning variables.

4. Treat `seekergun` as a separate subsystem in tuning docs and tools.
   Do not assume it behaves like the five standard hitscan/loadout weapons.

5. If you want a clean balancing pass, build one exported weapon audit payload.
   Recommended fields:
   - gameplay stats
   - reload/ammo stats
   - falloff
   - seek profile
   - recoil
   - audio
   - tracer

That would let docs, debug UI, and tests all consume the same audit source instead of hand-reading files.
