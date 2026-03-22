import { test, expect } from '@playwright/test';

async function login(page, username, pin = '1234') {
  await page.locator('#account-toggle-btn').click();
  await expect(page.locator('#auth-overlay')).toBeVisible();
  await page.locator('#auth-username').fill(username);
  await page.locator('#auth-pin').fill(pin);
  await page.locator('#auth-play-btn').click();
  await expect(page.locator('#auth-overlay')).toBeHidden();
  await expect(page.locator('#account-toggle-btn')).toContainText(username);
}

test('play free for all hands off into a real free for all room and reaches the live match shell', async ({ page }) => {
  const suffix = String(Date.now()).slice(-6);
  const username = `HANDOFF${suffix}`;

  await page.goto('/');
  await login(page, username);

  await expect(page.locator('#primary-launch-btn')).toHaveText('Play Free For All');
  const matchmakingResponsePromise = page.waitForResponse((response) => {
    return response.url().includes('/api/matchmaking') && response.request().method() === 'POST';
  });

  await page.locator('#primary-launch-btn').click();

  const matchmakingResponse = await matchmakingResponsePromise;
  const payload = await matchmakingResponse.json();

  expect(payload.ok).toBe(true);
  expect(String(payload.modeId || '')).toBe('cloud_multiplayer');
  expect(String(payload.gameMode || '')).toBe('ffa');
  expect(String(payload.roomId || '')).toMatch(/^ffa-/);
  expect(String(payload.roomId || '')).not.toBe('global');

  await expect(page.locator('#active-match-shell')).toBeVisible();
  await expect(page.locator('#play-btn')).toHaveText('ENTER MATCH');
  await expect(page.locator('#back-mode-btn')).toHaveText('RETURN TO MENU');
  await expect(page.locator('body')).toContainText('Goal: 10');
  await expect(page.locator('body')).not.toContainText(/required before gameplay starts/i);
  await expect(page.locator('body')).not.toContainText(/network room join unavailable/i);
});
