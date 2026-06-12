import { describe, expect, it } from 'vitest';
import { ZombiesSim } from './sim';
import type { MapData } from './map';
import type { EnemyState, PlayerInput, SimEvent } from './types';
import {
  FASTEST_SPAWN_INTERVAL_MS,
  PLAYER_SPAWN,
  SLOWEST_SPAWN_INTERVAL_MS,
  TICK_MS,
  WEAPONS,
  spawnIntervalForWave,
  zombieStatsForWave,
  ripperStatsForWave,
} from './constants';
import { ENEMY_SPAWN_POINTS, PURCHASE_BARRIERS } from './mapConfig';

/** Flat 120x120 floor at y=0 so entities everywhere land at y=1. */
function flatMap(): MapData {
  const blocks: Record<string, number> = {};
  for (let x = -60; x < 60; x++) {
    for (let z = -60; z < 60; z++) {
      blocks[`${x},0,${z}`] = 1;
    }
  }
  return { blockTypes: [{ id: 1, name: 'stone', textureUri: 'blocks/stone.png', isCustom: false }], blocks };
}

const MAP = flatMap();

function makeSim(countdownS = 1): ZombiesSim {
  return new ZombiesSim(MAP, { seed: 42, countdownS });
}

function input(overrides: Partial<PlayerInput> = {}): PlayerInput {
  return {
    seq: 1, moveX: 0, moveZ: 0, yaw: 0, pitch: 0,
    jump: false, sprint: false, fire: false, reload: false, interact: false,
    ...overrides,
  };
}

function tickFor(sim: ZombiesSim, ms: number): SimEvent[] {
  const events: SimEvent[] = [];
  for (let t = 0; t < ms; t += TICK_MS) {
    events.push(...sim.tick());
  }
  return events;
}

function startRunning(sim: ZombiesSim, playerId = 'p1'): void {
  sim.addPlayer(playerId, 'Tester');
  tickFor(sim, 1500);
  expect(sim.state.phase).toBe('running');
}

function addEnemy(sim: ZombiesSim, pos: { x: number; y: number; z: number }, health = 100): EnemyState {
  const enemy: EnemyState = {
    id: sim.state.nextEnemyId++,
    kind: 'zombie',
    pos: { ...pos },
    vel: { x: 0, y: 0, z: 0 },
    yaw: 0,
    grounded: true,
    health,
    maxHealth: health,
    speed: 0,
    damage: 2,
    reward: 20,
    jumpHeight: 2,
    halfWidth: 0.35,
    height: 1.7,
    targetPlayerId: null,
    retargetAtMs: Infinity,
    nextContactHitAtMs: {},
  };
  sim.state.enemies.set(enemy.id, enemy);
  return enemy;
}

describe('round lifecycle', () => {
  it('counts down, starts the game, and fires wave 1 immediately', () => {
    const sim = makeSim(1);
    sim.addPlayer('p1', 'Tester');
    const events = tickFor(sim, 1500);

    expect(sim.state.phase).toBe('running');
    expect(sim.state.wave).toBe(1);
    expect(events.some(e => e.type === 'gameStarted')).toBe(true);
    expect(events.some(e => e.type === 'waveStarted' && e.wave === 1)).toBe(true);
  });

  it('resets the countdown while the lobby is empty', () => {
    const sim = makeSim(1);
    tickFor(sim, 5000); // nobody here; countdown must not elapse
    expect(sim.state.phase).toBe('countdown');
    sim.addPlayer('p1', 'Tester');
    tickFor(sim, 1500);
    expect(sim.state.phase).toBe('running');
  });

  it('spawns a ripper boss every 5 waves with scaled stats', () => {
    const sim = makeSim(1);
    startRunning(sim);
    // The AFK test player must survive 4 waves of contact damage.
    const player = sim.state.players.get('p1')!;
    player.health = player.maxHealth = 1_000_000;
    // Advance to wave 5: 4 more waves at 30s each.
    const events = tickFor(sim, 4 * 30_000 + 1000);
    expect(sim.state.wave).toBeGreaterThanOrEqual(5);
    expect(events.some(e => e.type === 'bossSpawned')).toBe(true);

    const ripper = [...sim.state.enemies.values()].find(e => e.kind === 'ripper');
    // Boss stats follow the wave-5 formula.
    expect(ripperStatsForWave(5).health).toBe(250);
    expect(ripperStatsForWave(5).reward).toBe(250);
    if (ripper && sim.state.wave === 5) {
      expect(ripper.maxHealth).toBe(250);
    }
  });

  it('ends the game when all players are downed, then resets to lobby', () => {
    const sim = makeSim(1);
    startRunning(sim);

    const player = sim.state.players.get('p1')!;
    sim.damagePlayer(player, 1000);
    expect(player.downed).toBe(true);

    const events = tickFor(sim, 2000);
    expect(events.some(e => e.type === 'gameOver')).toBe(true);
    expect(sim.state.phase).toBe('gameover');
    expect(sim.state.enemies.size).toBe(0);

    // Tick to the reset boundary and assert before the next countdown elapses.
    for (let i = 0; i < 200 && sim.state.phase === 'gameover'; i++) sim.tick();
    expect(sim.state.phase).toBe('countdown');
    const respawned = sim.state.players.get('p1')!;
    expect(respawned.downed).toBe(false);
    expect(respawned.health).toBe(100);
    expect(respawned.money).toBe(0);
    expect(respawned.weapon).toBe('pistol');
    expect(sim.state.barriers.every(b => b.alive)).toBe(true);
  });

  it('makes mid-round joiners spectators until the next round', () => {
    const sim = makeSim(1);
    startRunning(sim);
    const late = sim.addPlayer('p2', 'Late')!;
    expect(late.spectator).toBe(true);

    const p1 = sim.state.players.get('p1')!;
    sim.damagePlayer(p1, 1000);
    tickFor(sim, 2000); // grace period -> game over
    expect(sim.state.phase).toBe('gameover');
    for (let i = 0; i < 200 && sim.state.phase === 'gameover'; i++) sim.tick();
    expect(sim.state.phase).toBe('countdown');
    expect(sim.state.players.get('p2')!.spectator).toBe(false);
  });
});

describe('wave pacing', () => {
  it('scales spawn interval down per wave and clamps at the floor', () => {
    expect(spawnIntervalForWave(0)).toBe(SLOWEST_SPAWN_INTERVAL_MS);
    expect(spawnIntervalForWave(1)).toBe(3700);
    expect(spawnIntervalForWave(10)).toBe(1000);
    expect(spawnIntervalForWave(11)).toBe(FASTEST_SPAWN_INTERVAL_MS);
    expect(spawnIntervalForWave(50)).toBe(FASTEST_SPAWN_INTERVAL_MS);
  });

  it('scales zombie stats by wave', () => {
    expect(zombieStatsForWave(1)).toMatchObject({ health: 7.25, speed: 2.25 });
    expect(zombieStatsForWave(16).speed).toBe(6); // speed cap
  });

  it('spawns zombies only at unlocked spawn points', () => {
    const sim = makeSim(1);
    startRunning(sim);
    tickFor(sim, 10_000);

    const startPoints = ENEMY_SPAWN_POINTS.start!;
    for (const enemy of sim.state.enemies.values()) {
      // Spawned at one of the 'start' points (possibly moved since; check x/z
      // proximity over the short run instead of exact equality).
      const near = startPoints.some(p => Math.hypot(p.x - enemy.pos.x, p.z - enemy.pos.z) < 30);
      expect(near).toBe(true);
    }
  });
});

describe('economy', () => {
  it('pays damage share plus kill bonus, rounded to whole dollars', () => {
    const sim = makeSim(1);
    startRunning(sim);
    const player = sim.state.players.get('p1')!;
    player.money = 0;

    const enemy = addEnemy(sim, { x: 10, y: 1, z: 10 }, 100); // reward 20
    sim.hurtEnemy(enemy.id, 50, 'p1'); // half the health -> half the reward
    expect(player.money).toBe(10);

    sim.hurtEnemy(enemy.id, 50, 'p1'); // rest + 50% kill bonus
    expect(player.money).toBe(10 + 10 + 10);
    expect(sim.state.enemies.has(enemy.id)).toBe(false);
  });

  it('never overpays when damage exceeds remaining health', () => {
    const sim = makeSim(1);
    startRunning(sim);
    const player = sim.state.players.get('p1')!;
    player.money = 0;

    const enemy = addEnemy(sim, { x: 10, y: 1, z: 10 }, 100);
    sim.hurtEnemy(enemy.id, 10_000, 'p1');
    expect(player.money).toBe(20 + 10); // full reward + kill bonus
  });

  it('unlocks barriers for money and opens their spawn areas', () => {
    const sim = makeSim(1);
    sim.addPlayer('p1', 'Tester');
    const player = sim.state.players.get('p1')!;
    tickFor(sim, 200);

    // Stand in front of the Parlor (South) barrier and look at it.
    const parlorIndex = PURCHASE_BARRIERS.findIndex(b => b.name === 'Parlor (South)');
    const barrier = PURCHASE_BARRIERS[parlorIndex]!;
    player.pos = { x: barrier.position.x + 2, y: 1, z: barrier.position.z };
    player.money = 100;
    // Face -x toward the barrier: yaw where lookDirection x = -1 -> yaw = PI/2.
    sim.applyInput('p1', input({ yaw: Math.PI / 2, interact: true }));
    const events = sim.tick();

    expect(events.some(e => e.type === 'barrierRemoved')).toBe(true);
    expect(player.money).toBe(25);
    expect(sim.state.barriers[parlorIndex]!.alive).toBe(false);
    expect(sim.state.unlockedIds.has('parlor')).toBe(true);
  });

  it('rejects barrier purchase without enough money', () => {
    const sim = makeSim(1);
    sim.addPlayer('p1', 'Tester');
    const player = sim.state.players.get('p1')!;
    tickFor(sim, 200);

    const parlorIndex = PURCHASE_BARRIERS.findIndex(b => b.name === 'Parlor (South)');
    const barrier = PURCHASE_BARRIERS[parlorIndex]!;
    player.pos = { x: barrier.position.x + 2, y: 1, z: barrier.position.z };
    player.money = 10;
    sim.applyInput('p1', input({ yaw: Math.PI / 2, interact: true }));
    const events = sim.tick();

    expect(events.some(e => e.type === 'message' && e.color === 'FF0000')).toBe(true);
    expect(player.money).toBe(10);
    expect(sim.state.barriers[parlorIndex]!.alive).toBe(true);
  });
});

describe('weapons', () => {
  it('fires at the weapon fire rate and consumes ammo', () => {
    const sim = makeSim(1);
    startRunning(sim);
    const player = sim.state.players.get('p1')!;
    player.pos = { x: 0, y: 1, z: 0 };

    addEnemy(sim, { x: 0, y: 1, z: -5 }, 1000);

    // Hold fire for 1 second; the pistol is semi-auto so only the initial
    // press fires.
    for (let i = 0; i < 20; i++) {
      sim.applyInput('p1', input({ seq: i, fire: true }));
      sim.tick();
    }
    expect(player.ammo).toBe(WEAPONS.pistol.clipSize - 1);
  });

  it('fires continuously with an automatic weapon and damages the target', () => {
    const sim = makeSim(1);
    startRunning(sim);
    const player = sim.state.players.get('p1')!;
    player.pos = { x: 0, y: 1, z: 0 };
    player.weapon = 'ak47';
    player.ammo = WEAPONS.ak47.clipSize;

    const enemy = addEnemy(sim, { x: 0, y: 1, z: -5 }, 1000);

    for (let i = 0; i < 20; i++) {
      sim.applyInput('p1', input({ seq: i, fire: true }));
      sim.tick();
    }

    // 1 second at 10 shots/s -> ~10 shots, 3 damage each.
    const shots = WEAPONS.ak47.clipSize - player.ammo;
    expect(shots).toBeGreaterThanOrEqual(9);
    expect(shots).toBeLessThanOrEqual(11);
    expect(enemy.health).toBe(1000 - shots * WEAPONS.ak47.damage);
  });

  it('reloads to a full clip after the reload time', () => {
    const sim = makeSim(1);
    startRunning(sim);
    const player = sim.state.players.get('p1')!;
    player.ammo = 3;

    sim.applyInput('p1', input({ reload: true }));
    let events = sim.tick();
    expect(events.some(e => e.type === 'reloadStarted')).toBe(true);
    expect(player.ammo).toBe(0); // clip dumps during reload
    expect(player.reloading).toBe(true);

    tickFor(sim, WEAPONS.pistol.reloadMs + TICK_MS);
    expect(player.reloading).toBe(false);
    expect(player.ammo).toBe(WEAPONS.pistol.clipSize);
  });

  it('bullets stop at purchase barriers', () => {
    const sim = makeSim(1);
    startRunning(sim);
    const player = sim.state.players.get('p1')!;

    // Vault barrier spans x at {0.5, 1.5, -26}; stand south of it, enemy north.
    player.pos = { x: 0.5, y: 1, z: -20 };
    const enemy = addEnemy(sim, { x: 0.5, y: 1, z: -30 }, 100);

    sim.applyInput('p1', input({ yaw: 0, fire: true })); // facing -z
    sim.tick();

    expect(enemy.health).toBe(100);
  });
});

describe('downed and revive', () => {
  it('downs a player at 0 health instead of killing them', () => {
    const sim = makeSim(1);
    startRunning(sim);
    const player = sim.state.players.get('p1')!;

    sim.damagePlayer(player, 100);
    expect(player.downed).toBe(true);
    expect(player.health).toBe(0);
  });

  it('revives a downed player at +10 hp per second up to 50', () => {
    const sim = makeSim(5); // long countdown so the round doesn't end
    sim.addPlayer('p1', 'Down');
    sim.addPlayer('p2', 'Medic');
    tickFor(sim, 200);

    const down = sim.state.players.get('p1')!;
    const medic = sim.state.players.get('p2')!;
    down.pos = { x: 0, y: 1, z: 0 };
    medic.pos = { x: 1, y: 1, z: 0 };
    down.downed = true;
    down.health = 0;

    // Medic looks down at the body (facing -x, pitched down) and interacts.
    sim.applyInput('p2', input({ yaw: Math.PI / 2, pitch: -0.5, interact: true }));
    sim.tick();
    expect(down.reviverId).toBe('p2');

    const events = tickFor(sim, 5200);
    expect(down.downed).toBe(false);
    expect(down.health).toBeGreaterThanOrEqual(50);
    expect(events.some(e => e.type === 'playerRevived' && e.playerId === 'p1')).toBe(true);
  });

  it('cancels the revive when the medic walks away', () => {
    const sim = makeSim(5);
    sim.addPlayer('p1', 'Down');
    sim.addPlayer('p2', 'Medic');
    tickFor(sim, 200);

    const down = sim.state.players.get('p1')!;
    const medic = sim.state.players.get('p2')!;
    down.pos = { x: 0, y: 1, z: 0 };
    medic.pos = { x: 1, y: 1, z: 0 };
    down.downed = true;
    down.health = 0;

    sim.applyInput('p2', input({ yaw: Math.PI / 2, pitch: -0.5, interact: true }));
    sim.tick();
    expect(down.reviverId).toBe('p2');
    medic.pos = { x: 20, y: 1, z: 0 }; // walks away before the tick lands

    tickFor(sim, 3000);
    expect(down.downed).toBe(true);
    expect(down.health).toBe(0);
  });

  it('regenerates 1 hp per second while standing', () => {
    const sim = makeSim(10);
    sim.addPlayer('p1', 'Tester');
    tickFor(sim, 200);
    const player = sim.state.players.get('p1')!;
    player.health = 90;

    tickFor(sim, 3000);
    expect(player.health).toBeGreaterThanOrEqual(92);
    expect(player.health).toBeLessThanOrEqual(94);
  });
});

describe('movement and collision', () => {
  it('players fall to the floor and stay grounded', () => {
    const sim = makeSim(10);
    sim.addPlayer('p1', 'Tester');
    tickFor(sim, 3000);
    const player = sim.state.players.get('p1')!;
    expect(player.pos.y).toBeCloseTo(1, 1);
    expect(player.grounded).toBe(true);
  });

  it('moves forward at walk speed', () => {
    const sim = makeSim(60);
    sim.addPlayer('p1', 'Tester');
    tickFor(sim, 2000); // settle on the ground
    const player = sim.state.players.get('p1')!;
    const startX = player.pos.x;

    for (let i = 0; i < 20; i++) {
      // Walk east (+x) — the spawn room is fenced to the north and south.
      sim.applyInput('p1', input({ moveZ: 1, yaw: -Math.PI / 2 }));
      sim.tick();
    }
    expect(player.pos.x - startX).toBeGreaterThan(3.5);
    expect(player.pos.x - startX).toBeLessThan(5.5);
  });

  it('invisible walls block players but not enemies', () => {
    const sim = makeSim(60);
    sim.addPlayer('p1', 'Tester');
    tickFor(sim, 2000);
    const player = sim.state.players.get('p1')!;

    // Main entrance south door wall at z=25, x in [1.5, 3.5].
    player.pos = { x: 2.5, y: 1, z: 22 };
    for (let i = 0; i < 40; i++) {
      sim.applyInput('p1', input({ moveZ: -1, yaw: Math.PI })); // walk toward +z
      sim.tick();
    }
    expect(player.pos.z).toBeLessThan(25);

    // An enemy walks through the same plane.
    const enemy = addEnemy(sim, { x: 2.5, y: 1, z: 27 }, 100);
    enemy.speed = 4;
    enemy.targetPlayerId = 'p1';
    enemy.retargetAtMs = Infinity;
    tickFor(sim, 2000);
    expect(enemy.pos.z).toBeLessThan(25.5);
  });
});

describe('weapon crates', () => {
  it('rolls a weapon for the buyer and equips on second interact', () => {
    const sim = makeSim(60);
    sim.addPlayer('p1', 'Tester');
    tickFor(sim, 200);
    const player = sim.state.players.get('p1')!;
    player.money = 1000;

    // First crate is at {-3, 1.5, 16.5}; stand south of it looking north (-z...
    // crate is at z=16.5, stand at z=19 facing -z -> yaw 0).
    player.pos = { x: -3, y: 1, z: 19 };
    sim.applyInput('p1', input({ interact: true }));
    let events = sim.tick();

    const rolled = events.find(e => e.type === 'crateRolled');
    expect(rolled).toBeTruthy();
    expect(player.money).toBe(900);
    expect(sim.state.crates[0]!.rolledForPlayerId).toBe('p1');

    sim.applyInput('p1', input({ seq: 2, interact: true }));
    events = sim.tick();
    const equipped = events.find(e => e.type === 'weaponEquipped');
    expect(equipped).toBeTruthy();
    expect(['pistol', 'shotgun', 'ar15']).toContain(player.weapon);
    expect(player.ammo).toBe(WEAPONS[player.weapon].clipSize);
  });

  it('blocks another player from claiming the roll and expires it', () => {
    const sim = makeSim(60);
    sim.addPlayer('p1', 'Buyer');
    sim.addPlayer('p2', 'Thief');
    tickFor(sim, 200);
    const buyer = sim.state.players.get('p1')!;
    const thief = sim.state.players.get('p2')!;
    buyer.money = 1000;
    buyer.pos = { x: -3, y: 1, z: 19 };
    thief.pos = { x: -3, y: 1, z: 19 };

    sim.applyInput('p1', input({ interact: true }));
    sim.tick();
    expect(sim.state.crates[0]!.rolledWeaponId).toBeTruthy();

    sim.applyInput('p2', input({ interact: true }));
    sim.tick();
    expect(thief.weapon).toBe('pistol'); // unchanged, roll belongs to buyer

    tickFor(sim, 31_000);
    expect(sim.state.crates[0]!.rolledWeaponId).toBeNull(); // expired
  });
});
