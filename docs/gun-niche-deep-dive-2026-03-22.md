# Gun Niche Deep Dive

Date: March 23, 2026

## Scope

This is a live read of the current brawler sandbox.

- survivability: `400` health + `100` shield
- full fresh durability: `500`
- round structure: `3` starting lives, up to `+2` earned lives
- extra-life meter: `1%` per `40` damage dealt
- guns: `machinegun`, `shotgun`, `rifle`, `pistol`, `sniper`

## Sandbox Read

The current roster has five clear jobs:

1. `machinegun` is the mobility pressure gun.
2. `pistol` is the chunky hand-cannon brawler gun.
3. `rifle` is the long-lane scout gun.
4. `shotgun` is the close-range swing weapon.
5. `sniper` is the heavy punish gun, but not a healthy-target delete.

The important global truth is that the match is no longer about who steals the fastest kill. It is about who stays in the fight, keeps dealing damage, and turns that pressure into survival.

## Important Global Interactions

### Damage has two rewards now

Damage matters twice:

- it moves the defender toward elimination
- it moves the attacker toward an extra life

That is why sustained pressure is much more valuable in this sandbox than it was in the older kill-goal framing.

### Shield recovery is intentionally slow to start

- shield delay: `12s`
- shield regen: `25/s`

That means chip damage sticks for a long time during a crowded round, which supports the brawler feel and makes the extra-life race meaningful.

### There is no quick reset button anymore

The roster no longer has a fast recovery tool.

That means:

- damage pressure matters more
- disengaging matters more
- players do not get a free self-reset button

## Current Weapon Niches

## Auto Rifle (`machinegun`)

Current read:

- most mobile weapon
- best sustained pressure
- best at farming extra-life meter through repeated hits
- weakest single-shot threat

Why it works:

- faster movement multiplier than the other long guns
- steady body/head damage
- shorter strong range window than scout

Niche summary:

- auto rifle should own active pressure, chase damage, and meter building through consistency

## Hand Cannon (`pistol`)

Current read:

- biggest non-sniper shot feel
- best scrappy peek gun
- strongest mid-range chunk weapon

Why it works:

- each hit matters a lot
- shorter falloff window than scout keeps it honest
- now uses the normal single-ray hitscan path, so spread and range tune it the same way as the other standard guns

Niche summary:

- hand cannon should own chunky short-window trades, not long-lane control

## Scout Rifle (`rifle`)

Current read:

- cleanest spacing gun
- safest long-range precision choice
- loses the close, messy mid-range fight to hand cannon

Why it works:

- strongest long-range falloff profile
- stable cadence
- clean precision without needing a separate aim mode

Niche summary:

- scout rifle should own lane control and measured spacing, not up-close scrapping

## Shotgun

Current read:

- strongest close-range momentum swing
- best punish on corner commits and cracked players
- not designed as a default fresh-target one-shot

Why it works:

- full pellet density is still brutal
- range collapse is severe
- two-shot baseline keeps it scary without turning the whole mode into cheap close deletes

Niche summary:

- shotgun should cash in advantage, not create free wins from neutral

## Sniper

Current read:

- strongest single-hit punish
- weakest mobility profile
- must rely on prior shield break or prior damage for the clean headshot finish

Why it works:

- `420` headshot damage kills shield-broken targets
- `180` body damage still creates a huge swing
- slow movement and cadence keep it committed

Niche summary:

- sniper should punish greed and exposed movement, not invalidate the longer-fight ruleset

## Extra-Life Economy Implications

### Weapons that build meter well

- Auto rifle
- Hand cannon
- Scout rifle

These weapons keep contributing damage in live fights even when they are not the final hit.

### Weapons that cash in more than they farm

- Shotgun
- Sniper

These weapons create or finish big damage spikes, but they are less naturally suited to steady meter farming.

That asymmetry is good. It keeps the roster from collapsing into five versions of the same gun.

## Final Read

The live sandbox now reads like a gun brawler instead of a fast kill-race shooter.

The key differences from the old version are:

- slower kill pace
- stock-based survival
- damage as a resource
- limited recovery
- weapon identity through movement, range, and pressure style
