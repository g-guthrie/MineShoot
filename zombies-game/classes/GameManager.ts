import { Audio, Collider, ColliderShape, CollisionGroup, Entity, GameServer, RigidBodyType } from 'highchair';
import worldColliders from '../assets/maps/boxman-world.colliders.json' with { type: 'json' };
import GamePlayerEntity from './GamePlayerEntity';
import PurchaseBarrierEntity from './PurchaseBarrierEntity';
import { INVISIBLE_WALLS, INVISIBLE_WALL_COLLISION_GROUP, PURCHASE_BARRIERS, ENEMY_SPAWN_POINTS, WEAPON_CRATES } from '../gameConfig';
import RipperEntity from './enemies/RipperEntity';
import ZombieEntity from './enemies/ZombieEntity';
import WeaponCrateEntity from './WeaponCrateEntity';
import type { World, Vector3Like } from 'highchair';
import type EnemyEntity from './EnemyEntity';
import type { Player } from 'highchair';

const GAME_WAVE_INTERVAL_MS = 30 * 1000; // 30 seconds between waves
const SLOWEST_SPAWN_INTERVAL_MS = 4000; // Starting spawn rate
const FASTEST_SPAWN_INTERVAL_MS = 750; // Fastest spawn rate
const GAME_START_COUNTDOWN_S = 45; // 45 seconds delay before game starts
const WAVE_SPAWN_INTERVAL_REDUCTION_MS = 300; // Spawn rate reduction per wave
const WAVE_DELAY_MS = 10000; // 10s between waves

export default class GameManager {
  public static readonly instance = new GameManager();

  public isStarted = false;
  public unlockedIds: Set<string> = new Set([ 'start' ]);
  public waveNumber = 0;
  public world: World | undefined;

  // Players who were part of the running round, so a disconnect+reconnect
  // mid-game gets respawned instead of relegated to spectator.
  private _activePlayerIds: Set<string> = new Set();

  private _enemySpawnTimeout: NodeJS.Timeout | undefined;
  private _endGameTimeout: NodeJS.Timeout | undefined;
  private _startCountdown: number = GAME_START_COUNTDOWN_S;
  private _startInterval: NodeJS.Timeout | undefined;
  private _waveTimeout: NodeJS.Timeout | undefined;
  private _waveStartAudio: Audio;

  public constructor() {
    this._waveStartAudio = new Audio({
      uri: 'audio/sfx/wave-start.mp3',
      loop: false,
      volume: 1,
    });
  }

  public addUnlockedId(id: string) {
    this.unlockedIds.add(id);
  }

  public canRejoin(player: Player): boolean {
    return this._activePlayerIds.has(player.id);
  }

  public checkEndGame() {
    if (this._endGameTimeout !== undefined) {
      return;
    }

    this._endGameTimeout = setTimeout(() => {
      this._endGameTimeout = undefined;

      if (!this.world || !this.isStarted) return;

      let allPlayersDowned = true;

      this.world.entityManager.getAllPlayerEntities().forEach(playerEntity => {
        const gamePlayerEntity = playerEntity as GamePlayerEntity;

        if (!gamePlayerEntity.downed) {
          allPlayersDowned = false;
        }
      });

      if (allPlayersDowned) {
        this.endGame();
      }
    }, 1000);
  }

  public setupGame(world: World) {
    this.world = world;

    this._spawnWorldMesh(world);

    // Setup invisible walls that only enemies can pass through
    INVISIBLE_WALLS.forEach(wall => {
      const wallCollider = new Collider({
        shape: ColliderShape.BLOCK,
        halfExtents: wall.halfExtents,
        relativePosition: wall.position, // since this is not attached to a rigid body, relative position is relative to the world global coordinate space.
        collisionGroups: {
          belongsTo: [ INVISIBLE_WALL_COLLISION_GROUP ],
          collidesWith: [ CollisionGroup.PLAYER ],
        },
      });

      wallCollider.addToSimulation(world.simulation);
    });

    // Spawn initial purchase barriers
    this.spawnPurchaseBarriers();

    // Setup weapon crates
    WEAPON_CRATES.forEach(crate => {
      const weaponCrate = new WeaponCrateEntity({
        name: crate.name,
        price: crate.price,
        rollableWeaponIds: crate.rollableWeaponIds,
      });

      weaponCrate.spawn(world, crate.position, crate.rotation);
    });

    // Start ambient music
    (new Audio({
      uri: 'audio/music/bg.mp3',
      loop: true,
      volume: 0.4,
    })).play(world);

    this.startCountdown();
  }

  public startCountdown() {
    clearInterval(this._startInterval);
    this._startCountdown = GAME_START_COUNTDOWN_S;
    this._startInterval = setInterval(() => {
      if (!this.world) return;

      // An empty lobby resets the countdown rather than freezing it, so the
      // next player to join gets the full countdown instead of an ambush start.
      if (!this.world.entityManager.getAllPlayerEntities().length) {
        this._startCountdown = GAME_START_COUNTDOWN_S;
        return;
      }

      this._startCountdown--;

      if (this._startCountdown <= 0) {
        this.startGame();
        this.world.chatManager.sendBroadcastMessage('Game starting!', 'FF0000');
      } else if (this._startCountdown <= 5 || this._startCountdown % 15 === 0) {
        this.world.chatManager.sendBroadcastMessage(`${this._startCountdown} seconds until the game starts...`, 'FF0000');
      }
    }, 1000);
  }

  public startGame() {
    if (!this.world || this.isStarted) return; // type guard

    this.isStarted = true;
    clearInterval(this._startInterval);

    GameServer.instance.playerManager.getConnectedPlayersByWorld(this.world).forEach(player => {
      player.ui.sendData({ type: 'start' });
    });

    // Wave loop first so the first zombies spawn with wave-1 stats.
    this._waveLoop();
    this._spawnLoop();
  }

  public endGame() {
    if (!this.world) return;

    this.world.chatManager.sendBroadcastMessage(`Game Over! Your team made it to wave ${this.waveNumber}!`, '00FF00');

    clearTimeout(this._enemySpawnTimeout);
    clearTimeout(this._waveTimeout);

    this.isStarted = false;
    this.unlockedIds = new Set([ 'start' ]);
    this.waveNumber = 0;
    this._activePlayerIds.clear();

    this.world.entityManager.getEntitiesByTag('enemy').forEach(entity => {
      const enemy = entity as EnemyEntity;
      enemy.takeDamage(enemy.health); // triggers any UI updates when killed via takedamage
    });

    // Unclaimed crate rolls must not carry into the next game.
    this.world.entityManager.getEntitiesByTag('weapon-crate').forEach(entity => {
      (entity as WeaponCrateEntity).resetRoll();
    });

    this.world.entityManager.getAllPlayerEntities().forEach(playerEntity => {
      playerEntity.despawn();
    });

    setTimeout(() => { // brief timeout for at least a tick to allow packet resolution.
      if (!this.world) return;
      GameServer.instance.playerManager.getConnectedPlayersByWorld(this.world).forEach(player => {
        this.spawnPlayerEntity(player);
      });
    }, 250);

    this.spawnPurchaseBarriers();
    this.startCountdown();
  }

  public spawnPlayerEntity(player: Player) {
    if (!this.world) return;

    // A player joining inside endGame()'s respawn window (or any double
    // join) must not get a second entity wired to the same input.
    if (this.world.entityManager.getPlayerEntitiesByPlayer(player).length) return;

    const playerEntity = new GamePlayerEntity(player);
    playerEntity.spawn(this.world, { x: 2, y: 3, z: 4 });
    player.camera.setAttachedToEntity(playerEntity);

    this._activePlayerIds.add(player.id);
  }

  /**
   * The boxman mesh world with one BLOCK collider per solid cuboid, attached
   * to the entity's FIXED rigid body — the only SDK collider path that both
   * blocks movement and resolves gun raycasts (trimesh and bare simulation
   * colliders provably don't). Same pattern as highchair-game.
   */
  private _spawnWorldMesh(world: World) {
    const colliders = worldColliders.map(c => {
      const cy = Math.cos(c.rotY / 2), sy = Math.sin(c.rotY / 2);
      const cx = Math.cos(c.tiltX / 2), sx = Math.sin(c.tiltX / 2);
      return {
        shape: ColliderShape.BLOCK,
        halfExtents: { x: c.hx, y: c.hy, z: c.hz },
        relativePosition: { x: c.x, y: c.y, z: c.z },
        relativeRotation: { x: sx * cy, y: cx * sy, z: -sx * sy, w: cx * cy },
      };
    });

    new Entity({
      name: 'BoxmanWorld',
      modelUri: 'models/environment/boxman-world.glb',
      rigidBodyOptions: { type: RigidBodyType.FIXED, colliders },
    }).spawn(world, { x: 0, y: 0, z: 0 });
  }

  public spawnPurchaseBarriers() {
    if (!this.world) return;
   
    this.world.entityManager.getEntitiesByTag('purchase-barrier').forEach(entity => {
      entity.despawn();
    });
    
    PURCHASE_BARRIERS.forEach(barrier => {
      const purchaseBarrier = new PurchaseBarrierEntity({
        name: barrier.name,
        removalPrice: barrier.removalPrice,
        unlockIds: barrier.unlockIds,
        width: barrier.width,
      });

      purchaseBarrier.spawn(this.world!, barrier.position, barrier.rotation);
    });
  }

  private _spawnLoop() {
    if (!this.world || !this.isStarted) return;

    clearTimeout(this._enemySpawnTimeout);

    const zombie = new ZombieEntity({
      health: 7 + (this.waveNumber * 0.25),
      speed: Math.min(6, 2 + this.waveNumber * 0.25), // max speed of 6
    });

    zombie.spawn(this.world, this._getSpawnPoint());

    const nextSpawn = Math.max(FASTEST_SPAWN_INTERVAL_MS, SLOWEST_SPAWN_INTERVAL_MS - (this.waveNumber * WAVE_SPAWN_INTERVAL_REDUCTION_MS));

    this._enemySpawnTimeout = setTimeout(() => this._spawnLoop(), nextSpawn);

    // Check end game conditions.
    this.checkEndGame();
  }

  private _waveLoop() {
    if (!this.world || !this.isStarted) return;

    clearTimeout(this._waveTimeout);

    this.waveNumber++;

    // Real inter-wave lull: pause spawning, resume after the delay.
    if (this.waveNumber > 1) {
      clearTimeout(this._enemySpawnTimeout);
      this._enemySpawnTimeout = setTimeout(() => this._spawnLoop(), WAVE_DELAY_MS);
    }

    this._waveStartAudio.play(this.world, true);

    GameServer.instance.playerManager.getConnectedPlayersByWorld(this.world).forEach(player => {
      player.ui.sendData({
        type: 'wave',
        wave: this.waveNumber,
      });
    });
    
    if (this.waveNumber % 5 === 0) { // Spawn a ripper every 5 waves
      const ripper = new RipperEntity({
        health: 50 * this.waveNumber,
        speed: 2 + this.waveNumber * 0.25,
        reward: 50 * this.waveNumber,
      });
      ripper.spawn(this.world, this._getSpawnPoint());
    }
    
    this._waveTimeout = setTimeout(() => this._waveLoop(), GAME_WAVE_INTERVAL_MS);
  }

  private _getSpawnPoint(): Vector3Like {
    const spawnPoints: Vector3Like[] = [];

    this.unlockedIds.forEach(id => {
      const spawnPoint = ENEMY_SPAWN_POINTS[id];
      if (spawnPoint) spawnPoints.push(...spawnPoint);
    });

    return spawnPoints[Math.floor(Math.random() * spawnPoints.length)];
  }
}
