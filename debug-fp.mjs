import { chromium } from '@playwright/test';
const browser = await chromium.launch({ args: ['--disable-background-timer-throttling'] });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
page.setDefaultTimeout(120000);
page.on('pageerror', (e) => console.log('[err]', (e.stack || String(e)).slice(0, 300)));
await page.goto('http://127.0.0.1:3000/');
await page.waitForFunction(() => !!globalThis.__MINESHOOT);
await page.fill('#name-input', 'FPCheck');
await page.click('#play-btn');
await page.waitForFunction(() => globalThis.__MINESHOOT.state.mode !== 'menu');
await page.evaluate(() => { globalThis.__MINESHOOT.player.pitch = 0; });
await page.waitForTimeout(2500);
const names = ['ak', 'shotgun', 'sniper', 'pistol'];
for (let i = 0; i < 4; i++) {
  await page.evaluate((slot) => globalThis.__MINESHOOT.weapons.selectSlot(slot), i);
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `tmp-e2e/fpnew-${names[i]}.png` });
}
await page.evaluate(() => globalThis.__MINESHOOT.weapons.selectSlot(0));
await page.waitForTimeout(800);
await page.evaluate(() => globalThis.__MINESHOOT.weapons.triggerDown());
await page.waitForTimeout(8);
await page.screenshot({ path: 'tmp-e2e/fpnew-fire.png' });
await browser.close();
