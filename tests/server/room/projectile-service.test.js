import test from 'node:test';
import assert from 'node:assert/strict';

import { tickProjectiles, tickFireZones } from '../../../cloudflare/server/room/ProjectileService.js';

function createRoom(overrides = {}) {
  return {
    players: new Map(),
    bots: new Map(),
    projectiles: new Map(),
    fireZones: new Map(),
    worldCollidables() { return []; },
    canTargetEntity() { return false; },
    terrainFeetYAt() { return -50; },
    getEntityById() { return null; },
    broadcast() {},
    ...overrides
  };
}

test('tickProjectiles removes knives when they hit authoritative world colliders', () => {
  const broadcasts = [];
  const room = createRoom({
    worldCollidables() {
      return [{
        min: { x: -0.25, y: 0, z: -2.2 },
        max: { x: 0.25, y: 2, z: -1.8 }
      }];
    },
    broadcast(payload) {
      broadcasts.push(payload);
    }
  });
  room.projectiles.set('proj_knife', {
    id: 'proj_knife',
    type: 'knife',
    ownerId: 'usr_test',
    x: 0,
    y: 1,
    z: 0,
    vx: 0,
    vy: 0,
    vz: -12,
    age: 0,
    lifeSec: 1.8,
    fuseSec: 0,
    hitRadius: 0.55,
    alive: true
  });

  tickProjectiles(room, 0.2);

  assert.equal(room.projectiles.size, 0);
  assert.equal(broadcasts.length, 1);
  assert.equal(broadcasts[0].t, 'throw_impact');
  assert.equal(broadcasts[0].projectileId, 'proj_knife');
  assert.equal(broadcasts[0].projectileType, 'knife');
  assert.equal(broadcasts[0].impactType, 'world');
  assert.equal(broadcasts[0].x, 0);
  assert.equal(broadcasts[0].z, -1.8);
  assert.equal(broadcasts[0].y < 1, true);
  assert.equal(broadcasts[0].y > 0.7, true);
});

test('tickProjectiles reflects frag grenades off authoritative world colliders instead of tunneling through', () => {
  const room = createRoom({
    worldCollidables() {
      return [{
        min: { x: -0.25, y: 0, z: -2.2 },
        max: { x: 0.25, y: 2, z: -1.8 }
      }];
    }
  });
  const projectile = {
    id: 'proj_frag',
    type: 'frag',
    ownerId: 'usr_test',
    x: 0,
    y: 1,
    z: 0,
    vx: 0,
    vy: 0,
    vz: -12,
    age: 0,
    bounces: 0,
    lifeSec: 0,
    fuseSec: 2.2,
    hitRadius: 1.2,
    alive: true
  };
  room.projectiles.set(projectile.id, projectile);

  tickProjectiles(room, 0.2);

  assert.equal(room.projectiles.size, 1);
  assert.equal(projectile.z > -1.8, true);
  assert.equal(projectile.vz > 0, true);
  assert.equal(projectile.bounces, 1);
});

test('tickProjectiles lets plasma acquire before it sticks and then follows the stuck target', () => {
  const target = {
    id: 'usr_target',
    alive: true,
    x: 1.15,
    y: 1.6,
    z: -2.8
  };
  const room = createRoom({
    canTargetEntity(entity, ownerId) {
      return !!entity && entity.alive && entity.id !== ownerId;
    },
    getEntityById(id) {
      return id === target.id ? target : null;
    }
  });
  const projectile = {
    id: 'proj_plasma',
    type: 'plasma',
    ownerId: 'usr_owner',
    x: 0,
    y: 1,
    z: 0,
    vx: 0,
    vy: 0,
    vz: -20,
    age: 0,
    lifeSec: 6,
    fuseSec: 0,
    alive: true,
    stickyDelaySec: 2.2,
    catchRadius: 1.5,
    trackDurationSec: 0.2,
    trackLerp: 10,
    trackingTargetId: '',
    trackingUntil: 0,
    stickyUntil: 0,
    stuckToTargetId: '',
    stuckOffsetX: 0,
    stuckOffsetY: 0,
    stuckOffsetZ: 0
  };
  room.projectiles.set(projectile.id, projectile);
  room.players.set(target.id, target);

  tickProjectiles(room, 0.05);
  assert.equal(projectile.trackingTargetId, target.id);
  assert.equal(projectile.stickyUntil, 0);

  tickProjectiles(room, 0.05);
  assert.equal(projectile.stickyUntil > 0, true);
  assert.equal(projectile.stuckToTargetId, target.id);
  const stuckX = projectile.x;
  const stuckY = projectile.y;
  const stuckZ = projectile.z;

  target.x = 2.0;
  target.z = -3.5;
  tickProjectiles(room, 0.05);
  assert.equal(projectile.x > stuckX, true);
  assert.equal(projectile.z < stuckZ, true);
  assert.equal(projectile.y, stuckY);
});

test('tickFireZones deals more damage near the center of a molotov than at the edge', () => {
  const broadcasts = [];
  const owner = { id: 'usr_owner', alive: true, x: 0, y: 1.6, z: -6, hp: 500, hpMax: 500, armor: 0, armorMax: 90, spawnShieldUntil: 0, respawnAt: 0 };
  const center = { id: 'usr_center', alive: true, x: 0.2, y: 1.6, z: 0, hp: 500, hpMax: 500, armor: 0, armorMax: 90, spawnShieldUntil: 0, respawnAt: 0 };
  const edge = { id: 'usr_edge', alive: true, x: 3.6, y: 1.6, z: 0, hp: 500, hpMax: 500, armor: 0, armorMax: 90, spawnShieldUntil: 0, respawnAt: 0 };
  const room = createRoom({
    players: new Map([[owner.id, owner], [center.id, center], [edge.id, edge]]),
    canTargetEntity(entity, ownerId) {
      return !!entity && entity.alive && entity.id !== ownerId;
    },
    getEntityById(id) {
      return this.players.get(id) || null;
    },
    broadcast(payload) {
      broadcasts.push(payload);
    }
  });
  room.fireZones.set('zone_1', {
    id: 'zone_1',
    ownerId: owner.id,
    x: 0,
    y: 0,
    z: 0,
    radius: 3.8,
    life: 5.5,
    tickTimer: 0
  });

  tickFireZones(room, 0.1);

  const damageEvents = broadcasts.filter((payload) => payload.t === 'damage_event');
  assert.equal(damageEvents.length, 2);
  const centerEvent = damageEvents.find((payload) => payload.targetId === center.id);
  const edgeEvent = damageEvents.find((payload) => payload.targetId === edge.id);
  assert.ok(centerEvent);
  assert.ok(edgeEvent);
  assert.ok(centerEvent.damage > edgeEvent.damage);
});

test('tickFireZones keeps a short lingering burn after an entity leaves the molotov', () => {
  const originalDateNow = Date.now;
  let now = 1000;
  Date.now = () => now;
  try {
    const broadcasts = [];
    const owner = { id: 'usr_owner', alive: true, x: 0, y: 1.6, z: -6, hp: 500, hpMax: 500, armor: 0, armorMax: 90, spawnShieldUntil: 0, respawnAt: 0 };
    const target = { id: 'usr_target', alive: true, x: 0.2, y: 1.6, z: 0, hp: 500, hpMax: 500, armor: 0, armorMax: 90, spawnShieldUntil: 0, respawnAt: 0 };
    const room = createRoom({
      players: new Map([[owner.id, owner], [target.id, target]]),
      canTargetEntity(entity, ownerId) {
        return !!entity && entity.alive && entity.id !== ownerId;
      },
      getEntityById(id) {
        return this.players.get(id) || null;
      },
      broadcast(payload) {
        broadcasts.push(payload);
      }
    });
    room.fireZones.set('zone_1', {
      id: 'zone_1',
      ownerId: owner.id,
      x: 0,
      y: 0,
      z: 0,
      radius: 3.8,
      life: 5.5,
      tickTimer: 0
    });

    tickFireZones(room, 0.1);
    const hpAfterDirect = target.hp;
    assert.equal(target.burnUntil > now, true);

    target.x = 10;
    now += 450;
    tickFireZones(room, 0.45);

    assert.equal(target.hp < hpAfterDirect, true);
    const lingerEvents = broadcasts.filter((payload) => payload.t === 'damage_event' && payload.targetId === target.id);
    assert.equal(lingerEvents.length >= 2, true);
  } finally {
    Date.now = originalDateNow;
  }
});
