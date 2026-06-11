/**
 * character.js - Animated player characters (Quaternius Toon Shooter kit,
 * CC0). Loads the soldier once, clones per player with SkeletonUtils, and
 * exposes a small animation API over THREE.AnimationMixer with crossfades.
 */
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';

const THREE = globalThis.THREE;
const MODEL_URL = '/assets/characters/toon-shooter/Character_Soldier.gltf';
const TARGET_HEIGHT = 2.6;
const CROSSFADE = 0.16;

let basePromise = null;

function loadBase() {
  if (!basePromise) {
    basePromise = new Promise((resolve, reject) => {
      new GLTFLoader().load(MODEL_URL, (gltf) => {
        const scene = gltf.scene;
        scene.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(scene);
        const height = Math.max(0.001, box.max.y - box.min.y);
        resolve({
          scene,
          animations: gltf.animations,
          scale: TARGET_HEIGHT / height,
          footOffset: -box.min.y
        });
      }, undefined, reject);
    });
  }
  return basePromise;
}

const ONE_SHOTS = { Jump: true, Jump_Land: true, Death: true, HitReact: true, Punch: true };

/**
 * @param {number} tintHex per-player color applied to the main outfit
 * @returns {Promise<object>} character handle
 */
export function createCharacter(tintHex) {
  return loadBase().then((base) => {
    const model = cloneSkeleton(base.scene);
    const root = new THREE.Group();
    const inner = new THREE.Group();
    inner.scale.setScalar(base.scale);
    inner.position.y = base.footOffset * base.scale;
    inner.add(model);
    root.add(inner);

    // Per-instance materials so tint and damage flashes don't leak between
    // players; the main outfit material takes the player color.
    const materials = [];
    model.traverse((node) => {
      if (!node.isMesh) return;
      node.castShadow = true;
      // Skinned meshes can animate far outside their bind-pose bounds.
      node.frustumCulled = false;
      const cloneMat = (material) => {
        const copy = material.clone();
        if (copy.name === 'Character_Main' && tintHex != null) {
          copy.color.setHex(tintHex);
        }
        materials.push(copy);
        return copy;
      };
      node.material = Array.isArray(node.material)
        ? node.material.map(cloneMat)
        : cloneMat(node.material);
    });

    let headBone = null;
    let handBone = null;
    model.traverse((node) => {
      if (node.isBone) {
        if (!headBone && node.name === 'Head') headBone = node;
        if (!handBone && node.name === 'LowerArm.R') handBone = node;
      }
    });

    const mixer = new THREE.AnimationMixer(model);
    const actions = new Map();
    for (const clip of base.animations) {
      const action = mixer.clipAction(clip);
      if (ONE_SHOTS[clip.name]) {
        action.setLoop(THREE.LoopOnce);
        action.clampWhenFinished = true;
      }
      actions.set(clip.name, action);
    }

    let currentName = null;
    let current = null;
    let headPitch = 0;

    function play(name, fade = CROSSFADE) {
      if (name === currentName || !actions.has(name)) return;
      const next = actions.get(name);
      next.reset().fadeIn(fade).play();
      if (current) current.fadeOut(fade);
      current = next;
      currentName = name;
    }

    return {
      root,
      materials,
      mixer,
      height: TARGET_HEIGHT,

      play,
      currentAnimation: () => currentName,

      /** True while a one-shot is still running. */
      isPlayingOneShot() {
        return !!(currentName && ONE_SHOTS[currentName] && current && current.isRunning());
      },

      onFinished(callback) {
        mixer.addEventListener('finished', (event) => callback(event.action.getClip().name));
      },

      setHeadPitch(pitch) {
        headPitch = pitch;
      },

      handWorldPosition(out) {
        if (!handBone) return null;
        return handBone.getWorldPosition(out || new THREE.Vector3());
      },

      update(dt) {
        mixer.update(dt);
        // Applied after the mixer so the keyframes don't overwrite it.
        if (headBone) headBone.rotation.x += headPitch;
      },

      dispose() {
        mixer.stopAllAction();
        for (const material of materials) material.dispose();
      }
    };
  });
}
