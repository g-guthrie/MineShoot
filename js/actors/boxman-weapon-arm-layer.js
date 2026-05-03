import { Quaternion } from 'three';

const WEAPON_CARRY_PROFILE = {
  name: 'forward_carry_lock'
};

const IDLE_CAPTURE_PROFILE = {
  name: 'idle_capture'
};

const RIGHT_ARM_BONES = {
  armUpperR: ['arm_upperR', 'arm_upper.R'],
  armLowerR: ['arm_lowerR', 'arm_lower.R']
};
const IDLE_ARM_TRACK_PROPERTIES = ['position', 'quaternion', 'scale'];
const sampledQuaternion = new Quaternion();

function finite(value, fallback) {
  const num = Number(value);
  return Number.isFinite(num) ? num : Number(fallback || 0);
}

function cloneProfile(profile) {
  return profile ? { ...profile } : null;
}

function wrapClipTime(time, duration) {
  const clipDuration = Math.max(0.0001, finite(duration, 0.0001));
  let out = finite(time, 0) % clipDuration;
  if (out < 0) out += clipDuration;
  return out;
}

function parseTrackName(trackName) {
  const name = String(trackName || '');
  const split = name.lastIndexOf('.');
  if (split <= 0 || split >= name.length - 1) return null;
  return {
    nodeName: name.slice(0, split),
    propertyName: name.slice(split + 1)
  };
}

function resolveRightArmBoneKey(nodeName) {
  const normalized = String(nodeName || '');
  const keys = Object.keys(RIGHT_ARM_BONES);
  for (const key of keys) {
    if (RIGHT_ARM_BONES[key].includes(normalized)) return key;
  }
  return '';
}

function createEmptyBoneTrackSet() {
  return {
    position: null,
    quaternion: null,
    scale: null
  };
}

function createTrackSampler(track) {
  if (!track || typeof track.createInterpolant !== 'function') return null;
  return {
    track,
    interpolant: track.createInterpolant()
  };
}

function findIdleClip(animations) {
  const clips = Array.isArray(animations) ? animations : [];
  for (const clip of clips) {
    if (clip && clip.name === 'idle') return clip;
  }
  return null;
}

export function createIdleArmSampler(animations) {
  const idleClip = findIdleClip(animations);
  if (!idleClip || !Array.isArray(idleClip.tracks)) return null;
  const tracks = {
    armUpperR: createEmptyBoneTrackSet(),
    armLowerR: createEmptyBoneTrackSet()
  };
  let sampledTrackCount = 0;

  for (const track of idleClip.tracks) {
    const binding = parseTrackName(track && track.name);
    if (!binding || !IDLE_ARM_TRACK_PROPERTIES.includes(binding.propertyName)) continue;
    const boneKey = resolveRightArmBoneKey(binding.nodeName);
    if (!boneKey) continue;
    const sampler = createTrackSampler(track);
    if (!sampler) continue;
    tracks[boneKey][binding.propertyName] = sampler;
    sampledTrackCount += 1;
  }

  if (!sampledTrackCount) return null;
  return {
    duration: Math.max(0.0001, finite(idleClip.duration, 0.0001)),
    tracks
  };
}

function movementIntent(context) {
  const directional = context && context.directionalState;
  const intent = directional && directional.intent ? directional.intent : null;
  const animState = context && context.animState ? context.animState : {};
  const movingForward = intent
    ? !!intent.pureForward
    : !!animState.movingForward && !animState.movingBackward && !animState.movingLeft && !animState.movingRight;
  const moving = intent
    ? !!intent.moving
    : !!(animState.movingForward || animState.movingBackward || animState.movingLeft || animState.movingRight);
  return {
    moving,
    pureForward: movingForward
  };
}

function stopSettleIntent(context) {
  const weight = Math.max(0, finite(context && context.stopSettleWeight, 0));
  if (!(weight > 0)) return null;
  const directional = context && (context.stopDirectionalState || context.stopDirectionalSnapshot);
  return directional && directional.intent ? directional.intent : null;
}

function stopSettleUsesCarryProfile(intent) {
  return !!(intent && (intent.pureForward || intent.pureStrafe));
}

export function createWeaponArmLayerState(options = {}) {
  const idleArmSampler = options.idleArmSampler || createIdleArmSampler(options.animations);
  return {
    applied: false,
    profileName: '',
    idleBasePose: null,
    idleArmSampler,
    idleArmTime: 0
  };
}

export function resolveWeaponArmLayerProfile(context = {}) {
  const activeClipName = String(context.activeClipName || '');
  const intent = movementIntent(context);
  const stopIntent = stopSettleIntent(context);
  if (
    stopIntent &&
    !intent.moving &&
    stopSettleUsesCarryProfile(stopIntent) &&
    (activeClipName === 'idle' || activeClipName === 'stop')
  ) {
    return cloneProfile(WEAPON_CARRY_PROFILE);
  }
  if (!intent.moving && activeClipName === 'idle') return cloneProfile(IDLE_CAPTURE_PROFILE);
  if (intent.pureForward && (activeClipName === 'start_forward' || activeClipName === 'run')) {
    return cloneProfile(WEAPON_CARRY_PROFILE);
  }
  return null;
}

function readRotation(node) {
  if (!node || !node.rotation) return null;
  return {
    x: finite(node.rotation.x, 0),
    y: finite(node.rotation.y, 0),
    z: finite(node.rotation.z, 0)
  };
}

function writeRotation(node, rotation) {
  if (!node || !node.rotation || !rotation) return false;
  node.rotation.x = finite(rotation.x, 0);
  node.rotation.y = finite(rotation.y, 0);
  node.rotation.z = finite(rotation.z, 0);
  return true;
}

function captureIdleBasePose(state, rig) {
  if (!state || !rig) return false;
  const upper = readRotation(rig.armUpperR);
  const lower = readRotation(rig.armLowerR);
  if (!upper && !lower) return false;
  state.idleBasePose = { upper, lower };
  return true;
}

function syncIdleArmSamplerTime(state, context) {
  const sampler = state && state.idleArmSampler ? state.idleArmSampler : null;
  if (!state || !sampler) return false;
  const actionTime = Number(context && context.activeActionTime);
  if (!Number.isFinite(actionTime)) return false;
  state.idleArmTime = wrapClipTime(actionTime, sampler.duration);
  return true;
}

function advanceIdleArmSamplerTime(state, context) {
  const sampler = state && state.idleArmSampler ? state.idleArmSampler : null;
  if (!state || !sampler) return 0;
  const deltaSec = Math.max(0, finite(context && context.deltaSec, 0));
  state.idleArmTime = wrapClipTime(finite(state.idleArmTime, 0) + deltaSec, sampler.duration);
  return state.idleArmTime;
}

function sampleTrack(sampler, time) {
  if (!sampler || !sampler.interpolant || typeof sampler.interpolant.evaluate !== 'function') return null;
  return sampler.interpolant.evaluate(time);
}

function applySampledBonePose(bone, trackSet, time) {
  if (!bone || !trackSet) return false;
  let applied = false;
  const position = sampleTrack(trackSet.position, time);
  if (position && bone.position && typeof bone.position.set === 'function') {
    bone.position.set(position[0], position[1], position[2]);
    applied = true;
  }
  const quaternion = sampleTrack(trackSet.quaternion, time);
  if (quaternion && bone.quaternion && typeof bone.quaternion.copy === 'function') {
    sampledQuaternion.fromArray(quaternion).normalize();
    bone.quaternion.copy(sampledQuaternion);
    applied = true;
  }
  const scale = sampleTrack(trackSet.scale, time);
  if (scale && bone.scale && typeof bone.scale.set === 'function') {
    bone.scale.set(scale[0], scale[1], scale[2]);
    applied = true;
  }
  return applied;
}

function applySampledIdleArmPose(state, rig, context) {
  const sampler = state && state.idleArmSampler ? state.idleArmSampler : null;
  if (!sampler || !rig) return false;
  const time = advanceIdleArmSamplerTime(state, context);
  const upperApplied = applySampledBonePose(rig.armUpperR, sampler.tracks.armUpperR, time);
  const lowerApplied = applySampledBonePose(rig.armLowerR, sampler.tracks.armLowerR, time);
  return !!(upperApplied || lowerApplied);
}

function applyIdleBasePose(state, rig) {
  const base = state && state.idleBasePose ? state.idleBasePose : null;
  if (!base || !rig) return false;
  const upperApplied = writeRotation(rig.armUpperR, base.upper);
  const lowerApplied = writeRotation(rig.armLowerR, base.lower);
  return !!(upperApplied || lowerApplied);
}

export function applyWeaponArmLayer(rig, context = {}) {
  const layerState = context.state || null;
  const profile = resolveWeaponArmLayerProfile(context);
  if (!profile || !rig) {
    if (layerState) {
      layerState.applied = false;
      layerState.profileName = '';
    }
    return { applied: false, profileName: '' };
  }

  const applied = profile.name === 'idle_capture'
    ? false
    : (applySampledIdleArmPose(layerState, rig, context) || applyIdleBasePose(layerState, rig));
  if (profile.name === 'idle_capture') {
    syncIdleArmSamplerTime(layerState, context);
    captureIdleBasePose(layerState, rig);
  }

  if (layerState) {
    layerState.applied = applied;
    layerState.profileName = profile.name;
  }
  return { applied, profileName: profile.name };
}
