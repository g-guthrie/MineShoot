import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

async function loadScript(modulePath, sandbox) {
  const code = await fs.readFile(new URL(modulePath, import.meta.url), 'utf8');
  vm.runInContext(code, vm.createContext(sandbox));
}

test('GameNet forwards getMatchState through GameNetStateView wiring', async () => {
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
        copy(v) { this.x = v.x; this.y = v.y; this.z = v.z; return this; }
      }
    },
    globalThis: {
      __MAYHEM_RUNTIME: {
        GameShared: {
          protocol: {
            msg: { c2s: {}, s2c: {} },
            wsPath: '/api/ws',
            sanitizeRoomId(value) { return String(value || ''); },
            cloneWorldFlags(flags) { return { ...(flags || {}) }; },
            buildExpectedWorldMeta() {
              return {
                roomId: 'test-room',
                worldSeed: 'seed',
                worldProfileVersion: 1,
                worldFlags: {}
              };
            },
            normalizeAbilityLoadoutPayload() { return {}; },
            normalizeClassCastPayload() { return {}; },
            normalizeThrowPayload() { return {}; }
          }
        },
        GameNetAuth: {},
        GameNetEntities: {
          classStats() { return { armorMax: 100, wallhackRadius: 0 }; },
          getRenderMap() { return new Map(); },
          updateFromSnapshot() {},
          removeRemoteVisual() {}
        },
        GameNetRuntimeAccess: {
          create() {
            return {
              buildWsEndpoint() { return 'ws://example.test'; },
              getActiveWorldMeta() { return null; },
              getCurrentUser() { return null; },
              getSocketIdentity() { return null; },
              getPlayerApi() { return null; },
              damagePointY(y) { return y; },
              markerPointY(y) { return y; }
            };
          }
        },
        GameNetMessageRouter: {
          create() {
            return { handleMessage() {} };
          }
        },
        GameNetRuntimeCore: {
          create() {
            return {
              connectWs() {},
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

  await loadScript('../../js/net/state-view.js', sandbox);
  await loadScript('../../js/net/network.js', sandbox);

  assert.equal(
    sandbox.globalThis.__MAYHEM_RUNTIME.GameNet.getMatchState(),
    null
  );
});
