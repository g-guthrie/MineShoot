import { Quaternion, Vector3Like, QuaternionLike } from 'highchair';
import GunEntity from '../GunEntity';
import type { GunEntityOptions } from '../GunEntity';
import type GamePlayerEntity from '../GamePlayerEntity';

const DEFAULT_REVOLVER_OPTIONS: GunEntityOptions = {
  ammo: 6,
  damage: 34,
  fireRate: 2.3,
  spread: 0.015,
  falloff: { start: 7.5, end: 23, minScalar: 0.6 },
  tracer: { seg: 0.25 },
  heldHand: 'right',
  iconImageUri: 'icons/revolver.png',
  idleAnimation: 'idle_gun_right',
  mlAnimation: 'shoot_gun_right',
  name: 'Revolver',
  maxAmmo: 6,
  totalAmmo: 36,
  modelUri: 'models/items/revolver.glb',
  modelScale: 1.3,
  range: 52,
  reloadAudioUri: 'audio/sfx/pistol-reload.mp3',
  reloadTimeMs: 2000,
  shootAudioUri: 'audio/sfx/rifle-shoot.mp3',
};

export default class RevolverEntity extends GunEntity {
  public constructor(options: Partial<GunEntityOptions> = {}) {
    super({ ...DEFAULT_REVOLVER_OPTIONS, ...options });
  }


  public override getMuzzleFlashPositionRotation(): { position: Vector3Like, rotation: QuaternionLike } {
    return {
      position: { x: 0.03, y: 0.18, z: -0.7 },
      rotation: Quaternion.fromEuler(0, 90, 0),
    };
  }
}

