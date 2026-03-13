import {
  EYE_HEIGHT,
  BODY_HITBOX_SIZE,
  HEAD_HITBOX_SIZE,
  BODY_HITBOX_CENTER_OFFSET_Y,
  HEAD_HITBOX_CENTER_OFFSET_Y
} from '../../../shared/entity-constants.js';

export const DEFAULT_REWIND_HISTORY_MS = 300;
export const DEFAULT_MAX_REWIND_MS = 250;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normalizeAngle(rad) {
  let value = Number(rad || 0);
  while (value > Math.PI) value -= Math.PI * 2;
  while (value < -Math.PI) value += Math.PI * 2;
  return value;
}

function lerp(a, b, t) {
  return Number(a || 0) + ((Number(b || 0) - Number(a || 0)) * t);
}

function lerpAngle(a, b, t) {
  return Number(a || 0) + (normalizeAngle(Number(b || 0) - Number(a || 0)) * t);
}

export function readCurrentPose(entity, serverTime = 0) {
  if (!entity) return null;
  return {
    serverTime: Number(serverTime || 0),
    x: Number(entity.x || 0),
    y: Number(entity.y || EYE_HEIGHT),
    z: Number(entity.z || 0),
    yaw: Number(entity.yaw || 0),
    pitch: Number(entity.pitch || 0),
    velocityY: Number(entity.velocityY || 0),
    isGrounded: entity.isGrounded !== false
  };
}

export function seedEntityPoseHistory(entity, serverTime = 0, options = {}) {
  if (!entity) return [];
  entity.poseHistory = [];
  return recordEntityPoseHistory(entity, serverTime, options);
}

export function recordEntityPoseHistory(entity, serverTime = 0, options = {}) {
  if (!entity) return [];
  const stamp = Math.max(0, Number(serverTime || 0));
  const maxHistoryMs = Math.max(1, Number(options.maxHistoryMs || DEFAULT_REWIND_HISTORY_MS));
  const pose = readCurrentPose(entity, stamp);
  if (!pose) return [];
  const history = Array.isArray(entity.poseHistory) ? entity.poseHistory.slice() : [];
  const previous = history.length > 0 ? history[history.length - 1] : null;
  if (previous && Math.abs(Number(previous.serverTime || 0) - stamp) < 0.001) {
    history[history.length - 1] = pose;
  } else {
    history.push(pose);
  }
  const cutoff = stamp - maxHistoryMs;
  while (history.length > 1 && Number(history[1].serverTime || 0) < cutoff) {
    history.shift();
  }
  entity.poseHistory = history;
  return history;
}

export function clampRewindShotTime(requestedShotTime, now = 0, options = {}) {
  const stamp = Math.max(0, Number(now || 0));
  const maxRewindMs = Math.max(1, Number(options.maxRewindMs || DEFAULT_MAX_REWIND_MS));
  const raw = Number(requestedShotTime);
  if (!Number.isFinite(raw) || raw <= 0) return stamp;
  return clamp(raw, stamp - maxRewindMs, stamp);
}

export function rewindEntityPose(entity, requestedShotTime, now = 0, options = {}) {
  const fallback = readCurrentPose(entity, now);
  if (!entity) return null;
  const clampedShotTime = clampRewindShotTime(requestedShotTime, now, options);
  const history = Array.isArray(entity.poseHistory) ? entity.poseHistory : [];
  if (history.length === 0) {
    return fallback ? { ...fallback, serverTime: clampedShotTime } : null;
  }

  if (clampedShotTime <= Number(history[0].serverTime || 0)) {
    return { ...history[0], serverTime: clampedShotTime };
  }
  const latest = history[history.length - 1];
  if (clampedShotTime >= Number(latest.serverTime || 0)) {
    return { ...latest, serverTime: clampedShotTime };
  }

  for (let i = 1; i < history.length; i++) {
    const newer = history[i];
    const older = history[i - 1];
    const olderTime = Number(older.serverTime || 0);
    const newerTime = Number(newer.serverTime || 0);
    if (clampedShotTime < olderTime || clampedShotTime > newerTime) continue;
    const span = Math.max(1, newerTime - olderTime);
    const t = clamp((clampedShotTime - olderTime) / span, 0, 1);
    return {
      serverTime: clampedShotTime,
      x: lerp(older.x, newer.x, t),
      y: lerp(older.y, newer.y, t),
      z: lerp(older.z, newer.z, t),
      yaw: lerpAngle(older.yaw, newer.yaw, t),
      pitch: lerp(older.pitch, newer.pitch, t),
      velocityY: lerp(older.velocityY, newer.velocityY, t),
      isGrounded: t < 0.5 ? older.isGrounded !== false : newer.isGrounded !== false
    };
  }

  return fallback ? { ...fallback, serverTime: clampedShotTime } : null;
}

export function buildHitboxesFromPose(pose) {
  if (!pose) return { bodyBox: null, headBox: null };
  const feetY = Number((pose.y || EYE_HEIGHT) - EYE_HEIGHT);
  const bodyCenterY = feetY + BODY_HITBOX_CENTER_OFFSET_Y;
  const headCenterY = feetY + HEAD_HITBOX_CENTER_OFFSET_Y;
  const halfBody = {
    x: BODY_HITBOX_SIZE.x * 0.5,
    y: BODY_HITBOX_SIZE.y * 0.5,
    z: BODY_HITBOX_SIZE.z * 0.5
  };
  const halfHead = {
    x: HEAD_HITBOX_SIZE.x * 0.5,
    y: HEAD_HITBOX_SIZE.y * 0.5,
    z: HEAD_HITBOX_SIZE.z * 0.5
  };
  return {
    bodyBox: {
      min: { x: Number(pose.x || 0) - halfBody.x, y: bodyCenterY - halfBody.y, z: Number(pose.z || 0) - halfBody.z },
      max: { x: Number(pose.x || 0) + halfBody.x, y: bodyCenterY + halfBody.y, z: Number(pose.z || 0) + halfBody.z }
    },
    headBox: {
      min: { x: Number(pose.x || 0) - halfHead.x, y: headCenterY - halfHead.y, z: Number(pose.z || 0) - halfHead.z },
      max: { x: Number(pose.x || 0) + halfHead.x, y: headCenterY + halfHead.y, z: Number(pose.z || 0) + halfHead.z }
    }
  };
}

export function buildRewoundTargetEntity(entity, requestedShotTime, now = 0, options = {}) {
  if (!entity) return null;
  const pose = rewindEntityPose(entity, requestedShotTime, now, options);
  if (!pose) return null;
  const hitboxes = buildHitboxesFromPose(pose);
  return {
    ...entity,
    x: pose.x,
    y: pose.y,
    z: pose.z,
    yaw: pose.yaw,
    pitch: pose.pitch,
    velocityY: pose.velocityY,
    isGrounded: pose.isGrounded,
    bodyBox: hitboxes.bodyBox,
    headBox: hitboxes.headBox
  };
}
