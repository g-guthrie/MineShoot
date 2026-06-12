import type { Vec3 } from './vec';
import type { EnemyKind, WeaponId } from './constants';

export type GamePhase = 'countdown' | 'running' | 'gameover';

/** One frame of intent from a client. Edge-flags are true on press only. */
export interface PlayerInput {
  seq: number;
  moveX: number;
  moveZ: number;
  yaw: number;
  pitch: number;
  jump: boolean;
  sprint: boolean;
  fire: boolean; // held
  reload: boolean; // edge
  interact: boolean; // edge
}

export interface PlayerState {
  id: string;
  name: string;
  pos: Vec3;
  vel: Vec3;
  yaw: number;
  pitch: number;
  grounded: boolean;
  health: number;
  maxHealth: number;
  money: number;
  downed: boolean;
  /** Joined mid-round; gets a body when the next round starts. */
  spectator: boolean;
  weapon: WeaponId;
  ammo: number;
  reloading: boolean;
  reloadEndsAtMs: number;
  lastFireAtMs: number;
  /** Pending revive tick: set while a teammate is reviving this player. */
  reviverId: string | null;
  nextReviveTickAtMs: number;
  lastInputSeq: number;
  /** Latest continuous input plus accumulated edges, consumed each tick. */
  pendingInput: PlayerInput;
  fireHeld: boolean;
  firePressed: boolean;
}

export interface EnemyState {
  id: number;
  kind: EnemyKind;
  pos: Vec3;
  vel: Vec3;
  yaw: number;
  grounded: boolean;
  health: number;
  maxHealth: number;
  speed: number;
  damage: number;
  reward: number;
  jumpHeight: number;
  halfWidth: number;
  height: number;
  targetPlayerId: string | null;
  retargetAtMs: number;
  /** Per-player contact-damage cooldown (sim time of next allowed hit). */
  nextContactHitAtMs: Record<string, number>;
}

export interface BarrierState {
  alive: boolean;
}

export interface CrateState {
  rolledWeaponId: WeaponId | null;
  rolledForPlayerId: string | null;
  rollExpiresAtMs: number;
}

export type SimEvent =
  | { type: 'gameStarted' }
  | { type: 'gameOver'; wave: number }
  | { type: 'waveStarted'; wave: number }
  | { type: 'bossSpawned'; enemyId: number; name: string }
  | { type: 'shot'; playerId: string; weapon: WeaponId; hits: Vec3[] }
  | { type: 'reloadStarted'; playerId: string }
  | { type: 'enemyHurt'; enemyId: number }
  | { type: 'enemyDied'; enemyId: number; pos: Vec3 }
  | { type: 'playerHurt'; playerId: string }
  | { type: 'playerDowned'; playerId: string }
  | { type: 'playerRevived'; playerId: string }
  | { type: 'reviveProgress'; playerId: string; progress: number }
  | { type: 'purchase'; playerId: string }
  | { type: 'barrierRemoved'; barrierId: number; name: string; byPlayerId: string }
  | { type: 'crateRolled'; crateId: number; weapon: WeaponId; playerId: string }
  | { type: 'weaponEquipped'; playerId: string; weapon: WeaponId }
  | { type: 'message'; text: string; color: string; toPlayerId?: string };

export interface SimState {
  tick: number;
  timeMs: number;
  phase: GamePhase;
  countdownEndsAtMs: number;
  wave: number;
  unlockedIds: Set<string>;
  /** Players that were part of the running round and may rejoin mid-game. */
  activePlayerIds: Set<string>;
  nextWaveAtMs: number;
  nextSpawnAtMs: number;
  allDownedSinceMs: number;
  gameOverResetAtMs: number;
  nextEnemyId: number;
  players: Map<string, PlayerState>;
  enemies: Map<number, EnemyState>;
  barriers: BarrierState[];
  crates: CrateState[];
}
