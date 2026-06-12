/**
 * Client-side prediction for the local player. Because the movement step is
 * the same shared sim code the server runs, replaying unacknowledged inputs
 * on top of each authoritative snapshot converges exactly.
 */
import { stepPlayerMovement } from '../../sim/movement';
import { colliderFromCenter } from '../../sim/map';
import type { StaticCollider, VoxelMap } from '../../sim/map';
import type { PlayerInput } from '../../sim/types';
import type { Snapshot, WirePlayer } from '../../protocol/index';
import { INVISIBLE_WALLS, PURCHASE_BARRIERS, barrierHalfExtents } from '../../sim/mapConfig';
import type { Vec3 } from '../../sim/vec';

export class Prediction {
  pos: Vec3 = { x: 0, y: 0, z: 0 };
  private vel: Vec3 = { x: 0, y: 0, z: 0 };
  private grounded = false;
  private pending: PlayerInput[] = [];
  private wallColliders: StaticCollider[];
  private barrierColliders: StaticCollider[];
  private barrierAlive: boolean[] = PURCHASE_BARRIERS.map(() => true);

  constructor(private readonly map: VoxelMap) {
    this.wallColliders = INVISIBLE_WALLS.map(w => ({
      box: colliderFromCenter(w.position, w.halfExtents),
      blocksPlayers: true,
      blocksEnemies: false,
      blocksBullets: false,
    }));
    this.barrierColliders = PURCHASE_BARRIERS.map(b => ({
      box: colliderFromCenter(b.position, barrierHalfExtents(b)),
      blocksPlayers: true,
      blocksEnemies: false,
      blocksBullets: true,
    }));
  }

  /** Apply a freshly sent input immediately (the predicted step). */
  predict(input: PlayerInput, downed: boolean): void {
    this.pending.push(input);
    this.step(input, downed);
  }

  /** Reconcile against the authoritative state, replaying unacked inputs. */
  reconcile(me: WirePlayer, snapshot: Snapshot): void {
    this.barrierAlive = snapshot.barriers;

    this.pending = this.pending.filter(i => i.seq > me.lastInputSeq);
    this.pos = { x: me.x, y: me.y, z: me.z };
    this.vel = { x: me.vx, y: me.vy, z: me.vz };
    this.grounded = me.grounded;
    for (const input of this.pending) {
      this.step(input, me.downed);
    }
  }

  private step(input: PlayerInput, downed: boolean): void {
    const mover = { pos: this.pos, vel: this.vel, grounded: this.grounded };
    stepPlayerMovement(this.map, mover, input, downed, this.activeColliders());
    this.pos = mover.pos;
    this.vel = mover.vel;
    this.grounded = mover.grounded;
  }

  private activeColliders(): StaticCollider[] {
    return [
      ...this.wallColliders,
      ...this.barrierColliders.filter((_, i) => this.barrierAlive[i] !== false),
    ];
  }
}
