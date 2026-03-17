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

test('party join, friend save, and private room join work from the current menu selectors', async ({ browser }) => {
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
  await pageB.locator('#party-id-input').fill(String(alphaId || '').trim());
  await pageB.locator('#join-friend-btn').click();

  await expect(pageA.locator('#party-hero-members')).toContainText(bravoName);

  const bravoCard = pageA.locator('#party-hero-members').getByText(bravoName).first();
  await bravoCard.click();
  await pageA.getByRole('button', { name: 'Add Friend' }).click();
  await expect(pageA.locator('#social-friends-list')).toContainText(bravoName);

  await pageA.locator('#continue-loadout-btn').click();
  await expect(pageA.locator('#private-room-view')).toBeVisible();
  const roomCode = await pageA.locator('#room-share-code').textContent();

  await pageB.locator('#room-code-input').fill(String(roomCode || '').trim());
  await pageB.locator('#join-room-btn').click();
  await expect(pageB.locator('#private-room-view')).toBeVisible();

  await pageA.close();
  await pageB.close();
});
