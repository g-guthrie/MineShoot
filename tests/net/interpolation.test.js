import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

async function loadInterpolation() {
  const code = await fs.readFile(new URL('../../js/net/interpolation.js', import.meta.url), 'utf8');
  const sandbox = {
    __MAYHEM_RUNTIME: {
      GameShared: {
        gameplayTuning: null
      }
    },
    globalThis: null,
    console,
    Date,
    Math,
    Number,
    isFinite
  };
  sandbox.globalThis = sandbox;
  const context = vm.createContext(sandbox);
  vm.runInContext(code, context);
  return sandbox.__MAYHEM_RUNTIME.GameNetInterpolation;
}

test('interpolation smoothClockOffset uses the medium correction band for moderate drift', async () => {
  const interpolation = await loadInterpolation();
  const nextOffset = interpolation.smoothClockOffset(100, 170, 120);
  assert.equal(Number(nextOffset.toFixed(2)), 114);
});

test('interpolation extrapolation curve keeps more early motion and cuts harder near the cap', async () => {
  const interpolation = await loadInterpolation();
  const earlyScale = interpolation.dampedExtrapolationScale(10, 40, 40, { extrapolationDecay: 1.2 });
  const endScale = interpolation.dampedExtrapolationScale(40, 40, 40, { extrapolationDecay: 1.2 });
  const oldEarlyScale = (10 / 40) * (1 - ((10 / 40) * 0.4));
  const oldEndScale = 1 * (1 - (1 * 0.4));

  assert.equal(earlyScale > oldEarlyScale, true);
  assert.equal(endScale < oldEndScale, true);
});

test('interpolation uses a ballistic vertical curve when both samples are airborne', async () => {
  const interpolation = await loadInterpolation();
  const nextFootY = interpolation.interpolateFootY(
    {
      footY: 0,
      velocityY: 8,
      isGrounded: false
    },
    {
      footY: 1.24,
      velocityY: 4.4,
      isGrounded: false
    },
    0.5,
    200,
    {
      verticalBallisticEnabled: true,
      gravityWuPerSecSq: 18
    }
  );

  assert.equal(Number(nextFootY.toFixed(2)), 0.71);
});
