import test from 'node:test';
import assert from 'node:assert/strict';

import { tickProjectiles } from '../../../cloudflare/server/room/ProjectileService.js';

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
