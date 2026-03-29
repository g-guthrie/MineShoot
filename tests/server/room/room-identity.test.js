import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEV_LOCAL_ROOM_NAME,
  createDefaultPrivateRoomConfig,
  detectGameMode,
  emptyMatchState,
  isPrivateMatchRoom,
  isPublicMatchRoom
} from '../../../cloudflare/server/room/RoomIdentity.js';

test('room identity helpers derive room modes and default private room state', () => {
  assert.equal(detectGameMode('ffa-01'), 'ffa');
  assert.equal(detectGameMode('tdm-01'), 'tdm');
  assert.equal(detectGameMode('sandbox'), '');
  assert.equal(isPublicMatchRoom('ffa-01'), true);
  assert.equal(isPublicMatchRoom('sandbox'), false);
  assert.equal(isPrivateMatchRoom('private-room1'), true);
  assert.equal(isPrivateMatchRoom('ffa-01'), false);

  const config = createDefaultPrivateRoomConfig({
    roomPhaseActive: 'active',
    teamOrder: ['alpha', 'bravo', 'charlie', 'delta']
  });
  assert.deepEqual(config.teamIds, ['alpha', 'bravo']);
  assert.equal(config.teamCount, 2);
  assert.equal(config.roomPhase, 'active');
  assert.equal(config.teams.size, 0);
});

test('room identity empty match state uses the shared match defaults', () => {
  const ffa = emptyMatchState('ffa', { teamAlpha: 'alpha', teamBravo: 'bravo' });
  const tdm = emptyMatchState('tdm', { teamAlpha: 'alpha', teamBravo: 'bravo' });

  assert.equal(ffa.gameMode, 'ffa');
  assert.deepEqual(ffa.teamIds, []);
  assert.equal(tdm.gameMode, 'tdm');
  assert.deepEqual(tdm.teamIds, ['alpha', 'bravo']);
  assert.deepEqual(tdm.teamProgress, { alpha: 0, bravo: 0 });
});
