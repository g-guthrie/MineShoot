import test from 'node:test';
import assert from 'node:assert/strict';

import {
  applyPrivateRoomConfig,
  normalizePrivateRoomConfig,
  privateConfigEquals
} from '../../../cloudflare/server/room/RoomPrivateConfig.js';

test('private room config normalization clamps team setup and invalid assignments', () => {
  const config = normalizePrivateRoomConfig({
    roomMode: 'tdm',
    roomPhase: 'active',
    teamCount: 8,
    hostActorId: 'host-1',
    teams: [
      { actorId: 'a1', teamId: 'charlie' },
      { actorId: 'a2', teamId: 'unknown' }
    ]
  }, {
    roomPhaseActive: 'active',
    roomPhaseLobby: 'lobby',
    teamOrder: ['alpha', 'bravo', 'charlie', 'delta']
  });

  assert.equal(config.roomMode, 'tdm');
  assert.equal(config.roomPhase, 'active');
  assert.equal(config.teamCount, 4);
  assert.deepEqual(config.teamIds, ['alpha', 'bravo', 'charlie', 'delta']);
  assert.equal(config.teams.get('a1'), 'charlie');
  assert.equal(config.teams.get('a2'), 'alpha');
});

test('private room config equality includes team ids and assignments', () => {
  const left = normalizePrivateRoomConfig({
    roomMode: 'tdm',
    roomPhase: 'lobby',
    teamCount: 3,
    teams: [{ actorId: 'a1', teamId: 'charlie' }]
  }, {
    teamOrder: ['alpha', 'bravo', 'charlie', 'delta']
  });
  const right = normalizePrivateRoomConfig({
    roomMode: 'tdm',
    roomPhase: 'lobby',
    teamCount: 3,
    teams: [{ actorId: 'a1', teamId: 'charlie' }]
  }, {
    teamOrder: ['alpha', 'bravo', 'charlie', 'delta']
  });
  const changed = normalizePrivateRoomConfig({
    roomMode: 'tdm',
    roomPhase: 'lobby',
    teamCount: 4,
    teams: [{ actorId: 'a1', teamId: 'delta' }]
  }, {
    teamOrder: ['alpha', 'bravo', 'charlie', 'delta']
  });

  assert.equal(privateConfigEquals(left, right), true);
  assert.equal(privateConfigEquals(left, changed), false);
});

test('private room config apply hydrates team changes without resetting an active matching mode', () => {
  const player = { id: 'u1', actorId: 'actor-1', fixtureType: '', teamId: '' };
  const room = {
    roomName: 'private-room1',
    gameMode: 'tdm',
    matchState: { started: true },
    players: new Map([['u1', player]]),
    privateRoomConfig: normalizePrivateRoomConfig({
      roomMode: 'tdm',
      roomPhase: 'active',
      teamCount: 2
    }, {
      teamOrder: ['alpha', 'bravo', 'charlie', 'delta']
    }),
    syncPrivateRoomMatchStateCalled: 0,
    syncPrivateRoomMatchState() { this.syncPrivateRoomMatchStateCalled += 1; }
  };

  const changed = applyPrivateRoomConfig(room, {
    roomMode: 'tdm',
    roomPhase: 'active',
    syncMode: 'hydrate',
    teams: [{ actorId: 'actor-1', teamId: 'bravo' }]
  }, {
    isPrivateMatchRoom: (roomName) => String(roomName).startsWith('private-'),
    roomPhaseActive: 'active',
    roomPhaseLobby: 'lobby',
    teamOrder: ['alpha', 'bravo', 'charlie', 'delta']
  });

  assert.equal(changed, true);
  assert.equal(room.syncPrivateRoomMatchStateCalled, 0);
  assert.equal(player.teamId, 'bravo');
});

test('private room config apply falls back to full room sync when the match mode changes', () => {
  const room = {
    roomName: 'private-room1',
    gameMode: 'ffa',
    matchState: { started: false },
    players: new Map(),
    privateRoomConfig: normalizePrivateRoomConfig({
      roomMode: 'ffa',
      roomPhase: 'lobby'
    }, {
      teamOrder: ['alpha', 'bravo', 'charlie', 'delta']
    }),
    syncPrivateRoomMatchStateCalled: 0,
    syncPrivateRoomMatchState() { this.syncPrivateRoomMatchStateCalled += 1; }
  };

  const changed = applyPrivateRoomConfig(room, {
    roomMode: 'tdm',
    roomPhase: 'active',
    teamCount: 3
  }, {
    isPrivateMatchRoom: (roomName) => String(roomName).startsWith('private-'),
    roomPhaseActive: 'active',
    roomPhaseLobby: 'lobby',
    teamOrder: ['alpha', 'bravo', 'charlie', 'delta']
  });

  assert.equal(changed, true);
  assert.equal(room.syncPrivateRoomMatchStateCalled, 1);
});

test('private room config apply fully resets when a finished match is restarted from the lobby', () => {
  const room = {
    roomName: 'private-room1',
    gameMode: 'tdm',
    matchState: { started: true, ended: true },
    players: new Map(),
    privateRoomConfig: normalizePrivateRoomConfig({
      roomMode: 'tdm',
      roomPhase: 'lobby',
      teamCount: 2
    }, {
      teamOrder: ['alpha', 'bravo', 'charlie', 'delta']
    }),
    syncPrivateRoomMatchStateCalled: 0,
    syncPrivateRoomMatchState() { this.syncPrivateRoomMatchStateCalled += 1; }
  };

  const changed = applyPrivateRoomConfig(room, {
    roomMode: 'tdm',
    roomPhase: 'active',
    syncMode: 'hydrate'
  }, {
    isPrivateMatchRoom: (roomName) => String(roomName).startsWith('private-'),
    roomPhaseActive: 'active',
    roomPhaseLobby: 'lobby',
    teamOrder: ['alpha', 'bravo', 'charlie', 'delta']
  });

  assert.equal(changed, true);
  assert.equal(room.syncPrivateRoomMatchStateCalled, 1);
});
