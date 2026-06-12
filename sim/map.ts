/**
 * Voxel world: solid-block lookup, hitscan raycast, and AABB movement with
 * collision. Pure data in, pure data out — shared by the Durable Object
 * (authoritative physics) and the browser client (prediction).
 */
import type { AABB, Vec3 } from './vec';
import { GRAVITY, STEP_UP_HEIGHT } from './constants';

export interface MapBlockType {
  id: number;
  name: string;
  textureUri: string;
  isCustom: boolean;
}

/** Shape of assets/maps/terrain.json. Block key "x,y,z" occupies [x,x+1)^3. */
export interface MapData {
  blockTypes: MapBlockType[];
  blocks: Record<string, number>;
}

const COORD_OFFSET = 512;
const COORD_BITS = 10;

function packKey(x: number, y: number, z: number): number {
  return (
    (x + COORD_OFFSET) |
    ((y + COORD_OFFSET) << COORD_BITS) |
    ((z + COORD_OFFSET) << (COORD_BITS * 2))
  );
}

export interface StaticCollider {
  box: AABB;
  /** Colliders are filtered per mover: invisible walls and barriers block players only. */
  blocksPlayers: boolean;
  blocksEnemies: boolean;
  blocksBullets: boolean;
}

export function colliderFromCenter(center: Vec3, halfExtents: Vec3): AABB {
  return {
    min: { x: center.x - halfExtents.x, y: center.y - halfExtents.y, z: center.z - halfExtents.z },
    max: { x: center.x + halfExtents.x, y: center.y + halfExtents.y, z: center.z + halfExtents.z },
  };
}

export interface RaycastHit {
  dist: number;
  pos: Vec3;
}

export class VoxelMap {
  private readonly solid = new Set<number>();
  readonly minY: number;

  constructor(data: MapData) {
    let minY = Infinity;
    for (const key of Object.keys(data.blocks)) {
      const [xs, ys, zs] = key.split(',');
      const x = Number(xs);
      const y = Number(ys);
      const z = Number(zs);
      this.solid.add(packKey(x, y, z));
      if (y < minY) minY = y;
    }
    this.minY = Number.isFinite(minY) ? minY : 0;
  }

  isSolid(x: number, y: number, z: number): boolean {
    return this.solid.has(packKey(Math.floor(x), Math.floor(y), Math.floor(z)));
  }

  /** Voxel DDA raycast. Returns the nearest solid-block hit within maxDist. */
  raycast(origin: Vec3, dir: Vec3, maxDist: number): RaycastHit | null {
    let x = Math.floor(origin.x);
    let y = Math.floor(origin.y);
    let z = Math.floor(origin.z);

    const stepX = dir.x > 0 ? 1 : -1;
    const stepY = dir.y > 0 ? 1 : -1;
    const stepZ = dir.z > 0 ? 1 : -1;

    const tDeltaX = dir.x !== 0 ? Math.abs(1 / dir.x) : Infinity;
    const tDeltaY = dir.y !== 0 ? Math.abs(1 / dir.y) : Infinity;
    const tDeltaZ = dir.z !== 0 ? Math.abs(1 / dir.z) : Infinity;

    const fracX = origin.x - x;
    const fracY = origin.y - y;
    const fracZ = origin.z - z;

    let tMaxX = dir.x !== 0 ? (dir.x > 0 ? (1 - fracX) : fracX) * tDeltaX : Infinity;
    let tMaxY = dir.y !== 0 ? (dir.y > 0 ? (1 - fracY) : fracY) * tDeltaY : Infinity;
    let tMaxZ = dir.z !== 0 ? (dir.z > 0 ? (1 - fracZ) : fracZ) * tDeltaZ : Infinity;

    let t = 0;
    if (this.solid.has(packKey(x, y, z))) {
      return { dist: 0, pos: { ...origin } };
    }

    while (t <= maxDist) {
      if (tMaxX < tMaxY && tMaxX < tMaxZ) {
        x += stepX;
        t = tMaxX;
        tMaxX += tDeltaX;
      } else if (tMaxY < tMaxZ) {
        y += stepY;
        t = tMaxY;
        tMaxY += tDeltaY;
      } else {
        z += stepZ;
        t = tMaxZ;
        tMaxZ += tDeltaZ;
      }
      if (t > maxDist) break;
      if (this.solid.has(packKey(x, y, z))) {
        return {
          dist: t,
          pos: { x: origin.x + dir.x * t, y: origin.y + dir.y * t, z: origin.z + dir.z * t },
        };
      }
    }

    return null;
  }
}

export interface MoverState {
  pos: Vec3; // feet position
  vel: Vec3;
  grounded: boolean;
}

export interface MoveOptions {
  halfWidth: number;
  height: number;
  dt: number;
  colliders: readonly StaticCollider[]; // pre-filtered for this mover kind
  stepUp?: boolean;
}

const EPS = 1e-4;

function overlapsWorld(
  map: VoxelMap,
  pos: Vec3,
  halfWidth: number,
  height: number,
  colliders: readonly StaticCollider[],
): boolean {
  const minX = Math.floor(pos.x - halfWidth);
  const maxX = Math.floor(pos.x + halfWidth);
  const minY = Math.floor(pos.y);
  const maxY = Math.floor(pos.y + height - EPS);
  const minZ = Math.floor(pos.z - halfWidth);
  const maxZ = Math.floor(pos.z + halfWidth);

  for (let bx = minX; bx <= maxX; bx++) {
    for (let by = minY; by <= maxY; by++) {
      for (let bz = minZ; bz <= maxZ; bz++) {
        if (map.isSolid(bx, by, bz)) return true;
      }
    }
  }

  for (const c of colliders) {
    if (
      pos.x - halfWidth < c.box.max.x && pos.x + halfWidth > c.box.min.x &&
      pos.y < c.box.max.y && pos.y + height > c.box.min.y &&
      pos.z - halfWidth < c.box.max.z && pos.z + halfWidth > c.box.min.z
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Integrate one axis of movement, sub-stepping so fast movers can't tunnel
 * through 1-block walls. Returns true if movement was blocked.
 */
function moveAxis(
  map: VoxelMap,
  mover: MoverState,
  axis: 'x' | 'y' | 'z',
  delta: number,
  opts: MoveOptions,
): boolean {
  if (delta === 0) return false;

  const maxStep = 0.45; // < block size minus entity extents
  const steps = Math.max(1, Math.ceil(Math.abs(delta) / maxStep));
  const stepDelta = delta / steps;

  for (let i = 0; i < steps; i++) {
    const prev = mover.pos[axis];
    mover.pos[axis] = prev + stepDelta;
    if (overlapsWorld(map, mover.pos, opts.halfWidth, opts.height, opts.colliders)) {
      mover.pos[axis] = prev;
      return true;
    }
  }

  return false;
}

/**
 * Move an entity with gravity and axis-separated AABB collision.
 * `mover.vel` should already hold the desired horizontal velocity; vertical
 * velocity is integrated here.
 */
export function stepMover(map: VoxelMap, mover: MoverState, opts: MoveOptions): { hitWall: boolean } {
  mover.vel.y -= GRAVITY * opts.dt;

  let hitWall = false;

  for (const axis of ['x', 'z'] as const) {
    const delta = mover.vel[axis] * opts.dt;
    let blocked = moveAxis(map, mover, axis, delta, opts);

    // Walk up single-block ledges: try the move again from one block higher
    // and settle back down onto the ledge.
    if (blocked && opts.stepUp && mover.grounded) {
      const saved = { ...mover.pos };
      mover.pos.y += STEP_UP_HEIGHT;
      if (!overlapsWorld(map, mover.pos, opts.halfWidth, opts.height, opts.colliders)) {
        const stillBlocked = moveAxis(map, mover, axis, delta, opts);
        const dropBlocked = moveAxis(map, mover, 'y', -STEP_UP_HEIGHT, opts);
        if (!stillBlocked && dropBlocked) {
          blocked = false; // stepped up onto the ledge
        } else {
          mover.pos = saved;
        }
      } else {
        mover.pos = saved;
      }
    }

    if (blocked) {
      mover.vel[axis] = 0;
      hitWall = true;
    }
  }

  const dy = mover.vel.y * opts.dt;
  const blockedY = moveAxis(map, mover, 'y', dy, opts);
  if (blockedY) {
    mover.grounded = dy < 0;
    mover.vel.y = 0;
  } else {
    mover.grounded = false;
  }

  return { hitWall };
}
