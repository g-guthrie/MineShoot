import {
  GameServer,
  Player,
  Quaternion,
  Vector3Like,
  World,
  ColliderShape,
  Entity,
  RigidBodyType,
} from 'highchair';

import worldColliders from '../assets/maps/boxman-world.colliders.json' with { type: 'json' };

import {
  GAME_DURATION_MS,
  PLAYER_STAND_HEIGHT,
  SPAWN_POINTS,
  RANK_WIN_EXP,
} from '../gameConfig';

import GamePlayerEntity from './GamePlayerEntity';
import ItemFactory from './ItemFactory';
import BotPlayerEntity from './BotPlayerEntity';

export default class GameManager {
  public static readonly instance = new GameManager();

  public world: World | undefined;
  private _gameStartAt: number = 0;
  private _gameTimer: NodeJS.Timeout | undefined;
  private _playerCount: number = 0;
  private _restartTimer: NodeJS.Timeout | undefined;
  private _killCounter: Map<string, number> = new Map();
  private _gameActive: boolean = false;

  public get isGameActive(): boolean { return this._gameActive; }

  public get playerCount(): number { return this._playerCount; }
  public set playerCount(value: number) {
    this._playerCount = value;
    this._updatePlayerCountUI();
  }

  /**
   * Sets up the game world and waits for players to join
   */
  public setupGame(world: World) {
    this.world = world;
    this._waitForPlayersToStart();
    BotPlayerEntity.setWorldActive(world, false);
  }

  /**
   * Starts a new game round
   */
  public startGame() {
    if (!this.world) return;

    // Clean up any previous game state
    this._cleanup();
    
    // Set game as active
    this._gameActive = true;
    BotPlayerEntity.setWorldActive(this.world, true);
    this._gameStartAt = Date.now();
    
    // Move all players to random spawn positions
    this.world.entityManager.getAllPlayerEntities().forEach(playerEntity => {
      playerEntity.setPosition(this.getRandomSpawnPosition());
      playerEntity.player.ui.sendData({ type: 'game-start' });
      this._sendGameStartAnnouncements(playerEntity.player);
    });
    
    // Set game timer
    this._gameTimer = setTimeout(() => this.endGame(), GAME_DURATION_MS);

    // Sync UI for all players
    this._syncAllPlayersUI();
    this.onPlayerPopulationChanged();
  }

  /**
   * Ends the current game round and schedules the next one
   */
  public endGame() {
    if (!this.world || !this._gameActive) return;
    
    this._gameActive = false;
    BotPlayerEntity.setWorldActive(this.world, false);
    this.world.chatManager.sendBroadcastMessage('Game over! Starting the next round in 10 seconds...', 'FF0000');
    
    this._identifyWinningPlayer();
    this.refreshPlayerCount();

    // Clear any existing restart timer
    if (this._restartTimer) {
      clearTimeout(this._restartTimer);
    }
    
    this._restartTimer = setTimeout(() => this.startGame(), 10 * 1000);
  }

  /**
   * Spawns a player entity in the world
   */
  public spawnPlayerEntity(player: Player) {
    if (!this.world) return;

    const playerEntity = new GamePlayerEntity(player);
    
    playerEntity.spawn(this.world, this.getRandomSpawnPosition());
  
    // Sync UI for the new player
    this.syncTimer(player);
    this.syncLeaderboard(player);

    // Send start announcement if game is active
    if (this._gameActive) {
      player.ui.sendData({ type: 'game-start' });
      this._sendGameStartAnnouncements(player);
    }

    // Load player's data
    playerEntity.loadPersistedData();

    this.onPlayerPopulationChanged();
  }

  /**
   * Increments kill count for a player and updates the leaderboard
   */
  public addKill(playerUsername: string): void {
    const killCount = this._killCounter.get(playerUsername) ?? 0;
    const newKillCount = killCount + 1;
    
    this._killCounter.set(playerUsername, newKillCount);
    this._updateLeaderboardUI(playerUsername, newKillCount);
  }

  /**
   * Gets a random spawn position within the defined spawn region
   */
  public getRandomSpawnPosition(): Vector3Like {
    const p = SPAWN_POINTS[Math.floor(Math.random() * SPAWN_POINTS.length)];
    return { x: p.x, y: p.y + PLAYER_STAND_HEIGHT, z: p.z };
  }

  /**
   * Returns the current kill counts for all players
   */
  public getKillCounts(): Record<string, number> {
    return Object.fromEntries(this._killCounter);
  }

  /**
   * Syncs the leaderboard UI for a specific player
   */
  public syncLeaderboard(player: Player) {
    if (!this.world) return;

    player.ui.sendData({
      type: 'leaderboard-sync',
      killCounts: this.getKillCounts(),
      localPlayer: player.username,
    });
  }

  /**
   * Syncs the game timer UI for a specific player
   */
  public syncTimer(player: Player) {
    if (!this.world || !this._gameStartAt) return;

    player.ui.sendData({
      type: 'timer-sync',
      startedAt: this._gameStartAt,
      endsAt: this._gameStartAt + GAME_DURATION_MS,
    });
  }

  /**
   * Resets the leaderboard and syncs it for all players
   */
  public resetLeaderboard() {
    if (!this.world) return;

    this._killCounter.clear();
    
    GameServer.instance.playerManager.getConnectedPlayersByWorld(this.world).forEach(player => {
      this.syncLeaderboard(player);
    });
  }

  /**
   * Cleans up the game state for a new round
   */
  private _cleanup() {
    if (!this.world) return;

    // Reset map to initial state
    this._spawnWorldMesh(this.world);

    // Reset player state
    this.world.entityManager.getAllPlayerEntities().forEach(playerEntity => {
      if (playerEntity instanceof GamePlayerEntity) {
        playerEntity.setActiveInventorySlotIndex(0); // reset to pickaxe at slot 0
        playerEntity.refreshLoadout(); // fresh loadout guns, nothing dropped
        playerEntity.resetCamera();
        playerEntity.resetMaterials();
        playerEntity.health = 100;
        playerEntity.shield = 0;
      }
    });

    // Remove non-player entities except pickaxes
    this.world.entityManager.getAllEntities().forEach(entity => {
      const heldByPlayer = entity.parent instanceof GamePlayerEntity;
      const isWorldMesh = entity === this._worldMesh;
      if (!(entity instanceof GamePlayerEntity) && entity.tag !== 'pickaxe' && !heldByPlayer && !isWorldMesh) {
        // allow 1 event loop for drop to resolve, there's some 
        // weird bug here otherwise we need to investigate later.
        setTimeout(() => {
          if (entity.isSpawned) {
            entity.despawn();
          }
        }, 0);
      }
    });

    // Clear timers
    if (this._gameTimer) {
      clearTimeout(this._gameTimer);
      this._gameTimer = undefined;
    }

    // Reset leaderboard
    this.resetLeaderboard();

    this.onPlayerPopulationChanged();
  }

  public refreshPlayerCount(): void {
    if (!this.world) return;

    this.playerCount = this.world.entityManager.getAllPlayerEntities().length;
  }

  public onPlayerPopulationChanged(): void {
    this._syncBots();
    this.refreshPlayerCount();
  }

  private _syncBots(): void {
    if (!this.world) return;

    BotPlayerEntity.ensureForWorld(this.world);
  }

  public _identifyWinningPlayer() {
    if (!this.world) return;

    // Find player with most kills
    let highestKills = 0;
    let winningPlayer = '';
    
    this._killCounter.forEach((kills, player) => {
      if (kills > highestKills) {
        highestKills = kills;
        winningPlayer = player;
      }
    });

    // Get winning player entity
    const winningPlayerEntity = this.world.entityManager
      .getAllPlayerEntities()
      .find(entity => entity.player.username === winningPlayer);

    if (!winningPlayerEntity) return;

    // Give winning player XP for winning
    if (winningPlayerEntity instanceof GamePlayerEntity) {
      winningPlayerEntity.addExp(RANK_WIN_EXP);
    }

    this.world.entityManager.getAllPlayerEntities().forEach(playerEntity => {
      if (playerEntity instanceof GamePlayerEntity) {
        if (playerEntity.player.username !== winningPlayer) { // don't change camera for the winner
          playerEntity.focusCameraOnPlayer(winningPlayerEntity as GamePlayerEntity);
        }
          
        playerEntity.player.ui.sendData({
          type: 'announce-winner',
          username: winningPlayer,
        });
      }
    });
  }

  /**
   * Syncs UI for all connected players
   */
  private _syncAllPlayersUI() {
    if (!this.world) return;
    
    const players = GameServer.instance.playerManager.getConnectedPlayersByWorld(this.world);
    players.forEach(player => {
      this.syncTimer(player);
      this.syncLeaderboard(player);
    });
  }

  /**
   * Sends game start announcements to a specific player
   */
  private _sendGameStartAnnouncements(player: Player) {
    if (!this.world) return;
    
    this.world.chatManager.sendPlayerMessage(player, 'Game started - most kills wins!', '00FF00');
    this.world.chatManager.sendPlayerMessage(player, '- You spawn with your full loadout: press LOADOUT (top left) to change guns');
    this.world.chatManager.sendPlayerMessage(player, '- Break blocks with your pickaxe to gain materials');
    this.world.chatManager.sendPlayerMessage(player, '- Right click to spend 3 materials to place a block');
    this.world.chatManager.sendPlayerMessage(player, '- Some weapons zoom with "Z"');
  }

  /**
   * Creates bedrock floor for the game world
   */
  private _worldMesh: Entity | undefined;

  /**
   * The playfield is the ORIGINAL boxman MineShoot world as one fixed
   * trimesh model (smooth ramps, pirate ship, kraken and all) — not a
   * voxel approximation. The voxel lattice underneath is just a bedrock
   * safety floor and a base for block building.
   */
  public _spawnWorldMesh(world: World) {
    if (this._worldMesh?.isSpawned) return;

    // boxman-world.glb is generated by tools/export-boxman-glb.mjs from the
    // original MineShoot quadrant builders: real rotated cuboids at original
    // scale, already centered on the arena origin (same -84 offset as the
    // voxel import, so boxman-arena.meta.json spawn points line up).
    // One box collider per solid cuboid of the boxman world
    // (assets/maps/boxman-world.colliders.json, world coordinates), attached
    // to this entity's FIXED rigid body. They must live on the entity:
    // TRIMESH colliders from optionsFromModelUri never register with the
    // simulation, and standalone colliders added via addToSimulation are
    // invisible to world.simulation.raycast — the SDK can only resolve hits
    // to an entity or a block, so bullets would pass through the world
    // (all three dead ends verified by raycast probes).
    const colliders = worldColliders.map(c => {
      // rotation: yaw about Y then tilt about X (matches the mesh bake)
      const cy = Math.cos(c.rotY / 2), sy = Math.sin(c.rotY / 2);
      const cx = Math.cos(c.tiltX / 2), sx = Math.sin(c.tiltX / 2);
      return {
        shape: ColliderShape.BLOCK,
        halfExtents: { x: c.hx, y: c.hy, z: c.hz },
        relativePosition: { x: c.x, y: c.y, z: c.z },
        relativeRotation: { x: sx * cy, y: cx * sy, z: -sx * sy, w: cx * cy },
      };
    });

    this._worldMesh = new Entity({
      name: 'BoxmanWorld',
      modelUri: 'models/environment/boxman-world.glb',
      rigidBodyOptions: {
        type: RigidBodyType.FIXED,
        colliders,
      },
    });
    // The world is authored around y=0: ground-slab tops are the zero
    // plane, recessed features (lagoon, quarry pit, river) dip below it.
    this._worldMesh.spawn(world, { x: 0, y: 0, z: 0 });
    if (process.env.WORLD_PROBE) {
      setTimeout(() => {
        for (const [px, pz] of [[0, 0], [-40, -40], [30, 30], [22, 22]]) {
          const hit = world.simulation.raycast({ x: px, y: 30, z: pz }, { x: 0, y: -1, z: 0 }, 60);
          console.info('[ray]', px, pz, '->', hit ? `hit y=${hit.hitPoint?.y ?? '?'} entity=${hit.hitEntity?.name ?? 'none'}` : 'NO HIT');
        }
        // Drop a probe entity and watch where physics lets it rest.
        this._syncBots();
        let n = 0;
        const timer = setInterval(() => {
          const who = world.entityManager
            .getAllPlayerEntities()
            .find(entity => entity instanceof GamePlayerEntity) as GamePlayerEntity | undefined;
          if (who?.isSpawned) {
            const p = who.position;
            console.info('[player-probe]', `y=${p.y.toFixed(3)} vel=${who.linearVelocity.y.toFixed(2)} grounded=${who.playerController.isGrounded}`);
          } else {
            console.info('[player-probe]', 'no player');
          }
          if (++n >= 8) clearInterval(timer);
        }, 2000);
      }, 8000);
    }
  }




  /**
   * Updates the leaderboard UI for all players
   */
  private _updateLeaderboardUI(username: string, killCount: number) {
    if (!this.world) return;

    GameServer.instance.playerManager.getConnectedPlayersByWorld(this.world).forEach(player => {
      player.ui.sendData({
        type: 'leaderboard-update',
        username,
        killCount,
        localPlayer: player.username,
      });
    });
  }

  private _updatePlayerCountUI() {
    setTimeout(() => { // have to wait 1 tick, we need to figure out this race condition later
      if (!this.world) return;

      GameServer.instance.playerManager.getConnectedPlayersByWorld(this.world).forEach(player => {
        player.ui.sendData({ type: 'players-count', count: this._playerCount });
      });
    }, 25);
  }

  /**
   * Waits for enough players to join before starting the game
   */
  private _waitForPlayersToStart() {
    if (!this.world) return;

    const connectedPlayers = this._getHumanPlayerCount();

    if (connectedPlayers >= 1) {
      this.startGame();
    } else {
      setTimeout(() => this._waitForPlayersToStart(), 1000);
    }
  }

  private _getHumanPlayerCount(): number {
    if (!this.world) return 0;

    return this.world.entityManager
      .getAllPlayerEntities()
      .filter(entity => !(entity instanceof BotPlayerEntity))
      .length;
  }
}
