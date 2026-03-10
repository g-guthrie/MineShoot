import test from 'node:test';
import assert from 'node:assert/strict';

import { handleRoomSocketMessage, handleRoomSocketClose } from '../cloudflare/server/room/RoomSocket.js';

function createSocket() {
  return {
    attachment: null,
    deserializeAttachment() {
      return this.attachment;
    }
  };
}

test('room socket message replays welcome payload for join-room', () => {
  const ws = createSocket();
  const sent = [];
  const room = {
    roomName: 'global',
    privateRoomConfig: { roomPhase: 'active' },
    clients: new Map([[ws, { userId: 'u1' }]]),
    activeSocketByUserId: new Map([['u1', ws]]),
    players: new Map([['u1', { id: 'u1' }]]),
    send(target, payload) { sent.push({ target, payload }); },
    buildWelcomePayload(userId) { return { t: 'welcome', selfId: userId }; }
  };

  handleRoomSocketMessage(room, ws, JSON.stringify({ t: 'join_room' }), {
    safeJsonParse: JSON.parse,
    nowMs: () => 123,
    isPrivateMatchRoom: () => false,
    roomPhaseActive: 'active',
    msgC2s: { JOIN_ROOM: 'join_room', PING: 'ping' },
    msgS2c: { PONG: 'pong' }
  });

  assert.deepEqual(sent, [{ target: ws, payload: { t: 'welcome', selfId: 'u1' } }]);
});

test('room socket message blocks live actions while a private room is still in lobby', () => {
  const ws = createSocket();
  let fireCount = 0;
  const room = {
    roomName: 'private-room1',
    privateRoomConfig: { roomPhase: 'lobby' },
    clients: new Map([[ws, { userId: 'u1' }]]),
    activeSocketByUserId: new Map([['u1', ws]]),
    players: new Map([['u1', { id: 'u1' }]]),
    handleFire() { fireCount += 1; },
    send() {}
  };

  handleRoomSocketMessage(room, ws, JSON.stringify({ t: 'fire' }), {
    safeJsonParse: JSON.parse,
    nowMs: () => 123,
    isPrivateMatchRoom: (roomName) => String(roomName).startsWith('private-'),
    roomPhaseActive: 'active',
    msgC2s: { FIRE: 'fire', PING: 'ping' },
    msgS2c: { PONG: 'pong' }
  });

  assert.equal(fireCount, 0);
});

test('room socket message answers ping and ignores stale sockets', () => {
  const activeWs = createSocket();
  const staleWs = createSocket();
  const sent = [];
  const room = {
    roomName: 'global',
    privateRoomConfig: { roomPhase: 'active' },
    clients: new Map([
      [activeWs, { userId: 'u1' }],
      [staleWs, { userId: 'u1' }]
    ]),
    activeSocketByUserId: new Map([['u1', activeWs]]),
    players: new Map([['u1', { id: 'u1' }]]),
    send(target, payload) { sent.push({ target, payload }); }
  };

  handleRoomSocketMessage(room, staleWs, JSON.stringify({ t: 'ping', clientTime: 55 }), {
    safeJsonParse: JSON.parse,
    nowMs: () => 777,
    isPrivateMatchRoom: () => false,
    roomPhaseActive: 'active',
    msgC2s: { PING: 'ping' },
    msgS2c: { PONG: 'pong' }
  });
  handleRoomSocketMessage(room, activeWs, JSON.stringify({ t: 'ping', clientTime: 55 }), {
    safeJsonParse: JSON.parse,
    nowMs: () => 777,
    isPrivateMatchRoom: () => false,
    roomPhaseActive: 'active',
    msgC2s: { PING: 'ping' },
    msgS2c: { PONG: 'pong' }
  });

  assert.deepEqual(sent, [{ target: activeWs, payload: { t: 'pong', clientTime: 55, serverTime: 777 } }]);
});

test('room socket close promotes a replacement socket or marks the player disconnected', () => {
  const closing = createSocket();
  const replacement = createSocket();
  const room = {
    clients: new Map([
      [closing, { userId: 'u1' }],
      [replacement, { userId: 'u1' }]
    ]),
    activeSocketByUserId: new Map([['u1', closing]]),
    players: new Map([['u1', { id: 'u1', disconnectedAt: 10 }]]),
    stopTickCalls: 0,
    stopTickIfEmpty() { this.stopTickCalls += 1; }
  };

  handleRoomSocketClose(room, closing, {
    nowMs: () => 999,
    findSocketForUserId(clients, userId, excludeWs) {
      for (const [ws, meta] of clients.entries()) {
        if (ws === excludeWs) continue;
        if (meta.userId === userId) return ws;
      }
      return null;
    }
  });

  assert.equal(room.activeSocketByUserId.get('u1'), replacement);
  assert.equal(room.players.get('u1').disconnectedAt, 0);
  assert.equal(room.stopTickCalls, 1);

  handleRoomSocketClose(room, replacement, {
    nowMs: () => 1234,
    findSocketForUserId() { return null; }
  });

  assert.equal(room.activeSocketByUserId.has('u1'), false);
  assert.equal(room.players.get('u1').disconnectedAt, 1234);
  assert.equal(room.stopTickCalls, 2);
});
