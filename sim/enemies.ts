/**
 * Enemy behavior: target the nearest standing player, chase with gravity and
 * collision, hop over low obstacles, deal contact damage on an interval.
 * Enemies ignore invisible walls and purchase barriers — that asymmetry is
 * the core map design (zombies come in through windows, players can't leave).
 */
import { distSq, entityAABB, aabbOverlap } from './vec';
import type { VoxelMap } from './map';
import { stepMover } from './map';
import type { EnemyState, PlayerState, SimEvent } from './types';
import {
  ENEMY_CONTACT_DAMAGE_INTERVAL_MS,
  ENEMY_RETARGET_MS,
  ENEMY_SEPARATION_PUSH,
  ENEMY_SEPARATION_RADIUS,
  TICK_DT,
} from './constants';

export interface EnemyContext {
  map: VoxelMap;
  players: Map<string, PlayerState>;
  enemies: readonly EnemyState[];
  timeMs: number;
  events: SimEvent[];
  onPlayerDamaged: (player: PlayerState, damage: number) => void;
}

function isTargetable(player: PlayerState | undefined): player is PlayerState {
  return !!player && !player.downed && !player.spectator;
}

function nearestTarget(enemy: EnemyState, players: Map<string, PlayerState>): PlayerState | null {
  let nearest: PlayerState | null = null;
  let nearestDistSq = Infinity;
  for (const player of players.values()) {
    if (!isTargetable(player)) continue;
    const d = distSq(player.pos, enemy.pos);
    if (d < nearestDistSq) {
      nearest = player;
      nearestDistSq = d;
    }
  }
  return nearest;
}

export function stepEnemy(enemy: EnemyState, ctx: EnemyContext): void {
  // Retarget when stale, or immediately when the target went down/left.
  const current = enemy.targetPlayerId ? ctx.players.get(enemy.targetPlayerId) : undefined;
  if (!isTargetable(current) || ctx.timeMs >= enemy.retargetAtMs) {
    const target = nearestTarget(enemy, ctx.players);
    enemy.targetPlayerId = target?.id ?? null;
    enemy.retargetAtMs = ctx.timeMs + ENEMY_RETARGET_MS;
  }

  const target = enemy.targetPlayerId ? ctx.players.get(enemy.targetPlayerId) : undefined;

  if (target) {
    const dx = target.pos.x - enemy.pos.x;
    const dz = target.pos.z - enemy.pos.z;
    const mag = Math.hypot(dx, dz);
    if (mag > 0.01) {
      enemy.vel.x = (dx / mag) * enemy.speed;
      enemy.vel.z = (dz / mag) * enemy.speed;
      enemy.yaw = Math.atan2(-dx, -dz);
    } else {
      enemy.vel.x = 0;
      enemy.vel.z = 0;
    }
  } else {
    enemy.vel.x = 0;
    enemy.vel.z = 0;
  }

  // Cheap separation so a horde doesn't collapse into one column.
  for (const other of ctx.enemies) {
    if (other === enemy || other.health <= 0) continue;
    const dx = enemy.pos.x - other.pos.x;
    const dz = enemy.pos.z - other.pos.z;
    const d = Math.hypot(dx, dz);
    if (d > 0.001 && d < ENEMY_SEPARATION_RADIUS) {
      const push = (ENEMY_SEPARATION_RADIUS - d) / ENEMY_SEPARATION_RADIUS;
      enemy.vel.x += (dx / d) * push * ENEMY_SEPARATION_PUSH;
      enemy.vel.z += (dz / d) * push * ENEMY_SEPARATION_PUSH;
    }
  }

  const { hitWall } = stepMover(ctx.map, enemy, {
    halfWidth: enemy.halfWidth,
    height: enemy.height,
    dt: TICK_DT,
    colliders: [], // enemies pass invisible walls and barriers
    stepUp: true,
  });

  // Blocked by something taller than a step: jump (window sills, furniture).
  if (hitWall && enemy.grounded) {
    enemy.vel.y = Math.sqrt(2 * 28 * Math.min(enemy.jumpHeight, 2.5)) * 0.75;
    enemy.grounded = false;
  }

  // Contact damage with a per-player cooldown; first touch hits immediately.
  const enemyBox = entityAABB(enemy.pos, enemy.halfWidth + 0.15, enemy.height);
  for (const player of ctx.players.values()) {
    if (player.spectator || player.downed) continue;
    const playerBox = entityAABB(player.pos, 0.4, 1.8);
    if (!aabbOverlap(enemyBox, playerBox)) continue;
    const nextAllowed = enemy.nextContactHitAtMs[player.id] ?? 0;
    if (ctx.timeMs >= nextAllowed) {
      enemy.nextContactHitAtMs[player.id] = ctx.timeMs + ENEMY_CONTACT_DAMAGE_INTERVAL_MS;
      ctx.onPlayerDamaged(player, enemy.damage);
    }
  }
}
