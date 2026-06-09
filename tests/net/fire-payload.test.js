import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

async function loadFirePayloadApi() {
  const sandbox = {
    console,
    globalThis: {
      __MAYHEM_RUNTIME: {}
    }
  };
  const context = vm.createContext(sandbox);
  const code = await fs.readFile(new URL('../../js/net/network-fire-payload.js', import.meta.url), 'utf8');
  vm.runInContext(code, context);
  return sandbox.globalThis.__MAYHEM_RUNTIME.GameNetFirePayload;
}

test('fire payload subtracts the displayed remote-pose delay from shot time', async () => {
  const firePayload = await loadFirePayloadApi();

  const payload = firePayload.buildPayload({
    msgType: 'fire',
    weaponId: 'rifle',
    shotToken: 'displayed-target',
    fireIntent: {
      aimForward: { x: 0, y: 0, z: -1 },
      aimOrigin: { x: 0, y: 1.6, z: 0 },
      presentationDelayMs: 84
    },
    sharedApi: {
      getNetworkTuning() {
        return {
          remoteInterpolation: {
            maxDelayMs: 180,
            lossDelayPaddingMaxMs: 160
          }
        };
      }
    },
    connectionTiming: {
      getEstimatedServerTime() { return 5000; }
    }
  });

  assert.equal(payload.estimatedServerShotTime, 4916);
});

test('fire payload bounds presentation delay with remote interpolation tuning', async () => {
  const firePayload = await loadFirePayloadApi();

  assert.equal(firePayload.resolveEstimatedServerShotTime({
    fireIntent: { presentationDelayMs: 900 },
    sharedApi: {
      getNetworkTuning() {
        return {
          remoteInterpolation: {
            maxDelayMs: 120,
            lossDelayPaddingMaxMs: 30
          }
        };
      }
    },
    connectionTiming: {
      getEstimatedServerTime() { return 5000; }
    }
  }), 4850);
});
