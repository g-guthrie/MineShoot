import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import {
  buildExpectedWorldMeta,
  cloneWorldFlags,
  normalizeAbilityLoadoutPayload,
  normalizeClassCastPayload,
  normalizeThrowPayload,
  normalizeWeaponLoadoutPayload,
  sanitizeRoomId
} from '../../shared/protocol.js';
import { logicalHitscanOriginFromEye } from '../../shared/entity-points.js';
import { gameNetRuntimeScriptUrls } from '../../js/app/runtime-assembly.js';

async function loadGameNetHarness(options = {}) {
  const renderMap = new Map();
  const currentInputState = {
    forward: true,
    backward: false,
    left: false,
    right: false,
    jump: false,
    sprint: false,
    adsActive: false,
    ...(options.initialInputState || {})
  };
  const currentRotation = {
    yaw: 0.25,
    pitch: -0.1,
    ...(options.initialRotation || {})
  };
  const runtime = {
    GameShared: {
      protocol: {
        wsPath: '/api/ws',
        world: {
          profileVersion: 6,
          seedPrefix: 'room-env-v6-static',
          flags: { envV2: true, terrainPhysicsV2: true }
        },
        sanitizeRoomId,
        cloneWorldFlags,
        buildExpectedWorldMeta,
        normalizeWeaponLoadoutPayload,
        normalizeThrowPayload,
        normalizeAbilityLoadoutPayload,
        normalizeClassCastPayload,
        msg: {
          c2s: { INPUT: 'input', FIRE: 'fire', PING: 'ping' },
          s2c: { WELCOME: 'welcome', SNAPSHOT: 'snapshot', PONG: 'pong' }
        }
      },
      entityPoints: {
        logicalHitscanOriginFromEye
      }
    },
    GameNetAuth: {
      getSocketIdentity() { return { id: 'usr_test', username: 'TEST', classId: 'abilities' }; },
      getUser() { return { id: 'usr_test', username: 'TEST', classId: 'abilities' }; },
      ensureArenaIdentity() { return Promise.resolve(); }
    },
    GameNetEntities: {
      init() {},
      cleanup() {},
      updateFromSnapshot() {},
      removeRemoteVisual() {},
      getRenderMap() { return renderMap; },
      classStats() { return { armorMax: 90, wallhackRadius: 90 }; }
    },
    GameNetSnapshots: {
      create(hooks = {}) {
        return {
          applySnapshot(entities, projectiles, fireZones, opts = {}) {
            const list = Array.isArray(entities) ? entities : [];
            for (let i = 0; i < list.length; i++) {
              if (hooks.onEntity) hooks.onEntity(list[i]);
            }
            if (hooks.onPrune) hooks.onPrune(new Map(list.map((entity) => [entity.id, entity])));
            if (hooks.onProjectiles && projectiles !== undefined) hooks.onProjectiles(Array.isArray(projectiles) ? projectiles : []);
            if (hooks.onFireZones && fireZones !== undefined) hooks.onFireZones(Array.isArray(fireZones) ? fireZones : []);
          }
        };
      }
    },
    GamePlayer: {
      getAnimNetState() {
        return { equippedWeaponId: 'rifle' };
      },
      getCamera() {
        return {
          fov: 75,
          position: { x: 1, y: 2, z: 3 }
        };
      },
      getMuzzleWorldPosition() {
        return { x: 7, y: 8, z: 9 };
      },
      getEyeWorldPosition() {
        return { x: 4, y: 5, z: 6 };
      },
      getRotation() {
        return {
          yaw: Number(currentRotation.yaw || 0),
          pitch: Number(currentRotation.pitch || 0)
        };
      },
      getAdsState() {
        return { active: false };
      },
      getNetworkInputState() {
        return {
          forward: !!currentInputState.forward,
          backward: !!currentInputState.backward,
          left: !!currentInputState.left,
          right: !!currentInputState.right,
          jump: !!currentInputState.jump,
          sprint: !!currentInputState.sprint,
          adsActive: !!currentInputState.adsActive
        };
      },
      respawn() {}
    },
    GameNetTransport: null
  };

  const timeState = { now: 1000 };
  const fakeDate = {
    now() { return timeState.now; }
  };
  const sandbox = {
    globalThis: { __MAYHEM_RUNTIME: runtime },
    window: {
      location: { protocol: 'https:', host: 'example.test' }
    },
    URL,
    URLSearchParams,
    console,
    Date: fakeDate,
    TextDecoder: class {
      decode(value) { return String(value || ''); }
    },
    WebSocket: { OPEN: 1 },
    setTimeout(fn) { if (typeof fn === 'function') fn(); return 1; },
    clearTimeout() {},
    Math,
    Map,
    JSON
  };

  const context = vm.createContext(sandbox);
  const scriptUrls = [new URL('../../js/combat/ability-fx.js', import.meta.url)].concat(gameNetRuntimeScriptUrls);
  for (const scriptUrl of scriptUrls) {
    const code = await fs.readFile(scriptUrl, 'utf8');
    vm.runInContext(code, context);
  }
  const GameNet = sandbox.globalThis.__MAYHEM_RUNTIME.GameNet;

  const sentMessages = [];
  let transportHooks = null;
  let transportOpen = false;
  runtime.GameNetTransport = {
    create(opts) {
      transportHooks = opts;
      return {
        connect() {
          transportOpen = true;
          const socket = { readyState: 1 };
          if (opts.onOpen) opts.onOpen(socket);
        },
        send(msg) {
          if (!transportOpen) return false;
          if (typeof options.transportSend === 'function') {
            const didSend = options.transportSend(msg);
            if (!didSend) return false;
          } else if (options.transportSendResult === false) {
            return false;
          }
          sentMessages.push(JSON.parse(JSON.stringify(msg)));
          return true;
        },
        shutdown() {
          transportOpen = false;
        }
      };
    }
  };

  GameNet.init({});

  return {
    GameNet,
    renderMap,
    sentMessages,
    timeState,
    handleMessage(message) {
      const payload = JSON.stringify(message);
      if (transportHooks && transportHooks.onMessage) {
        transportHooks.onMessage(payload);
      }
    },
    closeTransport(event = { code: 1006 }) {
      transportOpen = false;
      if (transportHooks && transportHooks.onClose) {
        transportHooks.onClose(event);
      }
    },
    setInputState(nextState) {
      const next = nextState && typeof nextState === 'object' ? nextState : {};
      currentInputState.forward = !!next.forward;
      currentInputState.backward = !!next.backward;
      currentInputState.left = !!next.left;
      currentInputState.right = !!next.right;
      currentInputState.jump = !!next.jump;
      currentInputState.sprint = !!next.sprint;
      currentInputState.adsActive = !!next.adsActive;
    },
    setRotation(nextRotation) {
      const next = nextRotation && typeof nextRotation === 'object' ? nextRotation : {};
      if (Object.prototype.hasOwnProperty.call(next, 'yaw')) currentRotation.yaw = Number(next.yaw || 0);
      if (Object.prototype.hasOwnProperty.call(next, 'pitch')) currentRotation.pitch = Number(next.pitch || 0);
    }
  };
}

test('GameNet records sent input samples with timing metadata', async () => {
  const harness = await loadGameNetHarness();
  const { GameNet, sentMessages, timeState } = harness;

  timeState.now = 1000;
  GameNet.update(0.05, { x: 0, y: 1.6, z: 0 }, { yaw: 0, pitch: 0 });
  timeState.now = 1060;
  GameNet.update(0.05, { x: 0, y: 1.6, z: 0 }, { yaw: 0, pitch: 0 });

  assert.equal(sentMessages.length, 2);
  const syncState = GameNet.view.getInputSyncState();
  const pending = GameNet.view.getPendingInputSamples();
  assert.equal(syncState.pendingInputCount, 2);
  assert.equal(pending.length, 2);
  assert.equal(pending[0].dtMs, 17);
  assert.equal(pending[1].dtMs, 60);
});

test('GameNet prunes acked input samples from self snapshots', async () => {
  const harness = await loadGameNetHarness();
  const { GameNet, timeState } = harness;

  timeState.now = 1000;
  GameNet.update(0.05, { x: 0, y: 1.6, z: 0 }, { yaw: 0, pitch: 0 });
  timeState.now = 1050;
  GameNet.update(0.05, { x: 0, y: 1.6, z: 0 }, { yaw: 0.1, pitch: 0 });

  harness.handleMessage({
    t: 'welcome',
    selfId: 'usr_test',
    roomId: 'global',
    worldSeed: 'seed',
    worldProfileVersion: 6,
    worldFlags: { envV2: true, terrainPhysicsV2: true }
  });

  harness.handleMessage({
    t: 'snapshot',
    delta: false,
    entities: [
      {
        id: 'usr_test',
        x: 0,
        y: 1.6,
        z: 0,
        yaw: 0,
        pitch: 0,
        seq: 1
      }
    ],
    removedEntityIds: [],
    projectiles: [],
    fireZones: []
  });

  const syncState = GameNet.view.getInputSyncState();
  const pending = GameNet.view.getPendingInputSamples();
  assert.equal(syncState.lastAckedSeq, 1);
  assert.equal(syncState.pendingInputCount, 1);
  assert.equal(pending[0].seq, 2);
});

test('GameNet prefers welcome inputSendHz over tickRate for continuous input cadence', async () => {
  const harness = await loadGameNetHarness();
  const { GameNet, sentMessages, timeState } = harness;

  harness.handleMessage({
    t: 'welcome',
    selfId: 'usr_test',
    roomId: 'global',
    tickRate: 60,
    inputSendHz: 30,
    worldSeed: 'seed',
    worldProfileVersion: 6,
    worldFlags: { envV2: true, terrainPhysicsV2: true }
  });

  for (const now of [1000, 1010, 1020, 1030, 1040]) {
    timeState.now = now;
    GameNet.update(0.01, { x: 0, y: 1.6, z: 0 }, { yaw: 0, pitch: 0 });
  }

  assert.equal(sentMessages.filter((message) => message.t === 'input').length, 2);
});

test('GameNet flushes movement, ADS, sprint, and jump edges immediately between 30 Hz sends', async () => {
  const harness = await loadGameNetHarness({ initialInputState: {
    forward: false,
    backward: false,
    left: false,
    right: false,
    jump: false,
    sprint: false,
    adsActive: false
  } });
  const { GameNet, sentMessages, timeState } = harness;

  harness.handleMessage({
    t: 'welcome',
    selfId: 'usr_test',
    roomId: 'global',
    tickRate: 60,
    inputSendHz: 30,
    worldSeed: 'seed',
    worldProfileVersion: 6,
    worldFlags: { envV2: true, terrainPhysicsV2: true }
  });

  timeState.now = 1000;
  GameNet.update(0.01, { x: 0, y: 1.6, z: 0 }, { yaw: 0, pitch: 0 });
  timeState.now = 1010;
  GameNet.update(0.01, { x: 0, y: 1.6, z: 0 }, { yaw: 0, pitch: 0 });
  assert.equal(sentMessages.filter((message) => message.t === 'input').length, 1);

  harness.setInputState({ right: true });
  timeState.now = 1015;
  GameNet.update(0.005, { x: 0, y: 1.6, z: 0 }, { yaw: 0, pitch: 0 });

  harness.setInputState({});
  timeState.now = 1020;
  GameNet.update(0.005, { x: 0, y: 1.6, z: 0 }, { yaw: 0, pitch: 0 });

  harness.setInputState({ adsActive: true });
  timeState.now = 1025;
  GameNet.update(0.005, { x: 0, y: 1.6, z: 0 }, { yaw: 0, pitch: 0 });

  harness.setInputState({});
  timeState.now = 1030;
  GameNet.update(0.005, { x: 0, y: 1.6, z: 0 }, { yaw: 0, pitch: 0 });

  harness.setInputState({ sprint: true });
  timeState.now = 1035;
  GameNet.update(0.005, { x: 0, y: 1.6, z: 0 }, { yaw: 0, pitch: 0 });

  harness.setInputState({});
  timeState.now = 1040;
  GameNet.update(0.005, { x: 0, y: 1.6, z: 0 }, { yaw: 0, pitch: 0 });

  harness.setInputState({ jump: true });
  timeState.now = 1045;
  GameNet.update(0.005, { x: 0, y: 1.6, z: 0 }, { yaw: 0, pitch: 0 });

  assert.equal(sentMessages.filter((message) => message.t === 'input').length, 8);
});

test('GameNet exposes an unsent input tail while local intent continues past the last sent sample', async () => {
  const harness = await loadGameNetHarness();
  const { GameNet, timeState } = harness;

  timeState.now = 1000;
  GameNet.update(0.05, { x: 0, y: 1.6, z: 0 }, { yaw: 0, pitch: 0 });
  assert.equal(GameNet.view.getInputSyncState().hasUnsentInputTail, true);

  timeState.now = 1005;
  GameNet.update(0.005, { x: 0.03, y: 1.6, z: -0.02 }, { yaw: 0, pitch: 0 });
  assert.equal(GameNet.view.getInputSyncState().hasUnsentInputTail, true);
});

test('GameNet preserves input send remainder after a long frame instead of resetting the cadence cleanly', async () => {
  const harness = await loadGameNetHarness();
  const { GameNet, sentMessages, timeState } = harness;

  timeState.now = 1000;
  GameNet.update(0.05, { x: 0, y: 1.6, z: 0 }, { yaw: 0, pitch: 0 });
  assert.equal(sentMessages.length, 1);

  timeState.now = 1001;
  GameNet.update(0.001, { x: 0.01, y: 1.6, z: -0.01 }, { yaw: 0, pitch: 0 });
  assert.equal(sentMessages.length, 2);
});

test('GameNet tolerates incomplete remote render entries during private-room sync', async () => {
  const harness = await loadGameNetHarness();
  const { GameNet, renderMap, timeState } = harness;

  renderMap.set('usr_remote', {
    id: 'usr_remote'
  });

  timeState.now = 1000;
  assert.doesNotThrow(() => {
    GameNet.update(0.05, { x: 0, y: 1.6, z: 0 }, { yaw: 0, pitch: 0 });
  });
});

test('GameNet maps compact abilityFx snapshot state into client selectors', async () => {
  const harness = await loadGameNetHarness();
  const { GameNet, timeState } = harness;

  timeState.now = 1000;
  harness.handleMessage({
    t: 'welcome',
    selfId: 'usr_test',
    roomId: 'global',
    worldSeed: 'seed',
    worldProfileVersion: 6,
    worldFlags: { envV2: true, terrainPhysicsV2: true }
  });

  harness.handleMessage({
    t: 'snapshot',
    delta: false,
    entities: [
      {
        id: 'usr_test',
        x: 0,
        y: 1.6,
        z: 0,
        yaw: 0,
        pitch: 0,
        seq: 1,
        abilityId: 'choke',
        cooldownRemaining: 1.25,
        abilityFx: {
          chokeCasterUntil: 1250,
          chokeVictim: { startedAt: 900, endsAt: 1300, liftHeight: 1.5 },
          hookedUntil: 1500,
          hookVisual: {
            phase: 'travel',
            targetId: '',
            headPos: { x: 1, y: 2, z: 3 },
            endsAt: 1400
          }
        },
        deadeyeState: {
          lockCount: 1,
          maxLocks: 2,
          nextLockAt: 1200,
          lockEveryMs: 200,
          endsAt: 1800,
          targetIds: ['usr_remote']
        }
      }
    ],
    removedEntityIds: [],
    projectiles: [],
    fireZones: []
  });

  const abilityState = GameNet.view.getSelfAbilityState();
  const chokeVictim = GameNet.view.getChokeVictimStateForEntity('usr_test');

  assert.equal(abilityState.cooldownRemaining, 1.25);
  assert.equal(abilityState.abilityId, 'choke');
  assert.equal(abilityState.chokeState.endsAt, 1250);
  assert.equal(abilityState.hookState.phase, 'travel');
  assert.deepEqual(JSON.parse(JSON.stringify(abilityState.hookState.headPos)), { x: 1, y: 2, z: 3 });
  assert.equal(abilityState.deadeyeState.maxLocks, 2);
  assert.equal(chokeVictim.startedAt, 900);
  assert.equal(chokeVictim.endsAt, 1300);
  assert.equal(chokeVictim.liftHeight, 1.5);
});

test('GameNet updates self ability loadout immediately on class_changed before the next snapshot', async () => {
  const harness = await loadGameNetHarness();
  const { GameNet } = harness;

  harness.handleMessage({
    t: 'welcome',
    selfId: 'usr_test',
    roomId: 'global',
    worldSeed: 'seed',
    worldProfileVersion: 6,
    worldFlags: { envV2: true, terrainPhysicsV2: true }
  });

  harness.handleMessage({
    t: 'snapshot',
    delta: false,
    entities: [
      {
        id: 'usr_test',
        x: 0,
        y: 1.6,
        z: 0,
        yaw: 0,
        pitch: 0,
        seq: 1,
        abilityId: 'choke',
        cooldownRemaining: 2.5,
        abilityFx: null
      }
    ],
    removedEntityIds: [],
    projectiles: [],
    fireZones: []
  });

  harness.handleMessage({
    t: 'class_changed',
    classId: 'abilities',
    abilityId: 'hook'
  });

  assert.equal(GameNet.view.getSelfAbilityState().abilityId, 'hook');
});

test('GameNet preserves the selected weapon loadout locally until snapshots catch up', async () => {
  const harness = await loadGameNetHarness();
  const { GameNet, sentMessages } = harness;

  harness.handleMessage({
    t: 'welcome',
    selfId: 'usr_test',
    roomId: 'global',
    worldSeed: 'seed',
    worldProfileVersion: 6,
    worldFlags: { envV2: true, terrainPhysicsV2: true }
  });

  assert.equal(GameNet.commands.sendWeaponLoadout('sniper', 'rifle'), true);
  assert.deepEqual(sentMessages.at(-1), {
    t: 'weapon_loadout',
    slot1: 'rifle',
    slot2: 'sniper'
  });

  harness.handleMessage({
    t: 'snapshot',
    delta: false,
    entities: [
      {
        id: 'usr_test',
        x: 0,
        y: 1.6,
        z: 0,
        yaw: 0,
        pitch: 0,
        seq: 1,
        weaponId: 'rifle',
        weaponLoadout: ['rifle', 'shotgun']
      }
    ],
    removedEntityIds: [],
    projectiles: [],
    fireZones: []
  });

  assert.deepEqual(JSON.parse(JSON.stringify(GameNet.view.getSelfState().weaponLoadout)), ['rifle', 'sniper']);
  assert.equal(GameNet.view.getSelfState().weaponId, 'rifle');

  harness.handleMessage({
    t: 'snapshot',
    delta: false,
    entities: [
      {
        id: 'usr_test',
        x: 0,
        y: 1.6,
        z: 0,
        yaw: 0,
        pitch: 0,
        seq: 2,
        weaponId: 'rifle',
        weaponLoadout: ['rifle', 'sniper']
      }
    ],
    removedEntityIds: [],
    projectiles: [],
    fireZones: []
  });

  assert.deepEqual(JSON.parse(JSON.stringify(GameNet.view.getSelfState().weaponLoadout)), ['rifle', 'sniper']);
  assert.equal(GameNet.view.getSelfState().weaponId, 'rifle');
});

test('GameNet stores snapshot timing and estimates current server time from snapshots', async () => {
  const harness = await loadGameNetHarness();
  const { GameNet, timeState } = harness;

  timeState.now = 1000;
  harness.handleMessage({
    t: 'snapshot',
    serverTime: 940,
    delta: false,
    entities: [],
    removedEntityIds: [],
    projectiles: [],
    fireZones: []
  });

  assert.deepEqual(JSON.parse(JSON.stringify(GameNet.timing.getSnapshotTimingState())), {
    serverTime: 940,
    receivedAt: 1000,
    serverTimeOffsetMs: 60
  });

  timeState.now = 1065;
  assert.equal(GameNet.timing.getEstimatedServerTime(), 1005);
  assert.deepEqual(JSON.parse(JSON.stringify(GameNet.timing.getConnectionTimingState())), {
    snapshot: {
      serverTime: 940,
      receivedAt: 1000,
      serverTimeOffsetMs: 60,
      intervalMs: 0,
      jitterMs: 0
    },
    rttMs: 0,
    responsiveRttMs: 0,
    pessimisticRttMs: 0,
    rttJitterMs: 0,
    lastPongAt: 0,
    pingCadenceMs: 500
  });
});

test('GameNet does not queue input samples when transport send fails', async () => {
  const harness = await loadGameNetHarness({
    transportSendResult: false
  });
  const { GameNet, sentMessages, timeState } = harness;

  timeState.now = 1000;
  GameNet.update(0.05, { x: 0, y: 1.6, z: 0 }, { yaw: 0, pitch: 0 });
  timeState.now = 1060;
  GameNet.update(0.05, { x: 0, y: 1.6, z: 0 }, { yaw: 0.1, pitch: 0 });

  const syncState = GameNet.view.getInputSyncState();
  assert.equal(sentMessages.length, 0);
  assert.equal(syncState.lastSentSeq, 0);
  assert.equal(syncState.pendingInputCount, 0);
  assert.equal(syncState.ackDrift, 0);
  assert.equal(GameNet.view.getPendingInputSamples().length, 0);
});

test('GameNet clears stale snapshot timing after transport close', async () => {
  const harness = await loadGameNetHarness();
  const { GameNet, timeState, closeTransport } = harness;

  timeState.now = 1000;
  harness.handleMessage({
    t: 'snapshot',
    serverTime: 940,
    delta: false,
    entities: [],
    removedEntityIds: [],
    projectiles: [],
    fireZones: []
  });

  timeState.now = 1065;
  assert.equal(GameNet.timing.getEstimatedServerTime(), 1005);

  closeTransport();
  timeState.now = 6000;
  assert.equal(GameNet.timing.getEstimatedServerTime(), 0);
  assert.equal(GameNet.timing.getConnectionTimingState().snapshot, null);
});

test('GameNet remaps death respawn timing onto the local clock when snapshot timing is available', async () => {
  const harness = await loadGameNetHarness();
  const { GameNet, timeState } = harness;

  harness.handleMessage({
    t: 'welcome',
    selfId: 'usr_test',
    roomId: 'global',
    worldSeed: 'seed',
    worldProfileVersion: 6,
    worldFlags: { envV2: true, terrainPhysicsV2: true }
  });

  timeState.now = 1100;
  harness.handleMessage({
    t: 'snapshot',
    serverTime: 1000,
    delta: false,
    entities: [],
    removedEntityIds: [],
    projectiles: [],
    fireZones: []
  });

  harness.handleMessage({
    t: 'death_respawn',
    entityId: 'usr_test',
    respawnAt: 1300,
    x: 4,
    z: 8
  });

  assert.deepEqual(JSON.parse(JSON.stringify(GameNet.view.getRespawnState())), {
    active: true,
    respawnAt: 1400,
    remainingMs: 300
  });
});

test('GameNet delays death respawn scheduling until snapshot timing is available', async () => {
  const harness = await loadGameNetHarness();
  const { GameNet, timeState } = harness;

  harness.handleMessage({
    t: 'welcome',
    selfId: 'usr_test',
    roomId: 'global',
    worldSeed: 'seed',
    worldProfileVersion: 6,
    worldFlags: { envV2: true, terrainPhysicsV2: true }
  });

  timeState.now = 1100;
  harness.handleMessage({
    t: 'death_respawn',
    entityId: 'usr_test',
    respawnAt: 1300,
    x: 4,
    z: 8
  });

  assert.deepEqual(JSON.parse(JSON.stringify(GameNet.view.getRespawnState())), {
    active: true,
    respawnAt: 0,
    remainingMs: 0
  });

  harness.handleMessage({
    t: 'snapshot',
    serverTime: 1000,
    delta: false,
    entities: [],
    removedEntityIds: [],
    projectiles: [],
    fireZones: []
  });
  GameNet.update(0.016, { x: 0, y: 1.6, z: 0 }, { yaw: 0, pitch: 0 });

  assert.deepEqual(JSON.parse(JSON.stringify(GameNet.view.getRespawnState())), {
    active: true,
    respawnAt: 1400,
    remainingMs: 300
  });
});

test('GameNet sendFire includes estimated server shot time when snapshot timing exists', async () => {
  const harness = await loadGameNetHarness();
  const { GameNet, sentMessages, timeState } = harness;

  timeState.now = 1000;
  harness.handleMessage({
    t: 'snapshot',
    serverTime: 925,
    delta: false,
    entities: [],
    removedEntityIds: [],
    projectiles: [],
    fireZones: []
  });

  timeState.now = 1080;
  assert.equal(GameNet.commands.sendFire('rifle', 'shot_1'), true);
  assert.equal(sentMessages.length, 1);
  assert.equal(sentMessages[0].t, 'fire');
  assert.equal(sentMessages[0].weaponId, 'rifle');
  assert.equal(sentMessages[0].shotToken, 'shot_1');
  assert.deepEqual(sentMessages[0].aimOrigin, logicalHitscanOriginFromEye({ x: 4, y: 5, z: 6 }, sentMessages[0].aimForward));
  assert.equal(sentMessages[0].estimatedServerShotTime, 1005);
});

test('GameNet sendFire omits estimated server shot time when snapshot timing is unavailable', async () => {
  const harness = await loadGameNetHarness();
  const { GameNet, sentMessages } = harness;

  assert.equal(GameNet.commands.sendFire('rifle', 'shot_2'), true);
  assert.equal(sentMessages.length, 1);
  assert.equal('estimatedServerShotTime' in sentMessages[0], false);
});

test('GameNet emits ping messages on the configured cadence while connected', async () => {
  const harness = await loadGameNetHarness();
  const { GameNet, sentMessages, timeState } = harness;

  timeState.now = 1000;
  GameNet.update(0.49);
  assert.equal(sentMessages.length, 0);

  timeState.now = 1510;
  GameNet.update(0.02);
  assert.equal(sentMessages.length, 1);
  assert.equal(sentMessages[0].t, 'ping');
  assert.equal(sentMessages[0].clientTime, 1510);
});

test('GameNet tracks pong RTT and jitter in connection timing state', async () => {
  const harness = await loadGameNetHarness();
  const { GameNet, timeState } = harness;

  timeState.now = 1000;
  harness.handleMessage({
    t: 'snapshot',
    serverTime: 940,
    delta: false,
    entities: [],
    removedEntityIds: [],
    projectiles: [],
    fireZones: []
  });

  timeState.now = 1120;
  harness.handleMessage({
    t: 'pong',
    clientTime: 1000,
    serverTime: 1080
  });

  const timing = JSON.parse(JSON.stringify(GameNet.timing.getConnectionTimingState()));
  assert.equal(timing.rttMs, 120);
  assert.equal(timing.responsiveRttMs, 120);
  assert.equal(timing.pessimisticRttMs, 120);
  assert.equal(timing.rttJitterMs, 0);
  assert.equal(timing.lastPongAt, 1120);
  assert.equal(timing.snapshot.serverTimeOffsetMs, 60);
});

test('GameNet keeps a separate pessimistic RTT estimate for delay decisions after a spike', async () => {
  const harness = await loadGameNetHarness();
  const { GameNet, timeState } = harness;

  timeState.now = 1050;
  harness.handleMessage({
    t: 'pong',
    clientTime: 1000,
    serverTime: 1040
  });

  timeState.now = 1300;
  harness.handleMessage({
    t: 'pong',
    clientTime: 1100,
    serverTime: 1280
  });

  const timing = JSON.parse(JSON.stringify(GameNet.timing.getConnectionTimingState()));
  assert.equal(Number(timing.responsiveRttMs.toFixed(1)), 72.5);
  assert.equal(timing.pessimisticRttMs > timing.responsiveRttMs, true);
  assert.equal(timing.pessimisticRttMs, 200);
});

test('GameNet rejects stale self snapshots before mutating self state', async () => {
  const harness = await loadGameNetHarness();
  const { GameNet, timeState } = harness;

  harness.handleMessage({
    t: 'welcome',
    selfId: 'usr_test',
    roomId: 'global',
    worldSeed: 'seed',
    worldProfileVersion: 6,
    worldFlags: { envV2: true, terrainPhysicsV2: true }
  });

  timeState.now = 1000;
  harness.handleMessage({
    t: 'snapshot',
    serverTime: 960,
    delta: false,
    entities: [{ id: 'usr_test', x: 4, y: 1.6, z: 5, yaw: 0, pitch: 0, seq: 3, hp: 400 }],
    removedEntityIds: [],
    projectiles: [],
    fireZones: []
  });
  timeState.now = 1010;
  harness.handleMessage({
    t: 'snapshot',
    serverTime: 950,
    delta: true,
    entities: [{ id: 'usr_test', x: 0, y: 1.6, z: 0, yaw: 0, pitch: 0, seq: 2, hp: 100 }],
    removedEntityIds: []
  });

  assert.equal(GameNet.view.getSelfState().seq, 3);
  assert.equal(GameNet.view.getSelfState().x, 4);
  assert.equal(GameNet.view.getSelfState().hp, 400);
  assert.equal(GameNet.view.getInputSyncState().lastAckedSeq, 3);
});

test('GameNet accepts wrapped self snapshot sequences when they are newer in modular order', async () => {
  const harness = await loadGameNetHarness();
  const { GameNet, timeState } = harness;

  harness.handleMessage({
    t: 'welcome',
    selfId: 'usr_test',
    roomId: 'global',
    worldSeed: 'seed',
    worldProfileVersion: 6,
    worldFlags: { envV2: true, terrainPhysicsV2: true }
  });

  timeState.now = 1000;
  harness.handleMessage({
    t: 'snapshot',
    serverTime: 960,
    delta: false,
    entities: [{ id: 'usr_test', x: 4, y: 1.6, z: 5, yaw: 0, pitch: 0, seq: 4294967294, hp: 400 }],
    removedEntityIds: [],
    projectiles: [],
    fireZones: []
  });
  timeState.now = 1010;
  harness.handleMessage({
    t: 'snapshot',
    serverTime: 970,
    delta: true,
    entities: [{ id: 'usr_test', x: 9, y: 1.6, z: 8, yaw: 0, pitch: 0, seq: 1, hp: 375 }],
    removedEntityIds: []
  });

  assert.equal(GameNet.view.getSelfState().seq, 1);
  assert.equal(GameNet.view.getSelfState().x, 9);
  assert.equal(GameNet.view.getSelfState().hp, 375);
  assert.equal(GameNet.view.getInputSyncState().lastAckedSeq, 1);
});

test('GameNet preserves authoritative projectile and fire zone state when delta snapshots omit them', async () => {
  const harness = await loadGameNetHarness();
  const { GameNet, timeState } = harness;

  timeState.now = 1000;
  harness.handleMessage({
    t: 'snapshot',
    serverTime: 940,
    delta: false,
    entities: [],
    removedEntityIds: [],
    projectiles: [{ id: 'proj_1' }],
    fireZones: [{ id: 'zone_1' }]
  });
  harness.handleMessage({
    t: 'snapshot',
    serverTime: 973,
    delta: true,
    entities: [{ id: 'usr_remote', x: 1, y: 1.6, z: 2 }],
    removedEntityIds: []
  });

  const throwableState = GameNet.view.getAuthoritativeThrowableState();
  assert.deepEqual(JSON.parse(JSON.stringify(throwableState.projectiles)), [{ id: 'proj_1' }]);
  assert.deepEqual(JSON.parse(JSON.stringify(throwableState.fireZones)), [{ id: 'zone_1' }]);
});
