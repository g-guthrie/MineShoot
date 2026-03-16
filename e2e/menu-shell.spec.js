const { test, expect } = require('@playwright/test');

async function openAuth(page) {
  await page.locator('#account-toggle-btn').click();
  await expect(page.locator('#auth-overlay')).toBeVisible();
}

test('menu boots without gameplay runtime and supports auth/docs/lazy gameplay loading', async ({ page }) => {
  await page.goto('/');

  await expect(page.locator('#menu-party-id-value')).not.toHaveText('------');
  await expect(page.locator('#menu-screen-mode')).toBeVisible();
  expect(await page.evaluate(() => !!window.__MAYHEM_RUNTIME.GameWorld)).toBe(false);
  expect(await page.evaluate(() => !!window.__MAYHEM_RUNTIME.GameMain)).toBe(false);

  await openAuth(page);
  await expect.poll(() => page.evaluate(() => document.activeElement && document.activeElement.id)).toBe('auth-username');
  await page.locator('#auth-username').fill('ALPHA_E2E');
  await page.locator('#auth-pin').fill('12');
  await page.locator('#auth-play-btn').click();
  await expect(page.locator('#auth-status')).toContainText('PIN must be exactly 4 digits.');
  await page.locator('#auth-close-btn').click();
  await expect(page.locator('#auth-overlay')).toBeHidden();

  await page.locator('#utility-toggle-btn').click();
  await page.locator('#open-manual-btn').click();
  await expect(page.locator('#docs-panel')).toBeVisible();
  await expect(page.locator('#docs-title')).toContainText('FIELD MANUAL');
  await page.locator('#docs-close-btn').click();
  await expect(page.locator('#docs-panel')).toBeHidden();
  await page.locator('#utility-close-btn').click();

  await page.locator('#practice-mode-btn').click();
  await expect(page.locator('#loadout-start-btn')).toBeVisible();
  await page.locator('#loadout-start-btn').click();
  await expect.poll(() => page.evaluate(() => !!window.__MAYHEM_RUNTIME.GameWorld)).toBe(true);
  await expect.poll(() => page.evaluate(() => !!window.__MAYHEM_RUNTIME.GameMain)).toBe(true);
});
