import { Quaternion, Vector3 } from 'three';

const DEFAULT_TARGET_DISTANCE = 96;
const IDENTITY_QUATERNION = new Quaternion();
const WORLD_FORWARD = new Vector3();
const EYE_WORLD = new Vector3();
const TARGET_WORLD = new Vector3();
const MUZZLE_WORLD = new Vector3();
const CURRENT_WORLD = new Vector3();
const DESIRED_WORLD = new Vector3();
const CURRENT_PARENT = new Vector3();
const DESIRED_PARENT = new Vector3();
const PARENT_QUATERNION = new Quaternion();
const PARENT_INVERSE_QUATERNION = new Quaternion();
const DELTA_QUATERNION = new Quaternion();
const LIMITED_DELTA_QUATERNION = new Quaternion();
const MUZZLE_QUATERNION = new Quaternion();

export function cameraForwardFromAnimState(animState, out = new Vector3()) {
  const yaw = Number(animState && animState.yaw || 0);
  const pitch = Number(animState && animState.aimPitch || 0);
  if (!Number.isFinite(yaw) || !Number.isFinite(pitch)) return null;
  const cosPitch = Math.cos(pitch);
  out.set(
    -Math.sin(yaw) * cosPitch,
    Math.sin(pitch),
    -Math.cos(yaw) * cosPitch
  );
  if (out.lengthSq() <= 0.000001) return null;
  return out.normalize();
}

function correctionWeight(options) {
  const weight = Number(options && options.weight == null ? 1 : options.weight);
  return Number.isFinite(weight) ? Math.max(0, Math.min(1, weight)) : 1;
}

function correctionLimit(options) {
  const maxRad = Number(options && options.maxCorrectionRad);
  return Number.isFinite(maxRad) && maxRad > 0 ? maxRad : Math.PI;
}

export function applyBarrelCrosshairAlignment(rig, animState, options = {}) {
  if (!rig || !rig.weaponRoot || !rig.muzzleAnchor || !rig.eyeAnchor) return false;
  const parent = rig.weaponRoot.parent;
  if (!parent || !parent.getWorldQuaternion || !rig.weaponRoot.quaternion) return false;
  const forward = cameraForwardFromAnimState(animState, WORLD_FORWARD);
  if (!forward) return false;

  const root = rig.root || rig.weaponRoot;
  if (root && root.updateMatrixWorld) root.updateMatrixWorld(true);
  rig.eyeAnchor.getWorldPosition(EYE_WORLD);
  rig.muzzleAnchor.getWorldPosition(MUZZLE_WORLD);
  rig.muzzleAnchor.getWorldQuaternion(MUZZLE_QUATERNION);

  const targetDistance = Math.max(1, Number(options.targetDistance || DEFAULT_TARGET_DISTANCE));
  TARGET_WORLD.copy(EYE_WORLD).addScaledVector(forward, targetDistance);
  DESIRED_WORLD.copy(TARGET_WORLD).sub(MUZZLE_WORLD);
  if (DESIRED_WORLD.lengthSq() <= 0.000001) return false;
  DESIRED_WORLD.normalize();

  CURRENT_WORLD.set(0, 0, -1).applyQuaternion(MUZZLE_QUATERNION);
  if (CURRENT_WORLD.lengthSq() <= 0.000001) return false;
  CURRENT_WORLD.normalize();

  parent.getWorldQuaternion(PARENT_QUATERNION);
  PARENT_INVERSE_QUATERNION.copy(PARENT_QUATERNION).invert();
  CURRENT_PARENT.copy(CURRENT_WORLD).applyQuaternion(PARENT_INVERSE_QUATERNION).normalize();
  DESIRED_PARENT.copy(DESIRED_WORLD).applyQuaternion(PARENT_INVERSE_QUATERNION).normalize();

  DELTA_QUATERNION.setFromUnitVectors(CURRENT_PARENT, DESIRED_PARENT);
  const angle = 2 * Math.acos(Math.max(-1, Math.min(1, DELTA_QUATERNION.w)));
  if (!(angle > 0.00001)) return false;
  const maxAngle = correctionLimit(options);
  const blend = Math.min(1, maxAngle / angle) * correctionWeight(options);
  if (!(blend > 0)) return false;

  LIMITED_DELTA_QUATERNION.copy(IDENTITY_QUATERNION).slerp(DELTA_QUATERNION, blend);
  rig.weaponRoot.quaternion.premultiply(LIMITED_DELTA_QUATERNION);
  return true;
}
