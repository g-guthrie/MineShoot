const { test, expect } = require('@playwright/test');

async function launchPracticeRuntime(page) {
  await page.goto('/');
  await page.locator('#practice-mode-btn').click();
  await expect(page.locator('#loadout-start-btn')).toBeVisible();
  await page.locator('#loadout-start-btn').click();
  await expect.poll(() => page.evaluate(() => !!window.__MAYHEM_RUNTIME.GameWorld)).toBe(true);
  await expect.poll(() => page.evaluate(() => !!window.__MAYHEM_RUNTIME.GameMain)).toBe(true);
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
  await launchPracticeRuntime(page);
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

test('browser wheel path toggles again after the discrete lockout expires', async ({ page }) => {
  await configureWeaponSwap(page, 'rifle');

  await dispatchWheel(page, { deltaY: 1, deltaMode: 1 });
  await page.waitForTimeout(180);
  await dispatchWheel(page, { deltaY: -1, deltaMode: 1 });

  await expect.poll(() => currentWeaponId(page)).toBe('rifle');
});

test('browser pixel bursts toggle once, ignore delayed momentum, and toggle again after quiet release', async ({ page }) => {
  await configureWeaponSwap(page, 'rifle');

  await dispatchWheel(page, { deltaY: 12, deltaMode: 0 });
  await dispatchWheel(page, { deltaY: 12, deltaMode: 0 });
  await page.waitForTimeout(230);
  await dispatchWheel(page, { deltaY: 12, deltaMode: 0 });
  await dispatchWheel(page, { deltaY: 12, deltaMode: 0 });

  await expect.poll(() => currentWeaponId(page)).toBe('sniper');

  await dispatchWheel(page, { deltaY: 2, deltaMode: 0 });
  await dispatchWheel(page, { deltaY: -12, deltaMode: 0 });
  await dispatchWheel(page, { deltaY: -12, deltaMode: 0 });

  await expect.poll(() => currentWeaponId(page)).toBe('rifle');
});

test('browser pixel bursts recover after the gesture timeout without a quiet release packet', async ({ page }) => {
  await configureWeaponSwap(page, 'rifle');

  await dispatchWheel(page, { deltaY: 12, deltaMode: 0 });
  await dispatchWheel(page, { deltaY: 12, deltaMode: 0 });
  await page.waitForTimeout(470);
  await dispatchWheel(page, { deltaY: 12, deltaMode: 0 });
  await dispatchWheel(page, { deltaY: 12, deltaMode: 0 });

  await expect.poll(() => currentWeaponId(page)).toBe('rifle');
});
