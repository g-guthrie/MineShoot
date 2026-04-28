import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

function getGameNetRuntimeScriptUrls() {
  return [
    new URL('../../js/net/join-state.js', import.meta.url),
    new URL('../../js/net/connection-timing.js', import.meta.url),
    new URL('../../js/net/runtime-state.js', import.meta.url),
    new URL('../../js/net/commands.js', import.meta.url),
    new URL('../../js/net/network-access.js', import.meta.url),
    new URL('../../js/net/network-config.js', import.meta.url),
    new URL('../../js/net/network-fire-payload.js', import.meta.url),
    new URL('../../js/net/network-loadout.js', import.meta.url),
    new URL('../../js/net/message-router.js', import.meta.url),
    new URL('../../js/net/runtime-core.js', import.meta.url),
    new URL('../../js/net/network-snapshot-buffer.js', import.meta.url),
    new URL('../../js/net/network-snapshot-apply.js', import.meta.url),
    new URL('../../js/net/state-view.js', import.meta.url),
    new URL('../../js/net/effects.js', import.meta.url),
    new URL('../../js/net/network.js', import.meta.url)
  ];
}

async function loadScript(modulePath, sandbox) {
  const code = await fs.readFile(modulePath instanceof URL ? modulePath : new URL(modulePath, import.meta.url), 'utf8');
  vm.runInContext(code, vm.createContext(sandbox));
}

async function createNetHarness() {
  let runtimeCoreOpts = null;

  const sandbox = {
    console,
    setTimeout,
    clearTimeout,
    Date,
    Map,
    URLSearchParams,
    WebSocket: function WebSocket() {},
    THREE: {
      Vector3: class Vector3 {
        constructor(x = 0, y = 0, z = 0) {
          this.x = x;
          this.y = y;
          this.z = z;
        }

        copy(v) {
          this.x = Number(v && v.x || 0);
          this.y = Number(v && v.y || 0);
          this.z = Number(v && v.z || 0);
          return this;
        }
      }
    },
    globalThis: {
      __MAYHEM_RUNTIME: {
        GameShared: {
          protocol: {
            msg: {
              c2s: {
                INPUT: 'input',
                FIRE: 'fire',
                EQUIP_WEAPON: 'equip_weapon',
                WEAPON_LOADOUT: 'weapon_loadout',
                THROW: 'throw',
                CLASS_QUEUE: 'class_queue',
                CLASS_CAST: 'class_cast'
              },
              s2c: {
                WELCOME: 'welcome',
                SNAPSHOT: 'snapshot'
              }
            },
            wsPath: '/api/ws',
            sanitizeRoomId(value) { return String(value || '').toLowerCase(); },
            cloneWorldFlags(flags) { return { ...(flags || {}) }; },
            buildExpectedWorldMeta(roomId) {
              return {
                roomId: String(roomId || ''),
                worldSeed: 'seed-' + String(roomId || ''),
                worldProfileVersion: 1,
                worldFlags: { envV2: true, terrainPhysicsV2: true }
              };
            },
            normalizeAbilityLoadoutPayload() { return {}; },
            normalizeClassCastPayload() { return {}; },
            normalizeThrowPayload() { return {}; },
            normalizeWeaponLoadoutPayload(slot1, slot2) { return { slot1, slot2 }; }
          }
        },
        GameNetAuth: {
          getSocketIdentity() { return { id: 'user-1' }; },
          ensureArenaIdentity() { return Promise.resolve({ id: 'user-1' }); }
        },
        GameNetEntities: {
          classStats() { return { armorMax: 100, wallhackRadius: 0 }; },
          getHitboxArray() { return []; },
          getRenderMap() { return new Map(); },
          updateFromSnapshot() {},
          removeRemoteVisual() {},
          init() {},
          cleanup() {},
          setHitboxVisibility() {}
        },
        GameNetRuntimeCore: {
          create(opts) {
            runtimeCoreOpts = opts;
            return {
              connectWs() {
                if (opts.onTransportConnectStart) opts.onTransportConnectStart();
              },
              shutdownConnection() {},
              clearReconnectTimer() {},
              update() {},
              wsSend() { return false; }
            };
          }
        },
        GameNetSnapshots: null,
        GameAbilityFx: null
      }
    }
  };

  const scriptUrls = getGameNetRuntimeScriptUrls().filter((scriptUrl) => {
    const href = String(scriptUrl);
    return !href.endsWith('/js/net/runtime-core.js');
  });

  for (const scriptUrl of scriptUrls) {
    await loadScript(scriptUrl, sandbox);
  }

  const net = sandbox.globalThis.__MAYHEM_RUNTIME.GameNet;
  net.setRoomId('ffa-01');

  return {
    net,
    init() {
      net.init({});
    },
    dispatch(message) {
      runtimeCoreOpts.handleMessage(JSON.stringify(message));
    },
    close() {
      if (runtimeCoreOpts.onTransportClose) runtimeCoreOpts.onTransportClose();
    },
    error() {
      if (runtimeCoreOpts.onTransportError) runtimeCoreOpts.onTransportError();
    }
  };
}

test('GameNet join attempt resolves only after matching welcome and self snapshot', async () => {
  const harness = await createNetHarness();
  const joinPromise = harness.net.beginJoinAttempt({ expectedRoomId: 'ffa-01', timeoutMs: 100 });
  harness.init();

  harness.dispatch({
    t: 'welcome',
    selfId: 'user-1',
    roomId: 'ffa-01',
    gameMode: 'ffa',
    matchState: { gameMode: 'ffa', started: false, ended: false },
    worldSeed: 'seed-ffa-01',
    worldProfileVersion: 1,
    worldFlags: { envV2: true, terrainPhysicsV2: true }
  });

  let settled = false;
  joinPromise.then(() => { settled = true; }, () => { settled = true; });
  await Promise.resolve();
  assert.equal(settled, false);

  harness.dispatch({
    t: 'snapshot',
    gameMode: 'ffa',
    matchState: { gameMode: 'ffa', started: false, ended: false },
    entities: [{ id: 'user-1', username: 'ALPHA', alive: true }],
    projectiles: [],
    fireZones: []
  });

  const result = await joinPromise;
  assert.equal(result.roomId, 'ffa-01');
  assert.equal(result.selfId, 'user-1');
  assert.equal(harness.net.view.getSelfState().id, 'user-1');
});

test('GameNet join attempt rejects when the websocket closes before authoritative join completes', async () => {
  const harness = await createNetHarness();
  const joinPromise = harness.net.beginJoinAttempt({ expectedRoomId: 'ffa-01', timeoutMs: 100 });
  harness.init();
  harness.close();

  await assert.rejects(joinPromise, /Disconnected while joining room FFA-01\./);
});

test('GameNet join attempt rejects on welcome room mismatch', async () => {
  const harness = await createNetHarness();
  const joinPromise = harness.net.beginJoinAttempt({ expectedRoomId: 'ffa-01', timeoutMs: 100 });
  harness.init();

  harness.dispatch({
    t: 'welcome',
    selfId: 'user-1',
    roomId: 'tdm-02',
    gameMode: 'tdm',
    matchState: { gameMode: 'tdm', started: false, ended: false },
    worldSeed: 'seed-tdm-02',
    worldProfileVersion: 1,
    worldFlags: { envV2: true, terrainPhysicsV2: true }
  });

  await assert.rejects(joinPromise, /Joined unexpected room TDM-02 while expecting FFA-01\./);
});

test('GameNet join attempt rejects on timeout before authoritative join', async () => {
  const harness = await createNetHarness();
  const joinPromise = harness.net.beginJoinAttempt({ expectedRoomId: 'ffa-01', timeoutMs: 5 });
  harness.init();

  await assert.rejects(joinPromise, /Timed out joining room FFA-01\./);
});

test('GameNet join attempt rejects an older attempt when a newer join begins', async () => {
  const harness = await createNetHarness();
  const firstJoin = harness.net.beginJoinAttempt({ expectedRoomId: 'ffa-01', timeoutMs: 100 });
  const secondJoin = harness.net.beginJoinAttempt({ expectedRoomId: 'tdm-02', timeoutMs: 100 });

  await assert.rejects(firstJoin, /Superseded by a newer room join attempt\./);

  harness.init();
  harness.dispatch({
    t: 'welcome',
    selfId: 'user-1',
    roomId: 'tdm-02',
    gameMode: 'tdm',
    matchState: { gameMode: 'tdm', started: false, ended: false },
    worldSeed: 'seed-tdm-02',
    worldProfileVersion: 1,
    worldFlags: { envV2: true, terrainPhysicsV2: true }
  });
  harness.dispatch({
    t: 'snapshot',
    gameMode: 'tdm',
    matchState: { gameMode: 'tdm', started: false, ended: false },
    entities: [{ id: 'user-1', username: 'ALPHA', alive: true }],
    projectiles: [],
    fireZones: []
  });

  const result = await secondJoin;
  assert.equal(result.roomId, 'tdm-02');
});
