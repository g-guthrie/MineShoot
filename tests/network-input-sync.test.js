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
} from '../shared/protocol.js';

async function loadGameNetHarness() {
  const renderMap = new Map();
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
          c2s: { INPUT: 'input' },
          s2c: { WELCOME: 'welcome', SNAPSHOT: 'snapshot' }
        }
      },
      entityPoints: {}
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
            if (hooks.onProjectiles) hooks.onProjectiles(Array.isArray(projectiles) ? projectiles : []);
            if (hooks.onFireZones) hooks.onFireZones(Array.isArray(fireZones) ? fireZones : []);
          }
        };
      }
    },
    GamePlayer: {
      getAnimNetState() {
        return { equippedWeaponId: 'rifle' };
      },
      getNetworkInputState() {
        return {
          forward: true,
          backward: false,
          left: false,
          right: false,
          jump: false,
          sprint: false,
          adsActive: false
        };
      },
      getEyeWorldPosition() {
        return { x: 10, y: 11, z: 12 };
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
  for (const path of [
    '../js/ability-fx.js',
    '../js/net/runtime-access.js',
    '../js/net/message-router.js',
    '../js/net/runtime-core.js',
    '../js/net/state-view.js',
    '../js/network.js'
  ]) {
    const code = await fs.readFile(new URL(path, import.meta.url), 'utf8');
    vm.runInContext(code, context);
  }
  const GameNet = sandbox.globalThis.__MAYHEM_RUNTIME.GameNet;

  const sentMessages = [];
  let transportHooks = null;
  runtime.GameNetTransport = {
    create(opts) {
      transportHooks = opts;
      return {
        connect() {
          const socket = { readyState: 1 };
          if (opts.onOpen) opts.onOpen(socket);
        },
        send(msg) {
          sentMessages.push(JSON.parse(JSON.stringify(msg)));
          return true;
        },
        shutdown() {}
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
  const syncState = GameNet.getInputSyncState();
  const pending = GameNet.getPendingInputSamples();
  assert.equal(syncState.pendingInputCount, 2);
  assert.equal(pending.length, 2);
  assert.equal(pending[0].dtMs, 33);
  assert.equal(pending[1].dtMs, 60);
});

test('GameNet fire payload uses player eye origin before falling back to camera position', async () => {
  const harness = await loadGameNetHarness();
  const { GameNet, sentMessages } = harness;

  GameNet.sendFire('rifle', 'shot-1');

  assert.equal(sentMessages.length, 1);
  assert.deepEqual(sentMessages[0].aimOrigin, {
    x: 10,
    y: 11,
    z: 12
  });
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

  const syncState = GameNet.getInputSyncState();
  const pending = GameNet.getPendingInputSamples();
  assert.equal(syncState.lastAckedSeq, 1);
  assert.equal(syncState.pendingInputCount, 1);
  assert.equal(pending[0].seq, 2);
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
        abilityLoadout: { slot1: 'choke', slot2: 'missile' },
        slot1CooldownRemaining: 1.25,
        slot2CooldownRemaining: 5,
        abilityFx: {
          chokeCasterUntil: 1250,
          chokeVictim: { startedAt: 900, endsAt: 1300, liftHeight: 1.5 },
          hookedUntil: 1500,
          hookVisual: {
            phase: 'travel',
            targetId: '',
            headPos: { x: 1, y: 2, z: 3 },
            endsAt: 1400
          },
          healUntil: 1600
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

  const abilityState = GameNet.getSelfAbilityState();
  const chokeVictim = GameNet.getChokeVictimStateForEntity('usr_test');

  assert.equal(abilityState.slot1CooldownRemaining, 1.25);
  assert.equal(abilityState.chokeState.endsAt, 1250);
  assert.equal(abilityState.hookState.phase, 'travel');
  assert.deepEqual(JSON.parse(JSON.stringify(abilityState.hookState.headPos)), { x: 1, y: 2, z: 3 });
  assert.equal(abilityState.healState.endsAt, 1600);
  assert.equal(abilityState.deadeyeState.maxLocks, 2);
  assert.equal(chokeVictim.startedAt, 900);
  assert.equal(chokeVictim.endsAt, 1300);
  assert.equal(chokeVictim.liftHeight, 1.5);
});
