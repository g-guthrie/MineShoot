/**
 * viewmodel.js - First-person weapon rendered from the shared weapon
 * platform definitions (toon-shooter GLTF assets with tuned offsets).
 * Shows the procedural box gun instantly and swaps in the GLTF when loaded.
 */
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const THREE = globalThis.THREE;
const VIEW_SCALE = 0.5;
const HOLD_POSITION = { x: 0.42, y: -0.36, z: -0.55 };
const DEG = Math.PI / 180;

const gltfCache = new Map();
const loader = new GLTFLoader();

function loadGltf(url) {
  if (!gltfCache.has(url)) {
    gltfCache.set(url, new Promise((resolve, reject) => {
      loader.load(url, (gltf) => resolve(gltf.scene), undefined, reject);
    }));
  }
  return gltfCache.get(url);
}

function buildProceduralGun(visual) {
  const group = new THREE.Group();
  // Legacy visual parts use short keys: p(osition), s(ize), c(olor).
  const parts = (visual && visual.parts) || {};
  for (const name of ['body', 'barrel', 'stock', 'grip']) {
    const part = parts[name];
    if (!part || !part.s) continue;
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(part.s[0], part.s[1], part.s[2]),
      new THREE.MeshLambertMaterial({ color: part.c })
    );
    mesh.position.set(part.p[0], part.p[1], part.p[2]);
    group.add(mesh);
  }
  return group;
}

export function createViewmodel(camera) {
  const visualsApi = globalThis.__MAYHEM_RUNTIME.GameWeaponVisuals;

  const holder = new THREE.Group();
  holder.position.set(HOLD_POSITION.x, HOLD_POSITION.y, HOLD_POSITION.z);
  holder.rotation.y = -4 * DEG;
  camera.add(holder);

  const gunRoot = new THREE.Group();
  gunRoot.scale.setScalar(VIEW_SCALE);
  holder.add(gunRoot);

  const muzzleAnchor = new THREE.Object3D();
  gunRoot.add(muzzleAnchor);

  const flash = new THREE.Sprite(new THREE.SpriteMaterial({
    color: 0xffd27a,
    transparent: true,
    opacity: 0,
    depthTest: false,
    blending: THREE.AdditiveBlending
  }));
  flash.scale.setScalar(0.55);
  muzzleAnchor.add(flash);

  let currentWeaponId = null;
  let currentModel = null;
  let loadToken = 0;

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

      const entry = visualsApi.get(weaponId);
      const asset = entry.platform.asset;
      const zones = entry.platform.zones;
      muzzleAnchor.position.set(zones.muzzle[0], zones.muzzle[1], zones.muzzle[2]);

      setModel(buildProceduralGun(entry.visual));

      const token = ++loadToken;
      loadGltf(asset.url).then((sceneRoot) => {
        if (token !== loadToken) return;
        const model = sceneRoot.clone(true);
        model.scale.setScalar(asset.scale);
        model.rotation.set(
          asset.rotationDeg[0] * DEG,
          asset.rotationDeg[1] * DEG,
          asset.rotationDeg[2] * DEG
        );
        setModel(model);
      }).catch(() => {
        // Procedural fallback already in place.
      });
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
        HOLD_POSITION.x + bobX,
        HOLD_POSITION.y - bobY - switchDip * 0.35,
        HOLD_POSITION.z + recoil * 0.06
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
