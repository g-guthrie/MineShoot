const DEG_TO_RAD = Math.PI / 180;
const TWO_PI = Math.PI * 2;

export const DIRECTIONAL_START_BLEND_DURATION = 0.16;
export const TURN_SOFT_START_RATE = 20 * DEG_TO_RAD;
export const TURN_SOFT_FULL_RATE = 90 * DEG_TO_RAD;
export const TURN_ENTRY_RATE = 90 * DEG_TO_RAD;
export const TURN_ENTRY_SPEED_NORM_MAX = 0.15;
const MOVEMENT_FACING_ANCHORS = [
  {
    angle: 0,
    facingYaw: 0,
    retreatLean: 0,
    label: 'forward'
  },
  {
    angle: 45 * DEG_TO_RAD,
    facingYaw: 45 * DEG_TO_RAD,
    retreatLean: 0,
    label: 'forward_diag'
  },
  {
    angle: 90 * DEG_TO_RAD,
    facingYaw: 90 * DEG_TO_RAD,
    retreatLean: 0,
    label: 'strafe'
  },
  {
    angle: 135 * DEG_TO_RAD,
    facingYaw: 30 * DEG_TO_RAD,
    retreatLean: 0.05,
    label: 'back_diag'
  },
  {
    angle: Math.PI,
    facingYaw: 0,
    retreatLean: 0.09,
    label: 'backpedal'
  }
];

function clamp01(value) {
  return Math.max(0, Math.min(1, Number(value || 0)));
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value || 0)));
}

function lerp(a, b, t) {
  return Number(a || 0) + ((Number(b || 0) - Number(a || 0)) * clamp01(t));
}

function smoothstep(value) {
  const t = clamp01(value);
  return t * t * (3 - (2 * t));
}

function normalizeAngle(angle) {
  let out = Number(angle || 0);
  while (out > Math.PI) out -= TWO_PI;
  while (out < -Math.PI) out += TWO_PI;
  return out;
}

function sign(value) {
  if (value > 0) return 1;
  if (value < 0) return -1;
  return 0;
}

function interpolateProfile(absAngle) {
  const clampedAngle = clamp(Math.abs(absAngle), 0, Math.PI);
  for (let i = 1; i < MOVEMENT_FACING_ANCHORS.length; i += 1) {
    const older = MOVEMENT_FACING_ANCHORS[i - 1];
    const newer = MOVEMENT_FACING_ANCHORS[i];
    if (clampedAngle > newer.angle) continue;
    const span = Math.max(0.0001, newer.angle - older.angle);
    const t = clamp01((clampedAngle - older.angle) / span);
    return {
      facingYaw: lerp(older.facingYaw, newer.facingYaw, t),
      retreatLean: lerp(older.retreatLean, newer.retreatLean, t),
      fromLabel: older.label,
      toLabel: newer.label,
      blend: t,
      label: t >= 0.5 ? newer.label : older.label
    };
  }
  const fallback = MOVEMENT_FACING_ANCHORS[MOVEMENT_FACING_ANCHORS.length - 1];
  return {
    facingYaw: fallback.facingYaw,
    retreatLean: fallback.retreatLean,
    fromLabel: fallback.label,
    toLabel: fallback.label,
    blend: 1,
    label: fallback.label
  };
}

export function resolveMoveIntent(animState) {
  const state = animState || {};
  const forwardAxis = (state.movingForward ? 1 : 0) - (state.movingBackward ? 1 : 0);
  const rightAxis = (state.movingRight ? 1 : 0) - (state.movingLeft ? 1 : 0);
  const magnitude = clamp(Math.hypot(forwardAxis, rightAxis), 0, 1);
  const moving = magnitude > 0.001;
  const angle = moving ? Math.atan2(rightAxis, forwardAxis) : 0;
  const absAngle = Math.abs(angle);
  return {
    moving,
    forwardAxis,
    rightAxis,
    magnitude,
    angle,
    absAngle,
    sideSign: sign(angle),
    pureForward: moving && forwardAxis > 0 && rightAxis === 0,
    pureBackpedal: moving && forwardAxis < 0 && rightAxis === 0,
    pureStrafe: moving && forwardAxis === 0 && rightAxis !== 0,
    diagonal: moving && forwardAxis !== 0 && rightAxis !== 0
  };
}

export function createDirectionalLocomotionState() {
  return {
    intent: resolveMoveIntent(null),
    profile: interpolateProfile(0),
    phase: 0,
    startRemaining: 0,
    wasMoving: false,
    moveAngle: 0,
    lastYaw: null,
    turnRate: 0,
    facingYaw: 0,
    targetFacingYaw: 0,
    bodyLowerAimYaw: 0,
    bodyUpperAimYaw: 0,
    headAimYaw: 0,
    useTurnEntryClip: false,
    useTurnLoopClip: false,
    turnClipDirection: 0,
    poseName: ''
  };
}

export function updateDirectionalLocomotionState(state, dt, animState) {
  const next = state || createDirectionalLocomotionState();
  const delta = Math.max(0, Number(dt || 0));
  const movementIntent = resolveMoveIntent(animState);
  const speedNorm = clamp01(animState && animState.speedNorm);
  const sprinting = !!(animState && animState.sprinting);
  const angleDelta = movementIntent.moving && next.wasMoving
    ? Math.abs(normalizeAngle(movementIntent.angle - Number(next.moveAngle || 0)))
    : 0;
  const needsCustomStart = movementIntent.moving && !movementIntent.pureForward;

  if (needsCustomStart && (!next.wasMoving || angleDelta > (35 * DEG_TO_RAD))) {
    next.startRemaining = DIRECTIONAL_START_BLEND_DURATION;
  } else if (!movementIntent.moving) {
    next.startRemaining = 0;
  }

  if (movementIntent.moving) {
    const cadence = lerp(1.4, 2.35, sprinting ? Math.max(speedNorm, 0.7) : speedNorm);
    next.phase = (Number(next.phase || 0) + (delta * cadence * TWO_PI)) % TWO_PI;
    next.startRemaining = Math.max(0, Number(next.startRemaining || 0) - delta);
    next.moveAngle = movementIntent.angle;
  }

  const profile = interpolateProfile(movementIntent.absAngle);
  next.intent = movementIntent;
  next.profile = profile;
  const locomotionYawSign = movementIntent.sideSign === 0 ? 0 : -movementIntent.sideSign;
  next.targetFacingYaw = locomotionYawSign * profile.facingYaw;
  const facingBlend = movementIntent.moving ? Math.min(1, delta * 12) : Math.min(1, delta * 10);
  next.facingYaw += (next.targetFacingYaw - Number(next.facingYaw || 0)) * facingBlend;
  if (Math.abs(next.targetFacingYaw - next.facingYaw) < 0.0001) {
    next.facingYaw = next.targetFacingYaw;
  }
  next.bodyLowerAimYaw = -(next.facingYaw * 0.2);
  next.bodyUpperAimYaw = -(next.facingYaw * 0.25);
  next.headAimYaw = -(next.facingYaw * 0.35);

  let resolvedTurnRate = 0;
  if (animState && Number.isFinite(Number(animState.turnRate))) {
    resolvedTurnRate = Number(animState.turnRate || 0);
  } else if (delta > 0 && animState && typeof animState.yaw === 'number' && typeof next.lastYaw === 'number') {
    resolvedTurnRate = normalizeAngle(Number(animState.yaw || 0) - Number(next.lastYaw || 0)) / delta;
  }
  next.turnRate = resolvedTurnRate;
  next.lastYaw = (animState && typeof animState.yaw === 'number') ? Number(animState.yaw || 0) : next.lastYaw;

  const turnAbs = Math.abs(resolvedTurnRate);
  const turnBlend = clamp01((turnAbs - TURN_SOFT_START_RATE) / Math.max(0.0001, (TURN_SOFT_FULL_RATE - TURN_SOFT_START_RATE)));
  const turnDirection = sign(resolvedTurnRate);
  const canIdleTurnClip = !movementIntent.moving && !(animState && animState.airborne) && speedNorm < TURN_ENTRY_SPEED_NORM_MAX;
  next.useTurnEntryClip = canIdleTurnClip && turnAbs >= TURN_ENTRY_RATE;
  next.useTurnLoopClip = canIdleTurnClip && turnAbs >= TURN_SOFT_START_RATE;
  next.turnClipDirection = (next.useTurnEntryClip || next.useTurnLoopClip) ? turnDirection : 0;
  void turnBlend;

  if (movementIntent.moving) {
    if (movementIntent.pureBackpedal) {
      next.poseName = 'backpedal';
    } else if (movementIntent.pureStrafe) {
      next.poseName = movementIntent.sideSign < 0 ? 'strafe_left' : 'strafe_right';
    } else if (movementIntent.diagonal && movementIntent.forwardAxis > 0) {
      next.poseName = movementIntent.sideSign < 0 ? 'forward_left' : 'forward_right';
    } else if (movementIntent.diagonal && movementIntent.forwardAxis < 0) {
      next.poseName = movementIntent.sideSign < 0 ? 'back_left' : 'back_right';
    } else {
      next.poseName = 'forward';
    }
  } else if (next.useTurnLoopClip || next.useTurnEntryClip) {
    next.poseName = next.turnClipDirection < 0 ? 'turn_right' : 'turn_left';
  } else {
    next.poseName = '';
  }

  next.wasMoving = movementIntent.moving;
  return next;
}

export function applyDirectionalLocomotionPose(rig, state, animState) {
  if (!rig || !state) return false;
  const intent = state.intent || resolveMoveIntent(animState);
  const profile = state.profile || interpolateProfile(intent.absAngle);
  const speedNorm = clamp01(animState && animState.speedNorm);
  const baseWeight = lerp(0.35, 1, speedNorm);
  const hasDirectionalPose = intent.moving || Math.abs(Number(state.facingYaw || 0)) > 0.0001;
  if (!hasDirectionalPose) return false;

  const startProgress = 1 - (Math.max(0, Number(state.startRemaining || 0)) / DIRECTIONAL_START_BLEND_DURATION);
  const startBlend = smoothstep(startProgress);
  const startArc = Math.sin(startBlend * Math.PI);
  if (rig.modelRoot) {
    rig.modelRoot.rotation.y = Number(rig.modelBaseYaw || 0) + Number(state.facingYaw || 0);
  }

  if (rig.bodyLower) {
    rig.bodyLower.rotation.y += Number(state.bodyLowerAimYaw || 0);
    rig.bodyLower.rotation.x += profile.retreatLean * 0.5 * baseWeight;
  }
  if (rig.bodyUpper) {
    rig.bodyUpper.rotation.y += Number(state.bodyUpperAimYaw || 0);
    rig.bodyUpper.rotation.x += (profile.retreatLean * 0.25 * baseWeight) + (profile.retreatLean * 0.4 * startArc);
  }
  if (rig.headBone) {
    rig.headBone.rotation.y += Number(state.headAimYaw || 0);
  }

  return true;
}

export function directionalLocomotionNeedsCustomStart(animState) {
  const intent = resolveMoveIntent(animState);
  return intent.moving && !intent.pureForward;
}
