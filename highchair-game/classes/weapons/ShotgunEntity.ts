import { Quaternion, Vector3Like, QuaternionLike } from 'highchair';
import GunEntity from '../GunEntity';
import type { GunEntityOptions } from '../GunEntity';

// Tuning ported from the original MineShoot shotgun (shared/gameplay-tuning.js):
// 12 pellets, 0.185 spread, 24 range, ~900ms between shots, damage falling to
// 35% past 12.5m. Per-pellet damage halved from the original 20 because the
// old game fought at 200 effective HP (100 armor) vs 100 here.
const DEFAULT_SHOTGUN_OPTIONS: GunEntityOptions = {
  ammo: 5,
  damage: 10,
  fireRate: 1.1,
  pellets: 12,
  spread: 0.185,
  falloff: { start: 7.5, end: 12.5, minScalar: 0.35 },
  heldHand: 'both',
  iconImageUri: 'icons/shotgun.png',
  idleAnimation: 'idle_gun_both',
  mlAnimation: 'shoot_gun_both',
  name: 'Shotgun',
  maxAmmo: 5,
  totalAmmo: 30,
  modelUri: 'models/items/shotgun.glb',
  modelScale: 1.2,
  range: 24,
  reloadAudioUri: 'audio/sfx/shotgun-reload.mp3',
  reloadTimeMs: 2100,
  shootAudioUri: 'audio/sfx/shotgun-shoot.mp3',
};

export default class ShotgunEntity extends GunEntity {
  public constructor(options: Partial<GunEntityOptions> = {}) {
    super({ ...DEFAULT_SHOTGUN_OPTIONS, ...options });
  }

  public override shoot(): void {
    if (!this.parent || !this.processShoot()) return;

    super.shoot();
  }

  public override getMuzzleFlashPositionRotation(): { position: Vector3Like, rotation: QuaternionLike } {
    return {
      position: { x: 0.03, y: 0.1, z: -1.5 },
      rotation: Quaternion.fromEuler(0, 90, 0),
    };
  }
}
