# Gun Niche Deep Dive

Date: March 22, 2026

## Scope

This is a live balance read of the current sandbox:

- survivability: `360` health + `90` armor
- guns: `machinegun`, `shotgun`, `rifle`, `pistol`, `sniper`
- throwables: `frag`, `plasma`, `molotov`, `knife`
- default ability focus: `deadeye`

It is based on the current shared tuning and the authoritative damage path, not on intended fantasy alone.

Primary sources:

- [shared/gameplay-tuning.js](/Users/gguthrie/Desktop/code bs/minecraft-fps/shared/gameplay-tuning.js)
- [shared/damage.js](/Users/gguthrie/Desktop/code bs/minecraft-fps/shared/damage.js)
- [shared/hitscan-authority.js](/Users/gguthrie/Desktop/code bs/minecraft-fps/shared/hitscan-authority.js)
- [cloudflare/server/room/CombatService.js](/Users/gguthrie/Desktop/code bs/minecraft-fps/cloudflare/server/room/CombatService.js)
- [cloudflare/server/room/AbilityService.js](/Users/gguthrie/Desktop/code bs/minecraft-fps/cloudflare/server/room/AbilityService.js)

## Sandbox Read

The sandbox currently has a clear backbone:

1. `machinegun` is the best sustained pressure tool.
2. `rifle` is the cleanest mid-range duel weapon.
3. `shotgun` is the hardest close-range punish.
4. `sniper` is a long-range shield-break and exposed-target punish tool.

The weapon with the least stable niche right now is `pistol`.

That is not because it is weak. It is because it is doing something unusual:

- it has rifle-like damage breakpoints
- it has close-range falloff like a sidearm
- it uses a forgiving cylinder scan instead of true pellet randomness
- it does not actually get shotgun-level burst because only one winning hit is applied

So the pistol does not behave like a normal pistol or a normal shotgun. It behaves like a forgiving short-range hand cannon.

That can work, but only if the rest of the sandbox treats it that way.

## Important Global Interactions

### Shield-first design is shaping the real balance more than raw damage

The most important pattern in the sandbox is that openers are heavily softened by armor.

- full target pool is `450`
- sniper uses `heavy` armor handling
- frag uses `heavy` armor handling
- plasma uses `heavy` armor handling

That means these tools often remove armor first instead of chunking health through armor on the same hit.

Practical result:

- sniper is not a neutral one-shot opener against healthy armored targets
- frag and plasma are better at forcing movement and priming kills than outright deleting fresh targets

That makes the gun roster matter more after first contact, which is good.

### Deadeye is a finisher/setup tool, not a full-health delete

Current `deadeye` damage is `160`, max `2` targets, over `1.6s`.

Against a fresh `450` pool, one Deadeye shot is meaningful but not decisive. Even two confirmed locks do not instantly erase a full target if armor is still present and the target gets cover between the locks and the release window.

That means Deadeye mostly rewards:

- catching damaged targets
- punishing exposed targets
- stacking with prior poke

That overall direction fits the anti-burst shield model.

### Molotov is the oddball utility damage source

Molotov uses normal armor behavior, then leaves a long area denial field.

That gives the sandbox one reliable tool that still converts pressure after the first armor layer is touched, especially in corners and on retreat paths.

This is useful because otherwise too many opener tools would only be shield strippers.

## Current Weapon Niches

## Machine Gun

Current read:

- best sustained DPS over time
- best shield stripping in live tracking fights
- best “stay on them” weapon
- worst opening punch per shot

Why it works:

- `82ms` cadence gives it the strongest pressure identity
- `50` round mag supports suppression and chase pressure
- modest falloff keeps it serviceable through mid range without making it a beam rifle

What keeps it honest:

- `15/20` damage means it needs commitment
- it is not a peek gun
- it does not get meaningful one-tap or two-tap moments

Niche summary:

- machinegun should own sustained pressure, anti-armor attrition, and finishing through movement mistakes

This niche is clear already.

## Rifle

Current read:

- best honest duel weapon
- best general-purpose weapon
- safest benchmark weapon in the roster

Why it works:

- `44` body damage is big enough to matter immediately
- `260ms` cadence gives real pace without machinegun spray
- zero ADS spread makes it the cleanest repeatable mid-range test of aim

Its role is not flashy, but it is structurally important:

- it tells players what “fair” neutral should feel like
- it punishes bad peeks without hard deleting through armor
- it bridges close, medium, and light long-range play better than anything else

Niche summary:

- rifle should stay the stable mid-range anchor and default skill-check gun

This niche is also clear.

## Shotgun

Current read:

- strongest close-range punishment tool
- best corner holder
- best response to hook, dive, or forced close spacing

Why it works:

- at full pellet connection it massively out-bursts every non-sniper gun
- it falls off hard enough that it cannot replace rifle
- slow cadence creates real punishment on misses

The important comparison is against the pistol:

- shotgun has true burst lethality
- pistol has forgiving aim but only one winning hit

That distinction is what keeps shotgun alive.

Niche summary:

- shotgun should own hard close-range commits, room entry punishment, and punish windows created by utility

This niche is healthy as long as pistol does not become too good at the same range.

## Sniper

Current read:

- best long-range threat
- best punish on exposed or softened targets
- weaker neutral opener than raw numbers first suggest

Why it works:

- `170` body and `360` head preserve sniper identity
- `heavy` armor interaction prevents first-shot health chunk through full armor
- ADS gating and slow cadence create commitment

What it actually does in the sandbox:

- first clean hit often strips armor
- second clean hit creates the kill window
- unarmored targets remain in real danger

Niche summary:

- sniper should own long sightlines, punish greed, and convert prior damage

This niche is clear and well supported by the armor rule.

## Pistol

Current read:

- forgiving close-range precision weapon
- not true burst
- not a real shotgun replacement
- not a real rifle replacement
- currently closest to a hand-cannon cleanup tool

The forgiving aim matters a lot here.

This pistol is not just “high spread.” Because of the cylinder scan path and the `hipfireCylinderRadiusWu` / `adsCylinderRadiusWu` values, it effectively checks a forgiving hit volume and then takes the best single result.

So in practice the pistol offers:

- easier hit confirmation than a strict single-ray hand cannon
- one solid chunk per trigger pull
- strong cleanup pressure once armor is already touched

That gives it a real niche, but it is easy for that niche to blur.

### What the pistol is good at

- finishing wounded targets without needing shotgun-level commit
- winning scrappy short-range duels where slight aim error should still pay out
- rewarding fast peek-shots inside short sightlines

### What the pistol is not good at

- deleting full-health armored targets quickly
- holding corners as hard as shotgun
- sustaining pressure as well as machinegun
- owning open mid-range duels as reliably as rifle

### Why the pistol can become balance-dangerous

Because its aim is forgiving, every extra point of range, damage, or cadence matters more than it would on a stricter precision weapon.

If you buff the wrong stat, it can start stealing too many jobs at once:

- if range goes up, it starts crowding rifle
- if cadence goes up, it starts crowding shotgun cleanup and rifle burst trading
- if damage goes up, its forgiving hit model becomes too easy to cash in

Niche summary:

- pistol should be the forgiving hand-cannon cleanup gun
- it should beat rifle and machinegun only in short, messy, imperfect fights
- it should still lose to shotgun on hard close-range commit

That is the most important niche rule for the whole roster.

## Overlap And Risk Map

### Healthy overlaps

- `machinegun` and `rifle`: both serve mid-range, but one is sustained and one is bursty
- `shotgun` and `pistol`: both prefer close range, but one is hard commit burst and one is forgiving chunk damage
- `rifle` and `sniper`: both reward accuracy, but one is neutral pressure and one is conditional pick power

These overlaps are fine because the usage pattern is still different.

### Main danger zone: pistol versus shotgun

This is the biggest tuning risk in the current roster.

If pistol gets too much of any of the following:

- more range
- faster fire rate
- higher headshot payoff

then the shotgun starts losing the very fights it is supposed to own, because the pistol already asks for less exact aim than a strict hitscan hand cannon would.

### Secondary danger zone: pistol versus rifle

The second risk is the pistol becoming a better peek weapon than rifle at too many medium-short ranges.

That happens if:

- the forgiving aim lets pistol hit too often at ranges where rifle is supposed to be the consistent answer
- the pistol damage profile stays too flat too far into mid range

Your current falloff helps prevent that. That needs to stay true.

## Recommended Niche Rules

If you want the roster to stay distinct, these should be treated as hard rules.

1. `machinegun` wins by staying on target, not by opening hard.
2. `rifle` wins neutral mid-range aim duels.
3. `shotgun` wins true close-range commit windows.
4. `sniper` wins range and exposure checks, not fresh armored neutral for free.
5. `pistol` wins messy short-range cleanup fights with forgiving aim, but should not become the best answer to full-health armored targets.

## Recommendation For The Pistol Specifically

Because you want a forgiving pistol aim, the safest way to preserve its niche is:

1. Keep its damage meaningful per shot.
2. Keep its range ceiling short.
3. Keep its fire rate slower than rifle.
4. Keep shotgun clearly ahead on point-blank burst.

That means:

- do not solve pistol feel problems by giving it more range
- do not solve pistol feel problems by making it spammy
- if it ever feels weak, small quality buffs are safer than raw lethality buffs

Examples of safer pistol levers:

- slightly faster weapon handling
- slightly faster reload
- clearer hit feedback
- slightly tighter close-range consistency only if mid-range reach stays capped

Examples of dangerous pistol levers:

- meaningful cooldown reduction
- broader effective falloff bands
- substantially higher headshot payout

## Final Read

The sandbox is close to having clean niches.

The good news:

- machinegun, rifle, shotgun, and sniper all already read as distinct
- the shield system is doing good work stopping oppressive openers
- the throwable and Deadeye layer mostly push fights into setup and conversion instead of cheap full-health deletes

The main design task left is not “make every gun stronger.”

It is:

- lock the pistol into a forgiving cleanup niche
- protect shotgun’s right to dominate hard close-range commit
- protect rifle’s right to own honest mid-range duels

If those two protections hold, the rest of the sandbox has a strong shape.
