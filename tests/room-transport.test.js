import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildRoomStatePayload,
  closeDuplicateSockets,
  findSocketForUserId,
  handleRoomRequest
} from '../cloudflare/server/room/RoomTransport.js';

test('room state payload reflects room status without simulation internals leaking through fetch', () => {
  const payload = buildRoomStatePayload({
    roomName: 'ffa-01',
    gameMode: 'ffa',
    matchState: { started: true, ended: false },
    bots: new Map([['bot-1', {}]]),
    humanPlayerCount() { return 3; },
    connectedHumanCount() { return 2; },
    simulatedPlayerCount() { return 1; }
  });

  assert.deepEqual(payload, {
    ok: true,
    roomId: 'ffa-01',
    gameMode: 'ffa',
    matchStarted: true,
    matchEnded: false,
    players: 3,
    connectedPlayers: 2,
    simPlayers: 1,
    bots: 1,
    softTarget: 12,
    hardCap: 16
  });
});

test('duplicate socket helpers only target the matching user', () => {
  const closed = [];
  const keep = { close() { closed.push('keep'); } };
  const duplicate = { close(code, reason) { closed.push(`${code}:${reason}`); } };
  const other = { close() { closed.push('other'); } };
  const clients = new Map([
    [keep, { userId: 'u1' }],
    [duplicate, { userId: 'u1' }],
    [other, { userId: 'u2' }]
  ]);

  assert.equal(findSocketForUserId(clients, 'u1', keep), duplicate);
  closeDuplicateSockets(clients, 'u1', keep);

  assert.deepEqual(closed, ['4001:Superseded by a newer connection']);
});

test('non-websocket room requests delegate private config and state responses through the transport helper', async () => {
  const applied = [];
  const room = {
    env: { ROOM_NAME: 'global' },
    roomName: '',
    gameMode: 'ffa',
    matchState: { started: false, ended: false },
    bots: new Map(),
    refreshWorldMetaCalled: 0,
    refreshWorldMeta() { this.refreshWorldMetaCalled += 1; },
    applyPrivateRoomConfig(config) { applied.push(config); },
    humanPlayerCount() { return 1; },
    connectedHumanCount() { return 1; },
    simulatedPlayerCount() { return 0; }
  };

  const stateResponse = await handleRoomRequest(
    room,
    new Request('https://room/state?roomId=FFA-01')
  );
  const stateBody = await stateResponse.json();
  assert.equal(room.roomName, 'ffa-01');
  assert.equal(room.refreshWorldMetaCalled, 1);
  assert.equal(stateBody.roomId, 'ffa-01');

  const configResponse = await handleRoomRequest(
    room,
    new Request('https://room/private-config?roomId=private-room1', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomMode: 'tdm' })
    })
  );
  const configBody = await configResponse.json();
  assert.equal(configBody.ok, true);
  assert.deepEqual(applied, [{ roomMode: 'tdm' }]);
});

test('websocket room requests are handled by the transport helper, including duplicate socket eviction', async () => {
  const originalResponse = globalThis.Response;
  const originalPair = globalThis.WebSocketPair;
  const accepted = [];
  const sent = [];

  class FakeResponse {
    constructor(body, init = {}) {
      this.body = body;
      this.status = init.status || 200;
      this.webSocket = init.webSocket;
    }
  }

  function createSocket(label) {
    return {
      label,
      attachment: null,
      closed: [],
      serializeAttachment(value) { this.attachment = value; },
      deserializeAttachment() { return this.attachment; },
      close(code, reason) { this.closed.push({ code, reason }); }
    };
  }

  globalThis.Response = FakeResponse;
  globalThis.WebSocketPair = class {
    constructor() {
      this[0] = createSocket('client');
      this[1] = createSocket('server');
    }
  };

  try {
    const staleSocket = createSocket('stale');
    const room = {
      env: { ROOM_NAME: 'global' },
      roomName: 'global',
      gameMode: 'ffa',
      matchState: { started: false, ended: false },
      bots: new Map(),
      players: new Map(),
      privateRoomConfig: { teams: new Map() },
      clients: new Map([[staleSocket, { userId: 'user-1', actorId: 'actor-1' }]]),
      activeSocketByUserId: new Map(),
      ctx: { acceptWebSocket(ws) { accepted.push(ws); } },
      refreshWorldMeta() {},
      syncRoomFixturesCalled: 0,
      syncRoomFixtures() { this.syncRoomFixturesCalled += 1; },
      ensurePlayerArgs: null,
      ensurePlayer(...args) { this.ensurePlayerArgs = args; },
      startPublicMatchIfReadyCalled: 0,
      startPublicMatchIfReady() { this.startPublicMatchIfReadyCalled += 1; },
      ensureTickCalled: 0,
      ensureTick() { this.ensureTickCalled += 1; },
      buildWelcomePayload(userId) { return { ok: true, userId }; },
      send(ws, payload) { sent.push({ ws, payload }); },
      broadcastSnapshotArgs: [],
      broadcastSnapshot(forceFull) { this.broadcastSnapshotArgs.push(forceFull); }
    };

    const response = await handleRoomRequest(
      room,
      new Request('https://room/connect?roomId=global&userId=user-1&username=PLAYER&actorId=actor-1', {
        headers: { Upgrade: 'websocket' }
      })
    );

    assert.equal(response.status, 101);
    assert.equal(accepted.length, 1);
    assert.deepEqual(room.ensurePlayerArgs, ['user-1', 'PLAYER', 'abilities', 'actor-1', 'PLAYER']);
    assert.equal(room.activeSocketByUserId.get('user-1'), accepted[0]);
    assert.deepEqual(staleSocket.closed, [{ code: 4001, reason: 'Superseded by a newer connection' }]);
    assert.deepEqual(room.broadcastSnapshotArgs, [true]);
    assert.equal(sent.length, 1);
    assert.deepEqual(sent[0].payload, { ok: true, userId: 'user-1' });
  } finally {
    globalThis.Response = originalResponse;
    globalThis.WebSocketPair = originalPair;
  }
});

test('active LMS rooms reject fresh websocket joins without blocking reconnects', async () => {
  const originalResponse = globalThis.Response;
  const originalPair = globalThis.WebSocketPair;

  class FakeResponse {
    constructor(body, init = {}) {
      this.body = body;
      this.status = init.status || 200;
      this.webSocket = init.webSocket;
    }

    async text() {
      return String(this.body || '');
    }
  }

  globalThis.Response = FakeResponse;
  globalThis.WebSocketPair = class {
    constructor() {
      this[0] = { label: 'client' };
      this[1] = {
        label: 'server',
        serializeAttachment() {},
        deserializeAttachment() { return null; }
      };
    }
  };

  try {
    const room = {
      env: { ROOM_NAME: 'lms-01' },
      roomName: 'lms-01',
      gameMode: 'lms',
      matchState: { started: true, ended: false },
      bots: new Map(),
      players: new Map(),
      privateRoomConfig: { teams: new Map() },
      clients: new Map(),
      activeSocketByUserId: new Map(),
      ctx: { acceptWebSocket() { throw new Error('should not accept new join'); } },
      refreshWorldMeta() {},
      syncRoomFixtures() {},
      ensurePlayer() { throw new Error('should not create a new player'); },
      startPublicMatchIfReady() {},
      ensureTick() {},
      buildWelcomePayload() { return {}; },
      send() {},
      broadcastSnapshot() {}
    };

    const denied = await handleRoomRequest(
      room,
      new Request('https://room/connect?roomId=lms-01&userId=u1&username=PLAYER&actorId=a1', {
        headers: { Upgrade: 'websocket' }
      })
    );

    assert.equal(denied.status, 409);
    assert.equal(await denied.text(), 'LMS match already in progress.');

    room.players.set('u1', { id: 'u1' });
    let ensured = 0;
    let accepted = 0;
    room.ctx.acceptWebSocket = function () { accepted += 1; };
    room.ensurePlayer = function () { ensured += 1; };
    const allowed = await handleRoomRequest(
      room,
      new Request('https://room/connect?roomId=lms-01&userId=u1&username=PLAYER&actorId=a1', {
        headers: { Upgrade: 'websocket' }
      })
    );

    assert.equal(allowed.status, 101);
    assert.equal(accepted, 1);
    assert.equal(ensured, 1);
  } finally {
    globalThis.Response = originalResponse;
    globalThis.WebSocketPair = originalPair;
  }
});
