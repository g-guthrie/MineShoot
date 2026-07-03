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
import { PLAYER_HITBOX } from '../gameConfig';
import type { ItemEntityOptions } from './ItemEntity';

export type GunHand = import('./ItemEntity').HeldHand;

const TRACER_VISIBLE_START_OFFSET = 1;
// The original tuning's head/body damage ratio (rifle 78/50, pistol 102/68,
// machinegun 27/18 — all 1.5x). Applied on top of distance falloff.
const HEADSHOT_DAMAGE_MULTIPLIER = 1.5;
const INFINITE_RESERVE_AMMO = -1;

export type GunEntityOptions = {
  ammo: number;              // The amount of ammo in the clip.
  damage: number;            // The damage of the gun.
  fireRate: number;          // Bullets shot per second.
  maxAmmo: number;           // The amount of ammo the clip can hold.
  totalAmmo: number;         // The amount of ammo remaining for this gun. -1 means infinite reserve.
  range: number;             // The max range bullets travel for raycast hits
  reloadAudioUri: string;    // The audio played when reloading
  reloadTimeMs: number;      // Seconds to reload.
  shootAudioUri: string;     // The audio played when shooting
  scopeZoom?: number;         // The zoom level when scoped in.
  scopeStyle?: 'none' | 'sniper'; // HUD treatment while scoped.
  pellets?: number;          // Rays per trigger pull (shotguns > 1). Each pellet rolls its own spread, damage and hitmarker.
  spread?: number;           // Max unscoped bloom radius in camera tangent units.
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
  protected readonly scopeStyle: 'none' | 'sniper';
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
  private _scoped: boolean = false;
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
    this.scopeStyle = options.scopeStyle ?? 'none';

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
  }

  public override unequip(): void {
    super.unequip();
    this.zoomScope(true); // reset any scope zoom
  }

  public override spawn(world: World, position: Vector3Like, rotation?: QuaternionLike): void {
    super.spawn(world, position, rotation);

    this._createMuzzleFlash();
  }

  public override getQuantity(): number {
    return this.totalAmmo;
  }

  /** Loadout guns aren't resupplied by pickups, so they carry an infinite reserve. */
  public setReserveAmmo(amount: number): void {
    this.totalAmmo = amount;
  }

  public reload(): void {
    if (!this.parent?.world || this._reloading || !this._hasReserveAmmo()) return;
    if (this.ammo >= this.maxAmmo) return; // full clip: nothing to reload
    this._startReload();
    this._reloadAudio.play(this.parent.world, true);

    setTimeout(() => this._finishReload(), this.reloadTimeMs);
  }

  public abstract getMuzzleFlashPositionRotation(): { position: Vector3Like, rotation: QuaternionLike };

  public shoot(): void {
    if (!this.parent?.world || !this.processShoot()) return;

    const player = this.parent as GamePlayerEntity;
    const { origin, direction } = this.getShootOriginDirection();
    
    this._performShootEffects(player);
    for (let i = 0; i < this.pellets; i++) {
      this.shootRaycast(origin, this._spreadDirection(player, direction), this.range, i, this.pellets);
    }
    this._updateUI(player);
  }

  public zoomScope(reset: boolean = false): void {
    if (!this.parent?.world || this.scopeZoom === 1) return;

    const player = this.parent as GamePlayerEntity;
    this._scoped = reset ? false : !this._scoped;
    const zoom = this._scoped ? this.scopeZoom : 1;
    const scopeStyle = zoom !== 1 ? this.scopeStyle : 'none';

    player.player.ui.sendData({
      type: 'scope-zoom',
      zoom,
      style: scopeStyle,
      sniper: scopeStyle === 'sniper',
    });
  }

  protected getShootOriginDirection(): { origin: Vector3Like, direction: Vector3Like } {
    const player = this.parent as GamePlayerEntity;
    return player.getReticleAimRay();
  }

  protected processShoot(): boolean {
    if (!this._hasReserveAmmo() || this._reloading) return false;

    const now = performance.now();
    if (this._lastFireTime && now - this._lastFireTime < 1000 / this.fireRate) return false;

    if (this.ammo <= 0) {
      this.reload();
      return false;
    }

    this.ammo--;
    if (!this._hasInfiniteReserveAmmo()) {
      this.totalAmmo--;
    }
    this._lastFireTime = now;

    return true;
  }

  /** Jitters a direction uniformly inside the reticle bloom circle. */
  protected _spreadDirection(player: GamePlayerEntity, direction: Vector3Like): Vector3Like {
    if (this.spread <= 0) return direction;

    // This is the same tangent-space disc the HUD projects into the debug
    // bloom circle. CSS scoped magnification scales the rendered world but
    // not the HUD, so the ray cone tightens by active scope zoom.
    const spread = this.getCurrentBulletSpread();
    const r = spread * Math.sqrt(Math.random());
    const t = Math.random() * Math.PI * 2;
    const ox = r * Math.cos(t), oy = r * Math.sin(t);

    return player.getReticleAimDirectionWithOffset(ox, oy);
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
    const shooter = this.parent;

    // World geometry (and player-built blocks) via the physics ray. Player
    // capsule hits are ignored here — players are resolved analytically
    // against the canonical PLAYER_HITBOX boxes below, which are larger
    // than the capsule and carry a real head volume.
    const raycastHit = world.simulation.raycast(origin, direction, length, {
      filterExcludeRigidBody: shooter.rawRigidBody,
    });
    const worldHitIsPlayer = raycastHit?.hitEntity instanceof GamePlayerEntity;
    const occlusionDistance = raycastHit?.hitPoint && !worldHitIsPlayer
      ? Math.hypot(raycastHit.hitPoint.x - origin.x, raycastHit.hitPoint.y - origin.y, raycastHit.hitPoint.z - origin.z)
      : length;

    // Analytic sweep: nearest player hitbox in front of the occluder.
    let best: { target: GamePlayerEntity; t: number; headshot: boolean } | undefined;
    for (const entity of world.entityManager.getAllPlayerEntities()) {
      if (!(entity instanceof GamePlayerEntity) || entity === shooter || entity.isDead || !entity.isSpawned) continue;
      const hit = GunEntity._rayVsPlayerHitbox(origin, direction, entity);
      if (!hit || hit.t > occlusionDistance) continue;
      if (!best || hit.t < best.t) best = { target: entity, t: hit.t, headshot: hit.headshot };
    }

    const endPoint = best
      ? { x: origin.x + direction.x * best.t, y: origin.y + direction.y * best.t, z: origin.z + direction.z * best.t }
      : raycastHit?.hitPoint && !worldHitIsPlayer
        ? raycastHit.hitPoint
        : { x: origin.x + direction.x * length, y: origin.y + direction.y * length, z: origin.z + direction.z * length };

    this._broadcastTracer(world, origin, direction, endPoint);

    if (best) {
      const damage = Math.max(1, Math.round(this.damage * this._falloffScalar(best.t)));
      this._handleHitEntity(best.target, direction, damage, endPoint, {
        pelletIndex,
        pelletCount,
        weaponName: this.name,
      }, best.headshot);
      return;
    }

    if (raycastHit?.hitBlock) {
      const damage = Math.max(1, Math.round(this.damage * this._falloffScalar(occlusionDistance)));
      TerrainDamageManager.instance.damageBlock(world, raycastHit.hitBlock, damage);
    }
  }

  /**
   * Ray vs the canonical player hitboxes (gameConfig PLAYER_HITBOX): an
   * axis-aligned body box (feet to head-base) and a head box above it.
   * Returns the nearest entry distance and whether it was the head.
   */
  private static _rayVsPlayerHitbox(
    origin: Vector3Like,
    direction: Vector3Like,
    target: GamePlayerEntity,
  ): { t: number; headshot: boolean } | undefined {
    const h = target.height;
    const center = target.position;
    const feetY = center.y - h / 2;
    const bodyHalf = h * PLAYER_HITBOX.bodyHalfWidthFrac;
    const headHalf = h * PLAYER_HITBOX.headHalfWidthFrac;
    const splitY = feetY + h * PLAYER_HITBOX.bodyTopFrac;

    const headT = GunEntity._rayVsAabb(origin, direction,
      { x: center.x - headHalf, y: splitY, z: center.z - headHalf },
      { x: center.x + headHalf, y: feetY + h * PLAYER_HITBOX.headTopFrac, z: center.z + headHalf });
    const bodyT = GunEntity._rayVsAabb(origin, direction,
      { x: center.x - bodyHalf, y: feetY, z: center.z - bodyHalf },
      { x: center.x + bodyHalf, y: splitY, z: center.z + bodyHalf });

    if (headT === undefined && bodyT === undefined) return undefined;
    if (headT !== undefined && (bodyT === undefined || headT <= bodyT)) {
      return { t: headT, headshot: true };
    }
    return { t: bodyT!, headshot: false };
  }

  /** Slab-test ray vs AABB; returns entry distance (>= 0) or undefined. */
  private static _rayVsAabb(origin: Vector3Like, dir: Vector3Like, min: Vector3Like, max: Vector3Like): number | undefined {
    let tMin = 0;
    let tMax = Infinity;
    const axes: Array<'x' | 'y' | 'z'> = ['x', 'y', 'z'];
    for (const a of axes) {
      const d = dir[a];
      if (Math.abs(d) < 1e-9) {
        if (origin[a] < min[a] || origin[a] > max[a]) return undefined;
        continue;
      }
      const inv = 1 / d;
      let t1 = (min[a] - origin[a]) * inv;
      let t2 = (max[a] - origin[a]) * inv;
      if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
      tMin = Math.max(tMin, t1);
      tMax = Math.min(tMax, t2);
      if (tMin > tMax) return undefined;
    }
    return tMin;
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
    return this.ammo > 0 || this._hasReserveAmmo();
  }

  public getReloadTimeMs(): number {
    return this.reloadTimeMs;
  }

  /** Whether this gun has a scope (right-click toggles scoped zoom). */
  public hasScope(): boolean {
    return this.scopeZoom > 1;
  }

  /** Unscoped bloom radius in camera tangent units. This defines the HUD circle. */
  public getSpread(): number {
    return this.spread;
  }

  /** Current bullet RNG radius in camera tangent units. */
  public getCurrentBulletSpread(): number {
    return this.spread / this._activeScopeZoom();
  }

  private _activeScopeZoom(): number {
    return this._scoped ? Math.max(1, this.scopeZoom) : 1;
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

    this.ammo = this._hasInfiniteReserveAmmo() ? this.maxAmmo : Math.min(this.maxAmmo, this.totalAmmo);
    this.updateAmmoIndicatorUI();
  }

  private _hasInfiniteReserveAmmo(): boolean {
    return this.totalAmmo === INFINITE_RESERVE_AMMO;
  }

  private _hasReserveAmmo(): boolean {
    return this._hasInfiniteReserveAmmo() || this.totalAmmo > 0;
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
    headshot: boolean = false,
  ): void {
    if (!(hitEntity instanceof GamePlayerEntity) || hitEntity.isDead) return;

    const attacker = this.parent as GamePlayerEntity;
    const finalDamage = headshot ? Math.round(damage * HEADSHOT_DAMAGE_MULTIPLIER) : damage;

    hitEntity.takeDamage(finalDamage, hitDirection, attacker);
    attacker.dealtDamage(finalDamage, {
      ...feedback,
      headshot,
      killed: hitEntity.isDead,
    });
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
