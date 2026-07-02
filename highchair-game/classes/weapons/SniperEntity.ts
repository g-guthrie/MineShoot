import { Quaternion, Vector3Like, QuaternionLike } from 'highchair';
import GunEntity from '../GunEntity';
import type { GunEntityOptions } from '../GunEntity';

const DEFAULT_SNIPER_OPTIONS: GunEntityOptions = {
  ammo: 4,
  damage: 90,
  fireRate: 0.55,
  tracer: { seg: 3.2, speed: 420, life: 0.14 },
  heldHand: 'both',
  iconImageUri: 'icons/sniper.png',
  idleAnimation: 'idle_gun_both',
  mlAnimation: 'shoot_gun_both',
  name: 'Sniper',
  maxAmmo: 4,
  totalAmmo: 24,
  scopeZoom: 5,
  centersCameraOnScope: true,
  modelUri: 'models/items/sniper.glb',
  modelScale: 1.3,
  range: 170,
  reloadAudioUri: 'audio/sfx/sniper-reload.mp3',
  reloadTimeMs: 2200,
  shootAudioUri: 'audio/sfx/sniper-shoot.mp3',
};

export default class SniperEntity extends GunEntity {
  public constructor(options: Partial<GunEntityOptions> = {}) {
    super({ ...DEFAULT_SNIPER_OPTIONS, ...options });
  }

  public override shoot(): void {
    const ammoBefore = this.ammo;
    super.shoot(); // base class gates fire rate/ammo

    // The sniper auto-reloads shortly after each fired shot.
    if (this.ammo < ammoBefore) {
      setTimeout(() => this.reload(), 300);
    }
  }

  public override getMuzzleFlashPositionRotation(): { position: Vector3Like, rotation: QuaternionLike } {
    return {
      position: { x: 0, y: 0.15, z: -2.23 },
      rotation: Quaternion.fromEuler(0, 90, 0),
    };
  }
}
