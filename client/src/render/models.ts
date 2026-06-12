/**
 * Loads the reference build's GLTF models once and hands out animated
 * instances. All models are self-contained (embedded buffers/textures).
 */
import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { WeaponId } from '../../../sim/constants';

export const WEAPON_MODEL_URL: Record<WeaponId, string> = {
  pistol: '/models/items/pistol.glb',
  'auto-pistol': '/models/items/auto-pistol.glb',
  shotgun: '/models/items/shotgun.glb',
  'auto-shotgun': '/models/items/auto-shotgun.glb',
  ar15: '/models/items/ar-15.glb',
  ak47: '/models/items/ak-47.glb',
};

/** Reference modelScale values from the entity classes. */
export const WEAPON_MODEL_SCALE: Record<WeaponId, number> = {
  pistol: 1.3,
  'auto-pistol': 1.3,
  shotgun: 1.2,
  'auto-shotgun': 1.2,
  ar15: 1,
  ak47: 1,
};

const URLS = {
  zombie: '/models/npcs/zombie.gltf',
  ripper: '/models/npcs/ripper-boss.gltf',
  soldier: '/models/players/soldier-player.gltf',
  fence: '/models/environment/barbedfence.gltf',
  weaponbox: '/models/environment/weaponbox.gltf',
  muzzleFlash: '/models/environment/muzzle-flash.gltf',
  ...WEAPON_MODEL_URL,
} as const;

export type ModelKey = keyof typeof URLS;

export interface ModelInstance {
  root: THREE.Object3D;
  mixer: THREE.AnimationMixer | null;
  clips: Map<string, THREE.AnimationClip>;
}

export class ModelLibrary {
  private gltfs = new Map<ModelKey, GLTF>();

  async load(): Promise<void> {
    const loader = new GLTFLoader();
    await Promise.all(
      (Object.keys(URLS) as ModelKey[]).map(async key => {
        const gltf = await loader.loadAsync(URLS[key]);
        this.gltfs.set(key, gltf);
      }),
    );
  }

  /**
   * Clone a model. `scale` is the reference build's modelScale; the clone is
   * grounded so its bounding-box bottom sits at local y=0 (feet origin).
   */
  instance(key: ModelKey, scale: number, ground = true): ModelInstance {
    const gltf = this.gltfs.get(key);
    if (!gltf) throw new Error(`model not loaded: ${key}`);

    const root = SkeletonUtils.clone(gltf.scene);
    root.scale.setScalar(scale);

    if (ground) {
      const box = new THREE.Box3().setFromObject(root);
      root.position.y = -box.min.y;
    }

    const clips = new Map(gltf.animations.map(c => [c.name, c]));
    const mixer = gltf.animations.length ? new THREE.AnimationMixer(root) : null;
    return { root, mixer, clips };
  }
}

/** Crossfade helper: keeps one looping action per slot (e.g. upper/lower body). */
export class AnimSlot {
  private current: THREE.AnimationAction | null = null;
  private currentName = '';

  constructor(
    private readonly mixer: THREE.AnimationMixer,
    private readonly clips: Map<string, THREE.AnimationClip>,
  ) {}

  play(name: string, fadeS = 0.15): void {
    if (name === this.currentName) return;
    const clip = this.clips.get(name);
    if (!clip) return;
    const next = this.mixer.clipAction(clip);
    next.reset().setLoop(THREE.LoopRepeat, Infinity).fadeIn(fadeS).play();
    this.current?.fadeOut(fadeS);
    this.current = next;
    this.currentName = name;
  }

  /** One-shot overlay (e.g. shoot animation); does not disturb the loop slot. */
  oneShot(name: string): void {
    const clip = this.clips.get(name);
    if (!clip) return;
    const action = this.mixer.clipAction(clip);
    action.reset().setLoop(THREE.LoopOnce, 1);
    action.clampWhenFinished = false;
    action.play();
  }
}
