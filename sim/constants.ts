/**
 * Game tuning constants, ported from the reference build (zombies-game).
 * Values here are the gameplay contract — change them deliberately.
 */

export const TICK_MS = 50; // 20 Hz authoritative tick
export const TICK_DT = TICK_MS / 1000;

// --- Round / wave pacing (GameManager.ts) ---
export const GAME_START_COUNTDOWN_S = 45;
export const WAVE_INTERVAL_MS = 30_000;
export const SLOWEST_SPAWN_INTERVAL_MS = 4_000;
export const FASTEST_SPAWN_INTERVAL_MS = 750;
export const WAVE_SPAWN_INTERVAL_REDUCTION_MS = 300;
export const WAVE_DELAY_MS = 10_000; // inter-wave spawn lull
export const RIPPER_WAVE_INTERVAL = 5; // boss every N waves
export const GAME_OVER_RESET_MS = 5_000; // game-over screen before back to lobby
export const ALL_DOWNED_GRACE_MS = 1_000; // matches reference end-game debounce
// Not in the reference (it melted down instead): hard cap on live enemies.
export const MAX_LIVE_ENEMIES = 80;

export function spawnIntervalForWave(wave: number): number {
  return Math.max(
    FASTEST_SPAWN_INTERVAL_MS,
    SLOWEST_SPAWN_INTERVAL_MS - wave * WAVE_SPAWN_INTERVAL_REDUCTION_MS,
  );
}

// --- Players (GamePlayerEntity.ts) ---
export const PLAYER_BASE_HEALTH = 100;
export const PLAYER_REGEN_HP_PER_S = 1;
export const REVIVE_REQUIRED_HEALTH = 50;
export const REVIVE_TICK_MS = 1_000;
export const REVIVE_HP_PER_TICK = 10;
export const REVIVE_DISTANCE = 3;
export const INTERACT_RANGE = 4;
export const PLAYER_SPAWN = { x: 2, y: 10, z: 19 };

export const PLAYER_HALF_WIDTH = 0.4;
export const PLAYER_HEIGHT = 1.8;
export const PLAYER_EYE_HEIGHT = 1.6;
export const PLAYER_WALK_SPEED = 4.5;
export const PLAYER_SPRINT_SPEED = 7.5;
export const PLAYER_DOWNED_SPEED = 1;
export const PLAYER_JUMP_VELOCITY = 9;
export const GRAVITY = 28;
export const STEP_UP_HEIGHT = 1.01; // walk up single-block ledges

// --- Enemies (EnemyEntity.ts and subclasses) ---
export const ENEMY_RETARGET_MS = 5_000;
export const ENEMY_CONTACT_DAMAGE_INTERVAL_MS = 1_000;
export const KILL_REWARD_MULTIPLIER = 0.5;
export const ENEMY_SEPARATION_RADIUS = 0.8;
export const ENEMY_SEPARATION_PUSH = 4; // m/s^2-ish horizontal push apart

export type EnemyKind = 'zombie' | 'ripper';

export interface EnemyStats {
  health: number;
  speed: number;
  damage: number;
  reward: number;
  jumpHeight: number;
  halfWidth: number;
  height: number;
}

export function zombieStatsForWave(wave: number): EnemyStats {
  return {
    health: 7 + wave * 0.25,
    speed: Math.min(6, 2 + wave * 0.25),
    damage: 2,
    reward: 20,
    jumpHeight: 2,
    halfWidth: 0.35,
    height: 1.7,
  };
}

export function ripperStatsForWave(wave: number): EnemyStats {
  return {
    health: 50 * wave,
    speed: 2 + wave * 0.25,
    damage: 6,
    reward: 50 * wave,
    jumpHeight: 2,
    halfWidth: 0.55,
    height: 2.4,
  };
}

// --- Weapons (GunEntity.ts and subclasses) ---
export type WeaponId = 'pistol' | 'shotgun' | 'ar15' | 'ak47' | 'auto-pistol' | 'auto-shotgun';

export interface WeaponSpec {
  id: WeaponId;
  name: string;
  iconUri: string;
  clipSize: number;
  damage: number; // per bullet/pellet
  fireRate: number; // shots per second
  range: number; // hitscan range in meters
  reloadMs: number;
  pellets: number;
  auto: boolean; // fires while held vs per-click
}

export const WEAPONS: Record<WeaponId, WeaponSpec> = {
  pistol: {
    id: 'pistol', name: 'Pistol', iconUri: 'icons/pistol.png',
    clipSize: 10, damage: 3, fireRate: 9, range: 50, reloadMs: 1250, pellets: 1, auto: false,
  },
  shotgun: {
    id: 'shotgun', name: 'Shotgun', iconUri: 'icons/shotgun.png',
    clipSize: 3, damage: 4, fireRate: 1.3, range: 8, reloadMs: 1000, pellets: 7, auto: false,
  },
  ar15: {
    id: 'ar15', name: 'AR-15', iconUri: 'icons/ar-15.png',
    clipSize: 30, damage: 4, fireRate: 15, range: 50, reloadMs: 1500, pellets: 1, auto: false,
  },
  ak47: {
    id: 'ak47', name: 'AK-47', iconUri: 'icons/ak-47.png',
    clipSize: 30, damage: 3, fireRate: 10, range: 50, reloadMs: 1500, pellets: 1, auto: true,
  },
  'auto-pistol': {
    id: 'auto-pistol', name: 'Auto Pistol', iconUri: 'icons/auto-pistol.png',
    clipSize: 20, damage: 3, fireRate: 7, range: 50, reloadMs: 1250, pellets: 1, auto: true,
  },
  'auto-shotgun': {
    id: 'auto-shotgun', name: 'Auto Shotgun', iconUri: 'icons/auto-shotgun.png',
    clipSize: 4, damage: 4, fireRate: 2, range: 8, reloadMs: 2500, pellets: 7, auto: true,
  },
};

/** Shotgun pellet spread offsets, applied relative to the aim direction. */
export const SHOTGUN_SPREAD: ReadonlyArray<{ x: number; y: number }> = [
  { x: 0, y: 0 },
  { x: 0.035, y: 0.035 },
  { x: -0.035, y: 0.035 },
  { x: 0.05, y: 0 },
  { x: -0.05, y: 0 },
  { x: 0.035, y: -0.035 },
  { x: -0.035, y: -0.035 },
];

export const CRATE_ROLL_CLAIM_TIMEOUT_MS = 30_000;
export const MAX_PLAYERS_PER_ROOM = 8;
