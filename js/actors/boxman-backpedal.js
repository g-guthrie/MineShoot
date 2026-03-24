export const BACKPEDAL_START_DURATION = 0.18;

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

export function isPureBackpedal(animState) {
  const state = animState || null;
  if (!state || state.airborne) return false;
  return !!(
    state.movingBackward &&
    !state.movingForward &&
    !state.movingLeft &&
    !state.movingRight
  );
}

export function createBackpedalState() {
  return {
    active: false,
    wasActive: false,
    startRemaining: 0,
    phase: 0
  };
}

export function updateBackpedalState(state, dt, animState) {
  const next = state || createBackpedalState();
  const delta = Math.max(0, Number(dt || 0));
  const active = isPureBackpedal(animState);

  if (active && !next.wasActive) {
    next.startRemaining = BACKPEDAL_START_DURATION;
  } else if (!active) {
    next.startRemaining = 0;
  }

  if (active) {
    const speedNorm = clamp01(animState && animState.speedNorm);
    const cadence = lerp(1.4, 2.3, animState && animState.sprinting ? Math.max(speedNorm, 0.7) : speedNorm);
    next.phase = (Number(next.phase || 0) + (delta * cadence * Math.PI * 2)) % (Math.PI * 2);
    next.startRemaining = Math.max(0, Number(next.startRemaining || 0) - delta);
  }

  next.active = active;
  next.wasActive = active;
  return next;
}

export function applyBackpedalPose(rig, state, animState) {
  if (!rig || !state || !state.active) return false;

  const speedNorm = clamp01(animState && animState.speedNorm);
  const phase = Number(state.phase || 0);
  const strideSwing = Math.sin(phase);
  const strideLift = Math.max(0, Math.sin(phase + (Math.PI * 0.5)));
  const oppositeLift = Math.max(0, Math.sin(phase - (Math.PI * 0.5)));
  const baseWeight = lerp(0.35, 1, speedNorm);
  const startProgress = 1 - (Math.max(0, Number(state.startRemaining || 0)) / BACKPEDAL_START_DURATION);
  const startBlend = smoothstep(startProgress);
  const startArc = Math.sin(startBlend * Math.PI);

  // Keep the combat read steady: soften into the retreat, sit back slightly,
  // and let the lower body do most of the work while the chest stays engaged.
  if (rig.bodyUpper) {
    rig.bodyUpper.rotation.x += (0.05 * baseWeight) + (0.14 * startArc);
    rig.bodyUpper.rotation.z += strideSwing * 0.02 * baseWeight;
  }
  if (rig.bodyLower) {
    rig.bodyLower.rotation.x += (0.025 * baseWeight) + (0.08 * startArc);
    rig.bodyLower.rotation.z += strideSwing * -0.014 * baseWeight;
  }
  if (rig.headBone) {
    rig.headBone.rotation.x += 0.025 * baseWeight;
    rig.headBone.rotation.z += strideSwing * -0.01 * baseWeight;
  }
  if (rig.armUpperL) {
    rig.armUpperL.rotation.x += 0.03 + (0.04 * startArc);
    rig.armUpperL.rotation.z += 0.02;
  }
  if (rig.armUpperR) {
    rig.armUpperR.rotation.x += 0.03 + (0.04 * startArc);
    rig.armUpperR.rotation.z -= 0.02;
  }
  if (rig.legUpperL) {
    rig.legUpperL.rotation.x += (-0.1 * startArc) + (0.08 * oppositeLift) - (0.04 * strideSwing * baseWeight);
    rig.legUpperL.rotation.z += 0.01;
  }
  if (rig.legUpperR) {
    rig.legUpperR.rotation.x += (-0.1 * startArc) + (0.08 * strideLift) + (0.04 * strideSwing * baseWeight);
    rig.legUpperR.rotation.z -= 0.01;
  }
  if (rig.legLowerL) {
    rig.legLowerL.rotation.x += 0.11 + (0.16 * oppositeLift) + (0.08 * startArc);
  }
  if (rig.legLowerR) {
    rig.legLowerR.rotation.x += 0.11 + (0.16 * strideLift) + (0.08 * startArc);
  }

  return true;
}
