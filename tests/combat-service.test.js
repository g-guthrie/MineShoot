import test from 'node:test';
import assert from 'node:assert/strict';

import { explodeProjectile } from '../cloudflare/server/room/CombatService.js';

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
    radius: 2.4
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
