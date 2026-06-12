/**
 * ZombiesSim: the authoritative game. Pure rules — no sockets, no renderer,
 * no wall clock, no Math.random. The Durable Object ticks it; the client
 * reuses its movement step for prediction; tests drive it directly.
 */
import { dist, lookDirection, entityAABB, rayAABB, vec3 } from './vec';
import type { Vec3 } from './vec';
import { Rng } from './rng';
import { VoxelMap, colliderFromCenter } from './map';
import type { MapData, StaticCollider } from './map';
import { stepPlayerMovement } from './movement';
import { stepEnemy } from './enemies';
import { damageEnemy, finishReloadIfDue, startReload, tryFire } from './weapons';
import type {
  BarrierState,
  CrateState,
  EnemyState,
  PlayerState,
  PlayerInput,
  SimEvent,
  SimState,
} from './types';
import {
  ALL_DOWNED_GRACE_MS,
  CRATE_ROLL_CLAIM_TIMEOUT_MS,
  GAME_OVER_RESET_MS,
  GAME_START_COUNTDOWN_S,
  INTERACT_RANGE,
  MAX_LIVE_ENEMIES,
  MAX_PLAYERS_PER_ROOM,
  PLAYER_BASE_HEALTH,
  PLAYER_EYE_HEIGHT,
  PLAYER_SPAWN,
  REVIVE_DISTANCE,
  REVIVE_HP_PER_TICK,
  REVIVE_REQUIRED_HEALTH,
  REVIVE_TICK_MS,
  RIPPER_WAVE_INTERVAL,
  TICK_MS,
  WAVE_DELAY_MS,
  WAVE_INTERVAL_MS,
  WEAPONS,
  ripperStatsForWave,
  spawnIntervalForWave,
  zombieStatsForWave,
} from './constants';
import {
  ENEMY_SPAWN_POINTS,
  INVISIBLE_WALLS,
  PURCHASE_BARRIERS,
  WEAPON_CRATES,
  barrierHalfExtents,
} from './mapConfig';

export interface SimOptions {
  seed?: number;
  /** Lobby countdown override (seconds); default is the reference's 45s. */
  countdownS?: number;
}

export class ZombiesSim {
  readonly state: SimState;
  readonly map: VoxelMap;

  private readonly rng: Rng;
  private readonly countdownMs: number;
  private readonly wallColliders: StaticCollider[];
  private readonly barrierColliders: StaticCollider[];
  private playerColliderCache: StaticCollider[] | null = null;
  private events: SimEvent[] = [];

  constructor(mapData: MapData, opts: SimOptions = {}) {
    this.map = new VoxelMap(mapData);
    this.rng = new Rng(opts.seed ?? 1);
    this.countdownMs = (opts.countdownS ?? GAME_START_COUNTDOWN_S) * 1000;

    this.wallColliders = INVISIBLE_WALLS.map(w => ({
      box: colliderFromCenter(w.position, w.halfExtents),
      blocksPlayers: true,
      blocksEnemies: false,
      blocksBullets: false,
    }));

    this.barrierColliders = PURCHASE_BARRIERS.map(b => ({
      box: colliderFromCenter(b.position, barrierHalfExtents(b)),
      blocksPlayers: true,
      blocksEnemies: false,
      blocksBullets: true, // reference barriers belong to the BLOCK group
    }));

    this.state = {
      tick: 0,
      timeMs: 0,
      phase: 'countdown',
      countdownEndsAtMs: this.countdownMs,
      wave: 0,
      unlockedIds: new Set(['start']),
      activePlayerIds: new Set(),
      nextWaveAtMs: 0,
      nextSpawnAtMs: 0,
      allDownedSinceMs: -1,
      gameOverResetAtMs: 0,
      nextEnemyId: 1,
      players: new Map(),
      enemies: new Map(),
      barriers: PURCHASE_BARRIERS.map(() => ({ alive: true })),
      crates: WEAPON_CRATES.map(() => ({
        rolledWeaponId: null,
        rolledForPlayerId: null,
        rollExpiresAtMs: 0,
      })),
    };
  }

  get countdownRemainingS(): number {
    return Math.max(0, Math.ceil((this.state.countdownEndsAtMs - this.state.timeMs) / 1000));
  }

  addPlayer(id: string, name: string): PlayerState | null {
    const s = this.state;
    if (s.players.has(id)) return s.players.get(id)!;
    if (s.players.size >= MAX_PLAYERS_PER_ROOM) return null;

    // Mid-round joiners spectate until the next round, unless they were part
    // of the running round (disconnect + reconnect).
    const spectator = s.phase !== 'countdown' && !s.activePlayerIds.has(id);

    const player: PlayerState = {
      id,
      name,
      pos: { ...PLAYER_SPAWN },
      vel: vec3(),
      yaw: 0,
      pitch: 0,
      grounded: false,
      health: PLAYER_BASE_HEALTH,
      maxHealth: PLAYER_BASE_HEALTH,
      money: 0,
      downed: false,
      spectator,
      weapon: 'pistol',
      ammo: WEAPONS.pistol.clipSize,
      reloading: false,
      reloadEndsAtMs: 0,
      lastFireAtMs: -100_000,
      reviverId: null,
      nextReviveTickAtMs: 0,
      lastInputSeq: 0,
      pendingInput: emptyInput(),
      fireHeld: false,
      firePressed: false,
    };

    s.players.set(id, player);
    if (!spectator && s.phase === 'running') {
      // rejoin mid-game keeps active membership
      s.activePlayerIds.add(id);
    }
    if (spectator) {
      this.events.push({
        type: 'message',
        text: 'This round has already started — you will join when the next round begins.',
        color: 'FF0000',
        toPlayerId: id,
      });
    }
    return player;
  }

  removePlayer(id: string): void {
    const s = this.state;
    const player = s.players.get(id);
    if (!player) return;
    // Anyone this player was reviving keeps their pending tick and fails the
    // reviver check naturally.
    s.players.delete(id);
  }

  /** Merge a client input message; edges accumulate until the next tick. */
  applyInput(id: string, input: PlayerInput): void {
    const player = this.state.players.get(id);
    if (!player) return;
    const p = player.pendingInput;
    p.seq = input.seq;
    p.moveX = clamp(input.moveX, -1, 1);
    p.moveZ = clamp(input.moveZ, -1, 1);
    p.yaw = wrapAngle(input.yaw);
    p.pitch = clamp(input.pitch, -1.55, 1.55);
    p.jump = input.jump;
    p.sprint = input.sprint;
    p.reload = p.reload || input.reload;
    p.interact = p.interact || input.interact;
    if (input.fire && !player.fireHeld) player.firePressed = true;
    player.fireHeld = input.fire;
  }

  /** Advance one fixed tick. Returns the events that happened during it. */
  tick(): SimEvent[] {
    const s = this.state;
    s.tick++;
    s.timeMs += TICK_MS;
    this.events = [];

    if (s.phase === 'countdown') {
      this.tickCountdown();
    } else if (s.phase === 'running') {
      this.tickWavesAndSpawns();
    } else if (s.phase === 'gameover' && s.timeMs >= s.gameOverResetAtMs) {
      this.resetToLobby();
    }

    this.tickPlayers();
    this.tickEnemies();
    this.tickCrateExpiry();

    if (s.phase === 'running') {
      this.checkAllDowned();
    }

    return this.events;
  }

  // ---- phases ----

  private tickCountdown(): void {
    const s = this.state;
    if (s.players.size === 0) {
      // An empty lobby resets the countdown so the next joiner gets the full
      // wait instead of an ambush start.
      s.countdownEndsAtMs = s.timeMs + this.countdownMs;
      return;
    }
    if (s.timeMs >= s.countdownEndsAtMs) {
      this.startGame();
    }
  }

  private startGame(): void {
    const s = this.state;
    s.phase = 'running';
    s.wave = 0;
    s.activePlayerIds = new Set([...s.players.keys()]);
    s.allDownedSinceMs = -1;
    // Wave timer fires this tick so the first zombies use wave-1 stats.
    s.nextWaveAtMs = s.timeMs;
    s.nextSpawnAtMs = s.timeMs;
    this.events.push({ type: 'gameStarted' });
    this.events.push({ type: 'message', text: 'Game starting!', color: 'FF0000' });
  }

  private tickWavesAndSpawns(): void {
    const s = this.state;

    if (s.timeMs >= s.nextWaveAtMs) {
      s.wave++;
      s.nextWaveAtMs = s.timeMs + WAVE_INTERVAL_MS;
      this.events.push({ type: 'waveStarted', wave: s.wave });

      // Real inter-wave lull: pause spawning, resume after the delay.
      if (s.wave > 1) {
        s.nextSpawnAtMs = Math.max(s.nextSpawnAtMs, s.timeMs + WAVE_DELAY_MS);
      }

      if (s.wave % RIPPER_WAVE_INTERVAL === 0) {
        const boss = this.spawnEnemy('ripper');
        this.events.push({ type: 'bossSpawned', enemyId: boss.id, name: 'BOSS: RIPPER' });
      }
    }

    if (s.timeMs >= s.nextSpawnAtMs) {
      if (s.enemies.size < MAX_LIVE_ENEMIES) {
        this.spawnEnemy('zombie');
      }
      s.nextSpawnAtMs = s.timeMs + spawnIntervalForWave(s.wave);
    }
  }

  private spawnEnemy(kind: 'zombie' | 'ripper'): EnemyState {
    const s = this.state;
    const stats = kind === 'ripper' ? ripperStatsForWave(s.wave) : zombieStatsForWave(s.wave);

    const spawnPoints: Vec3[] = [];
    for (const id of s.unlockedIds) {
      const points = ENEMY_SPAWN_POINTS[id];
      if (points) spawnPoints.push(...points);
    }
    const at = this.rng.pick(spawnPoints);

    const enemy: EnemyState = {
      id: s.nextEnemyId++,
      kind,
      pos: { ...at },
      vel: vec3(),
      yaw: 0,
      grounded: false,
      health: stats.health,
      maxHealth: stats.health,
      speed: stats.speed,
      damage: stats.damage,
      reward: stats.reward,
      jumpHeight: stats.jumpHeight,
      halfWidth: stats.halfWidth,
      height: stats.height,
      targetPlayerId: null,
      retargetAtMs: 0,
      nextContactHitAtMs: {},
    };
    s.enemies.set(enemy.id, enemy);
    return enemy;
  }

  private checkAllDowned(): void {
    const s = this.state;
    let anyBody = false;
    let anyStanding = false;
    for (const p of s.players.values()) {
      if (p.spectator) continue;
      anyBody = true;
      if (!p.downed) anyStanding = true;
    }

    // Nobody left in the round counts as a wipe (matches reference behavior
    // when the last player disconnects mid-game).
    const wiped = !anyStanding || !anyBody;
    if (!wiped) {
      s.allDownedSinceMs = -1;
      return;
    }
    if (s.allDownedSinceMs < 0) {
      s.allDownedSinceMs = s.timeMs;
      return;
    }
    if (s.timeMs - s.allDownedSinceMs >= ALL_DOWNED_GRACE_MS) {
      this.gameOver();
    }
  }

  private gameOver(): void {
    const s = this.state;
    s.phase = 'gameover';
    s.gameOverResetAtMs = s.timeMs + GAME_OVER_RESET_MS;
    s.enemies.clear();
    this.events.push({ type: 'gameOver', wave: s.wave });
    this.events.push({
      type: 'message',
      text: `Game Over! Your team made it to wave ${s.wave}!`,
      color: '00FF00',
    });
  }

  private resetToLobby(): void {
    const s = this.state;
    s.phase = 'countdown';
    s.countdownEndsAtMs = s.timeMs + this.countdownMs;
    s.wave = 0;
    s.unlockedIds = new Set(['start']);
    s.activePlayerIds.clear();
    s.allDownedSinceMs = -1;
    s.enemies.clear();
    s.barriers.forEach(b => (b.alive = true));
    s.crates.forEach(c => {
      c.rolledWeaponId = null;
      c.rolledForPlayerId = null;
      c.rollExpiresAtMs = 0;
    });
    this.playerColliderCache = null;
    for (const p of s.players.values()) {
      this.respawnPlayer(p);
    }
  }

  private respawnPlayer(p: PlayerState): void {
    p.pos = { ...PLAYER_SPAWN };
    p.vel = vec3();
    p.grounded = false;
    p.health = PLAYER_BASE_HEALTH;
    p.maxHealth = PLAYER_BASE_HEALTH;
    p.money = 0;
    p.downed = false;
    p.spectator = false;
    p.weapon = 'pistol';
    p.ammo = WEAPONS.pistol.clipSize;
    p.reloading = false;
    p.reviverId = null;
    p.nextReviveTickAtMs = 0;
  }

  // ---- players ----

  private playerColliders(): StaticCollider[] {
    if (!this.playerColliderCache) {
      this.playerColliderCache = [
        ...this.wallColliders,
        ...this.barrierColliders.filter((_, i) => this.state.barriers[i]!.alive),
      ];
    }
    return this.playerColliderCache;
  }

  private bulletBlockers(): StaticCollider[] {
    return this.barrierColliders.filter((_, i) => this.state.barriers[i]!.alive);
  }

  private tickPlayers(): void {
    const s = this.state;
    const colliders = this.playerColliders();
    const regenTick = s.timeMs % 1000 === 0;

    for (const player of s.players.values()) {
      const input = player.pendingInput;
      player.lastInputSeq = input.seq;
      player.yaw = input.yaw;
      player.pitch = input.pitch;

      if (!player.spectator) {
        stepPlayerMovement(this.map, player, input, player.downed, colliders);

        // Falling out of the world is a bug, not a death sentence.
        if (player.pos.y < this.map.minY - 30) {
          player.pos = { ...PLAYER_SPAWN };
          player.vel = vec3();
        }

        finishReloadIfDue(player, s.timeMs);

        const spec = WEAPONS[player.weapon];
        const wantsFire = spec.auto ? player.fireHeld : player.firePressed;
        if (wantsFire && !player.downed && !player.reloading && s.phase !== 'gameover') {
          tryFire(player, {
            map: this.map,
            bulletBlockers: this.bulletBlockers(),
            enemies: [...s.enemies.values()],
            timeMs: s.timeMs,
            events: this.events,
            onEnemyKilled: e => s.enemies.delete(e.id),
          });
        }

        if (input.reload && !player.downed) {
          startReload(player, s.timeMs, this.events);
        }

        if (input.interact) {
          this.handleInteract(player);
        }

        if (regenTick && !player.downed && player.health < player.maxHealth) {
          player.health += 1;
        }

        this.tickRevive(player);
      }

      // consume edges
      input.reload = false;
      input.interact = false;
      player.firePressed = false;
    }
  }

  private tickRevive(player: PlayerState): void {
    const s = this.state;
    if (!player.downed || !player.reviverId || s.timeMs < player.nextReviveTickAtMs) return;

    const reviver = s.players.get(player.reviverId);
    const valid =
      reviver && !reviver.downed && !reviver.spectator &&
      dist(reviver.pos, player.pos) <= REVIVE_DISTANCE;

    if (!valid) {
      player.reviverId = null;
      return;
    }

    player.health += REVIVE_HP_PER_TICK;
    this.events.push({
      type: 'reviveProgress',
      playerId: player.id,
      progress: Math.min(100, (player.health / REVIVE_REQUIRED_HEALTH) * 100),
    });

    if (player.health >= REVIVE_REQUIRED_HEALTH) {
      player.downed = false;
      player.reviverId = null;
      this.events.push({ type: 'playerRevived', playerId: player.id });
      this.events.push({
        type: 'message',
        text: 'You are back up! Thank your team & fight the horde!',
        color: '00FF00',
        toPlayerId: player.id,
      });
    } else {
      player.nextReviveTickAtMs = s.timeMs + REVIVE_TICK_MS;
    }
  }

  private handleInteract(player: PlayerState): void {
    const s = this.state;

    if (player.downed) {
      this.events.push({
        type: 'message',
        text: 'You are downed! You cannot revive others or make purchases!',
        color: 'FF0000',
        toPlayerId: player.id,
      });
      return;
    }

    const origin = {
      x: player.pos.x,
      y: player.pos.y + PLAYER_EYE_HEIGHT,
      z: player.pos.z,
    };
    const dir = lookDirection(player.yaw, player.pitch);

    // Nearest interactable along the view ray, occluded by map blocks.
    const blockHit = this.map.raycast(origin, dir, INTERACT_RANGE);
    let bestDist = blockHit ? blockHit.dist : INTERACT_RANGE;
    // Boxed so TS doesn't narrow the closure-assigned callback to null.
    const chosen: { action: (() => void) | null } = { action: null };

    this.state.barriers.forEach((barrier, i) => {
      if (!barrier.alive) return;
      const d = rayAABB(origin, dir, this.barrierColliders[i]!.box, bestDist);
      if (d !== null && d < bestDist) {
        bestDist = d;
        chosen.action = () => this.interactBarrier(player, i);
      }
    });

    WEAPON_CRATES.forEach((crate, i) => {
      const box = colliderFromCenter(crate.position, { x: 0.7, y: 1.5, z: 0.7 });
      const d = rayAABB(origin, dir, box, bestDist);
      if (d !== null && d < bestDist) {
        bestDist = d;
        chosen.action = () => this.interactCrate(player, i);
      }
    });

    for (const other of s.players.values()) {
      if (other === player || !other.downed || other.spectator) continue;
      const d = rayAABB(origin, dir, entityAABB(other.pos, 0.6, 1.2), bestDist);
      if (d !== null && d < bestDist) {
        bestDist = d;
        chosen.action = () => this.startReviving(player, other);
      }
    }

    chosen.action?.();
  }

  private spendMoney(player: PlayerState, amount: number): boolean {
    if (player.money < amount) return false;
    player.money -= amount;
    this.events.push({ type: 'purchase', playerId: player.id });
    return true;
  }

  private interactBarrier(player: PlayerState, index: number): void {
    const s = this.state;
    const config = PURCHASE_BARRIERS[index]!;
    const barrier = s.barriers[index]!;
    if (!barrier.alive) return;

    if (!this.spendMoney(player, config.removalPrice)) {
      this.events.push({
        type: 'message',
        text: `You don't have enough money to unlock this barrier!`,
        color: 'FF0000',
        toPlayerId: player.id,
      });
      return;
    }

    barrier.alive = false;
    this.playerColliderCache = null;
    config.unlockIds.forEach(id => s.unlockedIds.add(id));
    this.events.push({
      type: 'barrierRemoved',
      barrierId: index,
      name: config.name,
      byPlayerId: player.id,
    });
    this.events.push({
      type: 'message',
      text: `The ${config.name} barrier has been unlocked!`,
      color: '00FF00',
    });
  }

  private interactCrate(player: PlayerState, index: number): void {
    const s = this.state;
    const config = WEAPON_CRATES[index]!;
    const crate = s.crates[index]!;

    if (crate.rolledWeaponId) {
      if (crate.rolledForPlayerId !== player.id) {
        this.events.push({
          type: 'message',
          text: 'This weapon was purchased by another player!',
          color: 'FF0000',
          toPlayerId: player.id,
        });
        return;
      }
      player.weapon = crate.rolledWeaponId;
      player.ammo = WEAPONS[crate.rolledWeaponId].clipSize;
      player.reloading = false;
      this.events.push({ type: 'weaponEquipped', playerId: player.id, weapon: player.weapon });
      crate.rolledWeaponId = null;
      crate.rolledForPlayerId = null;
      crate.rollExpiresAtMs = 0;
      return;
    }

    if (!this.spendMoney(player, config.price)) {
      this.events.push({
        type: 'message',
        text: `You don't have enough money to purchase this weapon crate!`,
        color: 'FF0000',
        toPlayerId: player.id,
      });
      return;
    }

    crate.rolledWeaponId = this.rng.pick(config.rollableWeaponIds);
    crate.rolledForPlayerId = player.id;
    crate.rollExpiresAtMs = s.timeMs + CRATE_ROLL_CLAIM_TIMEOUT_MS;
    this.events.push({
      type: 'crateRolled',
      crateId: index,
      weapon: crate.rolledWeaponId,
      playerId: player.id,
    });
  }

  private startReviving(reviver: PlayerState, downed: PlayerState): void {
    // A pending revive tick is never reset by re-pressing interact.
    if (downed.reviverId && this.state.timeMs < downed.nextReviveTickAtMs) {
      return;
    }
    downed.reviverId = reviver.id;
    downed.nextReviveTickAtMs = this.state.timeMs + REVIVE_TICK_MS;
  }

  // ---- enemies ----

  private tickEnemies(): void {
    const s = this.state;
    const all = [...s.enemies.values()];
    for (const enemy of all) {
      if (!s.enemies.has(enemy.id)) continue;
      stepEnemy(enemy, {
        map: this.map,
        players: s.players,
        enemies: all,
        timeMs: s.timeMs,
        events: this.events,
        onPlayerDamaged: (p, damage) => this.damagePlayer(p, damage),
      });

      if (enemy.pos.y < this.map.minY - 50) {
        s.enemies.delete(enemy.id); // fell out of the world
      }
    }
  }

  damagePlayer(player: PlayerState, damage: number): void {
    if (player.downed || player.spectator) return;

    const healthAfter = player.health - damage;
    this.events.push({ type: 'playerHurt', playerId: player.id });

    if (player.health > 0 && healthAfter <= 0) {
      player.health = 0;
      player.downed = true;
      player.reviverId = null;
      this.events.push({ type: 'playerDowned', playerId: player.id });
      this.events.push({
        type: 'message',
        text: 'You are downed! A teammate can still revive you!',
        color: 'FF0000',
        toPlayerId: player.id,
      });
      return;
    }

    player.health = Math.max(healthAfter, 0);
  }

  /** Direct enemy damage entry point (used by tests/tools). */
  hurtEnemy(enemyId: number, damage: number, byPlayerId?: string): void {
    const enemy = this.state.enemies.get(enemyId);
    if (!enemy) return;
    const player = byPlayerId ? this.state.players.get(byPlayerId) ?? null : null;
    damageEnemy(enemy, damage, player, {
      events: this.events,
      onEnemyKilled: e => this.state.enemies.delete(e.id),
    });
  }

  private tickCrateExpiry(): void {
    const s = this.state;
    for (const crate of s.crates) {
      if (crate.rolledWeaponId && s.timeMs >= crate.rollExpiresAtMs) {
        crate.rolledWeaponId = null;
        crate.rolledForPlayerId = null;
        crate.rollExpiresAtMs = 0;
      }
    }
  }
}

function emptyInput(): PlayerInput {
  return {
    seq: 0,
    moveX: 0,
    moveZ: 0,
    yaw: 0,
    pitch: 0,
    jump: false,
    sprint: false,
    fire: false,
    reload: false,
    interact: false,
  };
}

function clamp(v: number, lo: number, hi: number): number {
  return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : 0;
}

function wrapAngle(v: number): number {
  if (!Number.isFinite(v)) return 0;
  const twoPi = Math.PI * 2;
  return ((v % twoPi) + twoPi) % twoPi;
}
