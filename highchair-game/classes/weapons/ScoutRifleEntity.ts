import { Quaternion, Vector3Like, QuaternionLike } from 'highchair';
import GunEntity from '../GunEntity';
import type { GunEntityOptions } from '../GunEntity';

const DEFAULT_SCOUT_RIFLE_OPTIONS: GunEntityOptions = {
  ammo: 8,
  damage: 40,
  fireRate: 1.8,
  tracer: { seg: 2.4, speed: 360 },
  heldHand: 'both',
  iconImageUri: 'icons/scout-rifle.png',
  idleAnimation: 'idle_gun_both',
  mlAnimation: 'shoot_gun_both',
  name: 'Scout Rifle',
  maxAmmo: 8,
  totalAmmo: 40,
  scopeZoom: 2.5,
  focusesReticleOnScope: true,
  scopeStyle: 'scout',
  modelUri: 'models/items/scout-rifle.glb',
  modelScale: 1.3,
  range: 120,
  reloadAudioUri: 'audio/sfx/sniper-reload.mp3',
  reloadTimeMs: 2200,
  shootAudioUri: 'audio/sfx/sniper-shoot.mp3',
};

export default class ScoutRifleEntity extends GunEntity {
  public constructor(options: Partial<GunEntityOptions> = {}) {
    super({ ...DEFAULT_SCOUT_RIFLE_OPTIONS, ...options });
  }


  public override getMuzzleFlashPositionRotation(): { position: Vector3Like, rotation: QuaternionLike } {
    return {
      position: { x: 0, y: 0.01, z: -2.7 },
      rotation: Quaternion.fromEuler(0, 90, 0),
    };
  }
}
