export const TICK_HZ = 60;
export const SNAPSHOT_HZ = 20;
export const INPUT_HZ = 60;

export const WORLD_BOUNDS = {
  minX: -48,
  maxX: 48,
  minZ: -48,
  maxZ: 48
};

export const PLAYER = {
  maxHealth: 100,
  eyeHeight: 1.62,
  height: 1.8,
  radius: 0.42,
  gravity: 24,
  jumpVelocity: 7.4,
  walkSpeed: 7.8,
  sprintSpeed: 10.6,
  groundAccel: 54,
  airAccel: 18,
  friction: 14,
  respawnMs: 1600
};

export const WEAPONS = {
  rifle: {
    id: 'rifle',
    name: 'Rifle',
    damage: 22,
    range: 86,
    fireIntervalMs: 105,
    spreadRad: 0.006,
    recoilRad: 0.008,
    model: '/assets/weapons/low-poly-fps/models/m4-carbine.glb',
    sound: '/assets/audio/weapons/rifle.mp3'
  },
  pistol: {
    id: 'pistol',
    name: 'Pistol',
    damage: 34,
    range: 64,
    fireIntervalMs: 240,
    spreadRad: 0.004,
    recoilRad: 0.012,
    model: '/assets/weapons/low-poly-fps/models/m1911.glb',
    sound: '/assets/audio/weapons/pistol.mp3'
  },
  shotgun: {
    id: 'shotgun',
    name: 'Shotgun',
    damage: 13,
    pellets: 7,
    range: 34,
    fireIntervalMs: 760,
    spreadRad: 0.055,
    recoilRad: 0.026,
    model: '/assets/weapons/low-poly-fps/models/shotgun.glb',
    sound: '/assets/audio/weapons/shotgun.mp3'
  }
};

export const DEFAULT_LOADOUT = ['rifle', 'pistol', 'shotgun'];

export const BOT = {
  count: 5,
  thinkMs: 160,
  fireRange: 62,
  strafeChance: 0.4
};

