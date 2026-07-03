import { Vector3Like, World } from 'highchair';

import { PLAYER_HITBOX } from '../gameConfig';
import GamePlayerEntity from './GamePlayerEntity';

/**
 * THE shot-resolution path. Everything that asks "what would this ray hit"
 * goes through here — gun fire, the red in-range reticle probe, mobile
 * autofire — so they can never disagree. Players are tested against the
 * canonical PLAYER_HITBOX boxes (mirrored in the client's prediction and
 * H-mode debug draw); world geometry occludes via the physics ray.
 */
export interface ShotResolution {
  /** The player hit, if any (nearest, un-occluded). */
  target?: GamePlayerEntity;
  /** Distance to whatever the shot stopped at. */
  distance: number;
  headshot: boolean;
  /** Where the shot stopped: player, world surface, or max range. */
  endPoint: Vector3Like;
  /** Block hit (player-built voxel), when no player was closer. */
  hitBlock?: import('highchair').Block;
}

export function resolveShot(
  world: World,
  shooter: GamePlayerEntity,
  origin: Vector3Like,
  direction: Vector3Like,
  length: number,
): ShotResolution {
  // World geometry (and built blocks). Player capsules are ignored — the
  // analytic hitboxes below are the authority on players.
  const raycastHit = world.simulation.raycast(origin, direction, length, {
    filterExcludeRigidBody: shooter.rawRigidBody,
  });
  const worldHitIsPlayer = raycastHit?.hitEntity instanceof GamePlayerEntity;
  const occlusionDistance = raycastHit?.hitPoint && !worldHitIsPlayer
    ? Math.hypot(raycastHit.hitPoint.x - origin.x, raycastHit.hitPoint.y - origin.y, raycastHit.hitPoint.z - origin.z)
    : length;

  let best: { target: GamePlayerEntity; t: number; headshot: boolean } | undefined;
  for (const entity of world.entityManager.getAllPlayerEntities()) {
    if (!(entity instanceof GamePlayerEntity) || entity === shooter || entity.isDead || !entity.isSpawned) continue;
    const hit = rayVsPlayerHitbox(origin, direction, entity);
    if (!hit || hit.t > occlusionDistance) continue;
    if (!best || hit.t < best.t) best = { target: entity, t: hit.t, headshot: hit.headshot };
  }

  if (best) {
    return {
      target: best.target,
      distance: best.t,
      headshot: best.headshot,
      endPoint: {
        x: origin.x + direction.x * best.t,
        y: origin.y + direction.y * best.t,
        z: origin.z + direction.z * best.t,
      },
    };
  }

  return {
    distance: occlusionDistance,
    headshot: false,
    endPoint: raycastHit?.hitPoint && !worldHitIsPlayer
      ? raycastHit.hitPoint
      : {
          x: origin.x + direction.x * length,
          y: origin.y + direction.y * length,
          z: origin.z + direction.z * length,
        },
    hitBlock: raycastHit?.hitBlock ?? undefined,
  };
}

/**
 * Ray vs the canonical player hitboxes: an axis-aligned body box (feet to
 * head-base) and a head box above it, sized as fractions of entity height.
 */
export function rayVsPlayerHitbox(
  origin: Vector3Like,
  direction: Vector3Like,
  target: GamePlayerEntity,
): { t: number; headshot: boolean } | undefined {
  const h = target.height;
  const center = target.position;
  const feetY = center.y - h / 2;
  const bodyHalf = h * PLAYER_HITBOX.bodyHalfWidthFrac;
  const headHalf = h * PLAYER_HITBOX.headHalfWidthFrac;
  const splitY = feetY + h * PLAYER_HITBOX.bodyTopFrac;

  const headT = rayVsAabb(origin, direction,
    { x: center.x - headHalf, y: splitY, z: center.z - headHalf },
    { x: center.x + headHalf, y: feetY + h * PLAYER_HITBOX.headTopFrac, z: center.z + headHalf });
  const bodyT = rayVsAabb(origin, direction,
    { x: center.x - bodyHalf, y: feetY, z: center.z - bodyHalf },
    { x: center.x + bodyHalf, y: splitY, z: center.z + bodyHalf });

  if (headT === undefined && bodyT === undefined) return undefined;
  if (headT !== undefined && (bodyT === undefined || headT <= bodyT)) {
    return { t: headT, headshot: true };
  }
  return { t: bodyT!, headshot: false };
}

/** Slab-test ray vs AABB; returns entry distance (>= 0) or undefined. */
export function rayVsAabb(origin: Vector3Like, dir: Vector3Like, min: Vector3Like, max: Vector3Like): number | undefined {
  let tMin = 0;
  let tMax = Infinity;
  const axes: Array<'x' | 'y' | 'z'> = ['x', 'y', 'z'];
  for (const a of axes) {
    const d = dir[a];
    if (Math.abs(d) < 1e-9) {
      if (origin[a] < min[a] || origin[a] > max[a]) return undefined;
      continue;
    }
    const inv = 1 / d;
    let t1 = (min[a] - origin[a]) * inv;
    let t2 = (max[a] - origin[a]) * inv;
    if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
    tMin = Math.max(tMin, t1);
    tMax = Math.min(tMax, t2);
    if (tMin > tMax) return undefined;
  }
  return tMin;
}
