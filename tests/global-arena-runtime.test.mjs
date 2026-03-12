import test from 'node:test';
import assert from 'node:assert/strict';

import { GlobalArenaRuntime } from '../cloudflare/server/room/runtime/GlobalArenaRuntime.mjs';

test('global arena runtime owns welcome, ping, and room state flow', () => {
  const broadcasts = [];
  const runtime = new GlobalArenaRuntime({
    roomName: 'ffa-01',
    broadcast(payload) {
      broadcasts.push(payload);
    }
  });

  runtime.ensurePlayer('user-1', 'Alice');

  const welcome = runtime.handleClientMessage('user-1', { t: 'join_room' });
  const pong = runtime.handleClientMessage('user-1', { t: 'ping', clientTime: 77 });
  const roomState = runtime.buildRoomState(['user-1']);

  assert.equal(welcome.t, 'welcome');
  assert.equal(welcome.selfId, 'user-1');
  assert.equal(welcome.roomId, 'ffa-01');
  assert.equal(pong.t, 'pong');
  assert.equal(pong.clientTime, 77);
  assert.equal(roomState.connectedPlayers, 1);
  assert.equal(broadcasts.length, 0);
});

test('global arena runtime applies authoritative fire and emits damage events', () => {
  const broadcasts = [];
  const runtime = new GlobalArenaRuntime({
    roomName: 'ffa-01',
    broadcast(payload) {
      broadcasts.push(payload);
    }
  });

  const attacker = runtime.ensurePlayer('user-1', 'Alice');
  const target = runtime.ensurePlayer('user-2', 'Bob');
  attacker.spawnShieldUntil = 0;
  target.spawnShieldUntil = 0;
  attacker.x = 10;
  attacker.y = 1.6;
  attacker.z = 10;
  target.x = 12;
  target.y = 1.6;
  target.z = 10;

  runtime.handleClientMessage('user-1', {
    t: 'fire',
    targetId: 'user-2',
    hitType: 'body',
    shotToken: 'shot-1'
  });

  assert.equal(broadcasts.length, 1);
  assert.equal(broadcasts[0].t, 'damage_event');
  assert.equal(broadcasts[0].sourceId, 'user-1');
  assert.equal(broadcasts[0].targetId, 'user-2');
  assert.equal(broadcasts[0].shotToken, 'shot-1');
});
