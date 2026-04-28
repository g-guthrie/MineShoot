import { test, expect } from '@playwright/test';

async function launchSandboxRuntime(page) {
  await page.goto('/');
  await page.locator('#game-modes-toggle-btn').click();
  await page.locator('#sandbox-mode-btn').click();
  await page.locator('#primary-launch-btn').click();
  await expect(page.locator('#active-match-shell')).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('#play-btn')).toHaveText(/enter match/i);
  await page.evaluate(() => document.getElementById('play-btn')?.click());
  await expect.poll(() => page.evaluate(() => !!window.__MAYHEM_RUNTIME.GameWorld)).toBe(true);
  await expect.poll(() => page.evaluate(() => !!(
    window.__MAYHEM_RUNTIME.GameRuntimeLoader &&
    window.__MAYHEM_RUNTIME.GameRuntimeLoader.getLoadedGameplayRuntime &&
    window.__MAYHEM_RUNTIME.GameRuntimeLoader.getLoadedGameplayRuntime()
  ))).toBe(true);
}

async function enableRealWeaponSwapHandle(page) {
  await expect.poll(() => page.evaluate(() => {
    const controlsApi = window.__MAYHEM_RUNTIME && window.__MAYHEM_RUNTIME.GameGameplayControls;
    return !!(
      controlsApi &&
      controlsApi._test &&
      controlsApi._test.getActiveHandle &&
      controlsApi._test.getActiveHandle()
    );
  })).toBe(true);

  await page.evaluate(() => {
    const runtime = window.__MAYHEM_RUNTIME;
    const handle = runtime.GameGameplayControls._test.getActiveHandle();
    handle.resetState();
    handle.setInputCaptureOverride(true);
    runtime.GameHitscan.setWeaponOrder(['rifle', 'sniper']);
    runtime.GameHitscan.setWeapon('rifle');
  });
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
    return window.__MAYHEM_RUNTIME.GameHitscan.getCurrentWeapon().id;
  });
}

test('sandbox runtime wires browser wheel input through the real gameplay controls', async ({ page }) => {
  await launchSandboxRuntime(page);
  await enableRealWeaponSwapHandle(page);

  await dispatchWheel(page, { deltaY: 1, deltaMode: 1 });

  await expect.poll(() => currentWeaponId(page)).toBe('sniper');
  await expect.poll(() => page.evaluate(() => {
    const handle = window.__MAYHEM_RUNTIME.GameGameplayControls._test.getActiveHandle();
    const state = handle && handle.readState ? handle.readState() : null;
    return !!(state && state.inputCaptureActive && state.switchLockUntil > 0);
  })).toBe(true);
});
