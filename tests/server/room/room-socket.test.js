import test from 'node:test';
import assert from 'node:assert/strict';

import { handleRoomSocketMessage, handleRoomSocketClose } from '../../../cloudflare/server/room/RoomSocket.js';

function createSocket() {
  return {
    attachment: null,
    closeCalls: [],
    deserializeAttachment() {
      return this.attachment;
    },
    close(code, reason) {
      this.closeCalls.push({ code, reason });
    }
  };
}

test('room socket ignores legacy join-room messages', () => {
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
    msgC2s: { PING: 'ping' },
    msgS2c: { PONG: 'pong' }
  });

  assert.deepEqual(sent, []);
});

test('room socket ignores legacy leave-room messages', () => {
  const ws = createSocket();
  const room = {
    clients: new Map([[ws, { userId: 'u1' }]]),
    activeSocketByUserId: new Map([['u1', ws]]),
    players: new Map([['u1', { id: 'u1' }]]),
    snapshots: [],
    stopTickCalls: 0,
    broadcastSnapshot(forceFull) { this.snapshots.push(forceFull); },
    stopTickIfEmpty() { this.stopTickCalls += 1; }
  };

  handleRoomSocketMessage(room, ws, JSON.stringify({ t: 'leave_room' }), {
    safeJsonParse: JSON.parse,
    nowMs: () => 123,
    isPrivateMatchRoom: () => false,
    roomPhaseActive: 'active',
    msgC2s: { PING: 'ping' },
    msgS2c: { PONG: 'pong' }
  });

  assert.equal(room.clients.has(ws), true);
  assert.equal(room.activeSocketByUserId.has('u1'), true);
  assert.equal(room.players.has('u1'), true);
  assert.deepEqual(room.snapshots, []);
  assert.equal(room.stopTickCalls, 0);
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

test('room socket message forwards reload commands when live gameplay is allowed', () => {
  const ws = createSocket();
  const reloads = [];
  const room = {
    roomName: 'global',
    privateRoomConfig: { roomPhase: 'active' },
    clients: new Map([[ws, { userId: 'u1' }]]),
    activeSocketByUserId: new Map([['u1', ws]]),
    players: new Map([['u1', { id: 'u1' }]]),
    handleReload(player, msg) {
      reloads.push({ player, msg });
    }
  };

  handleRoomSocketMessage(room, ws, JSON.stringify({ t: 'reload', weaponId: 'rifle' }), {
    safeJsonParse: JSON.parse,
    nowMs: () => 123,
    isPrivateMatchRoom: () => false,
    roomPhaseActive: 'active',
    msgC2s: { RELOAD: 'reload', PING: 'ping' },
    msgS2c: { PONG: 'pong' }
  });

  assert.equal(reloads.length, 1);
  assert.equal(reloads[0].player.id, 'u1');
  assert.deepEqual(reloads[0].msg, { t: 'reload', weaponId: 'rifle' });
});

test('room socket message forwards enter-match commands to the room runtime', () => {
  const ws = createSocket();
  const entered = [];
  const room = {
    roomName: 'global',
    privateRoomConfig: { roomPhase: 'active' },
    clients: new Map([[ws, { userId: 'u1' }]]),
    activeSocketByUserId: new Map([['u1', ws]]),
    players: new Map([['u1', { id: 'u1' }]]),
    handleEnterMatch(player, msg) {
      entered.push({ player, msg });
    }
  };

  handleRoomSocketMessage(room, ws, JSON.stringify({ t: 'enter_match' }), {
    safeJsonParse: JSON.parse,
    nowMs: () => 123,
    isPrivateMatchRoom: () => false,
    roomPhaseActive: 'active',
    msgC2s: { ENTER_MATCH: 'enter_match', PING: 'ping' },
    msgS2c: { PONG: 'pong' }
  });

  assert.equal(entered.length, 1);
  assert.equal(entered[0].player.id, 'u1');
  assert.deepEqual(entered[0].msg, { t: 'enter_match' });
});

test('room socket message blocks reload commands while a private room is still in lobby', () => {
  const ws = createSocket();
  let reloadCount = 0;
  const room = {
    roomName: 'private-room1',
    privateRoomConfig: { roomPhase: 'lobby' },
    clients: new Map([[ws, { userId: 'u1' }]]),
    activeSocketByUserId: new Map([['u1', ws]]),
    players: new Map([['u1', { id: 'u1' }]]),
    handleReload() {
      reloadCount += 1;
    }
  };

  handleRoomSocketMessage(room, ws, JSON.stringify({ t: 'reload', weaponId: 'rifle' }), {
    safeJsonParse: JSON.parse,
    nowMs: () => 123,
    isPrivateMatchRoom: (roomName) => String(roomName).startsWith('private-'),
    roomPhaseActive: 'active',
    msgC2s: { RELOAD: 'reload', PING: 'ping' },
    msgS2c: { PONG: 'pong' }
  });

  assert.equal(reloadCount, 0);
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

test('room socket silently throttles abusive combat message spam per player', () => {
  const ws = createSocket();
  let fireCount = 0;
  let reloadCount = 0;
  let throwCount = 0;
  const room = {
    roomName: 'global',
    privateRoomConfig: { roomPhase: 'active' },
    clients: new Map([[ws, { userId: 'u1' }]]),
    activeSocketByUserId: new Map([['u1', ws]]),
    players: new Map([['u1', { id: 'u1' }]]),
    handleFire() { fireCount += 1; },
    handleReload() { reloadCount += 1; },
    handleThrow() { throwCount += 1; }
  };
  const deps = {
    safeJsonParse: JSON.parse,
    nowMs: () => 1000,
    isPrivateMatchRoom: () => false,
    roomPhaseActive: 'active',
    msgC2s: { FIRE: 'fire', RELOAD: 'reload', THROW: 'throw', PING: 'ping' },
    msgS2c: { PONG: 'pong' }
  };

  for (let i = 0; i < 45; i++) {
    handleRoomSocketMessage(room, ws, JSON.stringify({ t: 'fire', weaponId: 'rifle' }), deps);
  }
  for (let i = 0; i < 12; i++) {
    handleRoomSocketMessage(room, ws, JSON.stringify({ t: 'reload', weaponId: 'rifle' }), deps);
    handleRoomSocketMessage(room, ws, JSON.stringify({ t: 'throw', throwableId: 'frag' }), deps);
  }

  assert.equal(fireCount, 40);
  assert.equal(reloadCount, 8);
  assert.equal(throwCount, 8);
});

test('room socket throttles abusive input and eventually closes the socket', () => {
  const ws = createSocket();
  let inputCount = 0;
  const room = {
    roomName: 'global',
    privateRoomConfig: { roomPhase: 'active' },
    clients: new Map([[ws, { userId: 'u1' }]]),
    activeSocketByUserId: new Map([['u1', ws]]),
    players: new Map([['u1', { id: 'u1' }]]),
    handleInput() {
      inputCount += 1;
    }
  };
  const deps = {
    safeJsonParse: JSON.parse,
    nowMs: () => 1000,
    isPrivateMatchRoom: () => false,
    roomPhaseActive: 'active',
    msgC2s: { INPUT: 'input', PING: 'ping' },
    msgS2c: { PONG: 'pong' }
  };

  for (let i = 0; i < 120; i++) {
    handleRoomSocketMessage(room, ws, JSON.stringify({ t: 'input', seq: i }), deps);
  }

  assert.equal(inputCount, 90);
  assert.equal(ws.closeCalls.length > 0, true);
  assert.equal(ws.closeCalls[0].code, 1008);
});

test('room socket rejects oversized redundant input batches before forwarding them', () => {
  const ws = createSocket();
  let inputCount = 0;
  const room = {
    roomName: 'global',
    privateRoomConfig: { roomPhase: 'active' },
    clients: new Map([[ws, { userId: 'u1' }]]),
    activeSocketByUserId: new Map([['u1', ws]]),
    players: new Map([['u1', { id: 'u1' }]]),
    handleInput() {
      inputCount += 1;
    }
  };

  handleRoomSocketMessage(room, ws, JSON.stringify({
    t: 'input',
    inputs: [{ seq: 1 }, { seq: 2 }, { seq: 3 }, { seq: 4 }, { seq: 5 }]
  }), {
    safeJsonParse: JSON.parse,
    nowMs: () => 1000,
    isPrivateMatchRoom: () => false,
    roomPhaseActive: 'active',
    msgC2s: { INPUT: 'input', PING: 'ping' },
    msgS2c: { PONG: 'pong' }
  });

  assert.equal(inputCount, 0);
  assert.equal(ws.closeCalls.length, 1);
  assert.equal(ws.closeCalls[0].code, 1008);
});

test('room socket rejects oversized gameplay messages before parsing', () => {
  const ws = createSocket();
  let parsed = 0;
  const room = {
    roomName: 'global',
    privateRoomConfig: { roomPhase: 'active' },
    clients: new Map([[ws, { userId: 'u1' }]]),
    activeSocketByUserId: new Map([['u1', ws]]),
    players: new Map([['u1', { id: 'u1' }]])
  };

  handleRoomSocketMessage(room, ws, 'x'.repeat(9000), {
    safeJsonParse() {
      parsed += 1;
      return null;
    },
    nowMs: () => 123,
    isPrivateMatchRoom: () => false,
    roomPhaseActive: 'active',
    msgC2s: { PING: 'ping' },
    msgS2c: { PONG: 'pong' }
  });

  assert.equal(parsed, 0);
  assert.equal(ws.closeCalls.length, 1);
  assert.equal(ws.closeCalls[0].code, 1009);
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
