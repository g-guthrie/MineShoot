import test from 'node:test';
import assert from 'node:assert/strict';

import {
  applyJoinBaseline,
  assignPlayerToCurrentTeam,
  finishPublicMatch,
  maybeResetPublicMatch,
  recordElimination,
  startPublicMatchIfReady,
  syncPrivateRoomMatchState,
  updateLeaderProgress
} from '../../../cloudflare/server/room/RoomMatch.js';

function emptyMatchState(gameMode) {
  return {
    gameMode,
    started: false,
    ended: false,
    startedAt: 0,
    endedAt: 0,
    resetAt: 0,
    matchBaselinePlayerCount: 0,
    targetProgress: gameMode === 'tdm' ? 10 : (gameMode === 'ffa' ? 10 : 0),
    leaderProgress: 0,
    leaderId: '',
    winnerId: '',
    winnerTeam: '',
    teamProgress: { alpha: 0, bravo: 0 },
    teamBaselineSize: { alpha: 0, bravo: 0 }
  };
}

test('private room match sync normalizes mode and team assignment', () => {
  const room = {
    roomName: 'private-room1',
    gameMode: 'ffa',
    privateRoomConfig: {
      roomMode: 'tdm',
      roomPhase: 'active',
      teams: new Map([['a1', 'bravo']])
    },
    players: new Map([
      ['u1', { id: 'u1', actorId: 'a1', fixtureType: '', teamId: '', progressScore: 5 }],
      ['u2', { id: 'u2', actorId: 'a2', fixtureType: '', teamId: '', progressScore: 7 }]
    ])
  };

  syncPrivateRoomMatchState(room, {
    isPrivateMatchRoom: (roomName) => String(roomName).startsWith('private-'),
    emptyMatchState,
    nowMs: () => 50,
    gameModeFfa: 'ffa',
    gameModeTdm: 'tdm',
    teamAlpha: 'alpha'
  });

  assert.equal(room.gameMode, 'tdm');
  assert.equal(room.matchState.started, true);
  assert.equal(room.players.get('u1').teamId, 'bravo');
  assert.equal(room.players.get('u2').teamId, 'alpha');
  assert.equal(room.players.get('u1').progressScore, 0);
});

test('public match helpers start tdm and assign the lighter team on join baseline', () => {
  const room = {
    roomName: 'tdm-01',
    gameMode: 'tdm',
    players: new Map([
      ['u1', { id: 'u1', fixtureType: '', teamId: 'alpha', kills: 0, progressScore: 0 }],
      ['u2', { id: 'u2', fixtureType: '', teamId: '', kills: 0, progressScore: 0 }]
    ]),
    matchState: emptyMatchState('tdm'),
    isPublicMatchRoom() { return true; },
    connectedHumanCount() { return 2; },
    initializeLmsMatchState() {}
  };

  assert.equal(assignPlayerToCurrentTeam(room, room.players.get('u2'), { teamAlpha: 'alpha', teamBravo: 'bravo' }), 'bravo');
  room.players.get('u2').teamId = '';
  assert.equal(startPublicMatchIfReady(room, {
    emptyMatchState,
    nowMs: () => 99,
    publicRoomStartThreshold: 2,
    ffaTargetProgress: 10,
    tdmTargetProgress: 10,
    gameModeFfa: 'ffa',
    gameModeTdm: 'tdm',
    teamAlpha: 'alpha',
    teamBravo: 'bravo'
  }), true);
  assert.equal(room.matchState.startedAt, 99);
  assert.equal(room.matchState.teamBaselineSize.alpha, 1);
  assert.equal(room.matchState.teamBaselineSize.bravo, 1);

  const joiner = { id: 'u3', fixtureType: '', teamId: '', progressScore: 0 };
  room.players.set('u3', joiner);
  applyJoinBaseline(room, joiner, {
    gameModeFfa: 'ffa',
    gameModeTdm: 'tdm',
    teamAlpha: 'alpha',
    teamBravo: 'bravo'
  });
  assert.ok(joiner.teamId === 'alpha' || joiner.teamId === 'bravo');
});

test('public matches start immediately when the first human connects', () => {
  const room = {
    roomName: 'ffa-01',
    gameMode: 'ffa',
    players: new Map([
      ['u1', { id: 'u1', fixtureType: '', teamId: '', kills: 0, progressScore: 0 }]
    ]),
    matchState: emptyMatchState('ffa'),
    isPublicMatchRoom() { return true; },
    connectedHumanCount() { return 1; },
    initializeLmsMatchState() {}
  };

  assert.equal(startPublicMatchIfReady(room, {
    emptyMatchState,
    nowMs: () => 42,
    publicRoomStartThreshold: 1,
    ffaTargetProgress: 10,
    tdmTargetProgress: 10,
    gameModeFfa: 'ffa',
    gameModeTdm: 'tdm',
    teamAlpha: 'alpha',
    teamBravo: 'bravo'
  }), true);
  assert.equal(room.matchState.started, true);
  assert.equal(room.matchState.startedAt, 42);
  assert.equal(room.matchState.matchBaselinePlayerCount, 1);
});

test('leader, finish, elimination, and reset helpers preserve match outcomes', () => {
  const room = {
    roomName: 'ffa-01',
    gameMode: 'ffa',
    players: new Map([
      ['u1', { id: 'u1', fixtureType: '', progressScore: 2, kills: 2, deaths: 0 }],
      ['u2', { id: 'u2', fixtureType: '', progressScore: 1, kills: 1, deaths: 0 }]
    ]),
    matchState: Object.assign(emptyMatchState('ffa'), { started: true, targetProgress: 3 }),
    getEntityById(id) { return this.players.get(id) || null; },
    updateLeaderProgress() {
      return updateLeaderProgress(this, {
        gameModeFfa: 'ffa',
        teamAlpha: 'alpha',
        teamBravo: 'bravo'
      });
    },
    finishPublicMatch(winnerId, winnerTeam) {
      return finishPublicMatch(this, {
        nowMs: () => 500,
        matchResetDelayMs: 5000,
        gameModeFfa: 'ffa',
        gameModeTdm: 'tdm'
      }, winnerId, winnerTeam);
    },
    assignPlayerToCurrentTeam() { return 'alpha'; },
    isPublicMatchRoom() { return true; },
    startPublicMatchIfReadyCalled: 0,
    startPublicMatchIfReady() { this.startPublicMatchIfReadyCalled += 1; return true; },
    syncPrivateRoomMatchStateCalled: 0,
    syncPrivateRoomMatchState() { this.syncPrivateRoomMatchStateCalled += 1; }
  };

  room.updateLeaderProgress();
  assert.equal(room.matchState.leaderId, 'u1');

  recordElimination(room, {
    nowMs: () => 100,
    ffaTargetProgress: 3,
    tdmTargetProgress: 10,
    gameModeFfa: 'ffa',
    gameModeTdm: 'tdm'
  }, 'u1', 'u2');
  assert.equal(room.matchState.ended, true);
  assert.equal(room.matchState.winnerId, 'u1');

  room.matchState.ended = true;
  room.matchState.resetAt = 0;
  assert.equal(maybeResetPublicMatch(room, {
    emptyMatchState,
    isPrivateMatchRoom: () => false,
    nowMs: () => 1000,
    roomPhaseActive: 'active'
  }), true);
  assert.equal(room.startPublicMatchIfReadyCalled, 1);
  assert.equal(room.players.get('u1').kills, 0);
});

test('private room four-team tdm preserves assignments and scores the winning team', () => {
  let finishCall = null;
  const room = {
    roomName: 'private-room4',
    gameMode: 'ffa',
    privateRoomConfig: {
      roomMode: 'tdm',
      roomPhase: 'active',
      teamCount: 4,
      teamIds: ['alpha', 'bravo', 'charlie', 'delta'],
      teams: new Map([
        ['a1', 'alpha'],
        ['a2', 'charlie'],
        ['a3', 'delta']
      ])
    },
    players: new Map([
      ['u1', { id: 'u1', actorId: 'a1', fixtureType: '', teamId: '', progressScore: 0, kills: 0, deaths: 0 }],
      ['u2', { id: 'u2', actorId: 'a2', fixtureType: '', teamId: '', progressScore: 0, kills: 0, deaths: 0 }],
      ['u3', { id: 'u3', actorId: 'a3', fixtureType: '', teamId: '', progressScore: 0, kills: 0, deaths: 0 }]
    ]),
    getEntityById(id) { return this.players.get(id) || null; },
    assignPlayerToCurrentTeam(player) {
      return assignPlayerToCurrentTeam(this, player, {
        teamAlpha: 'alpha',
        teamBravo: 'bravo'
      });
    },
    updateLeaderProgress() {
      return updateLeaderProgress(this, {
        gameModeFfa: 'ffa',
        teamAlpha: 'alpha',
        teamBravo: 'bravo'
      });
    },
    finishPublicMatch(winnerId, winnerTeam) {
      finishCall = { winnerId, winnerTeam };
    }
  };

  syncPrivateRoomMatchState(room, {
    isPrivateMatchRoom: (roomName) => String(roomName).startsWith('private-'),
    emptyMatchState,
    nowMs: () => 50,
    gameModeFfa: 'ffa',
    gameModeTdm: 'tdm',
    teamAlpha: 'alpha'
  });

  assert.deepEqual(room.matchState.teamIds, ['alpha', 'bravo', 'charlie', 'delta']);
  assert.equal(room.players.get('u1').teamId, 'alpha');
  assert.equal(room.players.get('u2').teamId, 'charlie');
  assert.equal(room.players.get('u3').teamId, 'delta');

  room.matchState.targetProgress = 1;
  recordElimination(room, {
    nowMs: () => 100,
    ffaTargetProgress: 10,
    tdmTargetProgress: 1,
    gameModeFfa: 'ffa',
    gameModeTdm: 'tdm'
  }, 'u2', 'u1');

  assert.equal(room.matchState.teamProgress.charlie, 1);
  assert.deepEqual(finishCall, { winnerId: '', winnerTeam: 'charlie' });
});
