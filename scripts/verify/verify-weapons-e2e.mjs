// Weapon-experience verification driver — boots the offline sandbox in headless
// Chromium and exercises all five guns (fire, reload, scope, camera modes)
// through real DOM input, capturing screenshots and timing measurements.
//
// Authored by Claude (AI agent). Usage:
//   npm run build && ./node_modules/.bin/wrangler dev cloudflare/worker.js --config wrangler.toml --port 8787 --local --assets dist
//   node scripts/verify/verify-weapons-e2e.mjs   (screenshots land in /tmp/verify-shots2)
import { chromium } from '@playwright/test';
import fs from 'node:fs';

const OUT = '/tmp/verify-shots2';
fs.mkdirSync(OUT, { recursive: true });
const BASE = 'http://127.0.0.1:8787';
const log = (...a) => console.log('[verify]', ...a);
const results = { sessions: [], consoleErrors: [] };

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--use-gl=angle'] });

async function realMouse(page, type, button = 0) {
  await page.evaluate(([t, b]) => {
    document.dispatchEvent(new MouseEvent(t, { button: b, bubbles: true, cancelable: true }));
  }, [type, button]);
}

async function weaponState(page) {
  return page.evaluate(() => {
    const w = window.__MAYHEM_RUNTIME.GameHitscan.getCurrentWeapon();
    return { id: w.id, ammoInMag: w.ammoInMag, magazineSize: w.magazineSize, reloading: !!w.reloading };
  });
}

async function waitReady(page, timeout = 9000) {
  await page.waitForFunction(() => {
    const w = window.__MAYHEM_RUNTIME.GameHitscan.getCurrentWeapon();
    return !w.reloading && w.ammoInMag >= w.magazineSize;
  }, null, { timeout }).catch(() => {});
}

async function measureReload(page) {
  const t0 = Date.now();
  let sawReloading = false;
  for (;;) {
    const w = await weaponState(page);
    if (w.reloading) sawReloading = true;
    if (!w.reloading && w.ammoInMag >= w.magazineSize) {
      return { ms: Date.now() - t0, sawReloading };
    }
    if (Date.now() - t0 > 9000) return { ms: -1, sawReloading };
    await page.waitForTimeout(120);
  }
}

async function runSession({ label, loadout, fps, thirdPersonShots }) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('console', (m) => { if (m.type() === 'error') results.consoleErrors.push(label + ': ' + m.text().slice(0, 220)); });
  page.on('pageerror', (e) => results.consoleErrors.push(label + ' pageerror: ' + String(e).slice(0, 220)));
  const session = { label, loadout, fps, weapons: [], notes: [] };

  await page.goto(BASE + '/');
  await page.locator('#game-modes-toggle-btn').click();
  await page.locator('#sandbox-mode-btn').click();
  await page.locator('#primary-launch-btn').click();
  await page.locator('#active-match-shell').waitFor({ state: 'visible', timeout: 20000 });

  // Camera mode via the real menu toggle button.
  const camBtn = page.locator('#camera-view-toggle-btn');
  if (await camBtn.isVisible().catch(() => false)) {
    const txt = await camBtn.textContent();
    const wantFps = !!fps;
    const isFps = /fps/i.test(String(txt || ''));
    if (wantFps !== isFps) await camBtn.click();
    session.cameraButton = { found: true, before: txt, after: await camBtn.textContent() };
  } else {
    session.cameraButton = { found: false };
    if (fps) {
      session.notes.push('camera toggle not visible on menu; left default view');
    }
  }

  // Loadout via the real weapon grid (first pick begins draft, second commits).
  for (const id of loadout) {
    const btn = page.locator(`.weapon-choice-btn[data-weapon-id="${id}"]`);
    if (await btn.isVisible().catch(() => false)) {
      await btn.click();
      await page.waitForTimeout(250);
    } else {
      session.notes.push(`loadout button for ${id} not visible`);
    }
  }

  await page.locator('#play-btn').click();
  await page.waitForFunction(() => !!(window.__MAYHEM_RUNTIME && window.__MAYHEM_RUNTIME.GameWorld), null, { timeout: 20000 });
  await page.waitForFunction(() => !!(
    window.__MAYHEM_RUNTIME.GameRuntimeLoader &&
    window.__MAYHEM_RUNTIME.GameRuntimeLoader.getLoadedGameplayRuntime &&
    window.__MAYHEM_RUNTIME.GameRuntimeLoader.getLoadedGameplayRuntime()
  ), null, { timeout: 20000 });
  await page.evaluate(() => {
    const canvasEl = document.querySelector('canvas');
    Object.defineProperty(document, 'pointerLockElement', {
      configurable: true,
      get() { return canvasEl; }
    });
    document.dispatchEvent(new Event('pointerlockchange'));
  });
  await page.waitForTimeout(3000); // spawn grace + world settle

  for (let slot = 0; slot < loadout.length; slot++) {
    const id = loadout[slot];
    await page.keyboard.press(String(slot + 1)); // real Digit1/Digit2 weapon slot input
    await page.waitForTimeout(900);
    const equipped = await weaponState(page);
    if (equipped.id !== id) session.notes.push(`slot ${slot + 1} expected ${id}, got ${equipped.id}`);
    await waitReady(page);
    const before = await weaponState(page);
    const fovBefore = await page.evaluate(() => window.__MAYHEM_RUNTIME.GamePlayer.getCamera().fov);
    await page.screenshot({ path: `${OUT}/${label}-${id}-idle.png` });

    const auto = id === 'machinegun';
    await realMouse(page, 'mousedown', 0);
    if (auto) {
      await page.waitForTimeout(350);
      await page.screenshot({ path: `${OUT}/${label}-${id}-burst1.png` });
      await page.waitForTimeout(120);
      await page.screenshot({ path: `${OUT}/${label}-${id}-burst2.png` });
      await page.waitForTimeout(400);
    } else {
      await page.screenshot({ path: `${OUT}/${label}-${id}-firing.png` });
    }
    await realMouse(page, 'mouseup', 0);
    await page.waitForTimeout(220);
    const afterFire = await weaponState(page);

    // Reload through real KeyR, measuring wall-clock duration to full mag.
    await page.keyboard.press('r');
    await page.waitForTimeout(120);
    const reloadStarted = await weaponState(page);
    await page.screenshot({ path: `${OUT}/${label}-${id}-reloading.png` });
    const reload = await measureReload(page);

    session.weapons.push({ id, before, afterFire, reloadStarted, reloadMsObserved: reload.ms, sawReloading: reload.sawReloading, fovBefore });
    log(label, id, 'fired', before.ammoInMag, '->', afterFire.ammoInMag,
      '| reload started:', reloadStarted.reloading, '| reload took ~', reload.ms, 'ms');
  }

  // Sniper extras: auto-scope FOV + bolt cycle.
  if (loadout.includes('sniper')) {
    await page.keyboard.press(String(loadout.indexOf('sniper') + 1));
    await page.waitForTimeout(500);
    await waitReady(page);
    await page.waitForTimeout(1500); // scope blend-in
    const scopedFov = await page.evaluate(() => window.__MAYHEM_RUNTIME.GamePlayer.getCamera().fov);
    await page.screenshot({ path: `${OUT}/${label}-sniper-scoped.png` });
    await realMouse(page, 'mousedown', 0);
    await page.waitForTimeout(60);
    await realMouse(page, 'mouseup', 0);
    await page.waitForTimeout(350);
    const afterShot = await weaponState(page);
    session.sniper = { scopedFov, boltAfterShot: afterShot };
    log(label, 'sniper scoped fov:', scopedFov, '| bolt after shot:', JSON.stringify(afterShot));
  }

  if (thirdPersonShots) {
    await page.screenshot({ path: `${OUT}/${label}-third-person-final.png` });
  }
  results.sessions.push(session);
  await page.close();
}

await runSession({ label: 's1-fps', loadout: ['rifle', 'pistol'], fps: true });
await runSession({ label: 's2-fps', loadout: ['machinegun', 'shotgun'], fps: true });
await runSession({ label: 's3-fps', loadout: ['sniper', 'pistol'], fps: true });
await runSession({ label: 's4-3rd', loadout: ['machinegun', 'shotgun'], fps: false, thirdPersonShots: true });

fs.writeFileSync(`${OUT}/report.json`, JSON.stringify(results, null, 2));
log('console errors:', results.consoleErrors.length, results.consoleErrors.slice(0, 5));
await browser.close();
log('done');
