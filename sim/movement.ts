/**
 * Player movement step. This exact function runs on the Durable Object
 * (authoritative) and in the browser (prediction), so predicted and
 * authoritative positions agree to floating-point noise.
 */
import type { VoxelMap, StaticCollider, MoverState } from './map';
import { stepMover } from './map';
import {
  PLAYER_DOWNED_SPEED,
  PLAYER_HALF_WIDTH,
  PLAYER_HEIGHT,
  PLAYER_JUMP_VELOCITY,
  PLAYER_SPRINT_SPEED,
  PLAYER_WALK_SPEED,
  TICK_DT,
} from './constants';

export interface MoveInput {
  moveX: number; // strafe, -1..1 (right positive)
  moveZ: number; // forward, -1..1 (forward positive)
  yaw: number;
  jump: boolean;
  sprint: boolean;
}

export function stepPlayerMovement(
  map: VoxelMap,
  mover: MoverState,
  input: MoveInput,
  downed: boolean,
  colliders: readonly StaticCollider[],
): void {
  const speed = downed ? PLAYER_DOWNED_SPEED : input.sprint ? PLAYER_SPRINT_SPEED : PLAYER_WALK_SPEED;

  // Yaw-relative move direction. Yaw 0 faces -z; right is +x.
  const sin = Math.sin(input.yaw);
  const cos = Math.cos(input.yaw);
  let dx = input.moveX * cos + input.moveZ * -sin;
  let dz = input.moveX * -sin + input.moveZ * -cos;
  const mag = Math.hypot(dx, dz);
  if (mag > 1) {
    dx /= mag;
    dz /= mag;
  }

  mover.vel.x = dx * speed;
  mover.vel.z = dz * speed;

  if (input.jump && mover.grounded && !downed) {
    mover.vel.y = PLAYER_JUMP_VELOCITY;
    mover.grounded = false;
  }

  stepMover(map, mover, {
    halfWidth: PLAYER_HALF_WIDTH,
    height: PLAYER_HEIGHT,
    dt: TICK_DT,
    colliders,
    stepUp: true,
  });
}
