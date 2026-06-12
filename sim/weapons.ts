/**
 * Hitscan weapon fire: fire-rate/ammo gating, raycast against the voxel map,
 * bullet-blocking colliders (purchase barriers), and enemy hitboxes.
 */
import type { Vec3 } from './vec';
import { entityAABB, lookDirection, normalize, rayAABB } from './vec';
import type { StaticCollider, VoxelMap } from './map';
import type { EnemyState, PlayerState, SimEvent } from './types';
import {
  KILL_REWARD_MULTIPLIER,
  PLAYER_EYE_HEIGHT,
  SHOTGUN_SPREAD,
  WEAPONS,
} from './constants';

export interface FireContext {
  map: VoxelMap;
  bulletBlockers: readonly StaticCollider[];
  enemies: readonly EnemyState[]; // array, not iterator: pellets re-scan it
  timeMs: number;
  events: SimEvent[];
  onEnemyKilled: (enemy: EnemyState) => void;
}

export function startReload(player: PlayerState, timeMs: number, events: SimEvent[]): void {
  const spec = WEAPONS[player.weapon];
  if (player.reloading || player.ammo === spec.clipSize) return;

  // Reference behavior: ammo drops to 0 immediately so a partial clip can't
  // fire during the reload.
  player.ammo = 0;
  player.reloading = true;
  player.reloadEndsAtMs = timeMs + spec.reloadMs;
  events.push({ type: 'reloadStarted', playerId: player.id });
}

export function finishReloadIfDue(player: PlayerState, timeMs: number): void {
  if (player.reloading && timeMs >= player.reloadEndsAtMs) {
    player.ammo = WEAPONS[player.weapon].clipSize;
    player.reloading = false;
  }
}

/** Attempt to fire. Applies damage and rewards; emits shot/hurt/died events. */
export function tryFire(player: PlayerState, ctx: FireContext): void {
  const spec = WEAPONS[player.weapon];

  if (ctx.timeMs - player.lastFireAtMs < 1000 / spec.fireRate) return;

  if (player.ammo <= 0) {
    startReload(player, ctx.timeMs, ctx.events);
    return;
  }

  player.ammo--;
  player.lastFireAtMs = ctx.timeMs;

  const origin: Vec3 = {
    x: player.pos.x,
    y: player.pos.y + PLAYER_EYE_HEIGHT,
    z: player.pos.z,
  };
  const aim = lookDirection(player.yaw, player.pitch);

  const hits: Vec3[] = [];

  for (let pellet = 0; pellet < spec.pellets; pellet++) {
    let dir = aim;
    if (spec.pellets > 1) {
      const spread = SHOTGUN_SPREAD[pellet % SHOTGUN_SPREAD.length]!;
      // Same spread construction as the reference shotgun.
      dir = normalize({
        x: aim.x + aim.z * spread.x,
        y: aim.y + spread.y,
        z: aim.z - aim.x * spread.x,
      });
    }

    const hit = castBullet(origin, dir, spec.range, ctx);

    if (hit.enemy) {
      damageEnemy(hit.enemy, spec.damage, player, ctx);
    }
    if (hit.point) hits.push(hit.point);
  }

  ctx.events.push({ type: 'shot', playerId: player.id, weapon: spec.id, hits });
}

interface BulletHit {
  enemy: EnemyState | null;
  point: Vec3 | null;
}

function castBullet(origin: Vec3, dir: Vec3, range: number, ctx: FireContext): BulletHit {
  let nearestDist = range;
  let point: Vec3 | null = null;

  const blockHit = ctx.map.raycast(origin, dir, range);
  if (blockHit) {
    nearestDist = blockHit.dist;
    point = blockHit.pos;
  }

  for (const blocker of ctx.bulletBlockers) {
    const d = rayAABB(origin, dir, blocker.box, nearestDist);
    if (d !== null && d < nearestDist) {
      nearestDist = d;
      point = pointAt(origin, dir, d);
    }
  }

  let hitEnemy: EnemyState | null = null;
  for (const enemy of ctx.enemies) {
    if (enemy.health <= 0) continue;
    const box = entityAABB(enemy.pos, enemy.halfWidth, enemy.height);
    const d = rayAABB(origin, dir, box, nearestDist);
    if (d !== null && d < nearestDist) {
      nearestDist = d;
      hitEnemy = enemy;
      point = pointAt(origin, dir, d);
    }
  }

  if (!point) point = pointAt(origin, dir, range);

  return { enemy: hitEnemy, point };
}

function pointAt(origin: Vec3, dir: Vec3, d: number): Vec3 {
  return { x: origin.x + dir.x * d, y: origin.y + dir.y * d, z: origin.z + dir.z * d };
}

export function damageEnemy(
  enemy: EnemyState,
  damage: number,
  fromPlayer: PlayerState | null,
  ctx: Pick<FireContext, 'events' | 'onEnemyKilled'>,
): void {
  const effectiveDamage = Math.min(damage, Math.max(enemy.health, 0));
  enemy.health -= damage;

  // Reference economy: pay out damage as a share of max health, plus a kill
  // bonus, so total payout per enemy tracks its configured reward.
  if (fromPlayer) {
    let reward = (effectiveDamage / enemy.maxHealth) * enemy.reward;
    if (enemy.health <= 0) {
      reward += enemy.reward * KILL_REWARD_MULTIPLIER;
    }
    fromPlayer.money = Math.round(fromPlayer.money + reward);
  }

  if (enemy.health <= 0) {
    ctx.events.push({ type: 'enemyDied', enemyId: enemy.id, pos: { ...enemy.pos } });
    ctx.onEnemyKilled(enemy);
  } else {
    ctx.events.push({ type: 'enemyHurt', enemyId: enemy.id });
  }
}
