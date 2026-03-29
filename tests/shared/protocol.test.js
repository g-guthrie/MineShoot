import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_ROOM_ID,
  MSG_C2S,
  applySnapshotEntityPatch,
  buildSnapshotEntityPatch,
  buildExpectedWorldMeta,
  cloneSnapshotValue,
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

test('normalizeReloadPayload emits a reload command for the requested weapon', () => {
  const payload = normalizeReloadPayload('shotgun');

  assert.deepEqual(payload, {
    t: MSG_C2S.RELOAD,
    weaponId: 'shotgun'
  });
});

test('snapshot protocol helpers build shallow patches and apply them against a baseline entity', () => {
  const baseEntity = {
    id: 'u1',
    x: 1,
    weaponLoadout: ['rifle', 'shotgun'],
    weaponAmmo: {
      rifle: { ammoInMag: 10 }
    }
  };
  const nextEntity = {
    id: 'u1',
    x: 2,
    weaponLoadout: ['rifle', 'sniper'],
    weaponAmmo: {
      rifle: { ammoInMag: 8 }
    }
  };

  const patch = buildSnapshotEntityPatch(nextEntity, baseEntity);
  assert.deepEqual(patch, {
    id: 'u1',
    x: 2,
    weaponLoadout: ['rifle', 'sniper'],
    weaponAmmo: {
      rifle: { ammoInMag: 8 }
    }
  });
  assert.deepEqual(applySnapshotEntityPatch(baseEntity, patch), nextEntity);
  assert.deepEqual(cloneSnapshotValue(nextEntity), nextEntity);
  assert.notEqual(cloneSnapshotValue(nextEntity).weaponAmmo, nextEntity.weaponAmmo);
});
