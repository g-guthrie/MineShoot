export const STRAFE_BLEND_DURATION = 0.14;

function clamp01(value) {
  return Math.max(0, Math.min(1, Number(value || 0)));
}

function smoothstep(value) {
  const t = clamp01(value);
  return t * t * (3 - (2 * t));
}

function lerp(a, b, t) {
  return Number(a || 0) + ((Number(b || 0) - Number(a || 0)) * clamp01(t));
}

export function readPureStrafeDirection(animState) {
  const state = animState || null;
  if (!state || state.airborne) return 0;
  if (state.movingForward || state.movingBackward) return 0;
  if (!!state.movingLeft === !!state.movingRight) return 0;
  return state.movingLeft ? -1 : 1;
}

export function isPureStrafe(animState) {
  return readPureStrafeDirection(animState) !== 0;
}

export function createStrafeState() {
  return {
    active: false,
    wasActive: false,
    direction: 0,
    startRemaining: 0,
    phase: 0
  };
}

export function updateStrafeState(state, dt, animState) {
  const next = state || createStrafeState();
  const delta = Math.max(0, Number(dt || 0));
  const direction = readPureStrafeDirection(animState);
  const active = direction !== 0;

  if (active && (!next.wasActive || next.direction !== direction)) {
    next.startRemaining = STRAFE_BLEND_DURATION;
  } else if (!active) {
    next.startRemaining = 0;
  }

  if (active) {
    const speedNorm = clamp01(animState && animState.speedNorm);
    const cadence = lerp(1.5, 2.35, animState && animState.sprinting ? Math.max(speedNorm, 0.7) : speedNorm);
    next.phase = (Number(next.phase || 0) + (delta * cadence * Math.PI * 2)) % (Math.PI * 2);
    next.startRemaining = Math.max(0, Number(next.startRemaining || 0) - delta);
  }

  next.active = active;
  next.wasActive = active;
  next.direction = direction;
  return next;
}

export function applyStrafePose(rig, state, animState) {
  if (!rig || !state || !state.active || !state.direction) return false;

  const direction = Number(state.direction || 0);
  const speedNorm = clamp01(animState && animState.speedNorm);
  const phase = Number(state.phase || 0);
  const strideSwing = Math.sin(phase);
  const leadLift = Math.max(0, Math.sin(phase + (Math.PI * 0.5)));
  const trailLift = Math.max(0, Math.sin(phase - (Math.PI * 0.5)));
  const baseWeight = lerp(0.35, 1, speedNorm);
  const startProgress = 1 - (Math.max(0, Number(state.startRemaining || 0)) / STRAFE_BLEND_DURATION);
  const startBlend = smoothstep(startProgress);
  const shuffleWeight = lerp(0.45, 1.15, speedNorm);
  const crossover = strideSwing * (0.18 + (0.04 * baseWeight));

  // Side movement should read as a shuffle: the chest stays engaged, the body
  // leans into the move, and the legs slide across each other more than they
  // charge ahead like a forward run.
  if (rig.bodyUpper) {
    rig.bodyUpper.rotation.z += direction * ((0.08 * baseWeight) + (0.04 * startBlend));
    rig.bodyUpper.rotation.y += direction * -0.03 * baseWeight;
    rig.bodyUpper.rotation.x += 0.008 * baseWeight;
  }
  if (rig.bodyLower) {
    rig.bodyLower.rotation.z += direction * ((0.05 * baseWeight) + (0.03 * startBlend));
    rig.bodyLower.rotation.y += direction * -0.02 * baseWeight;
  }
  if (rig.headBone) {
    rig.headBone.rotation.z += direction * -0.015 * baseWeight;
  }
  if (rig.armUpperL) {
    rig.armUpperL.rotation.x += 0.008;
    rig.armUpperL.rotation.z += direction * 0.016;
  }
  if (rig.armUpperR) {
    rig.armUpperR.rotation.x += 0.008;
    rig.armUpperR.rotation.z += direction * 0.016;
  }
  if (rig.legUpperL) {
    rig.legUpperL.rotation.z += (direction * (0.055 + (0.03 * startBlend))) - crossover;
    rig.legUpperL.rotation.y += (direction * 0.035) - (crossover * 0.4);
    rig.legUpperL.rotation.x += (-0.11 * shuffleWeight) + (0.015 * trailLift) - (strideSwing * 0.025 * baseWeight);
  }
  if (rig.legUpperR) {
    rig.legUpperR.rotation.z += (direction * (0.055 + (0.03 * startBlend))) + crossover;
    rig.legUpperR.rotation.y += (direction * 0.035) + (crossover * 0.4);
    rig.legUpperR.rotation.x += (-0.11 * shuffleWeight) + (0.015 * leadLift) + (strideSwing * 0.025 * baseWeight);
  }
  if (rig.legLowerL) {
    rig.legLowerL.rotation.x += 0.22 + (0.1 * trailLift) + (0.025 * startBlend);
  }
  if (rig.legLowerR) {
    rig.legLowerR.rotation.x += 0.22 + (0.1 * leadLift) + (0.025 * startBlend);
  }

  return true;
}
