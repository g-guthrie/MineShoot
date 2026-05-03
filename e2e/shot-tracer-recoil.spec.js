import { test, expect } from '@playwright/test';

async function launchSandboxRuntime(page) {
  await page.goto('/');
  await page.locator('#game-modes-toggle-btn').click();
  await page.locator('#sandbox-mode-btn').click();
  await page.locator('#primary-launch-btn').click();
  await expect(page.locator('#active-match-shell')).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('#play-btn')).toHaveText(/enter match/i);
  await page.locator('#play-btn').click();
  await expect.poll(() => page.evaluate(() => !!window.__MAYHEM_RUNTIME.GameWorld)).toBe(true);
  await expect.poll(() => page.evaluate(() => !!(
    window.__MAYHEM_RUNTIME.GameRuntimeLoader &&
    window.__MAYHEM_RUNTIME.GameRuntimeLoader.getLoadedGameplayRuntime &&
    window.__MAYHEM_RUNTIME.GameRuntimeLoader.getLoadedGameplayRuntime()
  ))).toBe(true);
}

test('browser fire uses one shot sample for local tracer and network intent origin', async ({ page }) => {
  await launchSandboxRuntime(page);

  const proof = await page.evaluate(() => {
    const runtime = window.__MAYHEM_RUNTIME;
    const camera = runtime.GamePlayer.getCamera();
    const originalMuzzle = runtime.GamePlayer.getMuzzleWorldPosition;
    const originalSpawnTracer = runtime.GameWorldTracerFx.spawnTracer;
    const tracerSpawns = [];
    let muzzle = { x: 2, y: 1.75, z: -0.35 };

    try {
      runtime.GameHitscan.setWeapon('rifle');
      runtime.GamePlayer.getMuzzleWorldPosition = function (outVec3) {
        if (outVec3 && outVec3.set) return outVec3.set(muzzle.x, muzzle.y, muzzle.z);
        return { x: muzzle.x, y: muzzle.y, z: muzzle.z };
      };
      runtime.GameWorldTracerFx.spawnTracer = function (_camera, _weapon, endPoint, originPoint) {
        tracerSpawns.push({
          origin: { x: originPoint.x, y: originPoint.y, z: originPoint.z },
          end: { x: endPoint.x, y: endPoint.y, z: endPoint.z }
        });
      };

      const shotToken = 'e2e-shot-sample';
      const shotSample = runtime.GameHitscan.captureShotSample(camera, shotToken);
      muzzle = { x: 9, y: 9, z: 9 };
      const fired = runtime.GameHitscan.fire(camera, () => {}, () => {}, shotToken, shotSample);
      const intent = runtime.GameHitscan.buildNetworkFireIntent(shotToken, shotSample);

      return { fired, tracerSpawns, intent };
    } finally {
      runtime.GameWorldTracerFx.spawnTracer = originalSpawnTracer;
      runtime.GamePlayer.getMuzzleWorldPosition = originalMuzzle;
    }
  });

  expect(proof.fired).toBe(true);
  expect(proof.tracerSpawns).toHaveLength(1);
  expect(proof.tracerSpawns[0].origin).toEqual({ x: 2, y: 1.75, z: -0.35 });
  expect(proof.intent.aimOrigin).toEqual({ x: 2, y: 1.75, z: -0.35 });
});

test('browser shot effects drive remote tracer and fire presentation together', async ({ page }) => {
  await launchSandboxRuntime(page);

  const proof = await page.evaluate(() => {
    const runtime = window.__MAYHEM_RUNTIME;
    const originalNet = runtime.GameNet;
    const originalSpawnTracer = runtime.GameWorldTracerFx.spawnTracer;
    const tracerSpawns = [];
    const actions = [];
    const muzzleStates = [];
    const queue = [{
      sourceId: 'remote-e2e',
      weaponId: 'rifle',
      shotToken: 'remote-shot-e2e',
      origin: { x: 4, y: 5, z: 6 },
      traces: [{ x: 8, y: 9, z: 10, pelletIndex: 0, hitType: 'miss' }]
    }];
    const render = {
      actorVisual: {
        getMuzzleWorldPosition(outVec3) {
          if (outVec3 && outVec3.set) return outVec3.set(1, 2, 3);
          return { x: 1, y: 2, z: 3 };
        },
        setMuzzleVisible(visible) {
          muzzleStates.push(!!visible);
        },
        triggerAction(action, options) {
          actions.push({
            action: String(action || ''),
            shotToken: String(options && options.shotToken || '')
          });
        }
      }
    };

    try {
      runtime.GameWorldTracerFx.spawnTracer = function (_camera, _weapon, endPoint, originPoint) {
        tracerSpawns.push({
          origin: { x: originPoint.x, y: originPoint.y, z: originPoint.z },
          end: { x: endPoint.x, y: endPoint.y, z: endPoint.z }
        });
      };
      runtime.GameNet = {
        ...(originalNet || {}),
        view: {
          ...((originalNet && originalNet.view) || {}),
          consumeDamageFeedback() { return null; },
          consumeShotEffect() { return queue.shift() || null; },
          consumeShotReject() { return null; }
        },
        remoteEntities: {
          getRenderMap() {
            return new Map([['remote-e2e', render]]);
          }
        }
      };

      runtime.GameNetFeedbackSync.syncGameplayFeedback({
        camera: runtime.GamePlayer.getCamera(),
        selfState: { id: 'local-e2e' }
      });

      return {
        tracerSpawns,
        actions,
        muzzleStates,
        muzzleVisible: render._muzzleVisible,
        flashUntil: Number(render._localMuzzleFlashUntilMs || 0),
        now: Date.now()
      };
    } finally {
      runtime.GameNet = originalNet;
      runtime.GameWorldTracerFx.spawnTracer = originalSpawnTracer;
    }
  });

  expect(proof.tracerSpawns).toEqual([{
    origin: { x: 4, y: 5, z: 6 },
    end: { x: 8, y: 9, z: 10 }
  }]);
  expect(proof.actions).toEqual([{ action: 'fire', shotToken: 'remote-shot-e2e' }]);
  expect(proof.muzzleStates).toEqual([true]);
  expect(proof.muzzleVisible).toBe(true);
  expect(proof.flashUntil).toBeGreaterThanOrEqual(proof.now);
});
