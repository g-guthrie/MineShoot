import { stepAuthoritativeMovement } from './authoritative-movement.js';
import { EYE_HEIGHT, PLAYER_HEIGHT, PLAYER_RADIUS } from './entity-constants.js';

const MIN_REPLAY_SAMPLE_DT_SEC = 1 / 240;
const MAX_REPLAY_SAMPLE_DT_SEC = 0.075;

function cloneReplayInputState(inputState, createMovementInputState) {
  const base = typeof createMovementInputState === 'function'
    ? (createMovementInputState() || {})
    : {};
  const source = inputState && typeof inputState === 'object' ? inputState : {};
  base.forward = !!source.forward;
  base.backward = !!source.backward;
  base.left = !!source.left;
  base.right = !!source.right;
  base.jump = !!source.jump;
  base.sprint = !!source.sprint;
  base.adsActive = !!source.adsActive;
  return base;
}

export function clampReplaySampleDtSec(dtMs) {
  const parsedMs = Number(dtMs || 0);
  const dtSec = Number.isFinite(parsedMs) ? (parsedMs / 1000) : 0;
  return Math.max(MIN_REPLAY_SAMPLE_DT_SEC, Math.min(MAX_REPLAY_SAMPLE_DT_SEC, dtSec || 0));
}

export function buildReplayStepsFromPendingInputs(pendingInputs, options = {}) {
  const createMovementInputState = typeof options.createMovementInputState === 'function'
    ? options.createMovementInputState
    : null;
  const fallbackYaw = typeof options.fallbackYaw === 'number'
    ? Number(options.fallbackYaw)
    : 0;
  const fallbackPitch = typeof options.fallbackPitch === 'number'
    ? Number(options.fallbackPitch)
    : 0;
  const movementLocked = typeof options.movementLocked === 'function'
    ? options.movementLocked
    : (() => !!options.movementLocked);

  const entries = Array.isArray(pendingInputs) ? pendingInputs : [];
  const weightedEntries = [];
  let totalWeightSec = 0;
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    if (!entry || !entry.inputState) continue;
    const weightSec = clampReplaySampleDtSec(entry.dtMs);
    weightedEntries.push({
      seq: Math.max(0, Number(entry.seq || 0)),
      yaw: (typeof entry.yaw === 'number' && isFinite(entry.yaw)) ? Number(entry.yaw) : fallbackYaw,
      pitch: (typeof entry.pitch === 'number' && isFinite(entry.pitch)) ? Number(entry.pitch) : fallbackPitch,
      inputState: cloneReplayInputState(entry.inputState, createMovementInputState),
      movementLocked: !!(Object.prototype.hasOwnProperty.call(entry, 'movementLocked')
        ? entry.movementLocked
        : movementLocked(entry)),
      weightSec
    });
    totalWeightSec += weightSec;
  }

  if (!(totalWeightSec > 0) || weightedEntries.length === 0) {
    return { steps: [], totalWeightSec: 0, processedSeq: 0 };
  }

  const explicitTotalDtSec = Number(options.totalDtSec);
  const totalDtSec = (isFinite(explicitTotalDtSec) && explicitTotalDtSec > 0)
    ? explicitTotalDtSec
    : totalWeightSec;
  let remainingDtSec = totalDtSec;
  const steps = [];
  for (let i = 0; i < weightedEntries.length; i++) {
    const entry = weightedEntries[i];
    const stepDtSec = i === (weightedEntries.length - 1)
      ? remainingDtSec
      : Math.max(0, totalDtSec * (entry.weightSec / totalWeightSec));
    remainingDtSec = Math.max(0, remainingDtSec - stepDtSec);
    steps.push({
      dtSec: stepDtSec,
      yaw: entry.yaw,
      pitch: entry.pitch,
      inputState: entry.inputState,
      seq: entry.seq,
      movementLocked: entry.movementLocked,
      weightSec: entry.weightSec
    });
  }

  return {
    steps,
    totalWeightSec,
    processedSeq: Math.max(0, Number(weightedEntries[weightedEntries.length - 1].seq || 0))
  };
}

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
    airborneSprintCarry: state && Object.prototype.hasOwnProperty.call(state, 'airborneSprintCarry')
      ? !!state.airborneSprintCarry
      : (!!(state && state.sprinting) && !(state && state.isGrounded)),
    moveSpeedNorm: Number(state && state.moveSpeedNorm || 0),
    sprinting: !!(state && state.sprinting),
    fastBackpedal: !!(state && state.fastBackpedal)
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
  const authoritativeStateChanged = options.authoritativeStateChanged !== false;
  const ackAdvanced = lastAckedSeq !== lastReplayAckSeq;
  return pendingInputCount > 0 &&
    lastAckedSeq > 0 &&
    authoritativeStateChanged &&
    (ackAdvanced || options.allowReplayWithoutAckAdvance === true) &&
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
  const replayPlan = buildReplayStepsFromPendingInputs(pendingInputs, {
    createMovementInputState: options.createMovementInputState,
    fallbackYaw: state.yaw,
    fallbackPitch: state.pitch,
    movementLocked: options.movementLocked
  });

  for (let i = 0; i < replayPlan.steps.length; i++) {
    const step = replayPlan.steps[i];
    if (!step || !step.inputState || !(Number(step.dtSec || 0) > 0)) continue;
    state.yaw = Number(step.yaw || state.yaw);
    state.pitch = Number(step.pitch || state.pitch);
    stepMovement(state, step.inputState, {
      dtSec: Number(step.dtSec || 0),
      bounds: bounds,
      collisionBoxes: collisionBoxes,
      getGroundHeightAt: getGroundHeightAt,
      movementLocked: !!step.movementLocked,
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
  clampReplaySampleDtSec,
  buildReplayStepsFromPendingInputs,
  shouldReplayAuthoritativeCorrection,
  replayMotionState
};
