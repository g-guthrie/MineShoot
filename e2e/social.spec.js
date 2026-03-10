const { test, expect } = require('@playwright/test');

async function login(page, username, pin = '1234') {
  await page.locator('#account-toggle-btn').click();
  await expect(page.locator('#auth-overlay')).toBeVisible();
  await page.locator('#auth-username').fill(username);
  await page.locator('#auth-pin').fill(pin);
  await page.locator('#auth-play-btn').click();
  await expect(page.locator('#auth-overlay')).toBeHidden();
  await expect(page.locator('#account-toggle-btn')).toContainText(username);
  await expect(page.locator('#menu-party-id-label')).toContainText('PLAYER ID');
  await expect(page.locator('#menu-party-id-value')).toContainText('USR_');
  await expect(page.locator('#party-roster-preview')).toContainText(username);
}

test('party lock, private room join, and friend save flow work across two browser contexts', async ({ browser }) => {
  const pageA = await browser.newPage();
  const pageB = await browser.newPage();

  const suffix = String(Date.now());
  const alphaName = 'ALPHA' + suffix;
  const bravoName = 'BRAVO' + suffix;

  await pageA.goto('/');
  await pageB.goto('/');

  await login(pageA, alphaName);
  await login(pageB, bravoName);

  const alphaId = await pageA.locator('#menu-party-id-value').textContent();
  await pageA.locator('#party-join-lock-btn').click();
  await expect(pageA.locator('#party-join-lock-note')).toContainText('JOINS LOCKED');

  await pageB.locator('#party-id-input').fill(String(alphaId || '').trim());
  await pageB.locator('#join-party-btn').click();
  await expect(pageB.locator('#party-status')).toContainText('locked');

  await pageA.locator('#party-join-lock-btn').click();
  await expect(pageA.locator('#party-join-lock-note')).toContainText('JOINS OPEN');

  await pageB.locator('#join-party-btn').click();
  await expect(pageB.locator('#party-status')).toContainText('Party joined.');
  await expect(pageA.locator('#party-roster-preview')).toContainText(bravoName);
  await pageA.locator('.party-preview-add').first().click();

  await pageA.locator('#view-party-btn').click();
  await expect(pageA.locator('#party-roster-overlay')).toBeVisible();
  await pageA.locator('#party-roster-close-btn').click();

  await pageA.locator('#social-tab-friends-btn').click();
  await pageA.locator('#refresh-friends-btn').click();
  await expect(pageA.locator('#friends-preview')).toContainText(bravoName);

  await pageA.locator('#create-private-room-btn').click();
  await expect(pageA.locator('#room-share-panel')).toBeVisible();
  const roomCode = await pageA.locator('#room-share-code').textContent();

  await pageB.locator('#private-room-input').fill(String(roomCode || '').trim());
  await pageB.locator('#join-private-room-btn').click();
  await expect(pageB.locator('#private-room-view')).toBeVisible();

  await pageA.close();
  await pageB.close();
});
