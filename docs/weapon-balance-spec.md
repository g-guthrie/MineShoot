# Weapon Balance And Survivability Spec

Date: March 23, 2026

## Purpose

This document describes the live brawler sandbox as it now exists in code.

The game is no longer tuned like a quick kill-race shooter. The current design is a stock-based free-for-all where long fights, repeated pressure, and damage contribution matter more than fast picks.

## Current Match Model

- default public FFA is last-man-standing
- each player starts with `3` lives
- each player can earn up to `2` extra lives
- extra-life progress is earned by dealing damage
- progress does not reset when you lose one life during the same round
- rounds end when only one non-eliminated player remains

### Extra-life meter

- `1%` progress is earned per `40` points of real damage dealt
- only real authoritative damage to enemy players counts
- no kill bonus is applied
- overflow past `100%` carries into the next life award
- max earned bonus lives per round: `2`
- max total lives per round: `5`

## Core Survivability

- Health: `400`
- Shield layer in code: `armor = 100`
- Total fresh durability: `500`
- Shield regen delay: `12.0s`
- Shield regen rate: `25 per second`
- Spawn invulnerability: `1000ms`
- Respawn delay after losing a life: `2200ms`

### Naming note

The code still uses `armor` and `armorMax` for the recoverable top layer. Design-wise, that is the shield layer. `spawnShieldUntil` is still a separate spawn-protection timer.

### Passive recovery

- shield comes back after the no-damage delay
- health does not passively regenerate
- there is no fast self-reset in the live roster anymore

## Damage Model

Every current live weapon and throwable uses normal spillover damage.

That means:

- damage removes shield first
- leftover damage spills into health on the same hit
- taking damage resets shield regeneration

The shared `heavy` armor mode still exists in the lower-level damage helper, but the current sandbox does not assign it to any live weapon or throwable.

## Current Weapon Snapshot

Source of truth: [shared/gameplay-tuning.js](/Users/gguthrie/Desktop/code bs/minecraft-fps/shared/gameplay-tuning.js)

| Internal id | Role | Cooldown ms | Reload ms | Mag | Body | Head | Movement |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `machinegun` | Auto Rifle | `133` | `1800` | `32` | `18` | `27` | `1.04x` |
| `pistol` | Hand Cannon | `430` | `2050` | `10` | `60` | `90` | `1.10x` |
| `rifle` | Scout Rifle | `400` | `1850` | `14` | `50` | `78` | `0.96x` |
| `shotgun` | Shotgun | `900` | `2100` | `5` | `20` pellet | `22` pellet | `1.00x` |
| `sniper` | Sniper | `1800` | `2400` | `4` | `180` | `420` | `0.85x` |

## Movement Baseline

- base normal move speed: `7`
- base sprint speed: `11`
- weapon multipliers now provide the spread from hand cannon fastest to sniper slowest

## Range and Falloff

The game now uses a simple linear falloff profile per weapon:

- full damage until `falloff.start`
- straight line down to `falloff.minScalar` by `falloff.end`
- fixed minimum damage after `falloff.end`

First-pass live profiles:

- Auto Rifle: `33 -> 42`, min `50%`
- Hand Cannon: `32 -> 40`, min `33.3%`
- Scout Rifle: `42 -> 65`, min `50%`
- Shotgun: `6.8 -> 9.2`, min `0%`
- Sniper: effectively no damage falloff inside normal combat distance

## Design Read

### Auto Rifle

- most mobile gun
- best sustained pressure
- weakest single-shot punch

### Hand Cannon

- chunky mid-range brawler gun
- strongest in short exposure windows
- shorter useful range than scout

### Scout Rifle

- long-lane spacing gun
- most stable precision option
- weaker than hand cannon in scrappy mid-range peeks

### Shotgun

- close-range swing tool
- no designed full-health one-shot baseline
- strongest when it cashes in already-created pressure

### Sniper

- brawler sniper, not a full-health delete weapon
- fresh full target survives the first headshot
- shield-broken target dies to the headshot

## Decision Summary

The live game is now built around:

- slower, more physical fights
- stock-based elimination instead of a pure kill goal
- damage contribution as a real round resource
- weapon identity through role, range, and movement speed
- no self-reset mechanic
