/**
 * Mansion map layout, ported from the reference build's gameConfig.ts.
 * Coordinates are world-space block coordinates of assets/maps/terrain.json.
 */
import type { Vec3 } from './vec';
import type { WeaponId } from './constants';

/** Colliders that block players but let enemies through (window/door gaps). */
export interface InvisibleWall {
  position: Vec3; // center
  halfExtents: Vec3;
}

export const INVISIBLE_WALLS: readonly InvisibleWall[] = [
  { position: { x: 2.5, y: 1, z: 25 }, halfExtents: { x: 1, y: 5, z: 0.5 } }, // Main entrance (south door)
  { position: { x: -4, y: 1, z: 25 }, halfExtents: { x: 1, y: 5, z: 0.5 } }, // Main entrance (south window)
  { position: { x: 13, y: 1, z: 22 }, halfExtents: { x: 0.5, y: 5, z: 1 } }, // Main entrance (east window)
  { position: { x: 8, y: 1, z: 15 }, halfExtents: { x: 1, y: 5, z: 0.5 } }, // Main entrance (north window)
  { position: { x: -8, y: 1, z: 12 }, halfExtents: { x: 1, y: 5, z: 0.5 } }, // Theater (south window)
  { position: { x: -22, y: 1, z: 16 }, halfExtents: { x: 1, y: 5, z: 0.5 } }, // Parlor (south window)
  { position: { x: -26, y: 1, z: -2 }, halfExtents: { x: 1, y: 5, z: 0.5 } }, // Parlor (north window)
  { position: { x: 31, y: 1, z: 15 }, halfExtents: { x: 1, y: 5, z: 0.5 } }, // Dining Hall (south window)
  { position: { x: 31, y: 1, z: -2 }, halfExtents: { x: 1.5, y: 5, z: 0.5 } }, // Dining Hall (north window)
  { position: { x: 26, y: 1, z: -26 }, halfExtents: { x: 2.5, y: 5, z: 0.5 } }, // Art Gallery (north window)
  { position: { x: -29, y: 1, z: -18 }, halfExtents: { x: 0.5, y: 5, z: 1.5 } }, // Kitchen (west window 1)
  { position: { x: -29, y: 1, z: -23 }, halfExtents: { x: 0.5, y: 5, z: 1.5 } }, // Kitchen (west window 2)
];

/** The world axis the barrier fence row runs along. */
export type BarrierAxis = 'x' | 'z';

export interface BarrierConfig {
  name: string;
  removalPrice: number;
  position: Vec3; // center
  axis: BarrierAxis;
  width: number;
  unlockIds: readonly string[];
}

export const PURCHASE_BARRIERS: readonly BarrierConfig[] = [
  { name: 'Theater Room (South)', removalPrice: 300, position: { x: 2.5, y: 1.5, z: 15 }, axis: 'x', width: 5, unlockIds: ['theater'] },
  { name: 'Parlor (South)', removalPrice: 75, position: { x: -8, y: 1.5, z: 18.5 }, axis: 'z', width: 3, unlockIds: ['parlor'] },
  { name: 'Dining Hall (South)', removalPrice: 75, position: { x: 13, y: 1.5, z: 18.5 }, axis: 'z', width: 3, unlockIds: ['dining'] },
  { name: 'Theater Room (West)', removalPrice: 250, position: { x: -15, y: 1.5, z: 3 }, axis: 'z', width: 5, unlockIds: ['theater', 'parlor'] },
  { name: 'Theater Room (East)', removalPrice: 250, position: { x: 19, y: 1.5, z: 3 }, axis: 'z', width: 5, unlockIds: ['theater', 'dining'] },
  { name: 'Art Gallery (South)', removalPrice: 500, position: { x: 26.5, y: 1.5, z: -2 }, axis: 'x', width: 5, unlockIds: ['gallery', 'dining'] },
  { name: 'Kitchen (South)', removalPrice: 500, position: { x: -22, y: 1.5, z: -2 }, axis: 'x', width: 5, unlockIds: ['kitchen', 'parlor'] },
  { name: 'Vault', removalPrice: 1000, position: { x: 0.5, y: 1.5, z: -26 }, axis: 'x', width: 3, unlockIds: ['vault'] },
  { name: 'Treasure Room (West)', removalPrice: 75, position: { x: -15, y: 1.5, z: -19 }, axis: 'z', width: 5, unlockIds: ['treasure', 'kitchen'] },
  { name: 'Treasure Room (East)', removalPrice: 75, position: { x: 20, y: 1.5, z: -19 }, axis: 'z', width: 5, unlockIds: ['treasure', 'gallery'] },
];

export interface CrateConfig {
  name: string;
  position: Vec3;
  yawDeg: number; // visual orientation for the client
  price: number;
  rollableWeaponIds: readonly WeaponId[];
}

export const WEAPON_CRATES: readonly CrateConfig[] = [
  { name: 'Rusty Weapon Crate', position: { x: -3, y: 1.5, z: 16.5 }, yawDeg: 0, price: 100, rollableWeaponIds: ['pistol', 'shotgun', 'ar15'] },
  { name: 'Rusty Weapon Crate', position: { x: 10.5, y: 1.5, z: 16.5 }, yawDeg: 0, price: 100, rollableWeaponIds: ['pistol', 'shotgun', 'ar15'] },
  { name: 'Weapon Crate', position: { x: -27.5, y: 1.5, z: 2.5 }, yawDeg: 90, price: 200, rollableWeaponIds: ['shotgun', 'ar15', 'auto-pistol'] },
  { name: 'Weapon Crate', position: { x: 22, y: 1.5, z: 7 }, yawDeg: -45, price: 200, rollableWeaponIds: ['shotgun', 'ar15', 'auto-pistol'] },
  { name: 'Weapon Crate', position: { x: -23.5, y: 1.5, z: -24.5 }, yawDeg: 0, price: 200, rollableWeaponIds: ['shotgun', 'ar15', 'auto-pistol'] },
  { name: 'Elite Weapon Crate', position: { x: 31, y: 1.5, z: -14.5 }, yawDeg: 45, price: 300, rollableWeaponIds: ['ak47', 'ar15', 'auto-pistol', 'auto-shotgun'] },
  { name: 'Elite Weapon Crate', position: { x: 2.5, y: 2.5, z: -4.5 }, yawDeg: 0, price: 300, rollableWeaponIds: ['ak47', 'ar15', 'auto-pistol', 'auto-shotgun'] },
  { name: 'Elite Weapon Crate', position: { x: 0.5, y: 1.5, z: -29.5 }, yawDeg: 0, price: 300, rollableWeaponIds: ['ak47', 'ar15', 'auto-pistol', 'auto-shotgun'] },
];

export const ENEMY_SPAWN_POINTS: Record<string, readonly Vec3[]> = {
  start: [
    { x: -20, y: 3, z: 34 },
    { x: 12, y: 3, z: 36 },
    { x: 26, y: 3, z: 20 },
    { x: 17, y: 3, z: 13.5 },
  ],
  theater: [{ x: -13.5, y: 3, z: 10 }],
  parlor: [
    { x: -36, y: 3, z: 23 },
    { x: -35, y: 3, z: -5 },
  ],
  dining: [
    { x: 46, y: 3, z: 16 },
    { x: 41, y: 3, z: -5 },
  ],
  gallery: [
    { x: 35, y: 3, z: -39 },
    { x: 12, y: 3, z: -40 },
  ],
  kitchen: [
    { x: -28, y: 3, z: -32 },
    { x: -40, y: 3, z: -5 },
  ],
  treasure: [
    { x: -13, y: 3, z: -27 },
    { x: 0, y: 3, z: -37 },
  ],
};

/** AABB for a barrier's blocking collider (reference: width across its axis, 0.5 deep, 5 half-height). */
export function barrierHalfExtents(barrier: BarrierConfig): Vec3 {
  return barrier.axis === 'x'
    ? { x: barrier.width * 0.5, y: 5, z: 0.5 }
    : { x: 0.5, y: 5, z: barrier.width * 0.5 };
}
