# Weapon Balance And Survivability Spec

Date: March 20, 2026

## Purpose

This document explains the current weapon balance model and the reasoning behind the survivability stack:

- `360` health
- `90` shield
- shield-first damage handling
- special shield behavior against sniper shots

It is written as an engineering spec for the current live design, not as a wishlist. All numbers and behaviors below are based on the current shared tuning and authoritative server damage flow.

## Canonical Sources

Primary sources:

- [shared/gameplay-tuning.js](/Users/gguthrie/Desktop/code bs/minecraft-fps/shared/gameplay-tuning.js)
- [shared/damage.js](/Users/gguthrie/Desktop/code bs/minecraft-fps/shared/damage.js)
- [cloudflare/server/room/CombatService.js](/Users/gguthrie/Desktop/code bs/minecraft-fps/cloudflare/server/room/CombatService.js)
- [cloudflare/server/room/RoomCombatRuntime.js](/Users/gguthrie/Desktop/code bs/minecraft-fps/cloudflare/server/room/RoomCombatRuntime.js)
- [cloudflare/server/room/EntityLifecycle.js](/Users/gguthrie/Desktop/code bs/minecraft-fps/cloudflare/server/room/EntityLifecycle.js)
- [cloudflare/server/room/GlobalArenaRoom.js](/Users/gguthrie/Desktop/code bs/minecraft-fps/cloudflare/server/room/GlobalArenaRoom.js)

## Design Goals

The current balance model is trying to achieve five things at once:

1. Keep baseline time-to-kill long enough for movement, tracking, and abilities to matter.
2. Preserve room for precision weapons to feel rewarding without letting them dominate neutral openings.
3. Let players recover from chip damage without making full resets happen too quickly.
4. Make sustained weapons and close-range weapons good at finishing, not just tagging.
5. Prevent sniper play from collapsing fights into instant, low-counterplay picks.

## Survivability Model

### Core numbers

- Health: `360`
- Shield: `90`
- Total pool against normal damage: `450`
- Intended shield regen delay: `8.0s`
- Intended shield regen rate: `10 per second`
- Spawn shield: `1000ms` of full invulnerability after spawn

### Why `360` health

`360` health creates enough room between weak and strong weapons to support distinct roles.

- It is high enough that automatic weapons do not erase players instantly.
- It is low enough that focused fire and clean close-range hits still end fights quickly.
- It gives headshots real value without making every accurate weapon an instant-kill threat.

`360` also matters specifically for sniper balance:

- sniper headshot damage is `360`
- this means an unshielded target dies to one clean sniper headshot
- this keeps sniper shots meaningful when the defender has already been softened or caught out

### Why `90` shield

`90` shield is intentionally smaller than health. It is not meant to be a second full life bar. It is a buffer layer that does three jobs:

1. It absorbs opener damage so neutral fights are less likely to be decided by a single first hit.
2. It creates recoverable attrition, since shield can come back while health usually does not.
3. It gives design space for special interactions, especially anti-sniper handling.

`90` is large enough to change important breakpoints but small enough that sustained pressure still pushes through.

Examples against normal weapons:

- rifle body shot `44`: shield absorbs two full body hits before health starts dropping
- machine gun body shot `15`: shield gives meaningful extra exposure time, but not so much that tracking weapons become useless
- pistol body shot `46`: shield blocks one strong opener, then the fight moves into health damage quickly

### Shield regeneration role

Shield is the pacing valve for repeated fights.

- health is the hard attrition layer
- shield is the recoverable layer

The intended behavior is:

- taking damage resets shield regeneration
- shield returns only after disengagement
- shield returns slowly enough that winning space still matters

This lets players recover from poke and partial trades, while still rewarding the team or player who keeps pressure on.

### Spawn shield is a separate system

Spawn shield is not the same as normal shield.

- normal shield is the `90` point survivability buffer
- spawn shield is temporary full invulnerability for `1000ms`

Spawn shield exists to prevent immediate spawn deaths and should not be used when reasoning about normal fight balance.

## Damage Rules

### Standard damage rule

Most weapons use normal shield behavior:

- damage hits shield first
- if the hit is larger than the remaining shield, the leftover damage spills into health

This is the standard rule for rifle, pistol, machine gun, shotgun, and most non-sniper damage sources.

### Heavy shield rule

Sniper uses a special shield rule named `heavy`.

Under `heavy`:

- if the target has any shield left, the entire hit is consumed by shield
- no leftover damage spills into health on that shot
- the shot can break shield, but it cannot both break shield and chunk health at the same time

This is the core anti-sniper mechanic.

## Anti-Sniper Design

### Problem being solved

Without a special rule, a high-damage sniper body shot would break shield and still take a large amount of health in one action. That creates too much opener power at long range and makes neutral peeks too punishing.

With current numbers, a normal body-shot sniper hit of `170` against a target with `90` shield would otherwise:

- remove `90` shield
- spill `80` into health

That would make the first long-range connection too decisive for too little commitment.

### Current solution

Sniper uses all of the following constraints together:

- body damage `170`
- head damage `360`
- `1800ms` cooldown
- `2400ms` reload
- `4` round magazine
- perfect accuracy only while aiming down sights
- special `heavy` shield interaction

This changes sniper from a pure opener weapon into a conditional pick weapon:

- against full shield, the first sniper shot strips shield only
- against broken shield, the next sniper shot can threaten a kill
- against an already softened target, sniper still converts advantage cleanly

### Resulting sniper breakpoints

Against a target with full health and full shield:

- body shots to kill: `4`
- headshots to kill: `2`

Against a target with full health but no shield:

- body shots to kill: `3`
- headshots to kill: `1`

Important implication:

- shield does not make sniper weak
- shield delays sniper lethality by one successful shot
- that one extra shot is the intended counterplay window

This gives defenders a chance to move, break sightline, receive support, or re-engage with a closer-range weapon.

### Why shield is the right anti-sniper lever

Using shield for anti-sniper is better than simply lowering sniper damage because it preserves sniper identity.

If we lowered sniper damage too far:

- headshots would stop feeling decisive
- sniper would lose its payoff as a precision finisher
- the weapon would blur into rifle territory

By instead making shield specifically resistant to high-alpha shots:

- sniper keeps its kill threat on exposed or already-damaged targets
- sniper loses only the most frustrating neutral opener cases
- the rule stays readable: shield protects you from the first big sniper hit

## Weapon Role Spec

### Machine Gun

Current profile:

- automatic
- `15` body damage
- `20` head damage
- `82ms` cooldown
- `50` round magazine

Role:

- sustained pressure
- finishing broken targets
- reliable medium-range tracking

Balance reason:

- low per-hit damage keeps it honest in neutral
- large magazine and fast fire rate reward long exposure and pressure
- benefits heavily once enemy shield is already gone

### Shotgun

Current profile:

- `12` pellets
- `17` body damage per pellet
- `22` head damage per pellet
- `950ms` cooldown
- `6` round magazine

Role:

- close-range burst
- corner punishment
- strongest raw finishing weapon at short range

Balance reason:

- spread and falloff sharply limit consistent long-range value
- high payoff requires close distance and pellet commitment
- shield helps prevent distant chip shotgun patterns from mattering too much

### Rifle

Current profile:

- semi-auto precision weapon
- `44` body damage
- `90` head damage
- `260ms` cooldown
- `15` round magazine

Role:

- stable mid-range dueling
- consistent accuracy reward
- flexible general-purpose pick

Balance reason:

- high enough damage to matter immediately
- low enough damage that it does not invalidate the sniper or shotgun roles
- creates predictable breakpoints without oppressive opener lethality

### Pistol

Current profile:

- multi-trace, single-hit winner behavior
- `46` body damage
- `96` head damage
- `360ms` cooldown
- `10` round magazine

Role:

- high-risk, high-payoff precision side weapon
- close and mid-range bursty duels

Balance reason:

- strong per-shot numbers justify lower consistency
- unusual trace pattern makes it less of a pure replacement for rifle
- shield prevents the first clean pistol hit from deciding too much on its own

### Sniper

Current profile:

- `170` body damage
- `360` head damage
- `1800ms` cooldown
- `2400ms` reload
- `4` round magazine
- ADS required to fire
- `heavy` shield interaction

Role:

- long-range pick
- punish exposed, slowed, or already-tagged targets
- convert advantage, not dominate neutral by default

Balance reason:

- extreme damage gives it identity
- ADS gating, low mag size, and slow cadence limit spam
- shield interaction removes the most oppressive first-hit cases

## Why The Default Loadout Avoids Sniper

The default weapon loadout is:

- `machinegun`
- `shotgun`

Sniper is selectable, but not default.

That choice supports the broader balance strategy:

- default combat emphasizes movement, pressure, and close-to-mid engagement
- sniper remains a deliberate opt-in playstyle
- anti-sniper rules are still important, but sniper is not the baseline match texture

## Engineering Requirements

The following behaviors are required for the balance model to remain correct:

1. Shared tuning must remain the source of truth for health, shield, and weapon stats.
2. Authoritative server damage must continue to own shield handling.
3. Sniper must continue using `armorBufferMode: 'heavy'`.
4. Normal weapons must continue using spillover damage through shield.
5. Spawn shield must remain separate from normal shield math.
6. Sniper must remain ADS-gated in the server fire path.

## Current Implementation Gap

There is one active tuning mismatch in the codebase.

Shared tuning defines shield regeneration as:

- `8.0s` delay
- `10 per second`

But the current room runtime regeneration path is using:

- `6.0s` effective delay
- `12 per second`

Sources:

- intended tuning: [shared/gameplay-tuning.js](/Users/gguthrie/Desktop/code bs/minecraft-fps/shared/gameplay-tuning.js)
- current room behavior: [cloudflare/server/room/GlobalArenaRoom.js](/Users/gguthrie/Desktop/code bs/minecraft-fps/cloudflare/server/room/GlobalArenaRoom.js#L1322)

This should be resolved. The spec intent is the shared tuning values, because balance ownership should live in shared data, not in hardcoded room logic.

## Decision Summary

The current balance system uses:

- enough health to keep fights interactive
- a smaller recoverable shield layer to shape openers and resets
- a special shield rule to prevent sniper from winning neutral too cheaply

The most important design choice is this:

- shield is not only extra durability
- shield is also the anti-burst control layer

That is why sniper is balanced primarily through shield interaction, not just by reducing sniper damage.
