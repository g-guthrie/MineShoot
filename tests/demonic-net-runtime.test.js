import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

async function loadNetRuntime() {
  const transportCode = await fs.readFile(new URL('../demonic/gameplay/net/transport.js', import.meta.url), 'utf8');
  const inputHistoryCode = await fs.readFile(new URL('../demonic/gameplay/net/input-history.js', import.meta.url), 'utf8');
  const stateViewCode = await fs.readFile(new URL('../demonic/gameplay/net/state-view.js', import.meta.url), 'utf8');
  const runtimeCode = await fs.readFile(new URL('../demonic/gameplay/net/runtime.js', import.meta.url), 'utf8');
  const sentMessages = [];
  const sandbox = {
    __MAYHEM_RUNTIME: {
      GameShared: {
        protocol: {
          defaults: { roomId: 'global' },
          wsPath: '/api/ws',
          msg: {
            c2s: { INPUT: 'input' },
            s2c: { WELCOME: 'welcome', SNAPSHOT: 'snapshot', ERROR: 'error' }
          }
        }
      },
      GameRuntimeProfile: {
        resolveApiUrl(path) {
          return 'https://mayhem.test' + String(path || '');
        },
        resolveWsUrl(path) {
          return 'wss://mayhem.test' + String(path || '');
        }
      },
      GameNetAuth: {
        ensureArenaIdentity() {
          return Promise.resolve();
        },
        getSocketPlayerId() {
          return 'ply_test';
        },
        getSocketIdentity() {
          return { id: 'usr_test', username: 'Test', classId: 'abilities' };
        }
      }
    },
    __DEMONIC_RUNTIME: {},
    globalThis: null,
    console,
    Date,
    URLSearchParams,
    setTimeout(fn) {
      fn();
      return 1;
    },
    clearTimeout() {}
  };
  sandbox.globalThis = sandbox;
  const context = vm.createContext(sandbox);
  vm.runInContext(transportCode, context);
  vm.runInContext(inputHistoryCode, context);
  vm.runInContext(stateViewCode, context);
  vm.runInContext(runtimeCode, context);
  sandbox.__DEMONIC_RUNTIME.GameNetTransport = {
    create(options) {
      return {
        connect() {
          options.onOpen({
            readyState: 1,
            send(payload) {
              sentMessages.push(JSON.parse(payload));
            },
            close() {}
          });
        },
        send(msg) {
          sentMessages.push(msg);
          return true;
        },
        shutdown() {}
      };
    }
  };
  return {
    api: sandbox.__DEMONIC_RUNTIME.GameNetRuntime,
    sentMessages
    ,
    getSocket() {
      return null;
    }
  };
}

test('demonic net runtime ingests welcome and snapshot state from the authoritative lane', async () => {
  const harness = await loadNetRuntime();
  const net = harness.api.create({
    mode: {
      id: 'single_cloudflare',
      authorityMode: 'networked',
      backendKind: 'cloudflare-prod',
      roomId: 'cf-room-1'
    },
    context: { roomId: 'cf-room-1' }
  });

  net.captureLocalIntent({
    inputState: { moveForward: true, sprint: true },
    yaw: 0.5,
    pitch: 0.1,
    weaponId: 'machinegun'
  });
  net.setLocalSelfState({ x: 1, z: 2, weaponId: 'machinegun' });
  net.update(0.05);
  await Promise.resolve();
  net.update(0.05);
  net.receiveMessage({
    t: 'welcome',
    selfId: 'usr_test',
    roomId: 'cf-room-1',
    gameMode: 'ffa',
    tickRate: 30,
    worldSeed: 'seed-a',
    worldProfileVersion: 6,
    worldFlags: { envV2: true, terrainPhysicsV2: true }
  });
  net.receiveMessage({
    t: 'snapshot',
    gameMode: 'ffa',
    privateRoomPhase: '',
    matchState: { started: true },
    entities: [
      { id: 'usr_test', x: 10, z: 20, seq: 1, weaponId: 'machinegun' }
    ]
  });
  const snapshot = net.getSnapshot();

  assert.equal(snapshot.authoritative, true);
  assert.equal(snapshot.selfId, 'usr_test');
  assert.equal(snapshot.tickRate, 30);
  assert.equal(snapshot.inputSync.lastSentSeq >= 1, true);
  assert.equal(snapshot.inputSync.lastAckedSeq, 1);
  assert.equal(snapshot.inputSync.pendingInputCount >= 0, true);
  assert.equal(snapshot.selfState.id, 'usr_test');
  assert.equal(snapshot.predictedSelfState.weaponId, 'machinegun');
  assert.match(snapshot.status, /authoritative cloudflare lane/i);
});
