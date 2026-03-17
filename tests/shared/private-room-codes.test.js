import test from 'node:test';
import assert from 'node:assert/strict';

import {
  normalizePrivateRoomId,
  privateRoomCodeFromId,
  privateRoomIdFromCode
} from '../../shared/private-room-codes.js';

test('private room code helpers keep blank or public-room values empty', () => {
  assert.equal(privateRoomIdFromCode(''), '');
  assert.equal(privateRoomCodeFromId(''), '');
  assert.equal(privateRoomCodeFromId('global'), '');
  assert.equal(normalizePrivateRoomId(''), '');
  assert.equal(normalizePrivateRoomId('global'), '');
});

test('private room code helpers normalize valid room codes and ids', () => {
  assert.equal(privateRoomIdFromCode('room1'), 'private-room1');
  assert.equal(privateRoomCodeFromId('private-room1'), 'ROOM1');
  assert.equal(normalizePrivateRoomId('ROOM1'), 'private-room1');
});
