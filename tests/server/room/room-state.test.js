import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildViewerEntitySnapshot,
  buildSnapshotPayload,
  buildWelcomePayload,
  currentPrivateRoomPhase,
  snapshotCadenceMsForEntity,
  serializeMatchState
} from '../../../cloudflare/server/room/RoomState.js';

function emptyMatchState(gameMode) {
  return {
    gameMode,
    stockMode: gameMode === 'ffa',
    started: false,
    ended: false,
    startedAt: 0,
    endedAt: 0,
    resetAt: 0,
    matchBaselinePlayerCount: 0,
    aliveCount: 0,
    startingStocks: 3,
    maxStocks: 5,
    maxBonusLives: 2,
    targetProgress: 0,
    leaderProgress: 0,
    leaderId: '',
    winnerId: '',
    winnerTeam: '',
    teamProgress: { alpha: 0, bravo: 0 },
    teamBaselineSize: { alpha: 0, bravo: 0 }
  };
}

test('room state helper normalizes private room phase and match state payloads', () => {
  const room = {
    roomName: 'private-room1',
    gameMode: 'tdm',
    privateRoomConfig: { roomPhase: 'lobby' },
    matchState: {
      gameMode: 'tdm',
      stockMode: false,
      started: true,
      ended: false,
      startedAt: 11,
      endedAt: 0,
      resetAt: 22,
      matchBaselinePlayerCount: 4,
      aliveCount: 4,
      startingStocks: 3,
      maxStocks: 5,
      maxBonusLives: 2,
      targetProgress: 10,
      leaderProgress: 2.5,
      leaderId: 'lead',
      winnerId: '',
      winnerTeam: '',
      teamProgress: { alpha: 2, bravo: 1 },
      teamBaselineSize: { alpha: 2, bravo: 2 }
    }
  };

  assert.equal(currentPrivateRoomPhase(room, {
    isPrivateMatchRoom: (roomName) => String(roomName).startsWith('private-'),
    roomPhaseActive: 'active'
  }), 'lobby');

  assert.deepEqual(serializeMatchState(room, {
    emptyMatchState,
    teamAlpha: 'alpha',
    teamBravo: 'bravo'
  }), {
    gameMode: 'tdm',
    started: true,
    ended: false,
    startedAt: 11,
    endedAt: 0,
    resetAt: 22,
    matchBaselinePlayerCount: 4,
    aliveCount: 4,
    stockMode: false,
    startingStocks: 3,
    maxStocks: 5,
    maxBonusLives: 2,
    targetProgress: 10,
    leaderProgress: 2.5,
    leaderId: 'lead',
    winnerId: '',
    winnerTeam: '',
    teamIds: ['alpha', 'bravo'],
    teamProgress: { alpha: 2, bravo: 1 },
    teamBaselineSize: { alpha: 2, bravo: 2 }
  });
});

test('room state helper serializes dynamic private tdm team ids and progress maps', () => {
  const room = {
    roomName: 'private-room4',
    gameMode: 'tdm',
    privateRoomConfig: { roomPhase: 'lobby' },
    matchState: {
      gameMode: 'tdm',
      stockMode: false,
      started: true,
      ended: false,
      startedAt: 11,
      endedAt: 0,
      resetAt: 22,
      matchBaselinePlayerCount: 4,
      aliveCount: 4,
      startingStocks: 3,
      maxStocks: 5,
      maxBonusLives: 2,
      targetProgress: 10,
      leaderProgress: 5,
      leaderId: '',
      winnerId: '',
      winnerTeam: '',
      teamIds: ['alpha', 'bravo', 'charlie', 'delta'],
      teamProgress: { alpha: 2, bravo: 1, charlie: 5, delta: 4 },
      teamBaselineSize: { alpha: 1, bravo: 1, charlie: 1, delta: 1 }
    }
  };

  assert.deepEqual(serializeMatchState(room, {
    emptyMatchState,
    teamAlpha: 'alpha',
    teamBravo: 'bravo'
  }), {
    gameMode: 'tdm',
    started: true,
    ended: false,
    startedAt: 11,
    endedAt: 0,
    resetAt: 22,
    matchBaselinePlayerCount: 4,
    aliveCount: 4,
    stockMode: false,
    startingStocks: 3,
    maxStocks: 5,
    maxBonusLives: 2,
    targetProgress: 10,
    leaderProgress: 5,
    leaderId: '',
    winnerId: '',
    winnerTeam: '',
    teamIds: ['alpha', 'bravo', 'charlie', 'delta'],
    teamProgress: { alpha: 2, bravo: 1, charlie: 5, delta: 4 },
    teamBaselineSize: { alpha: 1, bravo: 1, charlie: 1, delta: 1 }
  });
});

test('room state helper builds welcome and snapshot payloads from shared room state', () => {
  const room = {
    roomName: 'private-room2',
    gameMode: 'tdm',
    worldSeed: 'seed-1',
    worldProfileVersion: 6,
    worldFlags: { envV2: true, terrainPhysicsV2: false },
    privateRoomConfig: { roomPhase: 'active' },
    matchState: {
      gameMode: 'tdm',
      stockMode: false,
      started: true,
      ended: false,
      startedAt: 50,
      endedAt: 0,
      resetAt: 0,
      matchBaselinePlayerCount: 3,
      aliveCount: 3,
      startingStocks: 3,
      maxStocks: 5,
      maxBonusLives: 2,
      targetProgress: 10,
      leaderProgress: 6,
      leaderId: 'u1',
      winnerId: '',
      winnerTeam: '',
      teamIds: ['alpha', 'bravo'],
      teamProgress: { alpha: 6, bravo: 4 },
      teamBaselineSize: { alpha: 2, bravo: 1 }
    }
  };

  const deps = {
    msgType: 'welcome',
    isPrivateMatchRoom: (roomName) => String(roomName).startsWith('private-'),
    roomPhaseActive: 'active',
    emptyMatchState,
    roomSimTickMs: 1000 / 60,
    inputSendHz: 30,
    teamAlpha: 'alpha',
    teamBravo: 'bravo'
  };
  const welcome = buildWelcomePayload(room, 'u1', deps);
  assert.equal(welcome.t, 'welcome');
  assert.equal(welcome.privateRoomPhase, 'active');
  assert.equal(welcome.tickRate, 60);
  assert.equal(welcome.inputSendHz, 30);
  assert.deepEqual(welcome.worldFlags, { envV2: true, terrainPhysicsV2: false });
  assert.equal(welcome.matchState.teamProgress.alpha, 6);

  const snapshot = buildSnapshotPayload(room, {
    forceFull: false,
    entities: [{ id: 'full' }],
    changedEntities: [{ id: 'delta' }],
    removedEntityIds: ['gone'],
    projectiles: [{ id: 'p1' }],
    fireZones: [{ id: 'f1' }]
  }, Object.assign({}, deps, { msgType: 'snapshot', nowMs: () => 999 }));
  assert.deepEqual(snapshot, {
    t: 'snapshot',
    serverTime: 999,
    delta: true,
    gameMode: 'tdm',
    privateRoomPhase: 'active',
    matchState: welcome.matchState,
    entities: [{ id: 'delta' }],
    removedEntityIds: ['gone'],
    projectiles: [{ id: 'p1' }],
    fireZones: [{ id: 'f1' }]
  });

  const entityOnlySnapshot = buildSnapshotPayload(room, {
    forceFull: false,
    changedEntities: [{ id: 'delta2' }],
    removedEntityIds: []
  }, Object.assign({}, deps, { msgType: 'snapshot', nowMs: () => 1001 }));
  assert.equal('projectiles' in entityOnlySnapshot, false);
  assert.equal('fireZones' in entityOnlySnapshot, false);
});

test('room state helper builds baseline delta snapshot payloads with entity patches', () => {
  const room = {
    roomName: 'global',
    gameMode: 'ffa',
    privateRoomConfig: { roomPhase: 'active' },
    matchState: emptyMatchState('ffa')
  };

  const payload = buildSnapshotPayload(room, {
    snapshotSeq: 9,
    baseSnapshotSeq: 7,
    forceFull: false,
    entityPatches: [{ id: 'u1', x: 4 }],
    removedEntityIds: ['u2']
  }, {
    msgType: 'snapshot',
    nowMs: () => 555,
    isPrivateMatchRoom: () => false,
    roomPhaseActive: 'active',
    emptyMatchState,
    teamAlpha: 'alpha',
    teamBravo: 'bravo'
  });

  assert.deepEqual(payload, {
    t: 'snapshot',
    serverTime: 555,
    delta: true,
    gameMode: 'ffa',
    privateRoomPhase: '',
    matchState: serializeMatchState(room, {
      emptyMatchState,
      teamAlpha: 'alpha',
      teamBravo: 'bravo'
    }),
    entityPatches: [{ id: 'u1', x: 4 }],
    removedEntityIds: ['u2'],
    snapshotSeq: 9,
    baseSnapshotSeq: 7
  });
});

test('room state helper prioritizes snapshot cadence for self, engaged, nearby, and far entities', () => {
  const viewer = { id: 'u1', x: 0, y: 1.6, z: 0 };
  const engaged = { id: 'u2', x: 60, y: 1.6, z: 0 };
  const nearby = { id: 'u3', x: 10, y: 1.6, z: 0, moveSpeedNorm: 0.2 };
  const fastNearby = { id: 'u5', x: 12, y: 1.6, z: 0, moveSpeedNorm: 0.9 };
  const far = { id: 'u4', x: 80, y: 1.6, z: 0 };

  assert.equal(snapshotCadenceMsForEntity(viewer, viewer, 1000), 1000 / 30);
  assert.equal(snapshotCadenceMsForEntity(viewer, engaged, 1000, {
    isEngaged(currentViewer, entity) {
      return currentViewer.id === 'u1' && entity.id === 'u2';
    }
  }), 1000 / 60);
  assert.equal(snapshotCadenceMsForEntity(viewer, nearby, 1000), 1000 / 45);
  assert.equal(snapshotCadenceMsForEntity(viewer, fastNearby, 1000), 1000 / 60);
  assert.equal(snapshotCadenceMsForEntity(viewer, far, 1000), 1000 / 30);
});

test('room state helper applies adaptive cadence multipliers without dropping below per-tier floors', () => {
  const viewer = { id: 'u1', x: 0, y: 1.6, z: 0 };
  const engaged = { id: 'u2', x: 60, y: 1.6, z: 0 };
  const nearby = { id: 'u3', x: 10, y: 1.6, z: 0, moveSpeedNorm: 0.2 };
  const far = { id: 'u4', x: 80, y: 1.6, z: 0 };

  assert.equal(snapshotCadenceMsForEntity(viewer, engaged, 1000, {
    adaptiveCadenceEnabled: true,
    qualityIntervalMultiplier: 2,
    isEngaged(currentViewer, entity) {
      return currentViewer.id === 'u1' && entity.id === 'u2';
    }
  }), 1000 / 30);
  assert.equal(snapshotCadenceMsForEntity(viewer, nearby, 1000, {
    adaptiveCadenceEnabled: true,
    qualityIntervalMultiplier: 2
  }), (1000 / 45) * 2);
  assert.equal(snapshotCadenceMsForEntity(viewer, far, 1000, {
    adaptiveCadenceEnabled: true,
    qualityIntervalMultiplier: 4
  }), 1000 / 10);
});

test('room state helper resends a cadence-due entity that changed since the last send even if rounded state matches', () => {
  const viewer = { id: 'u1', x: 0, y: 1.6, z: 0 };
  const firstSelection = buildViewerEntitySnapshot([
    { id: 'u1', x: 0, y: 1.6, z: 0, seq: 3 },
    { id: 'u2', x: 40, y: 1.6, z: 0, lastAuthoritativeChangeAt: 1000 }
  ], viewer, null, {
    nowMs: 1000,
    serializeEntity: JSON.stringify
  });

  const secondSelection = buildViewerEntitySnapshot([
    { id: 'u1', x: 0, y: 1.6, z: 0, seq: 3 },
    { id: 'u2', x: 40, y: 1.6, z: 0, lastAuthoritativeChangeAt: 1090 }
  ], viewer, firstSelection.snapshotState, {
    nowMs: 1010,
    serializeEntity: JSON.stringify
  });
  assert.equal(secondSelection.entities.length, 0);

  const thirdSelection = buildViewerEntitySnapshot([
    { id: 'u1', x: 0, y: 1.6, z: 0, seq: 3 },
    { id: 'u2', x: 40, y: 1.6, z: 0, lastAuthoritativeChangeAt: 1090 }
  ], viewer, firstSelection.snapshotState, {
    nowMs: 1035,
    serializeEntity: JSON.stringify
  });
  assert.equal(thirdSelection.entities.length, 1);
  assert.equal(thirdSelection.entities[0].id, 'u2');
});

test('room state helper builds per-viewer deltas without dropping unsent far entities', () => {
  const viewer = { id: 'u1', x: 0, y: 1.6, z: 0 };
  const first = [
    { id: 'u1', x: 0, y: 1.6, z: 0, seq: 3 },
    { id: 'u2', x: 5, y: 1.6, z: 0 }
  ];
  const firstSelection = buildViewerEntitySnapshot(first, viewer, null, {
    nowMs: 1000,
    serializeEntity: JSON.stringify
  });
  assert.deepEqual(firstSelection.entities, first);
  assert.deepEqual(firstSelection.removedEntityIds, []);

  const second = [
    { id: 'u1', x: 0.1, y: 1.6, z: 0, seq: 4 },
    { id: 'u2', x: 6, y: 1.6, z: 0 },
    { id: 'u3', x: 90, y: 1.6, z: 0 }
  ];
  const secondSelection = buildViewerEntitySnapshot(second, viewer, firstSelection.snapshotState, {
    nowMs: 1033,
    serializeEntity: JSON.stringify
  });
  assert.deepEqual(secondSelection.entities, [
    { id: 'u2', x: 6, y: 1.6, z: 0 },
    { id: 'u3', x: 90, y: 1.6, z: 0 }
  ]);
  assert.deepEqual(secondSelection.removedEntityIds, []);

  const third = [
    { id: 'u1', x: 0.2, y: 1.6, z: 0, seq: 5 },
    { id: 'u2', x: 7, y: 1.6, z: 0 },
    { id: 'u3', x: 91, y: 1.6, z: 0 }
  ];
  const thirdSelection = buildViewerEntitySnapshot(third, viewer, secondSelection.snapshotState, {
    nowMs: 1066,
    serializeEntity: JSON.stringify
  });
  assert.deepEqual(thirdSelection.entities, [
    { id: 'u1', x: 0.2, y: 1.6, z: 0, seq: 5 },
    { id: 'u2', x: 7, y: 1.6, z: 0 }
  ]);
  assert.deepEqual(thirdSelection.removedEntityIds, []);
  assert.equal(thirdSelection.snapshotState.entityStateById.has('u3'), true);
});

test('room state helper can force a priority entity through before its normal cadence', () => {
  const viewer = { id: 'u1', x: 0, y: 1.6, z: 0 };
  const firstSelection = buildViewerEntitySnapshot([
    { id: 'u1', x: 0, y: 1.6, z: 0, seq: 3 },
    { id: 'u2', x: 5, y: 1.6, z: 0 }
  ], viewer, null, {
    nowMs: 1000,
    serializeEntity: JSON.stringify
  });

  const secondSelection = buildViewerEntitySnapshot([
    { id: 'u1', x: 0, y: 1.6, z: 0, seq: 3 },
    { id: 'u2', x: 6, y: 1.6, z: 0 }
  ], viewer, firstSelection.snapshotState, {
    nowMs: 1010,
    serializeEntity: JSON.stringify,
    priorityEntityIds: new Set(['u2'])
  });

  assert.deepEqual(secondSelection.entities, [{ id: 'u2', x: 6, y: 1.6, z: 0 }]);
});
