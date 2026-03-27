# Weapon Mount Guide

This guide describes what the current gun hold and recoil behavior already prove about the weapon shapes, pivots, and axes in the live build.

## What the current result tells us

If the gun:

- faces the right direction,
- sits in the hand cleanly,
- bends upward when firing in a believable way,
- and still behaves correctly across the axes,

then the weapon data is already following a stable authoring convention:

1. The gun's long forward axis is `-Z` in weapon space.
2. The gun's up axis is `+Y`.
3. The gun's left/right width axis is `X`, with the gun mostly centered on `X = 0`.
4. The important hand anchor is not the model origin. It is the back of the firing grip, exposed as `handleBack`.
5. Recoil is expected to move the gun backward along local `Z` while the arm pitches the muzzle upward.

That is why the current setup reads as believable instead of feeling like the gun is being dragged around by a random cube pivot.

## The current axis rules

From the live weapon definitions:

- `muzzle` is always farther into negative `Z` than the grip.
- `stock` and rear body mass sit on positive `Z`.
- `optic` parts sit on positive `Y`.
- `grip` parts sit on negative `Y`.
- support-hand zones bias slightly to negative `X`, which means the off-hand side is authored consistently instead of mirrored arbitrarily.

In plain terms:

- front of gun = `-Z`
- rear of gun = `+Z`
- top of gun = `+Y`
- bottom of gun = `-Y`
- width = `±X`

## The real pivot is the grip-back anchor

The rig does not attach the model by its center. It aligns the weapon using `handleBack`, which is the back of the firing grip area.

That means a new gun should be authored as if:

- the hand closes around the grip,
- the gun extends forward from there along `-Z`,
- and only a smaller amount of mass extends rearward into `+Z`.

This is the key reason the hold articulates well. The arm is driving the gun from the grip region, not from the middle of the receiver or the muzzle.

## What the recoil proves

The current fire reaction does two simple things:

1. It pulls the weapon backward.
2. It pitches the lower right arm so the muzzle rises.

Because that looks correct in-game, the current weapon authoring is already telling us:

- the barrel line is aligned with the weapon's forward axis,
- the arm hinge and the gun mount agree on what "up" means,
- the gun is not upside down or quarter-turned relative to the arm,
- and the pivot is close enough to the grip that recoil reads like shoulder-and-wrist control instead of a floating prop.

If a future gun kicks backward but the muzzle drops, twists, or skews sideways, that almost always means one of those axis assumptions has been broken.

## What the 90 degree X-axis experiment proved

We tested an extra `+90` degree rotation on the shared weapon-model `X` rotation.

What happened:

- when the arm extended outward, the barrel pointed down at the ground
- when the arm rested lower by the avatar's side, the barrel pointed behind the avatar

That result is useful, because it confirms that the current local `X` axis is already the gun's pitch axis inside the live mount.

In practice, that means:

- rotating local `X` tips the muzzle up or down
- it does not behave like a harmless sideways spin
- the current mount is already aligned well enough that changing `X` immediately breaks the weapon's aiming direction

So the failed experiment is actually evidence that the current mount is coherent.

## Why that can feel like the "wrong" axis

It is normal for this to feel counterintuitive.

In plain-language thinking, a rotation that makes the gun do a forward flip can feel like a `Y` turn. But in the gun's own local space, that same motion is still an `X` rotation.

The reason is simple:

- the gun is not sitting at world-zero with world-aligned axes
- it is already attached to an arm mount that has its own rotation
- once the model is mounted, the gun's local axes no longer feel like the clean world axes you picture in your head

So for this rig:

- local `X` = pitch the muzzle up or down
- local `Y` = yaw the muzzle left or right
- local `Z` = roll the weapon sideways

If a future research test is needed:

- use `X` for nose-up or nose-down experiments
- use `Y` for left-right facing experiments
- use `Z` for roll experiments

## Approximate size envelope of the current guns

These are the practical authoring dimensions implied by the current live data. They are not real-world meters. They are gameplay-space proportions around the grip-back anchor.

| Weapon | Forward reach from grip-back to muzzle | Rear allowance | Total length envelope |
| --- | ---: | ---: | ---: |
| Pistol | `0.46` | `0.08` | `0.54` |
| Rifle | `0.64` | `0.22` | `0.86` |
| Machine Gun | `1.00` | `0.22` | `1.22` |
| Shotgun | `0.94` | `0.24` | `1.18` |
| Sniper | `1.45` | `0.34` | `1.79` |

How to read that:

- forward reach = how far the muzzle sits in front of the grip-back anchor
- rear allowance = how much stock/rear body mass can sit behind that anchor
- total length envelope = the rough full gun length the rig already tolerates well

## Shape rules that the live build rewards

The guns that fit best follow these proportions:

- keep the grip near the rear half of the weapon, not the center
- keep most barrel length extending into `-Z`
- keep sights and optics above center on `+Y`
- keep the main receiver close to the centerline on `X = 0`
- keep off-hand contact zones only slightly offset laterally
- keep the buttstock or rear housing modest in `+Z` unless the weapon is intentionally long like the sniper

## Authoring checklist for new weapons

For a new gun to match the current system:

1. Put the muzzle forward on `-Z`.
2. Put the grip below the body on `-Y`.
3. Put the optic or top rail above the body on `+Y`.
4. Keep the weapon centered laterally unless you have a very specific reason not to.
5. Define `handleBack` where the firing hand should really own the weapon.
6. Keep the rear extent modest relative to the forward barrel reach.
7. Test one fire cycle and confirm the barrel rises cranially instead of dipping or twisting.

## Fast diagnosis rules

If a gun looks wrong, the usual cause is:

- pointing the barrel toward `+Z` instead of `-Z`
- using the model origin as the hand anchor instead of the grip-back point
- placing too much mass behind the hand
- putting the grip too high or too close to center
- rolling the model so arm pitch no longer produces muzzle rise

## Current conclusion

The live mount system is already telling us that the game's "correct" gun convention is:

- grip-driven pivot
- forward = `-Z`
- up = `+Y`
- centered width on `X`
- recoil backward plus upward muzzle climb

That is the standard new weapons should follow if they are meant to feel like the current guns.
