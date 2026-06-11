/**
 * animated-guns.js - First-person weapons from the CC0 Quaternius
 * "Animated FPS Guns" pack: skinned models with artist-keyframed Fire and
 * Reload clips, played through an AnimationMixer. Each gun is normalized
 * into the holder frame (muzzle -Z, rear at origin, scaled to a target
 * length) using skeleton-aware bounds.
 */
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';

const THREE = globalThis.THREE;

const GUNS = {
  machinegun: {
    url: '/assets/weapons/animated/P90.glb',
    fire: 'P90Armature|Fire',
    reload: 'P90Armature|Reload',
    rotationDeg: [0, 180, 0],
    // Bullpup: the grip sits in the front half, which fools the
    // grip-at-the-rear orientation heuristic.
    invertFlip: true
  },
  shotgun: {
    url: '/assets/weapons/animated/Shotgun.glb',
    fire: 'ShotgunArmature|FireWBullet',
    reload: 'ShotgunArmature|Reload',
    rotationDeg: [0, 180, 0]
  },
  sniper: {
    url: '/assets/weapons/animated/SniperRifle.glb',
    fire: 'SniperRifle |FireWBullet',
    reload: 'SniperRifle |Reload',
    rotationDeg: [0, 180, 0]
  },
  pistol: {
    url: '/assets/weapons/animated/Revolver.glb',
    fire: 'RevolverArmature|Fire',
    reload: 'RevolverArmature|Reload',
    rotationDeg: [0, 180, 0]
  }
};

// The FBX conversion dropped material colors but kept their names, so the
// palette is restored by name.
const MATERIAL_COLORS = {
  Black: 0x1c1c1c,
  DarkMetal: 0x2f3136,
  DarkerMetal: 0x26282c,
  Metal: 0x9aa0a6,
  Trigger: 0x202020,
  Magazine: 0x4a4d52,
  Muzzle: 0x141414,
  Wood: 0x7a5230,
  DarkWood: 0x5b3c20,
  LightWood: 0xb98a5a,
  Barrel: 0x3a3d42,
  Barrels: 0x3a3d42,
  Green: 0x55613f,
  BulletYellow: 0xd4af37,
  BulletOrange: 0xc77b30,
  BulletRed: 0xb33a3a,
  BulletTip: 0xc77b30
};
const DEFAULT_GUN_COLOR = 0x6e7176;

const loader = new GLTFLoader();
const cache = new Map();

function loadGltf(url) {
  if (!cache.has(url)) {
    cache.set(url, new Promise((resolve, reject) => {
      loader.load(url, resolve, undefined, reject);
    }));
  }
  return cache.get(url);
}

/**
 * Skeleton-aware world bounds. Detached pieces like bullets and magazines
 * can sit far from the body in the measured frame, so only meshes near the
 * largest mesh (the gun body) are counted. Returns the cluster box plus
 * the per-part boxes inside it.
 */
function measure(root) {
  root.updateMatrixWorld(true);
  const boxes = [];
  root.traverse((node) => {
    if (!node.isMesh) return;
    const meshBox = new THREE.Box3();
    if (node.isSkinnedMesh) {
      node.computeBoundingBox();
      meshBox.copy(node.geometry.boundingBox).applyMatrix4(node.matrixWorld);
    } else {
      meshBox.setFromObject(node);
    }
    if (!meshBox.isEmpty()) boxes.push(meshBox);
  });
  if (boxes.length === 0) return { box: new THREE.Box3(), parts: [] };

  const volume = (b) =>
    Math.max(0.0001, b.max.x - b.min.x) *
    Math.max(0.0001, b.max.y - b.min.y) *
    Math.max(0.0001, b.max.z - b.min.z);
  const primary = boxes.reduce((a, b) => (volume(b) > volume(a) ? b : a));
  const cluster = primary.clone().expandByVector(
    primary.getSize(new THREE.Vector3()).multiplyScalar(0.6)
  );

  const box = primary.clone();
  const parts = [];
  for (const candidate of boxes) {
    if (candidate.intersectsBox(cluster)) {
      box.union(candidate);
      parts.push(candidate);
    }
  }
  return { box, parts };
}

/**
 * Guns hang their grip/trigger below the REAR half while the muzzle end
 * is thin, so the Z-half whose geometry reaches lowest is the back of the
 * gun. Returns true when the model needs a 180-degree flip to put the
 * muzzle at -Z.
 */
function needsFlip(box, parts) {
  const centerZ = (box.min.z + box.max.z) / 2;
  let frontMinY = Infinity;
  let rearMinY = Infinity;
  for (const part of parts) {
    const partCenterZ = (part.min.z + part.max.z) / 2;
    if (partCenterZ < centerZ) frontMinY = Math.min(frontMinY, part.min.y);
    else rearMinY = Math.min(rearMinY, part.min.y);
  }
  // Grip hanging in the -Z half means the gun is facing backwards.
  return frontMinY < rearMinY - (box.max.y - box.min.y) * 0.12;
}

/**
 * @returns {Promise<{root, playFire, playReload, update, box}>}
 */
export function createAnimatedGun(weaponId, targetLength) {
  const config = GUNS[weaponId] || GUNS.machinegun;
  return loadGltf(config.url).then((gltf) => {
    const model = cloneSkeleton(gltf.scene);
    model.traverse((node) => {
      if (!node.isMesh) return;
      node.frustumCulled = false;
      node.castShadow = false;
      const recolor = (material) => {
        const copy = material.clone();
        copy.color.setHex(MATERIAL_COLORS[copy.name] ?? DEFAULT_GUN_COLOR);
        if ('metalness' in copy) copy.metalness = 0.15;
        if ('roughness' in copy) copy.roughness = 0.85;
        return copy;
      };
      node.material = Array.isArray(node.material)
        ? node.material.map(recolor)
        : recolor(node.material);
    });

    const inner = new THREE.Group();
    inner.add(model);
    inner.rotation.set(
      config.rotationDeg[0] * Math.PI / 180,
      config.rotationDeg[1] * Math.PI / 180,
      config.rotationDeg[2] * Math.PI / 180
    );
    const wrap = new THREE.Group();
    wrap.add(inner);

    const mixer = new THREE.AnimationMixer(model);
    const actions = {};
    for (const clip of gltf.animations) {
      const action = mixer.clipAction(clip);
      action.setLoop(THREE.LoopOnce);
      action.clampWhenFinished = false;
      actions[clip.name] = action;
    }
    // Settle the rig into the first frame of the fire clip so the bind
    // pose never flashes, then measure for normalization.
    const fireAction = actions[config.fire];
    const reloadAction = actions[config.reload];
    if (fireAction) {
      fireAction.play();
      mixer.update(0);
      fireAction.stop();
    }

    let scale;
    let { box, parts } = measure(wrap);
    const flip = config.invertFlip ? !needsFlip(box, parts) : needsFlip(box, parts);
    if (flip) {
      inner.rotation.y += Math.PI;
      ({ box, parts } = measure(wrap));
    }
    if (config.manualScale != null) {
      scale = config.manualScale;
      wrap.scale.setScalar(scale);
      const offset = config.manualOffset || [0, 0, 0];
      inner.position.set(offset[0], offset[1], offset[2] - targetLength / scale);
    } else {
      const sizeZ = Math.max(0.001, box.max.z - box.min.z);
      scale = targetLength / sizeZ;
      wrap.scale.setScalar(scale);
      inner.position.x -= (box.min.x + box.max.x) / 2;
      inner.position.y -= (box.min.y + box.max.y) / 2;
      inner.position.z -= box.max.z;
    }

    // Normalized-space bounds for hand placement.
    const normalizedBox = new THREE.Box3(
      new THREE.Vector3(
        (box.min.x - (box.min.x + box.max.x) / 2) * scale,
        (box.min.y - (box.min.y + box.max.y) / 2) * scale,
        -targetLength
      ),
      new THREE.Vector3(
        (box.max.x - (box.min.x + box.max.x) / 2) * scale,
        (box.max.y - (box.min.y + box.max.y) / 2) * scale,
        0
      )
    );

    return {
      root: wrap,
      box: normalizedBox,

      /** Plays the keyframed fire clip, time-scaled to the fire cadence. */
      playFire(cooldownMs) {
        if (!fireAction) return;
        const clipSec = fireAction.getClip().duration;
        const wantSec = Math.max(0.09, Math.min(clipSec, cooldownMs / 1000));
        fireAction.timeScale = clipSec / wantSec;
        fireAction.stop().reset().play();
      },

      /** Plays the keyframed reload clip stretched to the reload time. */
      playReload(reloadMs) {
        if (!reloadAction) return;
        const clipSec = reloadAction.getClip().duration;
        reloadAction.timeScale = clipSec / (reloadMs / 1000);
        reloadAction.stop().reset().play();
      },

      update(dt) {
        mixer.update(dt);
      }
    };
  });
}
