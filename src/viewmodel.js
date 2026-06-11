/**
 * viewmodel.js - First-person weapon + blocky arm, Minecraft style. Uses
 * the textured low-poly weapon models, normalized to consistent on-screen
 * lengths, with bob, recoil, reload dip, and a muzzle flash.
 */
import { createAnimatedGun } from './animated-guns.js';
import { getMuzzleTexture } from './effects.js';

const THREE = globalThis.THREE;
const HOLD_POSITION = { x: 0.27, y: -0.22, z: -0.34 };
const DEG = Math.PI / 180;
const SKIN_COLOR = 0xd2a77d;
const SLEEVE_COLOR = 0x55613f; // soldier fatigues, matches the character kit

// Per-weapon view tuning: target on-screen barrel length, optional hold
// offsets relative to HOLD_POSITION, and muzzle flash size. Fire/reload
// motion comes from the keyframed clips baked into the gun models.
const VIEW_TUNING = {
  machinegun: { length: 0.7, flash: 0.5 },
  shotgun: { length: 0.92, flash: 0.75 },
  sniper: { length: 1.05, dy: 0.02, flash: 0.6 },
  pistol: { length: 0.46, dy: 0.02, dx: -0.02, flash: 0.4 }
};

const SWAY_LOOK_SCALE = 0.045;
const SWAY_RETURN_SPEED = 9;
const SWAY_MAX = 0.07;

const LONG_GUNS = { machinegun: true, shotgun: true, sniper: true };

/**
 * Builds the blocky arm + gripping hands. When the gun model has loaded,
 * gunBox (the measured Box3 of the normalized model) lets the hands wrap
 * the actual grip: palm behind, fingers curling over the far side.
 */
function buildArms(weaponId, gunLength, gunBox) {
  const group = new THREE.Group();
  const skin = new THREE.MeshLambertMaterial({ color: SKIN_COLOR });
  const sleeve = new THREE.MeshLambertMaterial({ color: SLEEVE_COLOR });

  const gunWidth = gunBox ? Math.min(0.16, gunBox.max.x - gunBox.min.x) : 0.1;
  const gripBottom = gunBox ? gunBox.min.y + 0.01 : -0.1;
  const gripZ = -gunLength * (LONG_GUNS[weaponId] ? 0.24 : 0.18);

  function addHand(z, bottomY) {
    // One clean mitt cupping the grip from below, Minecraft style.
    const mitt = new THREE.Mesh(new THREE.BoxGeometry(gunWidth + 0.08, 0.11, 0.15), skin);
    mitt.position.set(0, bottomY - 0.035, z);
    group.add(mitt);
    return new THREE.Vector3(0, bottomY - 0.04, z);
  }

  function addArm(anchor, shoulder) {
    const direction = shoulder.clone().sub(anchor);
    const armLength = direction.length() + 0.3;
    const dir = direction.normalize();
    const orientation = new THREE.Quaternion()
      .setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);

    // Skin wrist segment near the hand, fatigues sleeve for the rest.
    const wristGeo = new THREE.BoxGeometry(0.15, 0.15, 0.16);
    wristGeo.translate(0, 0, 0.08);
    const wrist = new THREE.Mesh(wristGeo, skin);
    wrist.position.copy(anchor);
    wrist.quaternion.copy(orientation);
    group.add(wrist);

    const sleeveGeo = new THREE.BoxGeometry(0.19, 0.19, armLength - 0.14);
    sleeveGeo.translate(0, 0, 0.14 + (armLength - 0.14) / 2);
    const sleeveMesh = new THREE.Mesh(sleeveGeo, sleeve);
    sleeveMesh.position.copy(anchor);
    sleeveMesh.quaternion.copy(orientation);
    group.add(sleeveMesh);
  }

  // Trigger hand on the grip, arm running off the bottom-right frame edge.
  const rightAnchor = addHand(gripZ, gripBottom);
  addArm(rightAnchor, new THREE.Vector3(0.3, -0.55, 0.45));

  if (LONG_GUNS[weaponId]) {
    // Support hand under the handguard, arm running down-left.
    const leftAnchor = addHand(-gunLength * 0.62, gripBottom + 0.01);
    addArm(leftAnchor, new THREE.Vector3(-0.42, -0.62, 0.35));
  }
  return group;
}

export function createViewmodel(camera) {
  const holder = new THREE.Group();
  holder.position.set(HOLD_POSITION.x, HOLD_POSITION.y, HOLD_POSITION.z);
  // Slight inward yaw so the barrel converges toward the crosshair.
  holder.rotation.y = 6 * DEG;
  camera.add(holder);

  // Short-range fill so the viewmodel never reads as a murky silhouette,
  // whatever the world lighting is doing.
  const fillLight = new THREE.PointLight(0xfff2e0, 1.4, 2.4, 1.2);
  fillLight.position.set(-0.25, 0.35, 0.25);
  camera.add(fillLight);

  const gunRoot = new THREE.Group();
  holder.add(gunRoot);

  let arms = null;
  function setArms(weaponId, gunLength, gunBox) {
    if (arms) holder.remove(arms);
    arms = buildArms(weaponId, gunLength, gunBox);
    holder.add(arms);
  }

  const muzzleAnchor = new THREE.Object3D();
  gunRoot.add(muzzleAnchor);

  const flash = new THREE.Sprite(new THREE.SpriteMaterial({
    map: getMuzzleTexture(),
    transparent: true,
    opacity: 0,
    depthTest: false,
    blending: THREE.AdditiveBlending
  }));
  flash.scale.setScalar(0.5);
  muzzleAnchor.add(flash);

  // The flash also throws light onto nearby world geometry.
  const flashLight = new THREE.PointLight(0xffa850, 0, 9, 1.8);
  muzzleAnchor.add(flashLight);

  let currentWeaponId = null;
  let currentModel = null;
  let currentGun = null;
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
  // ADS blend: 0 = hip, 1 = aimed (gun centered under the crosshair).
  // Driven by a lightly underdamped spring so the gun settles with a
  // small overshoot instead of an exponential crawl.
  let adsTarget = 0;
  let adsBlend = 0;
  let adsVel = 0;
  let scoped = false;
  // Sprint carry pose blend and idle breathing.
  let sprintBlend = 0;
  let breathPhase = Math.random() * Math.PI * 2;

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
      holdOffset = { x: tuning.dx || 0, y: tuning.dy || 0, z: tuning.dz || 0 };
      muzzleAnchor.position.set(0, 0.02, -tuning.length - 0.03);
      flash.scale.setScalar(tuning.flash || 0.5);
      setArms(weaponId, tuning.length);

      const token = ++loadToken;
      createAnimatedGun(weaponId, tuning.length).then((gun) => {
        if (token !== loadToken) return;
        currentGun = gun;
        setModel(gun.root);
        setArms(weaponId, tuning.length, gun.box);
      }).catch((err) => {
        console.error('animated gun load failed', err);
      });
    },

    kick(strength = 1, cooldownMs = 300) {
      recoil = Math.min(1.8, recoil + 0.7 * strength);
      recoilSnap = 1; // instant rotational snap that decays fast
      flashTimer = 0.035; // HYTOPIA-style quick muzzle blink
      flash.material.opacity = 1;
      flash.material.rotation = Math.random() * Math.PI * 2;
      flash.scale.setScalar((currentTuning.flash || 0.5) * (0.85 + Math.random() * 0.35));
      flashLight.intensity = 16;
      if (currentGun) currentGun.playFire(cooldownMs);
    },

    onLook(dx, dy) {
      swayX = Math.max(-SWAY_MAX, Math.min(SWAY_MAX, swayX - dx * 0.0001));
      swayY = Math.max(-SWAY_MAX, Math.min(SWAY_MAX, swayY - dy * 0.0001));
    },

    setAds(active) {
      adsTarget = active ? 1 : 0;
    },

    /** Fully hides the viewmodel (sniper scope view). */
    setScoped(active) {
      scoped = !!active;
      holder.visible = !scoped;
    },

    startReload(durationMs) {
      reloadDuration = durationMs / 1000;
      reloadTimer = reloadDuration;
      if (currentGun) currentGun.playReload(durationMs);
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
      // Walk push-pull: the gun drives forward and back with each step.
      const bobZ = Math.cos(bobPhase) * 0.02 * speedNorm;
      // Idle breathing keeps the gun alive even when standing still.
      breathPhase += dt * 1.7;
      const breatheY = Math.sin(breathPhase) * 0.004;
      const breatheZ = Math.cos(breathPhase * 0.7) * 0.005;

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

      // Reload motion comes from the gun's keyframed clip; the holder only
      // adds a gentle settle dip.
      let reloadAngle = 0;
      if (reloadTimer > 0 && reloadDuration > 0) {
        const progress = 1 - reloadTimer / reloadDuration;
        reloadAngle = Math.sin(Math.min(1, progress) * Math.PI) * 0.18;
      }

      // ADS spring (underdamped for a touch of overshoot).
      const stiffness = 190;
      const damping = 20;
      adsVel += ((adsTarget - adsBlend) * stiffness - adsVel * damping) * dt;
      adsBlend = Math.max(-0.05, Math.min(1.08, adsBlend + adsVel * dt));
      const ads = adsBlend;
      const damp = 1 - Math.min(1, Math.max(0, ads)) * 0.7;

      // Sprint carry: gun swings up across the body while sprinting.
      const sprintTarget = player.entity.sprinting && adsTarget === 0 && reloadTimer <= 0 ? 1 : 0;
      sprintBlend += (sprintTarget - sprintBlend) * Math.min(1, dt * 8);
      const sprint = sprintBlend;

      const baseX = HOLD_POSITION.x * (1 - ads) + 0.0 * ads - sprint * 0.06;
      const baseY = (HOLD_POSITION.y + holdOffset.y) * (1 - ads) + -0.16 * ads - sprint * 0.05;
      const baseZ = (HOLD_POSITION.z + holdOffset.z) * (1 - ads) + -0.32 * ads + sprint * 0.05;

      holder.position.set(
        baseX + (holdOffset.x + bobX + swayX * 0.6) * damp,
        baseY + (-bobY - switchDip * 0.35 - landDip * 0.07 + swayY * 0.5 + breatheY) * damp,
        baseZ + recoil * 0.07 + (bobZ + breatheZ) * damp
      );
      holder.rotation.set(
        recoil * 0.04 + recoilSnap * 0.05 + reloadAngle * -0.8
          + (swayY * 1.4 - landDip * 0.06) * damp + sprint * 0.32,
        (6 * DEG) * (1 - ads) + swayX * 1.6 * damp + sprint * 0.5,
        swayX * 0.8 * damp - sprint * 0.12
      );
    },

    updateEffects(dt) {
      if (currentGun) currentGun.update(dt);
      if (flashTimer > 0) {
        flashTimer -= dt;
        if (flashTimer <= 0) flash.material.opacity = 0;
      }
      if (flashLight.intensity > 0.05) {
        flashLight.intensity *= Math.max(0, 1 - dt * 24);
      }
    }
  };
}
