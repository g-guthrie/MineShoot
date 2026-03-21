const { test, expect } = require('@playwright/test');

async function launchSandboxRuntime(page) {
  await page.goto('/');
  await page.locator('#game-modes-toggle-btn').click();
  await page.locator('#sandbox-mode-btn').click();
  await page.locator('#primary-launch-btn').click();
  await expect.poll(() => page.evaluate(() => !!window.__MAYHEM_RUNTIME.GameWorld)).toBe(true);
  await expect.poll(() => page.evaluate(() => !!(window.__MAYHEM_RUNTIME.GameRuntimeLoader && window.__MAYHEM_RUNTIME.GameRuntimeLoader.getLoadedGameplayRuntime && window.__MAYHEM_RUNTIME.GameRuntimeLoader.getLoadedGameplayRuntime()))).toBe(true);
}

async function ensureWeaponSwapTestHandle(page) {
  await expect.poll(() => page.evaluate(() => {
    const runtime = window.__MAYHEM_RUNTIME || {};
    const controlsApi = runtime.GameGameplayControls || null;
    if (!controlsApi || !controlsApi._test || !controlsApi._test.getActiveHandle) return false;
    if (controlsApi._test.getActiveHandle()) return true;
    if (!runtime.__weaponSwapE2EControls && controlsApi.create) {
      runtime.__weaponSwapE2EControls = controlsApi.create({
        applyWeapon() {},
        canUseLocalAction() { return true; },
        getCamera() { return { fov: 60, aspect: 16 / 9 }; },
        getMultiplayerMode() { return false; },
        handleEnemyHit() {},
        hasInputCapture() { return false; },
        setTransientDebug() {},
        toggleDebugVisuals() { return false; },
        tryPlayerFire() {}
      });
      if (runtime.__weaponSwapE2EControls && runtime.__weaponSwapE2EControls.bind) {
        runtime.__weaponSwapE2EControls.bind();
      }
    }
    return !!controlsApi._test.getActiveHandle();
  })).toBe(true);
}

async function configureWeaponSwap(page, weaponId = 'rifle') {
  await ensureWeaponSwapTestHandle(page);
  await page.evaluate(({ weaponId }) => {
    const runtime = window.__MAYHEM_RUNTIME;
    const handle = runtime.GameGameplayControls._test.getActiveHandle();
    handle.resetState();
    handle.setInputCaptureOverride(true);
    runtime.GameHitscan.setWeaponOrder(['rifle', 'sniper']);
    runtime.GameHitscan.setWeapon(weaponId);
  }, { weaponId });
}

async function dispatchWheel(page, init) {
  await page.evaluate((wheelInit) => {
    document.dispatchEvent(new WheelEvent('wheel', Object.assign({
      bubbles: true,
      cancelable: true
    }, wheelInit)));
  }, init);
}

async function currentWeaponId(page) {
  return page.evaluate(() => {
    const runtime = window.__MAYHEM_RUNTIME;
    return runtime.GameHitscan.getCurrentWeapon().id;
  });
}

test.beforeEach(async ({ page }) => {
  await launchSandboxRuntime(page);
});

test('browser wheel path toggles once and swallows duplicate notch events', async ({ page }) => {
  await configureWeaponSwap(page, 'rifle');

  await dispatchWheel(page, { deltaY: 1, deltaMode: 1 });
  await page.waitForTimeout(50);
  await dispatchWheel(page, { deltaY: 1, deltaMode: 1 });
  await page.waitForTimeout(50);
  await dispatchWheel(page, { deltaY: -1, deltaMode: 1 });

  await expect.poll(() => currentWeaponId(page)).toBe('sniper');
});

test('browser wheel path toggles again after the one-second switch lockout expires', async ({ page }) => {
  await configureWeaponSwap(page, 'rifle');

  await dispatchWheel(page, { deltaY: 1, deltaMode: 1 });
  await page.waitForTimeout(1100);
  await dispatchWheel(page, { deltaY: -1, deltaMode: 1 });

  await expect.poll(() => currentWeaponId(page)).toBe('rifle');
});

test('browser pixel bursts ignore delayed momentum packets while blocked', async ({ page }) => {
  await configureWeaponSwap(page, 'rifle');

  await dispatchWheel(page, { deltaY: 12, deltaMode: 0 });
  await dispatchWheel(page, { deltaY: 12, deltaMode: 0 });
  await page.waitForTimeout(230);
  await dispatchWheel(page, { deltaY: 12, deltaMode: 0 });
  await dispatchWheel(page, { deltaY: 12, deltaMode: 0 });

  await expect.poll(() => currentWeaponId(page)).toBe('sniper');
});

test('browser pixel bursts stay locked briefly even after a quiet release packet', async ({ page }) => {
  await configureWeaponSwap(page, 'rifle');

  await dispatchWheel(page, { deltaY: 12, deltaMode: 0 });
  await dispatchWheel(page, { deltaY: 12, deltaMode: 0 });
  await page.waitForTimeout(50);
  await dispatchWheel(page, { deltaY: 2, deltaMode: 0 });
  await dispatchWheel(page, { deltaY: -12, deltaMode: 0 });
  await dispatchWheel(page, { deltaY: -12, deltaMode: 0 });

  await expect.poll(() => currentWeaponId(page)).toBe('sniper');

  await page.waitForTimeout(1100);
  await dispatchWheel(page, { deltaY: -12, deltaMode: 0 });
  await dispatchWheel(page, { deltaY: -12, deltaMode: 0 });

  await expect.poll(() => currentWeaponId(page)).toBe('rifle');
});

test('browser pixel bursts recover after the one-second switch lockout without a quiet release packet', async ({ page }) => {
  await configureWeaponSwap(page, 'rifle');

  await dispatchWheel(page, { deltaY: 12, deltaMode: 0 });
  await dispatchWheel(page, { deltaY: 12, deltaMode: 0 });
  await page.waitForTimeout(1100);
  await dispatchWheel(page, { deltaY: 12, deltaMode: 0 });
  await dispatchWheel(page, { deltaY: 12, deltaMode: 0 });

  await expect.poll(() => currentWeaponId(page)).toBe('rifle');
});
