import { Quaternion, Vector3Like, QuaternionLike } from 'highchair';
import GunEntity from '../GunEntity';
import type { GunEntityOptions } from '../GunEntity';

// Faster, wider, weaker sibling of the pump shotgun — same pellet system
// (see ShotgunEntity for the tuning provenance).
const DEFAULT_AUTO_SHOTGUN_OPTIONS: GunEntityOptions = {
  ammo: 8,
  damage: 8,
  fireRate: 2.2,
  pellets: 8,
  spread: 0.22,
  falloff: { start: 6, end: 11, minScalar: 0.35 },
  tracer: { seg: 0.7, life: 0.09 },
  heldHand: 'both',
  iconImageUri: 'icons/auto-shotgun.png',
  idleAnimation: 'idle_gun_both',
  mlAnimation: 'shoot_gun_both',
  name: 'Auto Shotgun',
  maxAmmo: 8,
  totalAmmo: 40,
  modelUri: 'models/items/auto-shotgun.glb',
  modelScale: 1.2,
  range: 20,
  reloadAudioUri: 'audio/sfx/shotgun-reload.mp3',
  reloadTimeMs: 3000,
  shootAudioUri: 'audio/sfx/shotgun-shoot.mp3',
};

export default class AutoShotgunEntity extends GunEntity {
  public constructor(options: Partial<GunEntityOptions> = {}) {
    super({ ...DEFAULT_AUTO_SHOTGUN_OPTIONS, ...options });
  }

  public override shoot(): void {
    if (!this.parent || !this.processShoot()) return;

    super.shoot();
  }

  public override getMuzzleFlashPositionRotation(): { position: Vector3Like, rotation: QuaternionLike } {
    return {
      position: { x: 0.015, y: 0, z: -1 },
      rotation: Quaternion.fromEuler(0, 90, 0),
    };
  }
}
