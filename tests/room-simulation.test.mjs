import test from 'node:test';
import assert from 'node:assert/strict';

import { buildSnapshotPayload } from '../cloudflare/server/room/runtime/RoomSimulation.mjs';

function toEntityState(entity) {
  return {
    id: entity.id,
    x: entity.x,
    hp: entity.hp
  };
}

test('room simulation emits full snapshots and then deltas only for changes', () => {
  const first = buildSnapshotPayload({
    messageType: 'snapshot',
    serverTime: 1000,
    gameMode: 'ffa',
    matchState: { started: true },
    entities: [
      { id: 'a', x: 1, hp: 500 },
      { id: 'b', x: 2, hp: 500 }
    ],
    toEntityState,
    previousState: new Map(),
    forceFull: true
  });

  assert.equal(first.payload.delta, false);
  assert.deepEqual(first.payload.entities, [
    { id: 'a', x: 1, hp: 500 },
    { id: 'b', x: 2, hp: 500 }
  ]);

  const second = buildSnapshotPayload({
    messageType: 'snapshot',
    serverTime: 1033,
    gameMode: 'ffa',
    matchState: { started: true },
    entities: [
      { id: 'a', x: 1, hp: 500 },
      { id: 'b', x: 4, hp: 420 },
      { id: 'c', x: 8, hp: 500 }
    ],
    toEntityState,
    previousState: first.nextEntityState,
    forceFull: false
  });

  assert.equal(second.payload.delta, true);
  assert.deepEqual(second.payload.entities, [
    { id: 'b', x: 4, hp: 420 },
    { id: 'c', x: 8, hp: 500 }
  ]);
  assert.deepEqual(second.payload.removedEntityIds, []);

  const third = buildSnapshotPayload({
    messageType: 'snapshot',
    serverTime: 1066,
    gameMode: 'ffa',
    matchState: { started: true },
    entities: [
      { id: 'a', x: 1, hp: 500 },
      { id: 'c', x: 8, hp: 500 }
    ],
    toEntityState,
    previousState: second.nextEntityState,
    forceFull: false
  });

  assert.deepEqual(third.payload.entities, []);
  assert.deepEqual(third.payload.removedEntityIds, ['b']);
});
