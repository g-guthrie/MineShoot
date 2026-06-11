/**
 * viewmodel.js - First-person weapon + blocky arm, Minecraft style. Uses
 * the textured low-poly weapon models, normalized to consistent on-screen
 * lengths, with bob, recoil, reload dip, and a muzzle flash.
 */
import { createGunModel } from './gun-models.js';

const THREE = globalThis.THREE;
const HOLD_POSITION = { x: 0.3, y: -0.24, z: -0.38 };
const DEG = Math.PI / 180;
const SKIN_COLOR = 0xd2a77d;

// Per-weapon view tuning: target on-screen barrel length, optional hold
// offsets relative to HOLD_POSITION, muzzle flash size, and the fire
// action (pump/bolt/slide motion played after the recoil kick).
const VIEW_TUNING = {
  machinegun: { length: 0.88, flash: 0.5 },
  shotgun: { length: 0.82, flash: 0.75, action: { type: 'pump', delayMs: 220, durationMs: 320 } },
  sniper: { length: 1.05, dy: 0.02, flash: 0.6, action: { type: 'bolt', delayMs: 200, durationMs: 420 } },
  pistol: { length: 0.42, dy: 0.02, dx: -0.02, flash: 0.4, action: { type: 'slide', delayMs: 0, durationMs: 110 } }
};

const SWAY_LOOK_SCALE = 0.045;
const SWAY_RETURN_SPEED = 9;
const SWAY_MAX = 0.07;

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
  let currentTuning = VIEW_TUNING.machinegun;

  let bobPhase = 0;
  let recoil = 0;
  let recoilSnap = 0;
  let switchDip = 0;
  let reloadTimer = 0;
  let reloadDuration = 0;
  let flashTimer = 0;

  // Look sway: the gun lags behind quick camera turns and springs back.
  let swayX = 0;
  let swayY = 0;
  // Landing dip.
  let wasGrounded = true;
  let landDip = 0;
  // Per-weapon fire action (pump/bolt/slide) timeline, in seconds.
  let actionClock = -1;

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
      currentTuning = tuning;
      actionClock = -1;
      holdOffset = { x: tuning.dx || 0, y: tuning.dy || 0, z: tuning.dz || 0 };
      muzzleAnchor.position.set(0, 0.02, -tuning.length - 0.03);
      flash.scale.setScalar(tuning.flash || 0.5);
      setArms(weaponId, tuning.length);

      const token = ++loadToken;
      createGunModel(weaponId, tuning.length, 1).then((model) => {
        if (token !== loadToken) return;
        setModel(model);
      }).catch(() => {});
    },

    kick(strength = 1) {
      recoil = Math.min(1.8, recoil + 0.7 * strength);
      recoilSnap = 1; // instant rotational snap that decays fast
      flashTimer = 0.035; // HYTOPIA-style quick muzzle blink
      flash.material.opacity = 1;
      flash.material.rotation = Math.random() * Math.PI;
      if (currentTuning.action) actionClock = 0;
    },

    onLook(dx, dy) {
      swayX = Math.max(-SWAY_MAX, Math.min(SWAY_MAX, swayX - dx * 0.0001));
      swayY = Math.max(-SWAY_MAX, Math.min(SWAY_MAX, swayY - dy * 0.0001));
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

      // Landing dip on grounded transition.
      if (player.entity.isGrounded && !wasGrounded) landDip = 1;
      wasGrounded = player.entity.isGrounded;
      landDip = Math.max(0, landDip - dt * 5);

      // Look sway springs back to center.
      const swayDecay = Math.min(1, dt * SWAY_RETURN_SPEED);
      swayX -= swayX * swayDecay;
      swayY -= swayY * swayDecay;

      recoil = Math.max(0, recoil - dt * 5);
      recoilSnap = Math.max(0, recoilSnap - dt * 14);
      switchDip = Math.max(0, switchDip - dt * 4);
      if (reloadTimer > 0) reloadTimer = Math.max(0, reloadTimer - dt);

      let reloadAngle = 0;
      if (reloadTimer > 0 && reloadDuration > 0) {
        const progress = 1 - reloadTimer / reloadDuration;
        reloadAngle = Math.sin(Math.min(1, progress) * Math.PI) * 0.7;
      }

      // Per-weapon fire action: pump/bolt/slide motion on the gun itself.
      let actionZ = 0;
      let actionRoll = 0;
      let actionPitch = 0;
      const action = currentTuning.action;
      if (action && actionClock >= 0) {
        actionClock += dt;
        const start = action.delayMs / 1000;
        const span = action.durationMs / 1000;
        const phase = (actionClock - start) / span;
        if (phase >= 1) {
          actionClock = -1;
        } else if (phase > 0) {
          const pulse = Math.sin(phase * Math.PI);
          if (action.type === 'pump') {
            actionZ = pulse * 0.09;
            actionPitch = pulse * 0.06;
          } else if (action.type === 'bolt') {
            actionRoll = pulse * 0.3;
            actionZ = pulse * 0.05;
          } else if (action.type === 'slide') {
            actionZ = pulse * 0.05;
            actionPitch = pulse * 0.12;
          }
        }
      }

      holder.position.set(
        HOLD_POSITION.x + holdOffset.x + bobX + swayX * 0.6,
        HOLD_POSITION.y + holdOffset.y - bobY - switchDip * 0.35
          - landDip * 0.07 + swayY * 0.5,
        HOLD_POSITION.z + holdOffset.z + recoil * 0.07 + actionZ
      );
      holder.rotation.set(
        recoil * 0.04 + recoilSnap * 0.05 + reloadAngle * -0.8
          + swayY * 1.4 - landDip * 0.06 + actionPitch,
        6 * DEG + swayX * 1.6,
        swayX * 0.8 + actionRoll
      );
    },

    updateEffects(dt) {
      if (flashTimer > 0) {
        flashTimer -= dt;
        if (flashTimer <= 0) flash.material.opacity = 0;
      }
    }
  };
}
