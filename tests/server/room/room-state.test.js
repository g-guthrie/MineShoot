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
    started: false,
    ended: false,
    startedAt: 0,
    endedAt: 0,
    resetAt: 0,
    matchBaselinePlayerCount: 0,
    targetProgress: 0,
    leaderProgress: 0,
    leaderId: '',
    winnerId: '',
    winnerTeam: '',
    lms: gameMode === 'lms' ? {
      startingLives: 3,
      maxLives: 5,
      chargePerExtraLife: 100,
      remainingPlayers: 0,
      finalBankingCutoffRemaining: 2,
      warmupEndsAt: 0,
      nextRotateAt: 0,
      bankingEnabled: false,
      activeBeacon: null
    } : null,
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
      started: true,
      ended: false,
      startedAt: 11,
      endedAt: 0,
      resetAt: 22,
      matchBaselinePlayerCount: 4,
      targetProgress: 10,
      leaderProgress: 2.5,
      leaderId: 'lead',
      winnerId: '',
      winnerTeam: '',
      lms: null,
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
    targetProgress: 10,
    leaderProgress: 2.5,
    leaderId: 'lead',
    winnerId: '',
    winnerTeam: '',
    lms: null,
    teamProgress: { alpha: 2, bravo: 1 },
    teamBaselineSize: { alpha: 2, bravo: 2 }
  });
});

test('room state helper builds welcome and snapshot payloads from shared room state', () => {
  const room = {
    roomName: 'private-room2',
    gameMode: 'lms',
    worldSeed: 'seed-1',
    worldProfileVersion: 6,
    worldFlags: { envV2: true, terrainPhysicsV2: false },
    privateRoomConfig: { roomPhase: 'active' },
    matchState: {
      gameMode: 'lms',
      started: true,
      ended: false,
      startedAt: 50,
      endedAt: 0,
      resetAt: 0,
      matchBaselinePlayerCount: 3,
      targetProgress: 0,
      leaderProgress: 1,
      leaderId: 'u1',
      winnerId: '',
      winnerTeam: '',
      lms: {
        startingLives: 3,
        maxLives: 5,
        chargePerExtraLife: 100,
        remainingPlayers: 2,
        finalBankingCutoffRemaining: 1,
        warmupEndsAt: 60,
        nextRotateAt: 90,
        bankingEnabled: true,
        activeBeacon: { id: 'b1', x: 1, z: 2 }
      },
      teamProgress: { alpha: 0, bravo: 0 },
      teamBaselineSize: { alpha: 0, bravo: 0 }
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
  assert.equal(welcome.matchState.lms.activeBeacon.id, 'b1');

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
    gameMode: 'lms',
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

test('room state helper prioritizes snapshot cadence for self, engaged, nearby, and far entities', () => {
  const viewer = { id: 'u1', x: 0, y: 1.6, z: 0 };
  const engaged = { id: 'u2', x: 60, y: 1.6, z: 0 };
  const nearby = { id: 'u3', x: 10, y: 1.6, z: 0 };
  const far = { id: 'u4', x: 80, y: 1.6, z: 0 };

  assert.equal(snapshotCadenceMsForEntity(viewer, viewer, 1000), 1000 / 60);
  assert.equal(snapshotCadenceMsForEntity(viewer, engaged, 1000, {
    isEngaged(currentViewer, entity) {
      return currentViewer.id === 'u1' && entity.id === 'u2';
    }
  }), 1000 / 60);
  assert.equal(snapshotCadenceMsForEntity(viewer, nearby, 1000), 1000 / 30);
  assert.equal(snapshotCadenceMsForEntity(viewer, far, 1000), 1000 / 15);
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
  assert.deepEqual(secondSelection.entities, [{ id: 'u1', x: 0.1, y: 1.6, z: 0, seq: 4 }, { id: 'u3', x: 90, y: 1.6, z: 0 }]);
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
  assert.deepEqual(thirdSelection.entities, [{ id: 'u1', x: 0.2, y: 1.6, z: 0, seq: 5 }, { id: 'u2', x: 7, y: 1.6, z: 0 }]);
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
