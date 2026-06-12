/**
 * First-person weapon: the current gun model attached to the camera with
 * movement bob, recoil kick, a muzzle flash on shots, and a reload dip.
 */
import * as THREE from 'three';
import type { WeaponId } from '../../../sim/constants';
import { ModelLibrary, WEAPON_MODEL_SCALE } from './models';

const BASE_POS = new THREE.Vector3(0.3, -0.3, -0.65);
const MUZZLE_FLASH_MS = 40;
/** First-person guns render much smaller than their world modelScale. */
const FP_SCALE = 0.28;

export class Viewmodel {
  private group = new THREE.Group();
  private gun: THREE.Object3D | null = null;
  private muzzle: THREE.Object3D;
  private weaponId: WeaponId | null = null;
  private bobPhase = 0;
  private recoil = 0;
  private reloadDip = 0;
  private muzzleUntil = 0;

  constructor(
    private readonly models: ModelLibrary,
    camera: THREE.Camera,
  ) {
    this.group.position.copy(BASE_POS);
    camera.add(this.group);

    // Small fill light so the gun stays readable in the night scene.
    const fill = new THREE.PointLight(0xfff2dd, 0.7, 3);
    fill.position.set(-0.2, 0.3, 0.2);
    this.group.add(fill);

    this.muzzle = this.models.instance('muzzleFlash', 0.3, false).root;
    this.muzzle.position.set(0.02, 0.07, -0.75);
    this.muzzle.visible = false;
    this.group.add(this.muzzle);
  }

  setWeapon(weapon: WeaponId): void {
    if (this.weaponId === weapon) return;
    this.weaponId = weapon;
    if (this.gun) {
      this.gun.removeFromParent();
    }
    // Rotate the barrel to face down -z (away from the camera).
    const gun = this.models.instance(weapon, WEAPON_MODEL_SCALE[weapon] * FP_SCALE, false).root;
    gun.rotation.set(0, -Math.PI / 2, 0);
    this.group.add(gun);
    this.gun = gun;
  }

  setVisible(visible: boolean): void {
    this.group.visible = visible;
  }

  /** Kick + flash when the local player's shot is confirmed. */
  onShot(): void {
    this.recoil = Math.min(0.12, this.recoil + 0.07);
    this.muzzleUntil = performance.now() + MUZZLE_FLASH_MS;
  }

  update(dt: number, moveSpeed: number, reloading: boolean): void {
    this.bobPhase += dt * (4 + moveSpeed * 1.6);
    const bobAmount = Math.min(1, moveSpeed / 5) * 0.012;

    this.recoil = Math.max(0, this.recoil - dt * 0.6);
    const dipTarget = reloading ? 1 : 0;
    this.reloadDip += (dipTarget - this.reloadDip) * Math.min(1, dt * 8);

    this.group.position.set(
      BASE_POS.x + Math.cos(this.bobPhase) * bobAmount,
      BASE_POS.y + Math.abs(Math.sin(this.bobPhase)) * bobAmount - this.reloadDip * 0.18,
      BASE_POS.z + this.recoil,
    );
    this.group.rotation.x = this.recoil * 0.8 - this.reloadDip * 0.7;

    this.muzzle.visible = performance.now() < this.muzzleUntil;
  }
}
