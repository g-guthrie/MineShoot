import test from 'node:test';
import assert from 'node:assert/strict';

import {
  resolveGameplayWsIdentity,
  resolveLobbyWsIdentity
} from '../../cloudflare/server/ws-identity.js';

function buildUrl(path) {
  return new URL(`https://example.test${path}`);
}

test('gameplay websocket identity keeps authenticated player ids server-owned', () => {
  const identity = resolveGameplayWsIdentity({
    session: {
      userId: 'usr_alpha',
      username: 'ALPHA',
      displayName: 'Alpha Prime',
      classId: 'abilities'
    },
    url: buildUrl('/api/ws?pid=ply_override_1&username=REQUESTED&classId=sniper&actorId=guest-actor&actorName=REQUEST_ACTOR'),
    classPresets: { abilities: {}, sniper: {} }
  });

  assert.equal(identity.isAuthenticated, true);
  assert.equal(identity.playerId, 'usr_alpha');
  assert.equal(identity.playerName, 'REQUESTED');
  assert.equal(identity.playerClassId, 'sniper');
  assert.equal(identity.actorId, 'usr_alpha');
  assert.equal(identity.actorName, 'REQUEST_ACTOR');
});

test('gameplay websocket identity preserves valid guest pid values', () => {
  const identity = resolveGameplayWsIdentity({
    session: null,
    url: buildUrl('/api/ws?pid=usr_join_alpha_hitafc&uid=amber-otter-314&username=JOIN_ALPHA&classId=abilities&actorId=actor-1&actorName=JOIN_ALPHA'),
    classPresets: { abilities: {} }
  });

  assert.equal(identity.isAuthenticated, false);
  assert.equal(identity.playerId, 'usr_join_alpha_hitafc');
  assert.equal(identity.playerName, 'JOIN_ALPHA');
  assert.equal(identity.playerClassId, 'abilities');
  assert.equal(identity.actorId, 'actor-1');
  assert.equal(identity.actorName, 'JOIN_ALPHA');
});

test('gameplay websocket identity uses readable guest uid as the fallback before minting', () => {
  const identity = resolveGameplayWsIdentity({
    session: null,
    url: buildUrl('/api/ws?uid=amber-otter-314'),
    classPresets: {}
  });

  assert.equal(identity.playerId, 'amber-otter-314');
  assert.equal(identity.playerName, 'AMBER-OTTER-314');
  assert.equal(identity.mintedGuestId, '');
});

test('gameplay websocket identity mints a readable guest id when guest pid and uid are unusable', () => {
  const identity = resolveGameplayWsIdentity({
    session: null,
    url: buildUrl('/api/ws?pid=bad!&uid=still-bad!'),
    classPresets: {},
    randomFn: () => 0
  });

  assert.equal(identity.playerId, 'amber-badger-000');
  assert.equal(identity.playerName, 'AMBER-BADGER-000');
  assert.equal(identity.mintedGuestId, 'amber-badger-000');
});

test('lobby websocket identity uses the authenticated actor id over the query actor id', () => {
  const identity = resolveLobbyWsIdentity({
    session: {
      userId: 'usr_lobby_alpha',
      username: 'ALPHA'
    },
    url: buildUrl('/api/ws/lobby?room=private-abcd&actorId=actor-override&actorName=REQUESTED')
  });

  assert.equal(identity.actorId, 'usr_lobby_alpha');
  assert.equal(identity.actorName, 'REQUESTED');
});
