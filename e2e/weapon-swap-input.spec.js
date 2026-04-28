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

async function enableRealWeaponSwapInput(page) {
  const canvas = page.locator('canvas').first();
  await expect(canvas).toBeVisible({ timeout: 15_000 });

  await page.evaluate(() => {
    const runtime = window.__MAYHEM_RUNTIME;
    const canvasEl = document.querySelector('canvas');
    Object.defineProperty(document, 'pointerLockElement', {
      configurable: true,
      get() {
        return canvasEl;
      }
    });
    document.dispatchEvent(new Event('pointerlockchange'));
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
  await enableRealWeaponSwapInput(page);

  await dispatchWheel(page, { deltaY: 1, deltaMode: 1 });

  await expect.poll(() => currentWeaponId(page)).toBe('sniper');
});
