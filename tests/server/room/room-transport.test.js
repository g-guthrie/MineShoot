import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildRoomStatePayload,
  closeDuplicateSockets,
  findSocketForUserId,
  handleRoomRequest
} from '../../../cloudflare/server/room/RoomTransport.js';

test('room state payload reflects room status without simulation internals leaking through fetch', () => {
  const payload = buildRoomStatePayload({
    roomName: 'ffa-01',
    gameMode: 'ffa',
    matchState: { started: true, ended: false },
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
    botPlayers: 0,
    totalPlayers: 4,
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
    roomName: 'ffa-01',
    gameMode: 'ffa',
    matchState: { started: false, ended: false },
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

test('room transport applies enabled local test fixtures and rebroadcasts a full snapshot', async () => {
  const room = {
    env: { ROOM_NAME: 'global', ENABLE_TEST_FIXTURES: '1' },
    roomName: 'global',
    gameMode: 'ffa',
    matchState: { started: false, ended: false },
    players: new Map([[
      'u1',
      {
        id: 'u1',
        x: 4,
        y: 1.6,
        z: 5,
        yaw: 0,
        pitch: 0,
        weaponId: 'pistol',
        spawnShieldUntil: 900,
        velocityY: 3,
        isGrounded: false,
        jumpHoldTimer: 0.2,
        jumpHeldLast: true,
        inputState: {
          forward: true,
          backward: false,
          left: true,
          right: false,
          jump: true,
          sprint: true,
          adsActive: true
        },
        inputQueue: [{ seq: 1 }]
      }
    ]]),
    refreshWorldMetaCalled: 0,
    refreshWorldMeta() { this.refreshWorldMetaCalled += 1; },
    humanPlayerCount() { return 1; },
    connectedHumanCount() { return 1; },
    simulatedPlayerCount() { return 0; },
    applyEntitySpawnPointCalls: [],
    applyEntitySpawnPoint(player, spawn) {
      this.applyEntitySpawnPointCalls.push({ playerId: player.id, spawn });
      player.x = spawn.x;
      player.y = 1.6;
      player.z = spawn.z;
    },
    seedEntityPoseHistoryCalls: [],
    seedEntityPoseHistory(player) {
      this.seedEntityPoseHistoryCalls.push(player.id);
    },
    broadcastSnapshotArgs: [],
    broadcastSnapshot(forceFull) {
      this.broadcastSnapshotArgs.push(forceFull);
    }
  };

  const response = await handleRoomRequest(
    room,
    new Request('https://room/test-fixture?roomId=itest-room', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        players: [{
          userId: 'u1',
          x: 12,
          z: 18,
          yaw: 0.5,
          pitch: -0.2,
          clearSpawnShield: true,
          weaponId: 'rifle'
        }]
      })
    })
  );
  const body = await response.json();
  const player = room.players.get('u1');

  assert.equal(response.status, 200);
  assert.equal(room.roomName, 'itest-room');
  assert.equal(room.refreshWorldMetaCalled, 1);
  assert.deepEqual(room.applyEntitySpawnPointCalls, [{
    playerId: 'u1',
    spawn: { x: 12, z: 18 }
  }]);
  assert.deepEqual(room.seedEntityPoseHistoryCalls, ['u1']);
  assert.deepEqual(room.broadcastSnapshotArgs, [true]);
  assert.equal(player.x, 12);
  assert.equal(player.z, 18);
  assert.equal(player.yaw, 0.5);
  assert.equal(player.pitch, -0.2);
  assert.equal(player.weaponId, 'rifle');
  assert.equal(player.spawnShieldUntil, 0);
  assert.equal(player.velocityY, 0);
  assert.equal(player.isGrounded, true);
  assert.equal(player.jumpHoldTimer, 0);
  assert.equal(player.jumpHeldLast, false);
  assert.equal(player.inputQueue.length, 0);
  assert.deepEqual(player.inputState, {
    forward: false,
    backward: false,
    left: false,
    right: false,
    jump: false,
    sprint: false,
    adsActive: false
  });
  assert.deepEqual(body, {
    ok: true,
    roomId: 'itest-room',
    players: [{
      userId: 'u1',
      x: 12,
      y: 1.6,
      z: 18,
      yaw: 0.5,
      pitch: -0.2,
      spawnShieldUntil: 0,
      weaponId: 'rifle'
    }]
  });
});

test('room transport does not rebuild world metadata on every request when the room id is unchanged', async () => {
  const room = {
    env: { ROOM_NAME: 'global' },
    roomName: 'ffa-01',
    gameMode: 'ffa',
    matchState: { started: false, ended: false },
    worldCollision: { collidables: [] },
    terrainSampler: { getGroundHeightAt() { return 0; } },
    refreshWorldMetaCalled: 0,
    refreshWorldMeta() { this.refreshWorldMetaCalled += 1; },
    humanPlayerCount() { return 1; },
    connectedHumanCount() { return 1; },
    simulatedPlayerCount() { return 0; }
  };

  const response = await handleRoomRequest(
    room,
    new Request('https://room/state?roomId=FFA-01')
  );
  const body = await response.json();

  assert.equal(body.roomId, 'ffa-01');
  assert.equal(room.refreshWorldMetaCalled, 0);
});

test('room transport ignores request roomId when the durable object already has a room identity', async () => {
  const room = {
    env: { ROOM_NAME: 'global' },
    roomName: 'ffa-01',
    gameMode: 'ffa',
    matchState: { started: false, ended: false },
    worldCollision: { collidables: [] },
    terrainSampler: { getGroundHeightAt() { return 0; } },
    refreshWorldMetaCalled: 0,
    refreshWorldMeta() { this.refreshWorldMetaCalled += 1; },
    humanPlayerCount() { return 1; },
    connectedHumanCount() { return 1; },
    simulatedPlayerCount() { return 0; }
  };

  const response = await handleRoomRequest(
    room,
    new Request('https://room/state?roomId=tdm-99')
  );
  const body = await response.json();

  assert.equal(room.roomName, 'ffa-01');
  assert.equal(body.roomId, 'ffa-01');
  assert.equal(room.refreshWorldMetaCalled, 0);
});

test('room transport adopts the requested roomId for a fresh durable object still on the default room name', async () => {
  const room = {
    env: { ROOM_NAME: 'global' },
    roomName: 'global',
    gameMode: '',
    matchState: { started: false, ended: false },
    refreshWorldMetaCalled: 0,
    refreshWorldMeta() { this.refreshWorldMetaCalled += 1; },
    humanPlayerCount() { return 0; },
    connectedHumanCount() { return 0; },
    simulatedPlayerCount() { return 0; }
  };

  const response = await handleRoomRequest(
    room,
    new Request('https://room/state?roomId=FFA-01')
  );
  const body = await response.json();

  assert.equal(room.roomName, 'ffa-01');
  assert.equal(body.roomId, 'ffa-01');
  assert.equal(room.refreshWorldMetaCalled, 1);
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
      broadcastSnapshot(forceFull) { this.broadcastSnapshotArgs.push(forceFull); },
      humanPlayerCount() { return 1; },
      connectedHumanCount() { return 1; },
      simulatedPlayerCount() { return 0; }
    };

    const response = await handleRoomRequest(
      room,
      new Request('https://room/connect?roomId=global&userId=user-1&username=PLAYER&classId=sniper&actorId=actor-1', {
        headers: { Upgrade: 'websocket' }
      })
    );

    assert.equal(response.status, 101);
    assert.equal(accepted.length, 1);
    assert.deepEqual(room.ensurePlayerArgs, ['user-1', 'PLAYER', 'sniper', 'actor-1', 'PLAYER']);
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

test('websocket room requests reset an ended public match before welcoming a fresh joiner', async () => {
  const originalResponse = globalThis.Response;
  const originalPair = globalThis.WebSocketPair;

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
      serializeAttachment(value) { this.attachment = value; },
      deserializeAttachment() { return this.attachment; },
      close() {}
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
    const room = {
      env: { ROOM_NAME: 'global' },
      roomName: 'global',
      gameMode: 'ffa',
      matchState: { started: true, ended: true, resetAt: Date.now() + 5000 },
      players: new Map(),
      privateRoomConfig: { teams: new Map() },
      clients: new Map(),
      activeSocketByUserId: new Map(),
      ctx: { acceptWebSocket() {} },
      refreshWorldMeta() {},
      syncRoomFixtures() {},
      ensurePlayer() {},
      resetPublicRoomToIdleCalled: 0,
      resetPublicRoomToIdle() {
        this.resetPublicRoomToIdleCalled += 1;
        this.matchState = { started: false, ended: false };
      },
      startPublicMatchIfReadyCalled: 0,
      startPublicMatchIfReady() { this.startPublicMatchIfReadyCalled += 1; },
      ensureTick() {},
      buildWelcomePayload() { return { ok: true }; },
      send() {},
      broadcastSnapshot() {},
      humanPlayerCount() { return 1; },
      connectedHumanCount() { return 0; },
      simulatedPlayerCount() { return 0; }
    };

    const response = await handleRoomRequest(
      room,
      new Request('https://room/connect?roomId=global&userId=user-1&username=PLAYER&classId=sniper&actorId=actor-1', {
        headers: { Upgrade: 'websocket' }
      })
    );

    assert.equal(response.status, 101);
    assert.equal(room.resetPublicRoomToIdleCalled, 1);
    assert.equal(room.startPublicMatchIfReadyCalled, 1);
  } finally {
    globalThis.Response = originalResponse;
    globalThis.WebSocketPair = originalPair;
  }
});

test('room transport rejects websocket connections that would exceed the public room hard cap', async () => {
  const originalResponse = globalThis.Response;
  const originalPair = globalThis.WebSocketPair;

  class FakeResponse {
    constructor(body, init = {}) {
      this.body = body;
      this.status = init.status || 200;
      this.webSocket = init.webSocket;
    }
  }

  function createSocket() {
    return {
      serializeAttachment() {},
      deserializeAttachment() { return null; },
      close() {}
    };
  }

  globalThis.Response = FakeResponse;
  globalThis.WebSocketPair = class {
    constructor() {
      this[0] = createSocket();
      this[1] = createSocket();
    }
  };

  try {
    const room = {
      env: { ROOM_NAME: 'global' },
      roomName: 'ffa-01',
      gameMode: 'ffa',
      matchState: { started: true, ended: false },
      players: new Map(),
      privateRoomConfig: { teams: new Map() },
      clients: new Map(),
      activeSocketByUserId: new Map(),
      ctx: { acceptWebSocket() {} },
      refreshWorldMeta() {},
      syncRoomFixtures() {},
      ensurePlayer() {},
      startPublicMatchIfReady() {},
      ensureTick() {},
      buildWelcomePayload() { return { ok: true }; },
      send() {},
      broadcastSnapshot() {},
      humanPlayerCount() { return 16; },
      connectedHumanCount() { return 16; },
      simulatedPlayerCount() { return 0; }
    };

    const response = await handleRoomRequest(
      room,
      new Request('https://room/connect?roomId=ffa-01&userId=user-17&username=OVERFLOW&actorId=actor-17', {
        headers: { Upgrade: 'websocket' }
      })
    );

    assert.equal(response.status, 409);
  } finally {
    globalThis.Response = originalResponse;
    globalThis.WebSocketPair = originalPair;
  }
});

test('room transport allows reconnecting players even when at hard cap', async () => {
  const originalResponse = globalThis.Response;
  const originalPair = globalThis.WebSocketPair;
  let accepted = 0;

  class FakeResponse {
    constructor(body, init = {}) {
      this.body = body;
      this.status = init.status || 200;
      this.webSocket = init.webSocket;
    }
  }

  function createSocket() {
    return {
      serializeAttachment() {},
      deserializeAttachment() { return null; },
      close() {}
    };
  }

  globalThis.Response = FakeResponse;
  globalThis.WebSocketPair = class {
    constructor() {
      this[0] = createSocket();
      this[1] = createSocket();
    }
  };

  try {
    const room = {
      env: { ROOM_NAME: 'global' },
      roomName: 'ffa-01',
      gameMode: 'ffa',
      matchState: { started: true, ended: false },
      players: new Map([['user-1', { id: 'user-1' }]]),
      privateRoomConfig: { teams: new Map() },
      clients: new Map(),
      activeSocketByUserId: new Map(),
      ctx: { acceptWebSocket() { accepted += 1; } },
      refreshWorldMeta() {},
      syncRoomFixtures() {},
      ensurePlayer() {},
      startPublicMatchIfReady() {},
      ensureTick() {},
      buildWelcomePayload() { return { ok: true }; },
      send() {},
      broadcastSnapshot() {},
      humanPlayerCount() { return 16; },
      connectedHumanCount() { return 16; },
      simulatedPlayerCount() { return 0; }
    };

    const response = await handleRoomRequest(
      room,
      new Request('https://room/connect?roomId=ffa-01&userId=user-1&username=PLAYER&actorId=actor-1', {
        headers: { Upgrade: 'websocket' }
      })
    );

    assert.equal(response.status, 101);
    assert.equal(accepted, 1);
  } finally {
    globalThis.Response = originalResponse;
    globalThis.WebSocketPair = originalPair;
  }
});

test('room transport accepts case-insensitive websocket upgrade headers', async () => {
  const originalResponse = globalThis.Response;
  const originalPair = globalThis.WebSocketPair;
  let accepted = 0;

  class FakeResponse {
    constructor(body, init = {}) {
      this.body = body;
      this.status = init.status || 200;
      this.webSocket = init.webSocket;
    }
  }

  function createSocket() {
    return {
      serializeAttachment() {},
      deserializeAttachment() { return null; },
      close() {}
    };
  }

  globalThis.Response = FakeResponse;
  globalThis.WebSocketPair = class {
    constructor() {
      this[0] = createSocket();
      this[1] = createSocket();
    }
  };

  try {
    const room = {
      env: { ROOM_NAME: 'global' },
      roomName: 'global',
      gameMode: 'ffa',
      matchState: { started: false, ended: false },
      players: new Map(),
      privateRoomConfig: { teams: new Map() },
      clients: new Map(),
      activeSocketByUserId: new Map(),
      ctx: { acceptWebSocket() { accepted += 1; } },
      refreshWorldMeta() {},
      syncRoomFixtures() {},
      ensurePlayer() {},
      startPublicMatchIfReady() {},
      ensureTick() {},
      buildWelcomePayload() { return { ok: true }; },
      send() {},
      broadcastSnapshot() {},
      humanPlayerCount() { return 0; },
      connectedHumanCount() { return 0; },
      simulatedPlayerCount() { return 0; }
    };

    const response = await handleRoomRequest(
      room,
      new Request('https://room/connect?roomId=global&userId=user-1&username=PLAYER&actorId=actor-1', {
        headers: { Upgrade: 'WebSocket' }
      })
    );

    assert.equal(response.status, 101);
    assert.equal(accepted, 1);
  } finally {
    globalThis.Response = originalResponse;
    globalThis.WebSocketPair = originalPair;
  }
});
