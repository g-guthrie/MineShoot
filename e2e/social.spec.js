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
  await pageA.locator('#open-party-btn').click();
  await pageB.locator('#open-party-btn').click();

  const alphaId = await pageA.locator('#menu-party-id-value').textContent();
  await pageA.locator('#party-join-lock-btn').click();
  await expect(pageA.locator('#party-join-lock-note')).toContainText('PARTY CLOSED');

  await pageB.locator('#party-back-btn').click();
  await pageB.locator('#join-party-trigger-btn').click();
  await pageB.locator('#party-id-input').fill(String(alphaId || '').trim());
  await pageB.locator('#join-party-btn').click();
  await pageB.locator('#open-party-btn').click();
  await expect(pageB.locator('#party-status')).toContainText('locked');

  await pageA.locator('#party-join-lock-btn').click();
  await expect(pageA.locator('#party-join-lock-note')).toContainText('PARTY OPEN');

  await pageB.locator('#party-back-btn').click();
  await pageB.locator('#join-party-trigger-btn').click();
  await pageB.locator('#join-party-btn').click();
  await pageB.locator('#open-party-btn').click();
  await expect(pageB.locator('#party-status')).toContainText('Party joined.');
  await expect(pageA.locator('#social-party-members')).toContainText(bravoName);
  const bravoUserId = await pageB.evaluate(() => {
    const auth = window.__MAYHEM_RUNTIME && window.__MAYHEM_RUNTIME.GameNetAuth;
    const user = auth && auth.getUser ? auth.getUser() : null;
    return user && user.id ? String(user.id) : '';
  });
  await pageA.locator('#friend-id-input').fill(bravoUserId);
  await pageA.locator('#add-friend-btn').click();
  await expect(pageA.locator('#friends-status')).toContainText('Friend saved.');

  await pageA.locator('#create-private-room-btn').click();
  await expect(pageA.locator('#room-share-panel')).toBeVisible();
  const roomCode = await pageA.locator('#room-share-code').textContent();

  await pageB.locator('#private-room-input').fill(String(roomCode || '').trim());
  await pageB.locator('#join-private-room-btn').click();
  await expect(pageB.locator('#private-room-view')).toBeVisible();

  await pageA.close();
  await pageB.close();
});
