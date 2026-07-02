import {
  Audio,
  Entity,
  GameServer,
  Vector3Like,
  Quaternion,
  QuaternionLike,
  World,
} from 'highchair';

import GamePlayerEntity from './GamePlayerEntity';
import type { DamageFeedback } from './GamePlayerEntity';
import ItemEntity from './ItemEntity';
import TerrainDamageManager from './TerrainDamageManager';
import type { ItemEntityOptions } from './ItemEntity';

export type GunHand = 'left' | 'right' | 'both';

const TRACER_VISIBLE_START_OFFSET = 1;

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
  tracer?: { speed?: number; seg?: number; life?: number }; // Tracer travel speed (wu/s), visible segment length, lifetime (s).
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
  protected readonly tracer?: { speed?: number; seg?: number; life?: number };

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
    this.tracer = options.tracer;
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
      this.shootRaycast(origin, this._spreadDirection(direction), this.range, i, this.pellets);
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
    return player.getReticleAimRay();
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

  protected shootRaycast(origin: Vector3Like, direction: Vector3Like, length: number, pelletIndex: number = 0, pelletCount: number = 1): void {
    if (!this.parent?.world) return;

    const { world } = this.parent;
    const raycastHit = this.parent.world.simulation.raycast(origin, direction, length, {
      filterExcludeRigidBody: this.parent.rawRigidBody,
    });

    this._broadcastTracer(world, origin, direction, raycastHit?.hitPoint ?? {
      x: origin.x + direction.x * length,
      y: origin.y + direction.y * length,
      z: origin.z + direction.z * length,
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
      this._handleHitEntity(raycastHit.hitEntity, direction, damage, raycastHit.hitPoint, {
        pelletIndex,
        pelletCount,
        weaponName: this.name,
      });
    }
  }

  /**
   * Every ray (pellets included) gets a tracer, visible to all players.
   * Hit logic stays reticle-based, but the visual line starts from the
   * rendered muzzle flash and travels toward the true impact point.
   */
  protected _broadcastTracer(world: World, origin: Vector3Like, direction: Vector3Like, end: Vector3Like): void {
    const muzzleOrigin = this._getTracerFallbackMuzzleOrigin(origin);
    const muzzleEntityId = this._muzzleFlashChildEntity?.id;
    const packet = {
      type: 'tracer',
      o: [
        +muzzleOrigin.x.toFixed(2),
        +muzzleOrigin.y.toFixed(2),
        +muzzleOrigin.z.toFixed(2),
      ],
      e: [+end.x.toFixed(2), +end.y.toFixed(2), +end.z.toFixed(2)],
      m: muzzleEntityId,
      so: TRACER_VISIBLE_START_OFFSET,
      speed: this.tracer?.speed,
      seg: this.tracer?.seg,
      life: this.tracer?.life,
    };
    GameServer.instance.playerManager.getConnectedPlayersByWorld(world).forEach(player => {
      player.ui.sendData(packet);
    });
  }

  private _getTracerFallbackMuzzleOrigin(rayOrigin: Vector3Like): Vector3Like {
    if (!(this.parent instanceof GamePlayerEntity)) return rayOrigin;

    const player = this.parent;
    const { position: muzzleLocalPosition } = this.getMuzzleFlashPositionRotation();
    const local = {
      x: this.position.x + muzzleLocalPosition.x,
      y: this.position.y + muzzleLocalPosition.y,
      z: this.position.z + muzzleLocalPosition.z,
    };
    const { forward, right, up } = this._getCameraBasis(player);

    return {
      x: rayOrigin.x + right.x * local.x + up.x * local.y - forward.x * local.z,
      y: rayOrigin.y + right.y * local.x + up.y * local.y - forward.y * local.z,
      z: rayOrigin.z + right.z * local.x + up.z * local.y - forward.z * local.z,
    };
  }

  private _getCameraBasis(player: GamePlayerEntity): {
    forward: Vector3Like;
    right: Vector3Like;
    up: Vector3Like;
  } {
    const { pitch, yaw } = player.player.camera.orientation;
    const cosPitch = Math.cos(pitch);
    const forward = {
      x: -Math.sin(yaw) * cosPitch,
      y: Math.sin(pitch),
      z: -Math.cos(yaw) * cosPitch,
    };
    const right = {
      x: Math.cos(yaw),
      y: 0,
      z: -Math.sin(yaw),
    };
    const up = {
      x: right.y * forward.z - right.z * forward.y,
      y: right.z * forward.x - right.x * forward.z,
      z: right.x * forward.y - right.y * forward.x,
    };

    return { forward, right, up };
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

  /** Spread cone radius in tangent units (bloom reticle sizing). */
  public getSpread(): number {
    return this.spread;
  }

  /** Rays per trigger pull (shotguns use a circle reticle). */
  public getPellets(): number {
    return this.pellets;
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

  protected _handleHitEntity(
    hitEntity: Entity,
    hitDirection: Vector3Like,
    damage: number = this.damage,
    hitPoint?: Vector3Like,
    feedback: DamageFeedback = {},
  ): void {
    if (!(hitEntity instanceof GamePlayerEntity) || hitEntity.isDead) return;

    const attacker = this.parent as GamePlayerEntity;
    const headshot = this._isHeadshot(hitEntity, hitPoint);

    attacker.dealtDamage(damage, {
      ...feedback,
      headshot,
    });
    hitEntity.takeDamage(damage, hitDirection, attacker);
  }

  private _isHeadshot(hitEntity: GamePlayerEntity, hitPoint?: Vector3Like): boolean {
    if (!hitPoint) return false;

    const relativeY = hitPoint.y - hitEntity.position.y;
    const headBaseY = hitEntity.height * 0.25;
    return relativeY >= headBaseY;
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
