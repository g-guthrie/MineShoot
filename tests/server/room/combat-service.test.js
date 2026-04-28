import test from 'node:test';
import assert from 'node:assert/strict';

import {
  applyDamageFromSource,
  broadcastDamageEvent,
  explodeProjectile
} from '../../../cloudflare/server/room/CombatService.js';

test('explodeProjectile tags missile explosions with projectileType for remote FX', () => {
  const broadcasts = [];
  const room = {
    broadcast(payload) {
      broadcasts.push(payload);
    },
    getEntityById() {
      return null;
    },
    getAliveEntities() {
      return [];
    },
    canTargetEntity() {
      return false;
    }
  };

  explodeProjectile(room, {
    id: 'proj_missile',
    type: 'missile',
    ownerId: 'usr_test'
  }, 1, 2, 3);

  assert.deepEqual(broadcasts, [{
    t: 'throw_explode',
    projectileId: 'proj_missile',
    projectileType: 'missile',
    x: 1,
    y: 2,
    z: 3,
    radius: 2
  }]);
});

test('explodeProjectile tags molotov impact payloads with projectileType', () => {
  const broadcasts = [];
  const room = {
    nextFireZoneSeq: 1,
    fireZones: new Map(),
    broadcast(payload) {
      broadcasts.push(payload);
    }
  };

  explodeProjectile(room, {
    id: 'proj_molotov',
    type: 'molotov',
    ownerId: 'usr_test'
  }, 4, 0, 5);

  assert.equal(room.fireZones.size, 1);
  assert.deepEqual(broadcasts, [{
    t: 'throw_impact',
    projectileId: 'proj_molotov',
    impactType: 'molotov',
    projectileType: 'molotov',
    x: 4,
    y: 0,
    z: 5
  }]);
});

test('broadcastDamageEvent carries the shot token for predicted-hit reconciliation', () => {
  const broadcasts = [];
  const engagements = [];
  const burstMarks = [];
  const room = {
    broadcast(payload) {
      broadcasts.push(payload);
    },
    markEntityEngaged(sourceId, targetId) {
      engagements.push({ sourceId, targetId });
    },
    markSnapshotBurst(viewerIds, entityIds) {
      burstMarks.push({
        viewerIds: viewerIds.slice(),
        entityIds: entityIds.slice()
      });
    },
    recordElimination() {}
  };

  broadcastDamageEvent(room, 'usr_attacker', { id: 'usr_target' }, {
    hp: 320,
    armor: 40,
    damageApplied: 28,
    killed: false
  }, 'body', 'rifle', 'shot_123');

  assert.deepEqual(broadcasts, [{
    t: 'damage_event',
    targetId: 'usr_target',
    sourceId: 'usr_attacker',
    health: 320,
    armor: 40,
    hitType: 'body',
    weaponId: 'rifle',
    shotToken: 'shot_123',
    damage: 28,
    killed: false
  }]);
  assert.deepEqual(engagements, [{ sourceId: 'usr_attacker', targetId: 'usr_target' }]);
  assert.deepEqual(burstMarks, [{
    viewerIds: ['usr_attacker', 'usr_target'],
    entityIds: ['usr_attacker', 'usr_target']
  }]);
});

test('broadcastDamageEvent carries pelletIndex when present', () => {
  const broadcasts = [];
  const room = {
    broadcast(payload) {
      broadcasts.push(payload);
    },
    markEntityEngaged() {},
    markSnapshotBurst() {},
    recordElimination() {}
  };

  broadcastDamageEvent(room, 'usr_attacker', { id: 'usr_target' }, {
    hp: 300,
    armor: 40,
    damageApplied: 14,
    killed: false
  }, 'body', 'shotgun', 'shot_456', 3);

  assert.deepEqual(broadcasts, [{
    t: 'damage_event',
    targetId: 'usr_target',
    sourceId: 'usr_attacker',
    health: 300,
    armor: 40,
    hitType: 'body',
    weaponId: 'shotgun',
    shotToken: 'shot_456',
    pelletIndex: 3,
    damage: 14,
    killed: false
  }]);
});

test('normal hits still spill excess damage into health after armor breaks', () => {
  const target = {
    id: 'usr_target',
    alive: true,
    hp: 360,
    armor: 10,
    spawnShieldUntil: 0,
    respawnAt: 0
  };

  const out = applyDamageFromSource({ id: 'usr_attacker' }, target, 44, {
    hitType: 'body',
    weaponId: 'rifle',
    sourceKind: 'weapon',
    armorBufferMode: 'normal'
  });

  assert.deepEqual(out, {
    id: 'usr_target',
    hp: 326,
    armor: 0,
    armorDamage: 10,
    healthDamage: 34,
    damageApplied: 44,
    killed: false
  });
});

test('TDM same-team hits do not apply damage', () => {
  const source = { id: 'usr_attacker', teamId: 'alpha' };
  const target = {
    id: 'usr_target',
    teamId: 'alpha',
    alive: true,
    hp: 360,
    armor: 40,
    spawnShieldUntil: 0,
    respawnAt: 0
  };
  const room = {
    gameMode: 'tdm',
    matchState: { gameMode: 'tdm' }
  };

  const out = applyDamageFromSource(source, target, 120, {
    hitType: 'body',
    weaponId: 'rifle',
    sourceKind: 'weapon',
    room
  });

  assert.equal(out, null);
  assert.equal(target.hp, 360);
  assert.equal(target.armor, 40);
});

test('sniper hits now spill excess damage into health after armor breaks', () => {
  const target = {
    id: 'usr_target',
    alive: true,
    hp: 360,
    armor: 10,
    spawnShieldUntil: 0,
    respawnAt: 0
  };

  const out = applyDamageFromSource({ id: 'usr_attacker' }, target, 170, {
    hitType: 'body',
    weaponId: 'sniper',
    sourceKind: 'weapon',
    armorBufferMode: 'normal'
  });

  assert.deepEqual(out, {
    id: 'usr_target',
    hp: 200,
    armor: 0,
    armorDamage: 10,
    healthDamage: 160,
    damageApplied: 170,
    killed: false
  });
});

test('explosive hits now spill excess damage into health after armor breaks', () => {
  const target = {
    id: 'usr_target',
    alive: true,
    hp: 360,
    armor: 10,
    spawnShieldUntil: 0,
    respawnAt: 0
  };

  const out = applyDamageFromSource({ id: 'usr_attacker' }, target, 110, {
    hitType: 'body',
    weaponId: 'frag',
    sourceKind: 'throwable',
    armorBufferMode: 'normal'
  });

  assert.deepEqual(out, {
    id: 'usr_target',
    hp: 260,
    armor: 0,
    armorDamage: 10,
    healthDamage: 100,
    damageApplied: 110,
    killed: false
  });
});

test('stock-based kills consume a stock and mark final stock deaths as eliminated', () => {
  const target = {
    id: 'usr_target',
    alive: true,
    hp: 80,
    armor: 0,
    stocksRemaining: 1,
    maxStocks: 5,
    bonusLivesEarned: 1,
    extraLifeProgressPct: 40,
    spawnShieldUntil: 0,
    respawnAt: 0
  };

  const out = applyDamageFromSource({ id: 'usr_attacker' }, target, 120, {
    hitType: 'body',
    weaponId: 'rifle',
    sourceKind: 'weapon',
    armorBufferMode: 'normal'
  });

  assert.deepEqual(out, {
    id: 'usr_target',
    hp: 0,
    armor: 0,
    armorDamage: 0,
    healthDamage: 80,
    damageApplied: 80,
    killed: true,
    stocksRemaining: 0,
    maxStocks: 5,
    bonusLivesEarned: 1,
    extraLifeProgressPct: 40,
    eliminated: true
  });
  assert.equal(target.respawnAt, 0);
});

test('authoritative damage awards bonus-life progress and grants a stock at 100 percent', () => {
  const broadcasts = [];
  const results = [];
  const attacker = {
    id: 'usr_attacker',
    alive: true,
    eliminated: false,
    stocksRemaining: 3,
    maxStocks: 5,
    bonusLivesEarned: 0,
    extraLifeProgressPct: 99
  };
  const target = {
    id: 'usr_target',
    alive: true,
    eliminated: false,
    spawnShieldUntil: 0
  };
  const room = {
    getEntityById(id) {
      if (id === attacker.id) return attacker;
      if (id === target.id) return target;
      return null;
    },
    broadcast(payload) {
      broadcasts.push(payload);
    },
    syncPlayerResultFromEntity(entity) {
      results.push({
        id: entity.id,
        stocksRemaining: entity.stocksRemaining,
        bonusLivesEarned: entity.bonusLivesEarned,
        extraLifeProgressPct: entity.extraLifeProgressPct
      });
    },
    markEntityEngaged() {},
    markSnapshotBurst() {},
    recordElimination() {}
  };

  broadcastDamageEvent(room, attacker.id, target, {
    hp: 300,
    armor: 40,
    damageApplied: 40,
    killed: false
  }, 'body', 'rifle', 'life_meter');

  assert.deepEqual(results, [{
    id: attacker.id,
    stocksRemaining: 4,
    bonusLivesEarned: 1,
    extraLifeProgressPct: 0
  }]);
  assert.equal(broadcasts[0].sourceStocksRemaining, 4);
  assert.equal(broadcasts[0].sourceBonusLivesEarned, 1);
  assert.equal(broadcasts[0].sourceExtraLifeProgressPct, 0);
});

test('explodeProjectile ignores targets that are only close on the ground plane but too far vertically', () => {
  const broadcasts = [];
  const target = { id: 'usr_target', alive: true, x: 0, y: 8, z: 0, hp: 360, armor: 0, spawnShieldUntil: 0, respawnAt: 0 };
  const room = {
    broadcast(payload) { broadcasts.push(payload); },
    getEntityById() { return null; },
    getAliveEntities() { return [target]; },
    canTargetEntity() { return true; },
    entityAimTargetPosition(entity) { return { x: entity.x, y: entity.y, z: entity.z }; },
    hasWorldLineOfSight() { return true; }
  };

  explodeProjectile(room, { id: 'proj_missile', type: 'missile', ownerId: 'usr_test' }, 0, 0, 0);

  assert.deepEqual(broadcasts, [{
    t: 'throw_explode',
    projectileId: 'proj_missile',
    projectileType: 'missile',
    x: 0,
    y: 0,
    z: 0,
    radius: 2
  }]);
});

test('explodeProjectile ignores targets blocked by world geometry', () => {
  const broadcasts = [];
  const target = { id: 'usr_target', alive: true, x: 1, y: 0, z: 0, hp: 360, armor: 0, spawnShieldUntil: 0, respawnAt: 0 };
  const room = {
    broadcast(payload) { broadcasts.push(payload); },
    getEntityById() { return null; },
    getAliveEntities() { return [target]; },
    canTargetEntity() { return true; },
    entityAimTargetPosition(entity) { return { x: entity.x, y: entity.y, z: entity.z }; },
    hasWorldLineOfSight() { return false; }
  };

  explodeProjectile(room, { id: 'proj_missile', type: 'missile', ownerId: 'usr_test' }, 0, 0, 0);

  assert.deepEqual(broadcasts, [{
    t: 'throw_explode',
    projectileId: 'proj_missile',
    projectileType: 'missile',
    x: 0,
    y: 0,
    z: 0,
    radius: 2
  }]);
});
