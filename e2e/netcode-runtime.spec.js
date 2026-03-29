import { test, expect } from '@playwright/test';

import {
  SNAPSHOT_TIMEOUT_MS,
  applyFixture,
  distanceXZ,
  forceNetworkDisconnect,
  getEntitySnapshotSeqs,
  getLatestSnapshotServerTime,
  holdMovementKey,
  openLayout,
  openMatchPage,
  sampleOwnerCorrectionPath,
  sampleRemotePresentedPath,
  setNetImpairment,
  summarizeMotionSamples,
  triggerRealFire
} from './helpers/browser-worker-harness.js';

async function waitForPlayerState(page, userId, expected, timeoutMs = SNAPSHOT_TIMEOUT_MS) {
  await page.waitForFunction(({ userId, expected }) => {
    const api = window.__MAYHEM_TEST_API;
    if (!api || !api.getSelfState || !api.getRemotePresentedState) return false;
    const selfState = api.getSelfState();
    const state = selfState && String(selfState.id || '') === String(userId || '')
      ? selfState
      : api.getRemotePresentedState(userId);
    if (!state) return false;
    if (Math.abs(Number(state.x || 0) - Number(expected.x || 0)) > 0.1) return false;
    if (Math.abs(Number(state.z || 0) - Number(expected.z || 0)) > 0.1) return false;
    return true;
  }, { userId, expected }, { timeout: timeoutMs });
}

async function waitForEntityOnPage(page, entityId, timeoutMs = SNAPSHOT_TIMEOUT_MS) {
  await page.waitForFunction((entityId) => {
    const api = window.__MAYHEM_TEST_API;
    return !!(api && api.getRemotePresentedState && api.getRemotePresentedState(entityId));
  }, entityId, { timeout: timeoutMs });
}

test.describe('netcode browser harness', () => {
  test.setTimeout(180_000);
  test.afterEach(async () => {
    await new Promise((resolve) => setTimeout(resolve, 5500));
  });

  test('real local fire path lands damage and predicted feedback under impairment', async ({ browser }) => {
    const roomId = 'local-shared';
    const shooter = await openMatchPage(browser, {
      roomId,
      modeId: 'single_dev_server',
      label: 'browser_fire_shooter',
      netImpairment: {
        outboundDelayMs: 70,
        outboundJitterMs: 20,
        inboundDelayMs: 60,
        inboundJitterMs: 20
      }
    });
    const target = await openMatchPage(browser, {
      roomId,
      modeId: 'single_dev_server',
      label: 'browser_fire_target'
    });

    try {
      const closeTarget = { x: openLayout.mover.x, z: openLayout.mover.z - 6 };
      const fixture = await applyFixture(shooter.page, roomId, [
        { userId: shooter.userId, x: openLayout.mover.x, z: openLayout.mover.z, yaw: 0, pitch: 0, clearSpawnShield: true, weaponId: 'shotgun' },
        { userId: target.userId, x: closeTarget.x, z: closeTarget.z, yaw: Math.PI, pitch: 0, clearSpawnShield: true, weaponId: 'rifle' }
      ]);
      expect(fixture && fixture.ok, JSON.stringify(fixture)).toBeTruthy();

      await waitForPlayerState(shooter.page, shooter.userId, openLayout.mover);
      await waitForPlayerState(target.page, target.userId, closeTarget);
      await shooter.page.waitForFunction(() => {
        const api = window.__MAYHEM_TEST_API;
        const selfState = api && api.getSelfState ? api.getSelfState() : null;
        return !!selfState && String(selfState.weaponId || '') === 'shotgun';
      }, null, { timeout: SNAPSHOT_TIMEOUT_MS });
      await waitForEntityOnPage(shooter.page, target.userId);
      await waitForEntityOnPage(target.page, shooter.userId);

      const initialHp = await target.page.evaluate(() => {
        const api = window.__MAYHEM_TEST_API;
        const selfState = api && api.getSelfState ? api.getSelfState() : null;
        return Number(selfState && selfState.hp || 0);
      });

      let hitLanded = false;
      for (let attempt = 0; attempt < 4 && !hitLanded; attempt++) {
        await triggerRealFire(shooter.page, { adsActive: false });
        await target.page.waitForFunction((initialHp) => {
          const api = window.__MAYHEM_TEST_API;
          const selfState = api && api.getSelfState ? api.getSelfState() : null;
          return !!selfState && Number(selfState.hp || 0) < Number(initialHp || 0);
        }, initialHp, { timeout: 4000 }).catch(() => null);
        const currentHp = await target.page.evaluate(() => {
          const api = window.__MAYHEM_TEST_API;
          const selfState = api && api.getSelfState ? api.getSelfState() : null;
          return Number(selfState && selfState.hp || 0);
        });
        hitLanded = currentHp < initialHp;
      }

      expect(hitLanded).toBe(true);
      await shooter.page.waitForFunction(() => {
        const hitmarker = document.getElementById('hitmarker');
        const damageNumbers = document.getElementById('damage-numbers');
        const markerOpacity = hitmarker ? Number(hitmarker.style.opacity || 0) : 0;
        const damageCount = damageNumbers && damageNumbers.children ? damageNumbers.children.length : 0;
        return markerOpacity > 0 || damageCount > 0;
      }, null, { timeout: 3000 });
    } finally {
      await shooter.page.close().catch(() => null);
      await target.page.close().catch(() => null);
    }
  });

  test('live render path stays smooth under inbound delay, loss, and reordering', async ({ browser }) => {
    const roomId = 'local-shared';
    const mover = await openMatchPage(browser, {
      roomId,
      modeId: 'single_dev_server',
      label: 'browser_render_mover',
    });
    const observer = await openMatchPage(browser, {
      roomId,
      modeId: 'single_dev_server',
      label: 'browser_render_observer',
      netImpairment: {
        inboundDelayMs: 60,
        inboundJitterMs: 25,
        inboundDropRate: 0.25,
        inboundReorderRate: 0.2,
        inboundReorderWindowMs: 90
      }
    });

    try {
      const fixture = await applyFixture(mover.page, roomId, [
        { userId: mover.userId, x: openLayout.mover.x, z: openLayout.mover.z, yaw: 0, pitch: 0, clearSpawnShield: true, weaponId: 'rifle' },
        { userId: observer.userId, x: openLayout.observer.x, z: openLayout.observer.z, yaw: 0, pitch: 0, clearSpawnShield: true, weaponId: 'rifle' }
      ]);
      expect(fixture && fixture.ok, JSON.stringify(fixture)).toBeTruthy();

      await waitForEntityOnPage(observer.page, mover.userId);
      await observer.page.waitForTimeout(600);
      const samplePromise = sampleRemotePresentedPath(observer.page, mover.userId, 1800, 50);
      await mover.page.bringToFront();
      await holdMovementKey(mover.page, 'w', 900);
      const samples = await samplePromise;
      expect(samples.length).toBeGreaterThanOrEqual(5);
      const metrics = summarizeMotionSamples(samples);
      expect(metrics.maxStep).toBeLessThan(3.25);
      expect(metrics.p95Step).toBeLessThan(1.6);
      expect(metrics.backtrackCount).toBeLessThanOrEqual(2);
      expect(metrics.largestBacktrack).toBeLessThan(0.5);
    } finally {
      await mover.page.close().catch(() => null);
      await observer.page.close().catch(() => null);
    }
  });

  test('owner correction converges under delay, jitter, loss, and reconnect', async ({ browser }) => {
    const roomId = 'local-shared';
    const player = await openMatchPage(browser, {
      roomId,
      modeId: 'single_dev_server',
      label: 'browser_owner',
      netImpairment: {
        outboundDelayMs: 70,
        outboundJitterMs: 25,
        outboundDropRate: 0.2,
        inboundDelayMs: 70,
        inboundJitterMs: 25,
        inboundDropRate: 0.1
      }
    });

    try {
      const fixture = await applyFixture(player.page, player.roomId, [
        { userId: player.userId, x: openLayout.mover.x, z: openLayout.mover.z, yaw: 0, pitch: 0, clearSpawnShield: true, weaponId: 'rifle' }
      ]);
      expect(fixture && fixture.ok, JSON.stringify(fixture)).toBeTruthy();
      await waitForPlayerState(player.page, player.userId, openLayout.mover);

      const samplePromise = sampleOwnerCorrectionPath(player.page, 4200, 50);
      await player.page.bringToFront();
      await holdMovementKey(player.page, 'w', 700);
      const closedSockets = await forceNetworkDisconnect(player.page, 2000);
      expect(closedSockets).toBeGreaterThan(0);
      await player.page.waitForFunction(() => window.__MAYHEM_TEST_API.isConnected(), null, { timeout: 10000 });
      await player.page.waitForTimeout(1800);
      const samples = await samplePromise;

      const localSamples = samples
        .map((entry) => entry && entry.local ? entry.local : null)
        .filter(Boolean)
        .map((entry) => ({ x: Number(entry.x || 0), z: Number(entry.z || 0) }));
      expect(localSamples.length).toBeGreaterThanOrEqual(3);
      const metrics = summarizeMotionSamples(localSamples);
      expect(metrics.maxStep).toBeLessThan(3.5);
      expect(metrics.backtrackCount).toBeLessThanOrEqual(3);

      const finalState = await player.page.evaluate(() => window.__MAYHEM_TEST_API.getOwnerCorrectionState());
      expect(finalState && finalState.connected).toBe(true);
      expect(Number(finalState && finalState.inputSync && finalState.inputSync.pendingInputCount || 0)).toBeLessThanOrEqual(6);
      expect(Number(finalState && finalState.inputSync && finalState.inputSync.ackDrift || 0)).toBeLessThanOrEqual(4);

      const local = finalState && finalState.local ? finalState.local : null;
      const authoritative = finalState && finalState.authoritative ? finalState.authoritative : null;
      expect(local).toBeTruthy();
      expect(authoritative).toBeTruthy();
      expect(distanceXZ(local, authoritative)).toBeLessThan(2.5);
    } finally {
      await player.page.close().catch(() => null);
    }
  });

  test('browser clients prove degraded viewers receive fewer snapshot updates than clean viewers', async ({ browser }) => {
    const roomId = 'local-shared';
    const mover = await openMatchPage(browser, {
      roomId,
      modeId: 'single_dev_server',
      label: 'browser_cadence_mover',
    });
    const cleanObserver = await openMatchPage(browser, {
      roomId,
      modeId: 'single_dev_server',
      label: 'browser_cadence_clean'
    });
    const degradedObserver = await openMatchPage(browser, {
      roomId,
      modeId: 'single_dev_server',
      label: 'browser_cadence_degraded',
      netImpairment: {
        outboundDelayMs: 200,
        outboundJitterMs: 50,
        inboundDelayMs: 200,
        inboundJitterMs: 50,
        inboundDropRate: 0.15
      }
    });

    try {
      const fixture = await applyFixture(mover.page, roomId, [
        { userId: mover.userId, x: openLayout.mover.x, z: openLayout.mover.z, yaw: 0, pitch: 0, clearSpawnShield: true, weaponId: 'rifle' },
        { userId: cleanObserver.userId, x: openLayout.observer.x, z: openLayout.observer.z, yaw: 0, pitch: 0, clearSpawnShield: true, weaponId: 'rifle' },
        { userId: degradedObserver.userId, x: openLayout.observer.x + 6, z: openLayout.observer.z + 2, yaw: 0, pitch: 0, clearSpawnShield: true, weaponId: 'rifle' }
      ]);
      expect(fixture && fixture.ok, JSON.stringify(fixture)).toBeTruthy();

      await waitForEntityOnPage(cleanObserver.page, mover.userId);
      await waitForEntityOnPage(degradedObserver.page, mover.userId);
      await cleanObserver.page.waitForTimeout(1200);
      await degradedObserver.page.waitForTimeout(1200);

      await setNetImpairment(degradedObserver.page, {
        outboundDelayMs: 140,
        outboundJitterMs: 40,
        outboundDropRate: 0.05,
        inboundDelayMs: 180,
        inboundJitterMs: 60,
        inboundDropRate: 0.1
      });
      await degradedObserver.page.waitForTimeout(1800);

      const cleanBaselineServerTime = await getLatestSnapshotServerTime(cleanObserver.page);
      const degradedBaselineServerTime = await getLatestSnapshotServerTime(degradedObserver.page);
      const windowStartServerTime = Math.max(cleanBaselineServerTime, degradedBaselineServerTime);

      await mover.page.bringToFront();
      await holdMovementKey(mover.page, 'w', 2200);

      await cleanObserver.page.waitForTimeout(1200);
      await degradedObserver.page.waitForTimeout(1600);
      const windowEndServerTime = await getLatestSnapshotServerTime(cleanObserver.page);

      const cleanSeqs = await getEntitySnapshotSeqs(cleanObserver.page, mover.userId, windowStartServerTime, windowEndServerTime);
      const degradedSeqs = await getEntitySnapshotSeqs(degradedObserver.page, mover.userId, windowStartServerTime, windowEndServerTime);
      const cleanCount = Array.isArray(cleanSeqs) ? cleanSeqs.length : 0;
      const degradedCount = Array.isArray(degradedSeqs) ? degradedSeqs.length : 0;
      expect(cleanCount).toBeGreaterThan(degradedCount);
      expect(degradedCount).toBeGreaterThanOrEqual(3);
    } finally {
      await mover.page.close().catch(() => null);
      await cleanObserver.page.close().catch(() => null);
      await degradedObserver.page.close().catch(() => null);
    }
  });
});
