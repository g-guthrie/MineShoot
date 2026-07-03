import { 
  CollisionGroup,
  Audio,
  BaseEntityControllerEvent,
  DefaultPlayerEntity,
  DefaultPlayerEntityController,
  EventPayloads,
  Player,
  PlayerCameraMode,
  Vector3Like,
  QuaternionLike,
  World,
  PlayerUIEvent,
} from 'highchair';

import GunEntity from './GunEntity';
import ItemEntity from './ItemEntity';
import ItemFactory from './ItemFactory';
import { DEFAULT_LOADOUT, GUN_CATALOG, LOADOUT_SLOTS, isCatalogGun } from './GunCatalog';
import MeleeWeaponEntity from './MeleeWeaponEntity';
import { BUILD_BLOCK_ID } from '../gameConfig';
import GameManager from './GameManager';

const BASE_HEALTH = 100;
const BASE_SHIELD = 0;
const BLOCK_MATERIAL_COST = 3;
const BUILD_REACH = 6; // max distance a block can be placed at
const VOID_Y = -100;   // below the deepest world geometry; falling past it kills
const PLAYER_WALK_VELOCITY = 10.5;
const PLAYER_RUN_VELOCITY = 16.5;
const PLAYER_JUMP_VELOCITY = 13.2;
// Canonical aim offsets, measured from the model skeleton itself by
// tools/measure-aim-offsets.mjs (idle stance bone chains; the barrel runs
// along the hand anchor's -Y). Camera-space tangent units: x < 0 = left,
// y > 0 = up. One-handed: 6.1deg left, 0.6deg up. Two-handed: 3.2deg left,
// 5.3deg down. Angles are resolution/aspect/zoom independent; the client
// re-projects them through its live camera every frame.
const ONE_HANDED_AIM_TANGENT_X = -0.1075;
const ONE_HANDED_AIM_TANGENT_Y = 0.0097;
const TWO_HANDED_AIM_TANGENT_X = -0.0551;
const TWO_HANDED_AIM_TANGENT_Y = -0.0928;
const INTERACT_DISTANCE = 4;
const MOBILE_AUTOFIRE_SAMPLE_INTERVAL_TICKS = 3;
const MAX_HEALTH = 100;
const MAX_SHIELD = 100;
const TOTAL_INVENTORY_SLOTS = 2; // two loadout guns; the pickaxe is sunsetted
const STARTING_MATERIALS = 30;
const INFINITE_RESERVE_AMMO = -1;
const RADAR_SEGMENTS = 8;
const RADAR_RANGE = 56;
const RADAR_CORE_RANGE = 10;
const RADAR_UPDATE_INTERVAL_MS = 100;
const RADAR_SECTOR_STEP = (Math.PI * 2) / RADAR_SEGMENTS;

function normalizeRadarSegmentIndex(index: number): number {
  return ((index % RADAR_SEGMENTS) + RADAR_SEGMENTS) % RADAR_SEGMENTS;
}

function radarQuadrantIndexFromAngle(angle: number): number {
  if (angle >= 0) {
    return angle < Math.PI * 0.5 ? 0 : 1;
  }

  return angle >= -Math.PI * 0.5 ? 3 : 2;
}

interface InventoryItem {
  name: string;
  iconImageUri: string;
  quantity: number;
}

export interface DamageFeedback {
  headshot?: boolean;
  killed?: boolean;
  pelletIndex?: number;
  pelletCount?: number;
  weaponName?: string;
}

export default class GamePlayerEntity extends DefaultPlayerEntity {
  private readonly _damageAudio: Audio;
  private readonly _inventory: (ItemEntity | undefined)[] = new Array(TOTAL_INVENTORY_SLOTS).fill(undefined);
  private _isMobileClient: boolean = false;
  private _autoFireRaycastCooldown: number = 0;
  private _aimTangentX: number = TWO_HANDED_AIM_TANGENT_X;
  private _aimTangentY: number = TWO_HANDED_AIM_TANGENT_Y;
  private _reticleProbeAtMs: number = 0;
  private _reticleTargetActive: boolean = false;
  private _autoFireHasTarget: boolean = false;
  private _autoFireEngaged: boolean = false;
  private _dead: boolean = false;
  private _health: number = BASE_HEALTH;
  private _inventoryActiveSlotIndex: number = 0;
  /** Gun ids (slots 1..N) re-equipped at spawn and on loadout changes. */
  private _loadout: string[] = [...DEFAULT_LOADOUT];
  private _equippingLoadout = false;
  /** Multiplier for step-cadence-vs-speed matching; tune live with /stride. */
  private static _strideTune = 1;
  private _gaitRate = 1;
  private _maxHealth: number = MAX_HEALTH;
  private _maxShield: number = MAX_SHIELD;
  private _materials: number = STARTING_MATERIALS;
  private _radarTimer: NodeJS.Timeout | undefined;
  private _respawnTimer: NodeJS.Timeout | undefined;
  private _shield: number = BASE_SHIELD;

  // Player entities always assign a PlayerController to the entity
  public get playerController(): DefaultPlayerEntityController {
    return this.controller as DefaultPlayerEntityController;
  }

  public get health(): number { return this._health; }
  public set health(value: number) {
    this._health = Math.max(0, Math.min(value, this._maxHealth));
    this._updatePlayerUIHealth();
  }

  public get shield(): number { return this._shield; }
  public set shield(value: number) {
    this._shield = Math.max(0, Math.min(value, this._maxShield));
    this._updatePlayerUIShield();
  }

  public get maxHealth(): number { return this._maxHealth; }
  public get maxShield(): number { return this._maxShield; }

  public get isDead(): boolean { return this._dead; }

  /** The currently active inventory item, if any. */
  public get activeInventoryItem(): ItemEntity | undefined {
    return this._inventory[this._inventoryActiveSlotIndex];
  }

  /** A snapshot of the inventory items. */
  public get inventoryItems(): ReadonlyArray<ItemEntity | undefined> {
    return this._inventory.slice();
  }

  public constructor(player: Player) {
    super({
      player,
      name: 'Player',
      modelUri: 'models/players/soldier-player.gltf',
      modelScale: 0.75, // 50% bigger than the hygrounds 0.5 — movement scales with it
    });

    this._setupPlayerController();
    this._setupPlayerInteraction();
    this.setupPlayerUI();
    this._setupPlayerCamera();
    this._setupPlayerHeadshotCollider();
    this._damageAudio = new Audio({
      attachedToEntity: this,
      uri: 'audio/sfx/player-hurt.mp3',
      loop: false,
      volume: 0.7,
    });
  }

  public override spawn(world: World, position: Vector3Like, rotation?: QuaternionLike): void {
    super.spawn(world, position, rotation);
    // Original MineShoot movement (jog 7, run 11, jump 8.8 at gravity 18)
    // scaled x1.5 with the character size. Velocities and jump velocity
    // scale linearly; gravity scales too (see index.ts), which keeps air
    // time identical while jump height scales to 3.2 units.
    this._setMovementEnabled(true);

    // Players never physically shove each other — capsule-vs-capsule
    // contacts let one player catapult another (solver depenetration).
    // Bullets are raycasts and still hit the PLAYER group fine.
    this.setCollisionGroupsForSolidColliders({
      belongsTo: [CollisionGroup.PLAYER],
      collidesWith: [CollisionGroup.BLOCK, CollisionGroup.ENTITY, CollisionGroup.ENTITY_SENSOR, CollisionGroup.ENVIRONMENT_ENTITY],
    });
    this._setupPlayerInventory();
    this._autoHealTicker();
    this._outOfWorldTicker();
    this._startRadarTicker();
    this._updatePlayerUIHealth();
    this._updatePlayerUIMaterials();
  }

  public override despawn(): void {
    this._stopRadarTicker();
    if (this._respawnTimer) {
      clearTimeout(this._respawnTimer);
      this._respawnTimer = undefined;
    }
    super.despawn();
  }

  public addItemToInventory(item: ItemEntity): void {
    const slot = this._findInventorySlot();

    if (slot === this._inventoryActiveSlotIndex) {
      this.dropActiveInventoryItem();
    }

    this._inventory[slot] = item;
    this._updatePlayerUIInventory();
    this._updatePlayerUIInventoryActiveSlot();
    this.setActiveInventorySlotIndex(this._inventoryActiveSlotIndex);
  }

  public addMaterial(quantity: number): void {
    if (!quantity) return;

    this._materials += quantity;
    this._updatePlayerUIMaterials();
  }

  public checkDeath(attacker?: GamePlayerEntity): void {
    if (this.health <= 0) {
      this._dead = true;
      this._autoFireRaycastCooldown = 0;
      this._autoFireHasTarget = false;
      this._setMovementEnabled(false);

      if (attacker) {
        if (attacker !== this) {
          GameManager.instance.addKill(attacker.player.username); // suicides never score
        }
        this.focusCameraOnPlayer(this); // death cam orbits your own body, not the killer
      }

      this._despawnGuns(); // loadout guns return fresh at respawn, nothing drops

      if (this.isSpawned && this.world) {
        this.playerController.idleLoopedAnimations = [ 'sleep' ];
        this.world.chatManager.sendPlayerMessage(this.player, 'You have died! Respawning in 5 seconds...', 'FF0000');
        this._respawnTimer = setTimeout(() => this.respawn(), 5 * 1000);

        if (attacker) {
          if (this.player.username !== attacker.player.username) {
            this.world.chatManager.sendBroadcastMessage(`${attacker.player.username} killed ${this.player.username} with a ${attacker.getActiveItemName()}!`, 'FF0000');
          } else {
            this.world.chatManager.sendBroadcastMessage(`${this.player.username} self-destructed!`, 'FF0000');
          }
        }
      }
    }
  }

  public focusCameraOnPlayer(player: GamePlayerEntity): void {
    this.player.camera.setMode(PlayerCameraMode.THIRD_PERSON);
    this.player.camera.setAttachedToEntity(player);
    this.player.camera.setViewModelHiddenNodes([]);
  }

  public dealtDamage(damage: number, feedback: DamageFeedback = {}): void {
    this.player.ui.sendData({
      type: 'show-damage',
      damage,
      headshot: Boolean(feedback.headshot),
      killed: Boolean(feedback.killed),
      pelletIndex: feedback.pelletIndex ?? 0,
      pelletCount: feedback.pelletCount ?? 1,
      weaponName: feedback.weaponName ?? '',
    });
  }
  
  public dropActiveInventoryItem(): void {
    const item = this._inventory[this._inventoryActiveSlotIndex];
    if (!item) return;

    item.unequip();
    item.drop(this.position, this.player.camera.facingDirection);
    this._inventory[this._inventoryActiveSlotIndex] = undefined;
    this._updatePlayerUIInventory();
    this._updatePlayerUIInventoryActiveSlot();
  }


  public getActiveItemName(): string {
    const activeItem = this._inventory[this._inventoryActiveSlotIndex];
    if (!activeItem) return '';

    return activeItem.name;
  }

  public getItemInventorySlot(item: ItemEntity): number {
    return this._inventory.findIndex(slot => slot === item);
  }

  public getReticleAimRay(): { origin: Vector3Like, direction: Vector3Like } {
    return {
      origin: {
        x: this.position.x,
        y: this.position.y + this.player.camera.offset.y,
        z: this.position.z,
      },
      direction: this.getReticleAimDirection(),
    };
  }

  public getReticleAimDirection(): Vector3Like {
    return this.getReticleAimDirectionWithOffset(0, 0);
  }

  public getReticleAimDirectionWithOffset(offsetX: number, offsetY: number): Vector3Like {
    const { pitch, yaw } = this.player.camera.orientation;
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
    // The stance's angular offset is a physical property of the character,
    // so it needs no viewport, FOV or zoom input — it cannot drift.
    const x = this._aimTangentX + offsetX;
    const y = this._aimTangentY + offsetY;
    const direction = {
      x: forward.x + right.x * x + up.x * y,
      y: forward.y + right.y * x + up.y * y,
      z: forward.z + right.z * x + up.z * y,
    };
    const length = Math.hypot(direction.x, direction.y, direction.z) || 1;
    return {
      x: direction.x / length,
      y: direction.y / length,
      z: direction.z / length,
    };
  }

  public clearScopeZoom(): void {
    const activeItem = this._inventory[this._inventoryActiveSlotIndex];
    if (activeItem instanceof GunEntity && activeItem.hasScope()) {
      activeItem.zoomScope(true);
      return;
    }

    this.player.camera.setZoom(1);
    this._sendReticleUI();
    this.player.ui.sendData({ type: 'scope-zoom', zoom: 1, style: 'none', sniper: false });
  }

  public isItemActiveInInventory(item: ItemEntity): boolean {
    return this._inventory[this._inventoryActiveSlotIndex] === item;
  }

  public async loadPersistedData(): Promise<void> {}

  public resetAnimations(): void {
    this.playerController.idleLoopedAnimations = ['idle_lower', 'idle_upper'];
    this.playerController.interactOneshotAnimations = [];
    this.playerController.walkLoopedAnimations = ['walk_lower', 'walk_upper'];
    this.playerController.runLoopedAnimations = ['run_lower', 'run_upper'];
  }

  private _setMovementEnabled(enabled: boolean): void {
    this.playerController.walkVelocity = enabled ? PLAYER_WALK_VELOCITY : 0;
    this.playerController.runVelocity = enabled ? PLAYER_RUN_VELOCITY : 0;
    this.playerController.jumpVelocity = enabled ? PLAYER_JUMP_VELOCITY : 0;

    if (!enabled) {
      this._clearPlayerInput(this.player.input);
      if (this.isSpawned) {
        this.resetLinearVelocity();
      }
    }
  }

  private _clearPlayerInput(input: EventPayloads[BaseEntityControllerEvent.TICK_WITH_PLAYER_INPUT]['input']): void {
    Object.keys(input).forEach(key => {
      input[key] = false;
    });
  }

  public resetCamera(): void {
    this._setupPlayerCamera();
    this.player.camera.setAttachedToEntity(this);
    this._sendReticleUI();
    this.player.ui.sendData({ type: 'scope-zoom', zoom: 1, style: 'none', sniper: false });
  }

  public resetMaterials(): void {
    this._materials = STARTING_MATERIALS;
    this._updatePlayerUIMaterials();
  }

  public respawn(): void {
    if (!this.world) return;

    if (this._respawnTimer) {
      clearTimeout(this._respawnTimer);
      this._respawnTimer = undefined;
    }
    this._dead = false;
    this._autoFireRaycastCooldown = 0;
    this._autoFireHasTarget = false;
    this._setMovementEnabled(true);
    this._clearPlayerInput(this.player.input);
    this.health = this._maxHealth;
    this.shield = 0;
    this.resetAnimations();
    this.player.camera.setAttachedToEntity(this);
    this._setupPlayerCamera();
    this.player.ui.sendData({ type: 'scope-zoom', zoom: 1, style: 'none', sniper: false });
    this.setActiveInventorySlotIndex(0);
    this.setPosition(GameManager.instance.getRandomSpawnPosition({ excludeEntity: this }));
    this.resetLinearVelocity();
    void this._equipLoadout();
  }

  public savePersistedData(): void {}

  /** Swipe/scroll toggle: with two slots this is direction-agnostic. */
  public switchToNextWeapon(): void {
    for (let step = 1; step < TOTAL_INVENTORY_SLOTS; step++) {
      const index = (this._inventoryActiveSlotIndex + step) % TOTAL_INVENTORY_SLOTS;
      if (this._inventory[index]) {
        this.setActiveInventorySlotIndex(index);
        return;
      }
    }
  }

  public setActiveInventorySlotIndex(index: number): void {
    if (!Number.isInteger(index) || index < 0 || index >= TOTAL_INVENTORY_SLOTS) return;

    if (index !== this._inventoryActiveSlotIndex) {
      this._inventory[this._inventoryActiveSlotIndex]?.unequip();
    }

    this._inventoryActiveSlotIndex = index;

    if (this._inventory[index]) {
      this._inventory[index].equip();
    }

    this._updatePlayerUIInventoryActiveSlot();
    this._sendReticleUI();
  }

  /**
   * Reticle spec for the active item: spread is the canonical bloom radius
   * in camera tangent units. The HUD projects it through the live camera, so
   * FOV changes resize the circle from the same value bullets sample.
   */
  private _sendReticleUI(): void {
    const item = this._inventory[this._inventoryActiveSlotIndex];
    const gun = item instanceof GunEntity ? item : undefined;
    this._updateAimTangentsForActiveItem();

    this.player.ui.sendData({
      type: 'reticle',
      spread: gun?.getSpread() ?? 0,
      pellets: gun?.getPellets() ?? 1,
      range: gun?.getEffectiveRange() ?? 0,
      tx: this._aimTangentX,
      ty: this._aimTangentY,
      scoped: false,
    });
  }

  private _updateAimTangentsForActiveItem(): void {
    const item = this._inventory[this._inventoryActiveSlotIndex];
    const gun = item instanceof GunEntity ? item : undefined;
    const twoHanded = gun?.heldHand === 'both';

    this._aimTangentX = twoHanded ? TWO_HANDED_AIM_TANGENT_X : ONE_HANDED_AIM_TANGENT_X;
    this._aimTangentY = twoHanded ? TWO_HANDED_AIM_TANGENT_Y : ONE_HANDED_AIM_TANGENT_Y;
  }

  public setGravity(gravityScale: number): void {
    this.setGravityScale(gravityScale);
  }

  public takeDamage(damage: number, hitDirection: Vector3Like, attacker?: GamePlayerEntity): void {
    if (!this.isSpawned || !this.world || !GameManager.instance.isGameActive || this._dead) return;

    this._playDamageAudio();

    // Flash for damage
    this.setTintColor({ r: 255, g: 0, b: 0});
    setTimeout(() => this.setTintColor({ r: 255, g: 255, b: 255 }), 100); // reset tint color after 100ms

    // Convert hit direction to screen space coordinates
    const facingDir = this.player.camera.facingDirection;
    this.player.ui.sendData({
      type: 'damage-indicator', 
      direction: {
        x: -(facingDir.x * hitDirection.z - facingDir.z * hitDirection.x),
        y: 0,
        z: -(facingDir.x * hitDirection.x + facingDir.z * hitDirection.z)
      }
    });

    // Handle shield damage first
    if (this.shield > 0) {
      const shieldDamage = Math.min(damage, this.shield);
      this.shield -= shieldDamage;
      damage -= shieldDamage;      
      if (damage === 0) return;
    }

    // Handle health damage
    this.health -= damage;
    this.checkDeath(attacker);
  }

  public updateHealth(amount: number): void {
    this.health += amount; // setter clamps and updates the UI
  }

  public updateShield(amount: number): void {
    this.shield += amount; // setter clamps and updates the UI
  }

  public updateItemInventoryQuantity(item: ItemEntity): void {
    const index = this.getItemInventorySlot(item);
    if (index === -1) return;

    this.player.ui.sendData({
      type: 'inventory-quantity-update',
      index,
      quantity: item.getQuantity(),
    });
  }

  private _setupPlayerController(): void {
    // FPS body facing: the model always faces the camera yaw. Rotating the
    // body toward strafe direction twists the feet under a fixed aim and
    // reads wrong from other players' view.
    this.playerController.applyDirectionalMovementRotations = false;
    this.playerController.autoCancelMouseLeftClick = false;

    this.resetAnimations();

    this.playerController.on(BaseEntityControllerEvent.TICK_WITH_PLAYER_INPUT, this._onTickWithPlayerInput);
    this.playerController.canSwim = () => false;
  }

  private _setupPlayerHeadshotCollider(): void {
    // TODO
    // this.createAndAddChildCollider({
    //   shape: ColliderShape.BALL,
    //   radius: 0.45,
    //   relativePosition: { x: 0, y: 0.4, z: 0 },
    //   isSensor: true,
    // });
  }

  private _setupPlayerInventory(): void {
    void this._equipLoadout();
  }

  /** Despawn every loadout gun. */
  private _despawnGuns(): void {
    this.player.camera.setZoom(1);
    this.player.ui.sendData({ type: 'scope-zoom', zoom: 1, style: 'none', sniper: false });

    for (let i = 0; i < this._inventory.length; i++) {
      const item = this._inventory[i];
      if (!item) continue;
      if (item.isSpawned) item.despawn();
      this._inventory[i] = undefined;
    }
    this._updatePlayerUIInventory();
    this._updatePlayerUIInventoryActiveSlot();
  }

  /**
   * Equips the player's chosen guns into slots 1..N with deep ammo
   * reserves. There are no weapon pickups: the loadout IS the arsenal.
   */
  private async _equipLoadout(): Promise<void> {
    if (this._equippingLoadout || !this.world || !this.isSpawned) return;
    this._equippingLoadout = true;

    try {
      this._despawnGuns();

      for (const gunId of this._loadout.slice(0, LOADOUT_SLOTS)) {
        if (!this.isSpawned || !this.world) break;
        const item = await ItemFactory.createItem(gunId);
        if (item instanceof GunEntity) {
          item.setReserveAmmo(INFINITE_RESERVE_AMMO); // before pickup so the HUD shows it
        }
        item.spawn(this.world, this.position);
        item.pickup(this);
      }
    } finally {
      this._equippingLoadout = false;
    }
  }

  /** Re-equip the current loadout (round resets, respawn). */
  public refreshLoadout(): void {
    void this._equipLoadout();
  }

  /** Validate + apply a loadout from the UI; refreshes guns immediately. */
  public setLoadout(gunIds: unknown[]): void {
    const unique = [...new Set(gunIds.filter(isCatalogGun))].slice(0, LOADOUT_SLOTS);
    if (!unique.length) return;
    this._loadout = unique;
    void this._equipLoadout();
    this._sendLoadoutUI(true);
  }

  private _sendLoadoutUI(applied = false): void {
    this.player.ui.sendData({
      type: 'loadout',
      catalog: GUN_CATALOG,
      selected: this._loadout,
      maxSlots: LOADOUT_SLOTS,
      applied,
    });
  }

  public setupPlayerUI(): void {
    this.nametagSceneUI.setViewDistance(8); // lessen view distance so you only see player names when close
    this.player.ui.load('ui/index.html');

    // Handle inventory selection from mobile UI
    this.player.ui.on(PlayerUIEvent.DATA, (payload) => {
      const { data } = payload;

      if (data.type === 'client-platform') {
        this._isMobileClient = Boolean(data.isMobile);
        return;
      }

      if (data.type === 'inventory-select') {
        this.setActiveInventorySlotIndex(data.index);
      }

      if (data.type === 'switch-weapon') {
        this.switchToNextWeapon();
      }

      if (data.type === 'request-loadout') {
        this._sendLoadoutUI();
      }

      if (data.type === 'set-loadout' && Array.isArray(data.guns)) {
        this.setLoadout(data.guns);
      }

      if (data.type === 'clear-scope') {
        this.clearScopeZoom();
      }
    });
  }

  private _setupPlayerCamera(): void {
    this.player.camera.setMode(PlayerCameraMode.FIRST_PERSON);
    this.player.camera.setZoom(1);
    this.player.camera.setViewModelHiddenNodes([ 'head', 'neck', 'torso', 'leg_right', 'leg_left' ]);
    this.player.camera.setOffset({ x: 0, y: 0.75, z: 0 }); // eye height scales with the 1.5x character
    this.player.camera.setViewModelPitchesWithCamera(true);
    this.player.camera.setViewModelYawsWithCamera(true);
  }

  public static setStrideTune(value: number): void {
    GamePlayerEntity._strideTune = value;
  }

  /**
   * Step cadence follows ground speed: the walk/run clips play at a rate
   * proportional to actual velocity so feet stop sliding when speed and
   * animation disagree (ADS, slows, knockback, tuning changes).
   */
  private _updateGaitCadence(): void {
    const v = this.linearVelocity;
    const speed = Math.hypot(v.x, v.z);
    const walkV = this.playerController.walkVelocity || 4;
    const runV = this.playerController.runVelocity || 8;
    const ref = speed > walkV * 1.15 ? runV : walkV;
    const target = speed < 0.3
      ? 1
      : Math.min(2.6, Math.max(0.5, (speed / ref) * GamePlayerEntity._strideTune));

    if (Math.abs(target - this._gaitRate) < 0.08) return;
    this._gaitRate = target;
    for (const name of ['walk_lower', 'run_lower']) {
      this.getModelAnimation(name)?.setPlaybackRate(target);
    }
  }

  /** Crosshair turns red while an enemy is under it within the gun's range. */
  private _updateReticleTarget(): void {
    const now = performance.now();
    if (now - this._reticleProbeAtMs < 120 || !this.world) return;
    this._reticleProbeAtMs = now;

    const item = this._inventory[this._inventoryActiveSlotIndex];
    let active = false;
    if (item instanceof GunEntity) {
      const { origin, direction } = this.getReticleAimRay();
      const hit = this.world.simulation.raycast(
        origin,
        direction,
        item.getEffectiveRange(),
        { filterExcludeRigidBody: this.rawRigidBody },
      );
      active = hit?.hitEntity instanceof GamePlayerEntity && !hit.hitEntity.isDead;
    }

    if (active !== this._reticleTargetActive) {
      this._reticleTargetActive = active;
      this.player.ui.sendData({ type: 'reticle-target', active });
    }
  }

  private _onTickWithPlayerInput = (payload: EventPayloads[BaseEntityControllerEvent.TICK_WITH_PLAYER_INPUT]): void => {
    const { input } = payload;

    if (this._dead) {
      this._clearPlayerInput(input);
      return;
    }

    this._updateGaitCadence();
    this._updateReticleTarget();

    this._applyMobileAutoFire(input);

    if (input.ml) {
      this._handleMouseLeftClick();
    }

    if (input.mr) {
      this._handleMouseRightClick();
    }

    if (input.q) {
      // Weapons are loadout-bound now; dropping them would only litter and
      // desync the loadout. Point players at the menu instead.
      this.world?.chatManager?.sendPlayerMessage(this.player, 'Your weapons are part of your loadout - press Esc to change them.', 'FFAA00');
      input.q = false;
    }

    if (input.r) {
      this._handleReload();
      input.r = false;
    }

    if (input.z) {
      this._handleZoomScope();
      input.z = false;
    }

    this._handleInventoryHotkeys(input);
  }

  private _applyMobileAutoFire(input: EventPayloads[BaseEntityControllerEvent.TICK_WITH_PLAYER_INPUT]['input']): void {
    const wasAutoEngaged = this._autoFireEngaged;
    const manualRequested = input.ml && !wasAutoEngaged;
    this._autoFireEngaged = false;

    const disableAutoFire = () => {
      this._autoFireHasTarget = false;
      this._autoFireRaycastCooldown = 0;
    };

    const activeItem = this._inventory[this._inventoryActiveSlotIndex];
    const canUseAutoFire = this._isMobileClient && this.world && activeItem instanceof GunEntity;

    if (!canUseAutoFire) {
      disableAutoFire();
    } else if (this._autoFireRaycastCooldown <= 0) {
      this._autoFireHasTarget = this._hasTargetInCrosshair(activeItem);
      this._autoFireRaycastCooldown = MOBILE_AUTOFIRE_SAMPLE_INTERVAL_TICKS;
    } else {
      this._autoFireRaycastCooldown--;
    }

    if (this._autoFireHasTarget) {
      input.ml = true;
      this._autoFireEngaged = true;
      return;
    }

    if (manualRequested) {
      input.ml = true;
      return;
    }

    if (wasAutoEngaged) {
      input.ml = false;
      return;
    }

    input.ml = false;
  }

  private _hasTargetInCrosshair(activeGun: GunEntity): boolean {
    if (!this.world) {
      return false;
    }

    const { origin, direction } = this.getReticleAimRay();

    const raycastHit = this.world.simulation.raycast(
      origin,
      direction,
      activeGun.getEffectiveRange(),
      {
        filterExcludeRigidBody: this.rawRigidBody,
      }
    );

    return Boolean(
      raycastHit?.hitEntity instanceof GamePlayerEntity &&
      raycastHit.hitEntity !== this &&
      !raycastHit.hitEntity.isDead
    );
  }

  private _handleMouseLeftClick(): void {
    const activeItem = this._inventory[this._inventoryActiveSlotIndex];
 
    if (activeItem instanceof ItemEntity && activeItem.consumable) {
      activeItem.consume();
    }

    if (activeItem instanceof GunEntity) {
      activeItem.shoot();
    }

    if (activeItem instanceof MeleeWeaponEntity) {
      activeItem.attack();
    }
  }

  private _handleMouseRightClick(): void {
    this.player.input.mr = false;

    if (!this.world) return;

    // Right-click: scoped guns ADS (the old two-finger-click scope zoom);
    // the pickaxe builds; other items do nothing.
    const activeItem = this._inventory[this._inventoryActiveSlotIndex];
    if (activeItem instanceof GunEntity) {
      if (activeItem.hasScope()) activeItem.zoomScope();
      return;
    }

    if (!(activeItem instanceof MeleeWeaponEntity)) return;

    if (this._materials < BLOCK_MATERIAL_COST) {
      this.world?.chatManager?.sendPlayerMessage(this.player, `You need at least ${BLOCK_MATERIAL_COST} materials to build.`, 'FF0000');
      return;
    }

    const { world } = this;
    const { origin, direction } = this.getReticleAimRay();
    const raycastHit = world.simulation.raycast(origin, direction, BUILD_REACH, {
      filterExcludeRigidBody: this.rawRigidBody,
    });
    if (!raycastHit?.hitPoint) return;

    // Against a placed block, fill its neighbor cell; against the world
    // mesh (an entity, not a block) take the empty cell just in front of
    // the hit surface.
    const placementCoordinate = raycastHit.hitBlock
      ? raycastHit.hitBlock.getNeighborGlobalCoordinateFromHitPoint(raycastHit.hitPoint)
      : {
          x: Math.floor(raycastHit.hitPoint.x - direction.x * 0.01),
          y: Math.floor(raycastHit.hitPoint.y - direction.y * 0.01),
          z: Math.floor(raycastHit.hitPoint.z - direction.z * 0.01),
        };

    // Never entomb anyone: reject cells overlapping a player capsule.
    const blockCenter = { x: placementCoordinate.x + 0.5, y: placementCoordinate.y + 0.5, z: placementCoordinate.z + 0.5 };
    const entombs = world.entityManager.getAllPlayerEntities().some(entity => {
      const p = entity.position;
      return Math.abs(p.x - blockCenter.x) < 1
        && Math.abs(p.z - blockCenter.z) < 1
        && Math.abs(p.y - blockCenter.y) < entity.height / 2 + 0.5;
    });
    if (entombs) return;

    world.chunkLattice.setBlock(placementCoordinate, BUILD_BLOCK_ID);
    this._materials -= BLOCK_MATERIAL_COST;
    this._updatePlayerUIMaterials();
  }

  private _handleReload(): void {
    const activeItem = this._inventory[this._inventoryActiveSlotIndex];
    if (activeItem instanceof GunEntity) {
      activeItem.reload();
    }
  }

  private _handleZoomScope(): void {
    const activeItem = this._inventory[this._inventoryActiveSlotIndex];
    if (activeItem instanceof GunEntity) {
      activeItem.zoomScope();
    }
  }

  private _setupPlayerInteraction(): void {
    this.player.setMaxInteractDistance(INTERACT_DISTANCE);
  }

  /** Whether the player can pick up an item (has an available inventory slot that isn't slot 0). */
  public canPickupItem(): boolean {
    return this._findInventorySlot() !== 0;
  }

  private _handleInventoryHotkeys(input: any): void {
    for (let i = 1; i <= TOTAL_INVENTORY_SLOTS; i++) {
      const key = i.toString();
      if (input[key]) {
        this.setActiveInventorySlotIndex(i - 1); // keys 1/2 -> slots 0/1
        input[key] = false;
      }
    }
  }

  private _findInventorySlot(): number {
    // Try active slot first if empty
    if (!this._inventory[this._inventoryActiveSlotIndex]) {
      return this._inventoryActiveSlotIndex;
    }

    // Find first empty slot or use active slot if none found
    const emptySlot = this._inventory.findIndex(slot => !slot);

    return emptySlot !== -1 ? emptySlot : this._inventoryActiveSlotIndex;
  }

  private _updatePlayerUIInventory(): void {
    this.player.ui.sendData({
      type: 'inventory',
      inventory: this._inventory.map(item => {
        if (!item) return;

        return {
          name: item.name,
          iconImageUri: item.iconImageUri,
          quantity: item.getQuantity(),
        } as InventoryItem;
      })
    });
  }

  private _updatePlayerUIInventoryActiveSlot(): void {
    this.player.ui.sendData({
      type: 'inventory-active-slot',
      index: this._inventoryActiveSlotIndex,
    });

    const activeItem = this._inventory[this._inventoryActiveSlotIndex];
    if (activeItem instanceof GunEntity) {
      activeItem.updateAmmoIndicatorUI();
    } else {
      this.player.ui.sendData({
        type: 'ammo-indicator',
        show: false,
      });
    }
  }

  private _updatePlayerUIHealth(): void {
    this.player.ui.sendData({
      type: 'health',
      health: this._health,
      maxHealth: this._maxHealth
    });
  }

  private _updatePlayerUIRadar(): void {
    if (!this.world || !this.isSpawned || this._dead) {
      this.player.ui.sendData({ type: 'radar', enabled: false });
      return;
    }

    let selfPosition: Vector3Like;
    try {
      selfPosition = this.position;
    } catch {
      this.player.ui.sendData({ type: 'radar', enabled: false });
      return;
    }

    const segments = new Array(RADAR_SEGMENTS).fill(0);
    let coreIntensity = 0;
    const offRadarQuadrants = [
      { angleRad: Math.PI * 0.25, count: 0 },
      { angleRad: Math.PI * 0.75, count: 0 },
      { angleRad: -Math.PI * 0.75, count: 0 },
      { angleRad: -Math.PI * 0.25, count: 0 },
    ];

    const yaw = this.player.camera.orientation?.yaw ?? 0;
    const forwardX = -Math.sin(yaw);
    const forwardZ = -Math.cos(yaw);
    const rightX = Math.cos(yaw);
    const rightZ = -Math.sin(yaw);

    for (const target of this.world.entityManager.getAllPlayerEntities()) {
      if (!(target instanceof GamePlayerEntity) || target === this || !target.isSpawned || target.isDead) {
        continue;
      }

      let targetPosition: Vector3Like;
      try {
        targetPosition = target.position;
      } catch {
        continue;
      }

      const dx = targetPosition.x - selfPosition.x;
      const dz = targetPosition.z - selfPosition.z;
      const dist = Math.hypot(dx, dz);
      if (!Number.isFinite(dist) || dist <= 0.001) continue;

      const nx = dx / dist;
      const nz = dz / dist;
      const frontDot = nx * forwardX + nz * forwardZ;
      const rightDot = nx * rightX + nz * rightZ;
      const angle = Math.atan2(rightDot, frontDot);
      const sector = normalizeRadarSegmentIndex(Math.round(angle / RADAR_SECTOR_STEP));

      if (dist > RADAR_RANGE) {
        offRadarQuadrants[radarQuadrantIndexFromAngle(angle)].count++;
        continue;
      }

      const nearIntensity = Math.max(0, 1 - (dist / RADAR_RANGE));
      segments[sector] = Math.max(segments[sector], nearIntensity);

      if (dist <= RADAR_CORE_RANGE) {
        coreIntensity = Math.max(coreIntensity, Math.max(0, 1 - (dist / RADAR_CORE_RANGE)));
      }
    }

    const beacons = offRadarQuadrants
      .filter(quadrant => quadrant.count > 0)
      .map(quadrant => ({
        angleRad: quadrant.angleRad,
        intensity: Math.max(0.35, Math.min(1, quadrant.count >= 4 ? 1 : (0.28 + quadrant.count * 0.18))),
        count: quadrant.count,
      }));

    this.player.ui.sendData({
      type: 'radar',
      enabled: true,
      segments,
      coreIntensity,
      beacons,
    });
  }

  private _updatePlayerUIMaterials(): void {
    this.player.ui.sendData({
      type: 'materials',
      materials: this._materials,
    });
  }

  private _updatePlayerUIShield(): void {
    this.player.ui.sendData({
      type: 'shield',
      shield: this._shield,
      maxShield: this._maxShield,
    });
  }

  private _playDamageAudio(): void {
    this._damageAudio.setDetune(-200 + Math.random() * 800);
    this._damageAudio.play(this.world!, true);
  }

  private _startRadarTicker(): void {
    if (this._radarTimer) return;

    const tick = () => {
      if (!this.isSpawned) {
        this._radarTimer = undefined;
        return;
      }

      this._updatePlayerUIRadar();
      this._radarTimer = setTimeout(tick, RADAR_UPDATE_INTERVAL_MS);
    };

    tick();
  }

  private _stopRadarTicker(): void {
    if (!this._radarTimer) return;
    clearTimeout(this._radarTimer);
    this._radarTimer = undefined;
  }

  private _autoHealTicker(): void {
    setTimeout(() => {
      if (!this.isSpawned) return;

      if (this.health < this._maxHealth && !this._dead) {
        this.health += 1;
      }

      this._autoHealTicker();
    }, 2000);
  }

  private _outOfWorldTicker(): void {
    setTimeout(() => {
      if (!this.isSpawned) return;

      try {
        if (this.position.y < VOID_Y && !this._dead) {
          if (GameManager.instance.isGameActive) {
            this.takeDamage(MAX_HEALTH + MAX_SHIELD, { x: 0, y: 0, z: -1 });
          } else {
            // No round running: takeDamage would no-op and the fall would
            // never end. Just put them back on the map.
            this.setPosition(GameManager.instance.getRandomSpawnPosition({ excludeEntity: this }));
            this.health = this._maxHealth;
          }
        }
      } catch {
        // Physics body tore down between the isSpawned check and the
        // position read (despawn race); stop ticking for this entity.
        return;
      }

      this._outOfWorldTicker();
    }, 3000);
  }
}
