/**
 * combat.js - Weapon and block tuning shared by the browser client and the
 * Cloudflare room server so damage math always agrees.
 */
export const WEAPONS = {
  machinegun: {
    name: 'AK',
    damage: 14,
    pellets: 1,
    cooldownMs: 110,
    range: 70,
    headshotMult: 1.6,
    magSize: 30,
    reloadMs: 1800,
    auto: true,
    spreadDeg: 1.1,
    sound: 'rifle'
  },
  shotgun: {
    name: 'Shotgun',
    damage: 9,
    pellets: 8,
    cooldownMs: 900,
    range: 26,
    headshotMult: 1.3,
    magSize: 6,
    reloadMs: 2200,
    auto: false,
    spreadDeg: 5.5,
    sound: 'shotgun'
  },
  sniper: {
    name: 'Sniper',
    damage: 85,
    pellets: 1,
    cooldownMs: 1400,
    range: 240,
    headshotMult: 2.0,
    magSize: 5,
    reloadMs: 2400,
    auto: false,
    spreadDeg: 0.05,
    sound: 'sniper'
  },
  pistol: {
    name: 'Pistol',
    damage: 30,
    pellets: 1,
    cooldownMs: 250,
    range: 55,
    headshotMult: 1.7,
    magSize: 8,
    reloadMs: 1400,
    auto: false,
    spreadDeg: 0.6,
    sound: 'pistol'
  }
};

export const WEAPON_SLOTS = ['machinegun', 'shotgun', 'sniper', 'pistol'];

export const BLOCKS = {
  size: 1.4,
  hp: 3,
  maxCarried: 24,
  startCarried: 16,
  regenMs: 1500,
  placeRange: 9
};

export const PLAYER_MAX_HP = 100;
export const RESPAWN_DELAY_MS = 2500;
export const SNAPSHOT_HZ = 15;
export const STATE_SEND_HZ = 20;

export function weaponOrDefault(weaponId) {
  return WEAPONS[weaponId] ? weaponId : WEAPON_SLOTS[0];
}

export function blockKey(ix, iy, iz) {
  return ix + ',' + iy + ',' + iz;
}

export function parseBlockKey(key) {
  const parts = String(key || '').split(',');
  return {
    ix: Number(parts[0] || 0) | 0,
    iy: Number(parts[1] || 0) | 0,
    iz: Number(parts[2] || 0) | 0
  };
}

export function blockCenter(ix, iy, iz) {
  return {
    x: (ix + 0.5) * BLOCKS.size,
    y: (iy + 0.5) * BLOCKS.size,
    z: (iz + 0.5) * BLOCKS.size
  };
}

export function blockBox(ix, iy, iz) {
  const s = BLOCKS.size;
  return {
    min: { x: ix * s, y: iy * s, z: iz * s },
    max: { x: (ix + 1) * s, y: (iy + 1) * s, z: (iz + 1) * s }
  };
}

export function sanitizePlayerName(raw) {
  let name = String(raw || '').replace(/[^\w \-\.]/g, '').trim();
  if (name.length > 16) name = name.slice(0, 16);
  return name || 'Player';
}
