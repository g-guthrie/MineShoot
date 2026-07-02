import { CollisionGroup, Quaternion } from 'highchair';
import type { Vector3Like } from 'highchair';

export const INVISIBLE_WALL_COLLISION_GROUP = CollisionGroup.GROUP_1;

// ---------------------------------------------------------------------------
// Boxman world layout: a 3x3 grid of 54-unit biomes centered on the origin.
// Players hold the center biome; each purchase barrier opens one compass
// direction, adding that side's enemy spawns (and access to better crates).
// All heights are snapped to the world collider surfaces (ground = y 0).
// ---------------------------------------------------------------------------

export const INVISIBLE_WALLS = [
  { // North perimeter
    position: { x: 0, y: 12, z: -84 },
    halfExtents: { x: 85, y: 14, z: 0.5 },
  },
  { // South perimeter
    position: { x: 0, y: 12, z: 84 },
    halfExtents: { x: 85, y: 14, z: 0.5 },
  },
  { // East perimeter
    position: { x: 84, y: 12, z: 0 },
    halfExtents: { x: 0.5, y: 14, z: 85 },
  },
  { // West perimeter
    position: { x: -84, y: 12, z: 0 },
    halfExtents: { x: 0.5, y: 14, z: 85 },
  },
]

export const PURCHASE_BARRIERS = [
  {
    name: 'North Gate',
    removalPrice: 75,
    position: { x: 0, y: 1.5, z: -27 },
    rotation: Quaternion.fromEuler(0, 0, 0),
    width: 8,
    unlockIds: [ 'north' ],
  },
  {
    name: 'East Gate',
    removalPrice: 150,
    position: { x: 27, y: 1.5, z: 0 },
    rotation: Quaternion.fromEuler(0, 90, 0),
    width: 8,
    unlockIds: [ 'east' ],
  },
  {
    name: 'West Gate',
    removalPrice: 150,
    position: { x: -27, y: 1.5, z: 0 },
    rotation: Quaternion.fromEuler(0, 90, 0),
    width: 8,
    unlockIds: [ 'west' ],
  },
  {
    name: 'South Gate',
    removalPrice: 300,
    position: { x: 0, y: 1.5, z: 27 },
    rotation: Quaternion.fromEuler(0, 0, 0),
    width: 8,
    unlockIds: [ 'south' ],
  },
]

export const WEAPON_CRATES = [
  {
    name: 'Rusty Weapon Crate',
    position: { x: -2, y: 1.5, z: 6 },
    rotation: Quaternion.fromEuler(0, 0, 0),
    price: 100,
    rollableWeaponIds: [ 'pistol', 'shotgun', 'ar15' ],
  },
  {
    name: 'Rusty Weapon Crate',
    position: { x: 8, y: 1.5, z: 6 },
    rotation: Quaternion.fromEuler(0, 0, 0),
    price: 100,
    rollableWeaponIds: [ 'pistol', 'shotgun', 'ar15' ],
  },
  {
    name: 'Weapon Crate',
    position: { x: 0, y: 1.5, z: -40 },
    rotation: Quaternion.fromEuler(0, 0, 0),
    price: 200,
    rollableWeaponIds: [ 'shotgun', 'ar15', 'auto-pistol' ],
  },
  {
    name: 'Weapon Crate',
    position: { x: 0, y: 1.5, z: 38 },
    rotation: Quaternion.fromEuler(0, 0, 0),
    price: 200,
    rollableWeaponIds: [ 'shotgun', 'ar15', 'auto-pistol' ],
  },
  {
    name: 'Weapon Crate',
    position: { x: -40, y: 1.5, z: 0 },
    rotation: Quaternion.fromEuler(0, 90, 0),
    price: 200,
    rollableWeaponIds: [ 'shotgun', 'ar15', 'auto-pistol' ],
  },
  {
    name: 'Weapon Crate',
    position: { x: 40, y: 1.5, z: 0 },
    rotation: Quaternion.fromEuler(0, 90, 0),
    price: 200,
    rollableWeaponIds: [ 'shotgun', 'ar15', 'auto-pistol' ],
  },
  {
    name: 'Elite Weapon Crate',
    position: { x: 48, y: 1.5, z: 38 },
    rotation: Quaternion.fromEuler(0, 0, 0),
    price: 300,
    rollableWeaponIds: [ 'ak47', 'ar15', 'auto-pistol', 'auto-shotgun' ],
  },
  {
    name: 'Elite Weapon Crate',
    position: { x: -44, y: 1.5, z: -44 },
    rotation: Quaternion.fromEuler(0, 0, 0),
    price: 300,
    rollableWeaponIds: [ 'ak47', 'ar15', 'auto-pistol', 'auto-shotgun' ],
  },
]

export const ENEMY_SPAWN_POINTS: Record<string, Vector3Like[]> = {
  start: [
    { x: 20, y: 1, z: 0 },
    { x: -20, y: 1, z: 0 },
    { x: 0, y: 1, z: 20 },
    { x: 0, y: 1, z: -20 },
  ],
  north: [
    { x: -54, y: 1, z: -44 },
    { x: 0, y: 1, z: -54 },
    { x: 54, y: 1, z: -54 },
  ],
  south: [
    { x: -50, y: 2, z: 54 },
    { x: 0, y: 1, z: 50 },
    { x: 54, y: 1, z: 64 },
  ],
  east: [
    { x: 54, y: 1, z: -10 },
    { x: 54, y: 1, z: 10 },
  ],
  west: [
    { x: -54, y: 1, z: -10 },
    { x: -54, y: 1, z: 10 },
  ],
};
