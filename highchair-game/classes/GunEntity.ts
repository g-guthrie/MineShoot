import {
  Audio,
  Entity,
  Vector3Like,
  Quaternion,
  QuaternionLike,
  World,
} from 'highchair';

import GamePlayerEntity from './GamePlayerEntity';
import ItemEntity from './ItemEntity';
import TerrainDamageManager from './TerrainDamageManager';
import type { ItemEntityOptions } from './ItemEntity';

export type GunHand = 'left' | 'right' | 'both';

export type GunEntityOptions = {
  ammo: number;              // The amount of ammo in the clip.
  damage: number;            // The damage of the gun.
  fireRate: number;          // Bullets shot per second.
  maxAmmo: number;           // The amount of ammo the clip can hold.
  totalAmmo: number;         // The amount of ammo remaining for this gun.
  range: number;             // The max range bullets travel for raycast hits
  reloadAudioUri: string;    // The audio played when reloading
  reloadTimeMs: number;      // Seconds to reload.
  shootAudioUri: string;     // The audio played when shooting
  scopeZoom?: number;         // The zoom level when scoped in.
  pellets?: number;          // Rays per trigger pull (shotguns > 1). Each pellet rolls its own spread, damage and hitmarker.
  spread?: number;           // Max spread cone radius, as tangent units (0.185 ~ 10.5 degrees).
  falloff?: { start: number; end: number; minScalar: number }; // Damage scalar lerps 1 -> minScalar between start and end distance.
} & ItemEntityOptions;

export default abstract class GunEntity extends ItemEntity {
  protected readonly damage: number;
  protected readonly fireRate: number;
  protected readonly maxAmmo: number;
  protected readonly range: number;
  protected readonly reloadTimeMs: number;
  protected readonly scopeZoom: number = 1;
  protected readonly pellets: number;
  protected readonly spread: number;
  protected readonly falloff?: { start: number; end: number; minScalar: number };

  protected ammo: number;
  protected totalAmmo: number;
  private _lastFireTime: number = 0;
  private _muzzleFlashChildEntity: Entity | undefined;
  private _reloadAudio: Audio;
  private _reloading: boolean = false;
  private _shootAudio: Audio;

  public constructor(options: GunEntityOptions) {
    if (!('modelUri' in options)) {
      throw new Error('GunEntity requires modelUri');
    }

    super(options);

    this.ammo = options.ammo;
    this.damage = options.damage;
    this.pellets = options.pellets ?? 1;
    this.spread = options.spread ?? 0;
    this.falloff = options.falloff;
    this.fireRate = options.fireRate;
    this.maxAmmo = options.maxAmmo;
    this.totalAmmo = options.totalAmmo;
    this.range = options.range;
    this.reloadTimeMs = options.reloadTimeMs;
    this.scopeZoom = options.scopeZoom ?? 1;

    this._reloadAudio = new Audio({
      attachedToEntity: this,
      uri: options.reloadAudioUri,  
      referenceDistance: 8,
      cutoffDistance: 20,
    });

    this._shootAudio = new Audio({
      attachedToEntity: this,
      uri: options.shootAudioUri,
      volume: 0.3,
      referenceDistance: 8,
      cutoffDistance: 100,
    });
  }

  public override equip(): void {
    if (!this.world) return;
    
    super.equip();
    
    this.setPosition({ x: 0, y: 0, z: -0.2 });
    this.setRotation(Quaternion.fromEuler(-90, 0, 0));
    this._reloadAudio.play(this.world, true);

  }

  public override unequip(): void {
    super.unequip();

    // reset any scope zoom
    const player = this.parent as GamePlayerEntity;
    this.zoomScope(true);
  }

  public override spawn(world: World, position: Vector3Like, rotation?: QuaternionLike): void {
    super.spawn(world, position, rotation);

    this._createMuzzleFlash();
  }

  public override getQuantity(): number {
    return this.totalAmmo;
  }

  /** Loadout guns aren't resupplied by pickups, so they carry a deep reserve. */
  public setReserveAmmo(amount: number): void {
    this.totalAmmo = amount;
  }

  public reload(): void {
    if (!this.parent?.world || this._reloading || !this.totalAmmo) return;
    this._startReload();
    this._reloadAudio.play(this.parent.world, true);

    setTimeout(() => this._finishReload(), this.reloadTimeMs);
  }

  public abstract getMuzzleFlashPositionRotation(): { position: Vector3Like, rotation: QuaternionLike };

  public shoot(): void {
    if (!this.parent?.world) return;

    const player = this.parent as GamePlayerEntity;
    const { origin, direction } = this.getShootOriginDirection();
    
    this._performShootEffects(player);
    for (let i = 0; i < this.pellets; i++) {
      this.shootRaycast(origin, this._spreadDirection(direction), this.range);
    }
    this._updateUI(player);
  }

  public zoomScope(reset: boolean = false): void {
    if (!this.parent?.world || this.scopeZoom === 1) return;

    const player = this.parent as GamePlayerEntity;
    const zoom = player.player.camera.zoom === 1 && !reset ? this.scopeZoom : 1;

    player.player.camera.setZoom(zoom);
    player.player.ui.sendData({
      type: 'scope-zoom',
      zoom,
    });
  }

  protected getShootOriginDirection(): { origin: Vector3Like, direction: Vector3Like } {
    const player = this.parent as GamePlayerEntity;
    const { x, y, z } = player.position;
    const cameraYOffset = player.player.camera.offset.y;    
    const direction = player.player.camera.facingDirection;
    
    return {
      origin: { x, y: y + cameraYOffset, z },
      direction
    };
  }

  protected processShoot(): boolean {
    if (this.totalAmmo <= 0 || this._reloading) return false;

    const now = performance.now();
    if (this._lastFireTime && now - this._lastFireTime < 1000 / this.fireRate) return false;

    if (this.ammo <= 0) {
      this.reload();
      return false;
    }

    this.ammo--;
    this.totalAmmo--;
    this._lastFireTime = now;

    return true;
  }

  /** Jitters a direction uniformly within the gun's spread cone. */
  protected _spreadDirection(direction: Vector3Like): Vector3Like {
    if (this.spread <= 0) return direction;

    // Orthonormal basis perpendicular to the aim direction.
    const up = Math.abs(direction.y) < 0.99 ? { x: 0, y: 1, z: 0 } : { x: 1, y: 0, z: 0 };
    let rx = direction.y * up.z - direction.z * up.y;
    let ry = direction.z * up.x - direction.x * up.z;
    let rz = direction.x * up.y - direction.y * up.x;
    const rl = Math.hypot(rx, ry, rz);
    rx /= rl; ry /= rl; rz /= rl;
    const ux = ry * direction.z - rz * direction.y;
    const uy = rz * direction.x - rx * direction.z;
    const uz = rx * direction.y - ry * direction.x;

    // Uniform sample on a disc of radius `spread` (tangent units).
    const r = this.spread * Math.sqrt(Math.random());
    const t = Math.random() * Math.PI * 2;
    const ox = r * Math.cos(t), oy = r * Math.sin(t);

    const dx = direction.x + rx * ox + ux * oy;
    const dy = direction.y + ry * ox + uy * oy;
    const dz = direction.z + rz * ox + uz * oy;
    const dl = Math.hypot(dx, dy, dz);
    return { x: dx / dl, y: dy / dl, z: dz / dl };
  }

  /** Damage scalar at a given hit distance, per the gun's falloff curve. */
  protected _falloffScalar(distance: number): number {
    if (!this.falloff) return 1;
    const { start, end, minScalar } = this.falloff;
    if (distance <= start) return 1;
    if (distance >= end) return minScalar;
    return 1 - (1 - minScalar) * ((distance - start) / (end - start));
  }

  protected shootRaycast(origin: Vector3Like, direction: Vector3Like, length: number): void {
    if (!this.parent?.world) return;

    const { world } = this.parent;
    const raycastHit = this.parent.world.simulation.raycast(origin, direction, length, {
      filterExcludeRigidBody: this.parent.rawRigidBody,
    });
    if (!raycastHit) return;

    const hp = raycastHit.hitPoint;
    const distance = hp
      ? Math.hypot(hp.x - origin.x, hp.y - origin.y, hp.z - origin.z)
      : length;
    const damage = Math.max(1, Math.round(this.damage * this._falloffScalar(distance)));

    if (raycastHit.hitBlock) {
      TerrainDamageManager.instance.damageBlock(world, raycastHit.hitBlock, damage);
    }

    if (raycastHit.hitEntity) {
      this._handleHitEntity(raycastHit.hitEntity, direction, damage);
    }
  }

  /** The amount of ammo currently in the clip. */
  public getClipAmmo(): number {
    return this.ammo;
  }

  /** The remaining reserve ammo for this gun. */
  public getReserveAmmo(): number {
    return this.totalAmmo;
  }

  /** Whether the gun has ammo available in the clip or reserves. */
  public hasUsableAmmo(): boolean {
    return this.ammo > 0 || this.totalAmmo > 0;
  }

  public getReloadTimeMs(): number {
    return this.reloadTimeMs;
  }

  /** The effective range (in blocks) of the gun. */
  public getEffectiveRange(): number {
    return this.range;
  }

  /** Whether the gun is currently reloading. */
  public isReloading(): boolean {
    return this._reloading;
  }

  private _createMuzzleFlash(): void {
    if (!this.isSpawned || !this.world) return;

    this._muzzleFlashChildEntity = new Entity({
      parent: this,
      modelUri: 'models/environment/muzzle-flash.gltf',
      modelScale: 0.5,
      opacity: 0,
    });

    const { position, rotation } = this.getMuzzleFlashPositionRotation();
    this._muzzleFlashChildEntity.spawn(this.world, position, rotation);
  }

  private _startReload(): void {
    this.ammo = 0;
    this._reloading = true;
    this.updateAmmoIndicatorUI(true);
  }

  private _finishReload(): void {
    this._reloading = false;

    // prevent reloads if they swapped active item mid reload.
    if (!this.parent || !(this.parent as GamePlayerEntity).isItemActiveInInventory(this)) return;

    this.ammo = Math.min(this.maxAmmo, this.totalAmmo);
    this.updateAmmoIndicatorUI();
  }

  private _performShootEffects(player: GamePlayerEntity): void {
    player.getModelAnimation(this.mlAnimation)?.restart();
    this._showMuzzleFlash();
    this._shootAudio.play(this.parent!.world!, true);
  }

  private _showMuzzleFlash(): void {
    if (!this._muzzleFlashChildEntity) return;

    this._muzzleFlashChildEntity.setOpacity(1);
    setTimeout(() => {
      if (this.isSpawned && this._muzzleFlashChildEntity?.isSpawned) {
        this._muzzleFlashChildEntity.setOpacity(0);
      }
    }, 35);
  }

  private _updateUI(player: GamePlayerEntity): void {
    player.updateItemInventoryQuantity(this);
    this.updateAmmoIndicatorUI();
  }

  protected _handleHitEntity(hitEntity: Entity, hitDirection: Vector3Like, damage: number = this.damage): void {
    if (!(hitEntity instanceof GamePlayerEntity) || hitEntity.isDead) return;

    const attacker = this.parent as GamePlayerEntity;

    attacker.dealtDamage(damage);
    hitEntity.takeDamage(damage, hitDirection, attacker);
  }

  public updateAmmoIndicatorUI(reloading: boolean = false): void {
    if (!this.parent) {
      return;
    }

    const player = this.parent as GamePlayerEntity;

    player.player.ui.sendData(reloading ? {
      type: 'ammo-indicator',
      reloading: true,
    } : {
      type: 'ammo-indicator',
      ammo: this.ammo,
      totalAmmo: this.totalAmmo,
      show: true,
    });
  }
}
