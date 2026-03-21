import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_ROOM_ID,
  MSG_C2S,
  buildExpectedWorldMeta,
  normalizeAbilityLoadoutPayload,
  normalizeClassCastPayload,
  normalizeReloadPayload,
  normalizeThrowPayload
} from '../../shared/protocol.js';

test('buildExpectedWorldMeta derives seed and flags from shared defaults', () => {
  const worldMeta = buildExpectedWorldMeta('Party Room!!');

  assert.equal(worldMeta.roomId, 'partyroom');
  assert.equal(worldMeta.worldSeed, 'room-env-v6-static-partyroom');
  assert.equal(worldMeta.worldProfileVersion, 6);
  assert.deepEqual(worldMeta.worldFlags, { envV2: true, terrainPhysicsV2: true });
});

test('buildExpectedWorldMeta falls back to the default room id', () => {
  const worldMeta = buildExpectedWorldMeta('***');

  assert.equal(worldMeta.roomId, DEFAULT_ROOM_ID);
  assert.equal(worldMeta.worldSeed, 'room-env-v6-static-global');
});

test('normalizeThrowPayload preserves valid throw intent and drops invalid vectors', () => {
  const payload = normalizeThrowPayload('frag', 'cthrow_1', {
    origin: { x: 1, y: 2, z: 3 },
    direction: { x: 0, y: 1, z: 0 },
    aimPoint: { x: 4, y: 5, z: 6 }
  });
  const invalidPayload = normalizeThrowPayload('frag', 'cthrow_2', {
    origin: { x: 1, y: 'bad', z: 3 },
    direction: { x: 0, y: 1, z: 0 }
  });

  assert.equal(payload.t, MSG_C2S.THROW);
  assert.deepEqual(payload.throwIntent, {
    origin: { x: 1, y: 2, z: 3 },
    direction: { x: 0, y: 1, z: 0 },
    aimPoint: { x: 4, y: 5, z: 6 }
  });
  assert.equal(invalidPayload.throwIntent, undefined);
});

test('normalizeClassCastPayload centralizes aim point and projectile intent shaping', () => {
  const payload = normalizeClassCastPayload({
    lockTargetId: 'usr_target',
    aimPoint: { x: 10, y: 11, z: 12 },
    projectileIntent: {
      origin: { x: 1, y: 2, z: 3 },
      direction: { x: 0, y: 0, z: -1 },
      aimPoint: { x: 4, y: 5, z: 6 }
    }
  });

  assert.equal(payload.t, MSG_C2S.CLASS_CAST);
  assert.equal('slot' in payload, false);
  assert.equal(payload.lockTargetId, 'usr_target');
  assert.deepEqual(payload.aimPoint, { x: 10, y: 11, z: 12 });
  assert.deepEqual(payload.projectileIntent, {
    origin: { x: 1, y: 2, z: 3 },
    direction: { x: 0, y: 0, z: -1 },
    aimPoint: { x: 4, y: 5, z: 6 }
  });
});

test('normalizeReloadPayload emits a reload command for the requested weapon', () => {
  const payload = normalizeReloadPayload('shotgun');

  assert.deepEqual(payload, {
    t: MSG_C2S.RELOAD,
    weaponId: 'shotgun'
  });
});

test('normalizeAbilityLoadoutPayload always emits strings', () => {
  const payload = normalizeAbilityLoadoutPayload('choke', null);

  assert.deepEqual(payload, {
    t: MSG_C2S.CLASS_QUEUE,
    abilityId: 'choke'
  });
});
