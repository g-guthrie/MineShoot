import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

async function loadMessageRouterFactory() {
  const sandbox = {
    console,
    Date,
    globalThis: {
      __MAYHEM_RUNTIME: {}
    }
  };
  const context = vm.createContext(sandbox);
  const code = await fs.readFile(new URL('../../js/net/message-router.js', import.meta.url), 'utf8');
  vm.runInContext(code, context);
  return sandbox.globalThis.__MAYHEM_RUNTIME.GameNetMessageRouter;
}

test('GameNetMessageRouter keeps default message names when only part of the map is overridden', async () => {
  const GameNetMessageRouter = await loadMessageRouterFactory();
  let snapshotCall = null;
  const router = GameNetMessageRouter.create({
    msgTypes: { WELCOME: 'hello' },
    getGameMode() { return 'ffa'; },
    setGameMode() {},
    getPrivateRoomPhase() { return ''; },
    setPrivateRoomPhase() {},
    getMatchState() { return null; },
    setMatchState() {},
    applySnapshot(entities, projectiles, fireZones, meta) {
      snapshotCall = { entities, projectiles, fireZones, meta };
    }
  });

  router.handleMessage(JSON.stringify({
    t: 'snapshot',
    entities: [{ id: 'user-1' }],
    serverTime: 42
  }));

  assert.ok(snapshotCall);
  assert.deepEqual(JSON.parse(JSON.stringify(snapshotCall.entities)), [{ id: 'user-1' }]);
  assert.equal(snapshotCall.meta.serverTime, 42);
});

test('GameNetMessageRouter forwards entity patch metadata on delta snapshots', async () => {
  const GameNetMessageRouter = await loadMessageRouterFactory();
  let snapshotCall = null;
  const router = GameNetMessageRouter.create({
    getGameMode() { return 'ffa'; },
    setGameMode() {},
    getPrivateRoomPhase() { return ''; },
    setPrivateRoomPhase() {},
    getMatchState() { return null; },
    setMatchState() {},
    applySnapshot(entities, projectiles, fireZones, meta) {
      snapshotCall = { entities, projectiles, fireZones, meta };
    }
  });

  router.handleMessage(JSON.stringify({
    t: 'snapshot',
    delta: true,
    entityPatches: [{ id: 'user-1', x: 2 }],
    baseSnapshotSeq: 9,
    snapshotSeq: 10,
    removedEntityIds: ['user-2'],
    serverTime: 99
  }));

  assert.ok(snapshotCall);
  assert.deepEqual(JSON.parse(JSON.stringify(snapshotCall.meta.entityPatches)), [{ id: 'user-1', x: 2 }]);
  assert.equal(snapshotCall.meta.baseSnapshotSeq, 9);
  assert.equal(snapshotCall.meta.snapshotSeq, 10);
});

test('GameNetMessageRouter warns when it receives an unknown message type', async () => {
  const GameNetMessageRouter = await loadMessageRouterFactory();
  const warnings = [];
  const router = GameNetMessageRouter.create({
    debugWarn(message, payload) {
      warnings.push({ message, payload });
    }
  });

  router.handleMessage(JSON.stringify({
    t: 'future_message',
    revision: 2
  }));

  assert.deepEqual(JSON.parse(JSON.stringify(warnings)), [{
    message: 'Unhandled GameNet message type "future_message".',
    payload: {
      t: 'future_message',
      revision: 2
    }
  }]);
});

test('GameNetMessageRouter queues replicated shot effects', async () => {
  const GameNetMessageRouter = await loadMessageRouterFactory();
  const shotEffectQueue = [];
  const router = GameNetMessageRouter.create({
    shotEffectQueue
  });

  router.handleMessage(JSON.stringify({
    t: 'shot_effect',
    sourceId: 'usr_remote',
    weaponId: 'rifle',
    traces: [{ x: 1, y: 2, z: 3 }]
  }));

  assert.deepEqual(JSON.parse(JSON.stringify(shotEffectQueue)), [{
    t: 'shot_effect',
    sourceId: 'usr_remote',
    weaponId: 'rifle',
    traces: [{ x: 1, y: 2, z: 3 }]
  }]);
});

test('GameNetMessageRouter queues authoritative shot rejections', async () => {
  const GameNetMessageRouter = await loadMessageRouterFactory();
  const shotRejectQueue = [];
  const router = GameNetMessageRouter.create({
    shotRejectQueue
  });

  router.handleMessage(JSON.stringify({
    t: 'shot_reject',
    shotToken: 'bad-aim',
    weaponId: 'rifle',
    reason: 'aim_direction_mismatch',
    serverTime: 1234
  }));

  assert.deepEqual(JSON.parse(JSON.stringify(shotRejectQueue)), [{
    shotToken: 'bad-aim',
    weaponId: 'rifle',
    reason: 'aim_direction_mismatch',
    serverTime: 1234
  }]);
});

test('GameNetMessageRouter immediately marks killed remote renders inactive', async () => {
  const GameNetMessageRouter = await loadMessageRouterFactory();
  const render = { alive: true };
  const renderMap = new Map([['usr_remote', render]]);
  const aliveCalls = [];
  const router = GameNetMessageRouter.create({
    getRenderMap() {
      return renderMap;
    },
    getSelfId() {
      return 'usr_self';
    },
    getSelfState() {
      return null;
    },
    setRemoteAliveState(entityId, alive) {
      aliveCalls.push({ entityId, alive });
    },
    damagePointForEntityId() {
      return null;
    },
    damageFeedbackQueue: [],
    incomingDamageFeedbackQueue: []
  });

  router.handleMessage(JSON.stringify({
    t: 'damage_event',
    sourceId: 'usr_self',
    targetId: 'usr_remote',
    killed: true,
    damage: 34,
    hitType: 'body'
  }));

  assert.equal(render.alive, false);
  assert.deepEqual(aliveCalls, [{ entityId: 'usr_remote', alive: false }]);
});
