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
    stockMode: gameMode === 'ffa',
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
      ['u1', { id: 'u1', actorId: 'a1', fixtureType: '', teamId: '', progressScore: 5, kills: 2, deaths: 1, hp: 10, hpMax: 100, armor: 3, armorMax: 40, alive: false, respawnAt: 99 }],
      ['u2', { id: 'u2', actorId: 'a2', fixtureType: '', teamId: '', progressScore: 7, kills: 1, deaths: 2, hp: 12, hpMax: 100, armor: 4, armorMax: 40, alive: false, respawnAt: 88 }]
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
  assert.equal(room.players.get('u1').kills, 0);
  assert.equal(room.players.get('u1').deaths, 0);
  assert.equal(room.players.get('u1').hp, 100);
  assert.equal(room.players.get('u1').armor, 40);
  assert.equal(room.players.get('u1').alive, true);
  assert.equal(room.players.get('u1').respawnAt, 0);
});

test('public match helpers start tdm and assign the lighter team on join baseline', () => {
  const room = {
    roomName: 'tdm-01',
    gameMode: 'tdm',
    players: new Map([
      ['u1', { id: 'u1', fixtureType: '', teamId: 'alpha', kills: 4, deaths: 2, progressScore: 4, hp: 15, hpMax: 100, armor: 2, armorMax: 40, alive: false, respawnAt: 77 }],
      ['u2', { id: 'u2', fixtureType: '', teamId: '', kills: 2, deaths: 3, progressScore: 2, hp: 16, hpMax: 100, armor: 3, armorMax: 40, alive: false, respawnAt: 66 }]
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
  assert.equal(room.players.get('u1').kills, 0);
  assert.equal(room.players.get('u1').deaths, 0);
  assert.equal(room.players.get('u1').progressScore, 0);
  assert.equal(room.players.get('u1').hp, 100);
  assert.equal(room.players.get('u1').armor, 40);
  assert.equal(room.players.get('u1').alive, true);
  assert.equal(room.players.get('u1').respawnAt, 0);

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

test('public FFA still starts with one human but does not auto-win without a kill', () => {
  const room = {
    roomName: 'ffa-01',
    gameMode: 'ffa',
    players: new Map([
      ['u1', { id: 'u1', fixtureType: '', teamId: '', kills: 0, progressScore: 0, eliminated: false }]
    ]),
    matchState: emptyMatchState('ffa'),
    isPublicMatchRoom() { return true; },
    connectedHumanCount() { return 1; },
    initializeLmsMatchState() {},
    finishPublicMatchCalled: 0,
    finishPublicMatch(winnerId, winnerTeam) {
      this.finishPublicMatchCalled += 1;
      return finishPublicMatch(this, {
        nowMs: () => 84,
        matchResetDelayMs: 5000,
        gameModeFfa: 'ffa',
        gameModeTdm: 'tdm'
      }, winnerId, winnerTeam);
    }
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

  updateLeaderProgress(room, {
    gameModeFfa: 'ffa',
    teamAlpha: 'alpha',
    teamBravo: 'bravo'
  });
  assert.equal(room.matchState.ended, false);
  assert.equal(room.finishPublicMatchCalled, 0);

  room.players.get('u1').kills = 1;
  room.players.get('u1').progressScore = 1;
  updateLeaderProgress(room, {
    gameModeFfa: 'ffa',
    teamAlpha: 'alpha',
    teamBravo: 'bravo'
  });
  assert.equal(room.matchState.ended, true);
  assert.equal(room.matchState.winnerId, 'u1');
  assert.equal(room.finishPublicMatchCalled, 1);
});

test('public FFA ends with a forfeit win when the field thins without the survivor scoring', () => {
  const room = {
    roomName: 'ffa-01',
    gameMode: 'ffa',
    players: new Map([
      ['u1', { id: 'u1', fixtureType: '', teamId: '', kills: 0, progressScore: 0, eliminated: false }]
    ]),
    matchState: Object.assign(emptyMatchState('ffa'), { started: true, matchBaselinePlayerCount: 2 }),
    isPublicMatchRoom() { return true; },
    connectedHumanCount() { return 1; },
    finishPublicMatchCalled: 0,
    finishPublicMatch(winnerId, winnerTeam) {
      this.finishPublicMatchCalled += 1;
      return finishPublicMatch(this, {
        nowMs: () => 84,
        matchResetDelayMs: 5000,
        gameModeFfa: 'ffa',
        gameModeTdm: 'tdm'
      }, winnerId, winnerTeam);
    }
  };

  updateLeaderProgress(room, {
    gameModeFfa: 'ffa',
    teamAlpha: 'alpha',
    teamBravo: 'bravo'
  });
  assert.equal(room.matchState.ended, true);
  assert.equal(room.matchState.winnerId, 'u1');
  assert.equal(room.finishPublicMatchCalled, 1);
});

test('public FFA ends on mutual elimination with the top-kills player as winner', () => {
  const room = {
    roomName: 'ffa-01',
    gameMode: 'ffa',
    players: new Map([
      ['u1', { id: 'u1', fixtureType: '', teamId: '', kills: 2, progressScore: 2, eliminated: true }],
      ['u2', { id: 'u2', fixtureType: '', teamId: '', kills: 3, progressScore: 3, eliminated: true }]
    ]),
    matchState: Object.assign(emptyMatchState('ffa'), { started: true, matchBaselinePlayerCount: 2 }),
    isPublicMatchRoom() { return true; },
    connectedHumanCount() { return 2; },
    finishPublicMatchCalled: 0,
    finishPublicMatch(winnerId, winnerTeam) {
      this.finishPublicMatchCalled += 1;
      return finishPublicMatch(this, {
        nowMs: () => 84,
        matchResetDelayMs: 5000,
        gameModeFfa: 'ffa',
        gameModeTdm: 'tdm'
      }, winnerId, winnerTeam);
    }
  };

  updateLeaderProgress(room, {
    gameModeFfa: 'ffa',
    teamAlpha: 'alpha',
    teamBravo: 'bravo'
  });
  assert.equal(room.matchState.ended, true);
  assert.equal(room.matchState.winnerId, 'u2');
  assert.equal(room.finishPublicMatchCalled, 1);
});

test('public FFA mutual elimination with no kills ends in a draw, never crowning a pending joiner', () => {
  const room = {
    roomName: 'ffa-01',
    gameMode: 'ffa',
    players: new Map([
      ['u1', { id: 'u1', fixtureType: '', teamId: '', kills: 0, progressScore: 0, eliminated: true }],
      ['u2', { id: 'u2', fixtureType: '', teamId: '', kills: 0, progressScore: 0, eliminated: true }],
      // 0-kill joiner still in the invulnerable entry window: must not win.
      ['u3', { id: 'u3', fixtureType: '', teamId: '', kills: 0, progressScore: 0, eliminated: false, pending: true }]
    ]),
    matchState: Object.assign(emptyMatchState('ffa'), { started: true, matchBaselinePlayerCount: 3 }),
    isEntityMatchEntryPending(player) { return !!(player && player.pending); },
    isPublicMatchRoom() { return true; },
    connectedHumanCount() { return 3; },
    finishPublicMatchCalled: 0,
    finishPublicMatch(winnerId, winnerTeam) {
      this.finishPublicMatchCalled += 1;
      return finishPublicMatch(this, {
        nowMs: () => 84,
        matchResetDelayMs: 5000,
        gameModeFfa: 'ffa',
        gameModeTdm: 'tdm'
      }, winnerId, winnerTeam);
    }
  };

  updateLeaderProgress(room, {
    gameModeFfa: 'ffa',
    teamAlpha: 'alpha',
    teamBravo: 'bravo'
  });
  assert.equal(room.matchState.ended, true);
  assert.equal(room.matchState.winnerId, '');
  assert.equal(room.finishPublicMatchCalled, 1);
});

test('public FFA mutual elimination ignores pending joiners when picking the top-kills winner', () => {
  const room = {
    roomName: 'ffa-01',
    gameMode: 'ffa',
    players: new Map([
      ['u1', { id: 'u1', fixtureType: '', teamId: '', kills: 2, progressScore: 2, eliminated: true }],
      ['u2', { id: 'u2', fixtureType: '', teamId: '', kills: 0, progressScore: 0, eliminated: true }],
      ['u3', { id: 'u3', fixtureType: '', teamId: '', kills: 0, progressScore: 0, eliminated: false, pending: true }]
    ]),
    matchState: Object.assign(emptyMatchState('ffa'), { started: true, matchBaselinePlayerCount: 3 }),
    isEntityMatchEntryPending(player) { return !!(player && player.pending); },
    isPublicMatchRoom() { return true; },
    connectedHumanCount() { return 3; },
    finishPublicMatchCalled: 0,
    finishPublicMatch(winnerId, winnerTeam) {
      this.finishPublicMatchCalled += 1;
      return finishPublicMatch(this, {
        nowMs: () => 84,
        matchResetDelayMs: 5000,
        gameModeFfa: 'ffa',
        gameModeTdm: 'tdm'
      }, winnerId, winnerTeam);
    }
  };

  updateLeaderProgress(room, {
    gameModeFfa: 'ffa',
    teamAlpha: 'alpha',
    teamBravo: 'bravo'
  });
  assert.equal(room.matchState.ended, true);
  assert.equal(room.matchState.winnerId, 'u1');
  assert.equal(room.finishPublicMatchCalled, 1);
});

test('public FFA match baseline includes bot-filled participants', () => {
  const room = {
    roomName: 'ffa-01',
    gameMode: 'ffa',
    players: new Map([
      ['u1', { id: 'u1', fixtureType: '', kills: 0, progressScore: 0, eliminated: false, hp: 100, hpMax: 100, armor: 40, armorMax: 40, alive: true }],
      ['public-bot-01', { id: 'public-bot-01', fixtureType: 'public_bot', kills: 0, progressScore: 0, eliminated: false, hp: 100, hpMax: 100, armor: 40, armorMax: 40, alive: true }],
      ['public-bot-02', { id: 'public-bot-02', fixtureType: 'public_bot', kills: 0, progressScore: 0, eliminated: false, hp: 100, hpMax: 100, armor: 40, armorMax: 40, alive: true }]
    ]),
    matchState: emptyMatchState('ffa'),
    isPublicMatchRoom() { return true; },
    connectedHumanCount() { return 1; },
    publicParticipantCount() { return 3; },
    syncPublicMatchBotsCalled: 0,
    syncPublicMatchBots() { this.syncPublicMatchBotsCalled += 1; }
  };

  assert.equal(startPublicMatchIfReady(room, {
    emptyMatchState,
    nowMs: () => 55,
    publicRoomStartThreshold: 1,
    ffaTargetProgress: 10,
    tdmTargetProgress: 10,
    gameModeFfa: 'ffa',
    gameModeTdm: 'tdm',
    teamAlpha: 'alpha',
    teamBravo: 'bravo'
  }), true);

  assert.equal(room.syncPublicMatchBotsCalled, 1);
  assert.equal(room.matchState.aliveCount, 3);
  assert.equal(room.matchState.matchBaselinePlayerCount, 3);
});

test('leader, finish, elimination, and reset helpers preserve match outcomes', () => {
  const room = {
    roomName: 'ffa-01',
    gameMode: 'ffa',
    players: new Map([
      ['u1', { id: 'u1', fixtureType: '', progressScore: 2, kills: 2, deaths: 0 }],
      ['u2', { id: 'u2', fixtureType: '', progressScore: 1, kills: 1, deaths: 0 }]
    ]),
    matchState: Object.assign(emptyMatchState('ffa'), { started: true, stockMode: false, targetProgress: 3 }),
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

test('TDM kill value tracks the live team size after a mid-match join', () => {
  const room = {
    gameMode: 'tdm',
    matchState: Object.assign(emptyMatchState('tdm'), {
      started: true,
      targetProgress: 10,
      teamProgress: { alpha: 0, bravo: 0 },
      teamBaselineSize: { alpha: 1, bravo: 1 }
    }),
    players: new Map([
      ['u1', { id: 'u1', fixtureType: '', teamId: 'alpha', kills: 0, deaths: 0, progressScore: 0 }],
      ['u2', { id: 'u2', fixtureType: '', teamId: 'alpha', kills: 0, deaths: 0, progressScore: 0 }],
      ['u3', { id: 'u3', fixtureType: '', teamId: 'bravo', kills: 0, deaths: 0, progressScore: 0 }]
    ]),
    getEntityById(id) { return this.players.get(id) || null; },
    assignPlayerToCurrentTeam(player) {
      return assignPlayerToCurrentTeam(this, player, {
        teamAlpha: 'alpha',
        teamBravo: 'bravo'
      });
    },
    updateLeaderProgress() {},
    finishPublicMatch() {}
  };

  recordElimination(room, {
    nowMs: () => 100,
    gameModeFfa: 'ffa',
    gameModeTdm: 'tdm',
    tdmTargetProgress: 10
  }, 'u1', 'u3');

  // alpha has two live members even though its start-of-match baseline was 1.
  assert.equal(room.matchState.teamProgress.alpha, 0.5);
  assert.equal(room.matchState.teamBaselineSize.alpha, 2);
  assert.equal(room.players.get('u1').progressScore, 0.5);
  assert.equal(room.players.get('u2').progressScore, 0.5);
});

test('TDM kill value keeps the match-start baseline when team members leave', () => {
  const room = {
    gameMode: 'tdm',
    matchState: Object.assign(emptyMatchState('tdm'), {
      started: true,
      targetProgress: 10,
      teamProgress: { alpha: 0, bravo: 0 },
      teamBaselineSize: { alpha: 3, bravo: 3 }
    }),
    // Two of alpha's three starters have left the room.
    players: new Map([
      ['u1', { id: 'u1', fixtureType: '', teamId: 'alpha', kills: 0, deaths: 0, progressScore: 0 }],
      ['u4', { id: 'u4', fixtureType: '', teamId: 'bravo', kills: 0, deaths: 0, progressScore: 0 }]
    ]),
    getEntityById(id) { return this.players.get(id) || null; },
    assignPlayerToCurrentTeam(player) {
      return assignPlayerToCurrentTeam(this, player, {
        teamAlpha: 'alpha',
        teamBravo: 'bravo'
      });
    },
    updateLeaderProgress() {},
    finishPublicMatch() {}
  };

  recordElimination(room, {
    nowMs: () => 100,
    gameModeFfa: 'ffa',
    gameModeTdm: 'tdm',
    tdmTargetProgress: 10
  }, 'u1', 'u4');

  // The divisor never shrinks below the match-start size, so a thinned team
  // does not score faster per kill.
  assert.equal(room.matchState.teamBaselineSize.alpha, 3);
  assert.equal(room.matchState.teamProgress.alpha, Number((1 / 3).toFixed(3)));
});

test('TDM kill value ignores pending-entry joiners in the divisor', () => {
  const room = {
    gameMode: 'tdm',
    matchState: Object.assign(emptyMatchState('tdm'), {
      started: true,
      targetProgress: 10,
      teamProgress: { alpha: 0, bravo: 0 },
      teamBaselineSize: { alpha: 1, bravo: 1 }
    }),
    players: new Map([
      ['u1', { id: 'u1', fixtureType: '', teamId: 'alpha', kills: 0, deaths: 0, progressScore: 0 }],
      // Invulnerable, unspawned joiner still inside the entry window.
      ['u2', { id: 'u2', fixtureType: '', teamId: 'alpha', kills: 0, deaths: 0, progressScore: 0, pending: true }],
      ['u3', { id: 'u3', fixtureType: '', teamId: 'bravo', kills: 0, deaths: 0, progressScore: 0 }]
    ]),
    isEntityMatchEntryPending(player) { return !!(player && player.pending); },
    getEntityById(id) { return this.players.get(id) || null; },
    assignPlayerToCurrentTeam(player) {
      return assignPlayerToCurrentTeam(this, player, {
        teamAlpha: 'alpha',
        teamBravo: 'bravo'
      });
    },
    updateLeaderProgress() {},
    finishPublicMatch() {}
  };

  recordElimination(room, {
    nowMs: () => 100,
    gameModeFfa: 'ffa',
    gameModeTdm: 'tdm',
    tdmTargetProgress: 10
  }, 'u1', 'u3');

  assert.equal(room.matchState.teamBaselineSize.alpha, 1);
  assert.equal(room.matchState.teamProgress.alpha, 1);
});

test('TDM eliminations ignore same-team targets', () => {
  const room = {
    gameMode: 'tdm',
    matchState: Object.assign(emptyMatchState('tdm'), {
      started: true,
      targetProgress: 1,
      teamProgress: { alpha: 0, bravo: 0 },
      teamBaselineSize: { alpha: 1, bravo: 1 }
    }),
    players: new Map([
      ['u1', { id: 'u1', fixtureType: '', teamId: 'alpha', kills: 0, deaths: 0, progressScore: 0 }],
      ['u2', { id: 'u2', fixtureType: '', teamId: 'alpha', kills: 0, deaths: 0, progressScore: 0 }]
    ]),
    getEntityById(id) { return this.players.get(id) || null; },
    assignPlayerToCurrentTeam(player) {
      return assignPlayerToCurrentTeam(this, player, {
        teamAlpha: 'alpha',
        teamBravo: 'bravo'
      });
    },
    updateLeaderProgress() {},
    finishPublicMatch() {
      throw new Error('same-team elimination should not finish the match');
    }
  };

  recordElimination(room, {
    nowMs: () => 100,
    gameModeFfa: 'ffa',
    gameModeTdm: 'tdm',
    tdmTargetProgress: 1
  }, 'u1', 'u2');

  assert.equal(room.players.get('u1').kills, 0);
  assert.equal(room.players.get('u2').deaths, 0);
  assert.equal(room.matchState.teamProgress.alpha, 0);
});

test('private room reset stays in the lobby once the room phase has already dropped back from active', () => {
  const room = {
    roomName: 'private-room1',
    gameMode: 'tdm',
    players: new Map([
      ['u1', { id: 'u1', fixtureType: '', kills: 3, deaths: 1, teamId: 'alpha', progressScore: 3 }]
    ]),
    matchState: Object.assign(emptyMatchState('tdm'), {
      started: true,
      ended: true,
      endedAt: 100,
      resetAt: 100
    }),
    privateRoomConfig: {
      roomMode: 'tdm',
      roomPhase: 'lobby'
    },
    isPublicMatchRoom() { return false; },
    spawnEntityRandomly() {},
    applySpawnShield() {},
    startPublicMatchIfReadyCalled: 0,
    startPublicMatchIfReady() {
      this.startPublicMatchIfReadyCalled += 1;
      return false;
    },
    syncPrivateRoomMatchStateCalled: 0,
    syncPrivateRoomMatchState() {
      this.syncPrivateRoomMatchStateCalled += 1;
    }
  };

  const changed = maybeResetPublicMatch(room, {
    emptyMatchState,
    isPrivateMatchRoom: (roomName) => String(roomName).startsWith('private-'),
    nowMs: () => 200,
    roomPhaseActive: 'active'
  });

  assert.equal(changed, true);
  assert.equal(room.matchState.ended, false);
  assert.equal(room.matchState.started, false);
  assert.equal(room.startPublicMatchIfReadyCalled, 1);
  assert.equal(room.syncPrivateRoomMatchStateCalled, 0);
});
