import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildSnapshotPayload,
  buildWelcomePayload,
  currentPrivateRoomPhase,
  serializeMatchState
} from '../cloudflare/server/room/RoomState.js';

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
    roomSimTickMs: 33,
    teamAlpha: 'alpha',
    teamBravo: 'bravo'
  };
  const welcome = buildWelcomePayload(room, 'u1', deps);
  assert.equal(welcome.t, 'welcome');
  assert.equal(welcome.privateRoomPhase, 'active');
  assert.equal(welcome.tickRate, 30);
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
});
