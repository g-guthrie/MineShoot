/**
 * Wire protocol between browser clients and a ZombiesRoom Durable Object.
 * JSON text frames, validated at the server boundary. v1 sends full
 * snapshots every tick; delta/binary encoding is a later optimization.
 */
import type { GamePhase, PlayerInput, SimEvent } from '../sim/types';
import type { WeaponId, EnemyKind } from '../sim/constants';
import type { ZombiesSim } from '../sim/sim';

export const PROTOCOL_VERSION = 1;

// ---- client -> server ----

export interface JoinMessage {
  type: 'join';
  protocol: number;
  name: string;
  /**
   * Stable per-tab id so a disconnect + reconnect mid-round resumes the same
   * player instead of relegating them to spectator.
   */
  clientId?: string;
}

export interface InputMessage extends PlayerInput {
  type: 'input';
}

export interface PingMessage {
  type: 'ping';
  t: number;
}

export type ClientMessage = JoinMessage | InputMessage | PingMessage;

// ---- server -> client ----

export interface WirePlayer {
  id: string;
  name: string;
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  health: number;
  maxHealth: number;
  money: number;
  downed: boolean;
  spectator: boolean;
  weapon: WeaponId;
  ammo: number;
  reloading: boolean;
  lastInputSeq: number;
  /** Server velocity, used by prediction reconciliation. */
  vx: number;
  vy: number;
  vz: number;
  grounded: boolean;
}

export interface WireEnemy {
  id: number;
  kind: EnemyKind;
  x: number;
  y: number;
  z: number;
  yaw: number;
  health: number;
  maxHealth: number;
}

export interface WireCrate {
  rolledWeaponId: WeaponId | null;
  rolledForPlayerId: string | null;
}

export interface Snapshot {
  tick: number;
  timeMs: number;
  phase: GamePhase;
  countdownS: number;
  wave: number;
  players: WirePlayer[];
  enemies: WireEnemy[];
  /** alive flag per barrier, indexed like PURCHASE_BARRIERS. */
  barriers: boolean[];
  /** indexed like WEAPON_CRATES. */
  crates: WireCrate[];
  events: SimEvent[];
}

export interface WelcomeMessage {
  type: 'welcome';
  protocol: number;
  playerId: string;
  snapshot: Snapshot;
}

export interface SnapshotMessage {
  type: 'snapshot';
  snapshot: Snapshot;
}

export interface PongMessage {
  type: 'pong';
  t: number;
}

export interface ErrorMessage {
  type: 'error';
  code: 'room-full' | 'bad-protocol' | 'bad-message' | 'room-reset';
  message: string;
}

export type ServerMessage = WelcomeMessage | SnapshotMessage | PongMessage | ErrorMessage;

// ---- snapshot building ----

export function buildSnapshot(sim: ZombiesSim, events: SimEvent[]): Snapshot {
  const s = sim.state;
  const players: WirePlayer[] = [];
  for (const p of s.players.values()) {
    players.push({
      id: p.id,
      name: p.name,
      x: round3(p.pos.x),
      y: round3(p.pos.y),
      z: round3(p.pos.z),
      yaw: round3(p.yaw),
      pitch: round3(p.pitch),
      health: p.health,
      maxHealth: p.maxHealth,
      money: p.money,
      downed: p.downed,
      spectator: p.spectator,
      weapon: p.weapon,
      ammo: p.ammo,
      reloading: p.reloading,
      lastInputSeq: p.lastInputSeq,
      vx: round3(p.vel.x),
      vy: round3(p.vel.y),
      vz: round3(p.vel.z),
      grounded: p.grounded,
    });
  }

  const enemies: WireEnemy[] = [];
  for (const e of s.enemies.values()) {
    enemies.push({
      id: e.id,
      kind: e.kind,
      x: round3(e.pos.x),
      y: round3(e.pos.y),
      z: round3(e.pos.z),
      yaw: round3(e.yaw),
      health: Math.max(0, round3(e.health)),
      maxHealth: e.maxHealth,
    });
  }

  return {
    tick: s.tick,
    timeMs: s.timeMs,
    phase: s.phase,
    countdownS: sim.countdownRemainingS,
    wave: s.wave,
    players,
    enemies,
    barriers: s.barriers.map(b => b.alive),
    crates: s.crates.map(c => ({
      rolledWeaponId: c.rolledWeaponId,
      rolledForPlayerId: c.rolledForPlayerId,
    })),
    events,
  };
}

function round3(v: number): number {
  return Math.round(v * 1000) / 1000;
}

// ---- parsing / validation (server boundary) ----

export function parseClientMessage(raw: unknown): ClientMessage | null {
  if (typeof raw !== 'string' || raw.length > 4096) return null;

  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof data !== 'object' || data === null) return null;
  const msg = data as Record<string, unknown>;

  switch (msg.type) {
    case 'join': {
      if (typeof msg.protocol !== 'number') return null;
      const name = typeof msg.name === 'string' ? msg.name.trim().slice(0, 16) : '';
      return {
        type: 'join',
        protocol: msg.protocol,
        name: name || 'Player',
        ...(typeof msg.clientId === 'string' ? { clientId: msg.clientId.slice(0, 40) } : {}),
      };
    }
    case 'input': {
      const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
      return {
        type: 'input',
        seq: num(msg.seq),
        moveX: num(msg.moveX),
        moveZ: num(msg.moveZ),
        yaw: num(msg.yaw),
        pitch: num(msg.pitch),
        jump: msg.jump === true,
        sprint: msg.sprint === true,
        fire: msg.fire === true,
        reload: msg.reload === true,
        interact: msg.interact === true,
      };
    }
    case 'ping':
      return { type: 'ping', t: typeof msg.t === 'number' ? msg.t : 0 };
    default:
      return null;
  }
}

export function parseServerMessage(raw: unknown): ServerMessage | null {
  if (typeof raw !== 'string') return null;
  try {
    const data = JSON.parse(raw) as ServerMessage;
    if (data && typeof data === 'object' && typeof data.type === 'string') return data;
    return null;
  } catch {
    return null;
  }
}
