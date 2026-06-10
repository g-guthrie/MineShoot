/**
 * viewmodel.js - First-person weapon + blocky arm, Minecraft style. Uses
 * the textured low-poly weapon models, normalized to consistent on-screen
 * lengths, with bob, recoil, reload dip, and a muzzle flash.
 */
import { createGunModel } from './gun-models.js';

const THREE = globalThis.THREE;
const HOLD_POSITION = { x: 0.33, y: -0.27, z: -0.46 };
const DEG = Math.PI / 180;
const SKIN_COLOR = 0xd2a77d;

// Per-weapon view tuning: target on-screen barrel length and optional hold
// offsets relative to HOLD_POSITION.
const VIEW_TUNING = {
  machinegun: { length: 0.6 },
  shotgun: { length: 0.56 },
  sniper: { length: 0.74, dy: 0.02 },
  pistol: { length: 0.3, dy: 0.03, dx: -0.02 }
};

function buildArms(weaponId, gunLength) {
  // Classic Minecraft first-person arm: one chunky arm running from the gun
  // grip down past the bottom-right screen edge. The grip end and the
  // off-screen shoulder end are defined in holder space and the box is
  // oriented between them, so the arm always connects.
  const group = new THREE.Group();
  const skin = new THREE.MeshLambertMaterial({ color: SKIN_COLOR });

  const grip = new THREE.Vector3(0.005, -0.1, -gunLength * 0.22);
  // Down, right, and toward the camera: ends up clipped by the frame edge.
  const shoulder = new THREE.Vector3(0.3, -0.55, 0.45);

  const direction = shoulder.clone().sub(grip);
  const armLength = direction.length() + 0.3;
  const geometry = new THREE.BoxGeometry(0.17, 0.17, armLength);
  geometry.translate(0, 0, armLength / 2);
  const arm = new THREE.Mesh(geometry, skin);
  arm.position.copy(grip);
  arm.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), direction.normalize());
  group.add(arm);

  const hand = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.13, 0.15), skin);
  hand.position.copy(grip).add(new THREE.Vector3(0, 0.02, 0));
  group.add(hand);
  return group;
}

export function createViewmodel(camera) {
  const holder = new THREE.Group();
  holder.position.set(HOLD_POSITION.x, HOLD_POSITION.y, HOLD_POSITION.z);
  // Slight inward yaw so the barrel converges toward the crosshair.
  holder.rotation.y = 6 * DEG;
  camera.add(holder);

  const gunRoot = new THREE.Group();
  holder.add(gunRoot);

  let arms = null;
  function setArms(weaponId, gunLength) {
    if (arms) holder.remove(arms);
    arms = buildArms(weaponId, gunLength);
    holder.add(arms);
  }

  const muzzleAnchor = new THREE.Object3D();
  gunRoot.add(muzzleAnchor);

  const flash = new THREE.Sprite(new THREE.SpriteMaterial({
    color: 0xffd27a,
    transparent: true,
    opacity: 0,
    depthTest: false,
    blending: THREE.AdditiveBlending
  }));
  flash.scale.setScalar(0.5);
  muzzleAnchor.add(flash);

  let currentWeaponId = null;
  let currentModel = null;
  let loadToken = 0;
  let holdOffset = { x: 0, y: 0, z: 0 };

  let bobPhase = 0;
  let recoil = 0;
  let switchDip = 0;
  let reloadTimer = 0;
  let reloadDuration = 0;
  let flashTimer = 0;

  function setModel(object) {
    if (currentModel) {
      gunRoot.remove(currentModel);
    }
    currentModel = object;
    if (object) gunRoot.add(object);
  }

  return {
    setWeapon(weaponId) {
      if (weaponId === currentWeaponId) return;
      currentWeaponId = weaponId;
      switchDip = 1;
      reloadTimer = 0;

      const tuning = VIEW_TUNING[weaponId] || VIEW_TUNING.machinegun;
      holdOffset = { x: tuning.dx || 0, y: tuning.dy || 0, z: tuning.dz || 0 };
      muzzleAnchor.position.set(0, 0.02, -tuning.length - 0.03);
      setArms(weaponId, tuning.length);

      const token = ++loadToken;
      createGunModel(weaponId, tuning.length, 1).then((model) => {
        if (token !== loadToken) return;
        setModel(model);
      }).catch(() => {});
    },

    kick(strength = 1) {
      recoil = Math.min(1.6, recoil + 0.55 * strength);
      flashTimer = 0.045;
      flash.material.opacity = 1;
      flash.material.rotation = Math.random() * Math.PI;
    },

    startReload(durationMs) {
      reloadDuration = durationMs / 1000;
      reloadTimer = reloadDuration;
    },

    muzzleWorldPosition() {
      const out = new THREE.Vector3();
      muzzleAnchor.getWorldPosition(out);
      return out;
    },

    update(dt, player) {
      const speedNorm = player.entity.moveSpeedNorm || 0;
      if (player.entity.isGrounded && speedNorm > 0.05) {
        bobPhase += dt * (6 + speedNorm * 6);
      }
      const bobX = Math.sin(bobPhase) * 0.012 * speedNorm;
      const bobY = Math.abs(Math.cos(bobPhase)) * 0.016 * speedNorm;

      recoil = Math.max(0, recoil - dt * 6);
      switchDip = Math.max(0, switchDip - dt * 4);
      if (reloadTimer > 0) reloadTimer = Math.max(0, reloadTimer - dt);

      let reloadAngle = 0;
      if (reloadTimer > 0 && reloadDuration > 0) {
        const progress = 1 - reloadTimer / reloadDuration;
        reloadAngle = Math.sin(Math.min(1, progress) * Math.PI) * 0.7;
      }

      holder.position.set(
        HOLD_POSITION.x + holdOffset.x + bobX,
        HOLD_POSITION.y + holdOffset.y - bobY - switchDip * 0.35,
        HOLD_POSITION.z + holdOffset.z + recoil * 0.06
      );
      holder.rotation.x = recoil * 0.05 + reloadAngle * -0.8;
    },

    updateEffects(dt) {
      if (flashTimer > 0) {
        flashTimer -= dt;
        if (flashTimer <= 0) flash.material.opacity = 0;
      }
    }
  };
}
