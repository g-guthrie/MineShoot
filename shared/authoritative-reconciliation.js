import { stepAuthoritativeMovement } from './authoritative-movement.js';
import { EYE_HEIGHT, PLAYER_HEIGHT, PLAYER_RADIUS } from './entity-constants.js';

export function buildMotionStateFromSnapshot(state, options = {}) {
  const fallbackYaw = typeof options.fallbackYaw === 'number' ? Number(options.fallbackYaw) : 0;
  const fallbackPitch = typeof options.fallbackPitch === 'number' ? Number(options.fallbackPitch) : 0;
  const fallbackGroundHeightAt = typeof options.getGroundHeightAt === 'function' ? options.getGroundHeightAt : (() => 0);
  const eyeHeight = Number(options.eyeHeight || EYE_HEIGHT);
  const x = Number(state && state.x || 0);
  const z = Number(state && state.z || 0);
  return {
    x: x,
    y: (state && typeof state.y === 'number' && isFinite(state.y))
      ? Number(state.y)
      : (Number(fallbackGroundHeightAt(x, z) || 0) + eyeHeight),
    z: z,
    yaw: (state && typeof state.yaw === 'number' && isFinite(state.yaw)) ? Number(state.yaw) : fallbackYaw,
    pitch: (state && typeof state.pitch === 'number' && isFinite(state.pitch)) ? Number(state.pitch) : fallbackPitch,
    velocityY: Number(state && state.velocityY || 0),
    isGrounded: !!(state && state.isGrounded),
    jumpHoldTimer: Number(state && state.jumpHoldTimer || 0),
    jumpHeldLast: !!(state && state.jumpHeldLast),
    moveSpeedNorm: Number(state && state.moveSpeedNorm || 0),
    sprinting: !!(state && state.sprinting)
  };
}

export function shouldReplayAuthoritativeCorrection(options = {}) {
  const pendingInputCount = Math.max(0, Number(options.pendingInputCount || 0));
  const lastAckedSeq = Math.max(0, Number(options.lastAckedSeq || 0));
  const lastReplayAckSeq = Math.max(0, Number(options.lastReplayAckSeq || 0));
  const horizontalDistSq = Math.max(0, Number(options.horizontalDistSq || 0));
  const replayDistance = Math.max(0, Number(options.replayCorrectionDistance || 0.55));
  const latestPendingAgeMs = Math.max(0, Number(options.latestPendingAgeMs || 0));
  const minPendingAgeMs = Math.max(0, Number(options.minPendingAgeMs || 0));
  const movingIntent = !!options.movingIntent;
  const canCorrectWhileMoving = options.canCorrectWhileMoving !== false;
  const allowFreshPendingReplay = options.allowFreshPendingReplay === true;
  return pendingInputCount > 0 &&
    lastAckedSeq > 0 &&
    lastAckedSeq !== lastReplayAckSeq &&
    horizontalDistSq >= (replayDistance * replayDistance) &&
    (!movingIntent || canCorrectWhileMoving) &&
    (allowFreshPendingReplay || latestPendingAgeMs >= minPendingAgeMs);
}

export function replayMotionState(snapshotState, pendingInputs, options = {}) {
  const stepMovement = typeof options.stepMovement === 'function' ? options.stepMovement : stepAuthoritativeMovement;
  const state = buildMotionStateFromSnapshot(snapshotState, options);
  const bounds = options.bounds || { minX: -Infinity, maxX: Infinity, minZ: -Infinity, maxZ: Infinity };
  const collisionBoxes = Array.isArray(options.collisionBoxes) ? options.collisionBoxes : [];
  const getGroundHeightAt = typeof options.getGroundHeightAt === 'function' ? options.getGroundHeightAt : (() => 0);
  const movementLocked = typeof options.movementLocked === 'function'
    ? options.movementLocked
    : (() => !!options.movementLocked);

  const entries = Array.isArray(pendingInputs) ? pendingInputs : [];
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    if (!entry || !entry.inputState) continue;
    const dtSec = Math.max(1 / 240, Math.min(0.075, Number(entry.dtMs || 50) / 1000));
    state.yaw = (typeof entry.yaw === 'number' && isFinite(entry.yaw)) ? Number(entry.yaw) : state.yaw;
    state.pitch = (typeof entry.pitch === 'number' && isFinite(entry.pitch)) ? Number(entry.pitch) : state.pitch;
    stepMovement(state, entry.inputState, {
      dtSec: dtSec,
      bounds: bounds,
      collisionBoxes: collisionBoxes,
      getGroundHeightAt: getGroundHeightAt,
      movementLocked: !!movementLocked(entry, state),
      eyeHeight: Number(options.eyeHeight || EYE_HEIGHT),
      playerHeight: Number(options.playerHeight || PLAYER_HEIGHT),
      playerRadius: Number(options.playerRadius || PLAYER_RADIUS),
      epsilon: Number(options.epsilon || 0.001)
    });
  }
  return state;
}

const runtime = (typeof globalThis !== 'undefined') ? globalThis : {};
runtime.__MAYHEM_RUNTIME = runtime.__MAYHEM_RUNTIME || {};
runtime.__MAYHEM_RUNTIME.GameShared = runtime.__MAYHEM_RUNTIME.GameShared || {};
runtime.__MAYHEM_RUNTIME.GameShared.authoritativeReconciliation = {
  buildMotionStateFromSnapshot,
  shouldReplayAuthoritativeCorrection,
  replayMotionState
};
