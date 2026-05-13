import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';

const baseUrl = process.env.V2_URL || 'http://127.0.0.1:3020/v2/';

async function verifyViewport(browser, label, viewport) {
  const page = await browser.newPage({ viewport });
  const pageErrors = [];
  const consoleMessages = [];
  const badResponses = [];
  page.on('console', (message) => consoleMessages.push(`${message.type()}: ${message.text()}`));
  page.on('pageerror', (err) => pageErrors.push(err.message));
  page.on('response', (response) => {
    if (response.status() >= 400) badResponses.push(`${response.status()} ${response.url()}`);
  });
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.locator('#start-btn').click();
  try {
    await page.waitForFunction(() => {
      const session = globalThis.__PVP_V2_SESSION__;
      return !!(
        session &&
        session.latestSnapshot &&
        Array.isArray(session.latestSnapshot.entities) &&
        session.latestSnapshot.entities.length >= 3
      );
    }, null, { timeout: 7000 });
  } catch (err) {
    const diagnostic = await page.evaluate(() => {
      const session = globalThis.__PVP_V2_SESSION__;
      return {
        title: document.title,
        bodyText: document.body ? document.body.innerText.slice(0, 500) : '',
        hasSession: !!session,
        running: !!(session && session.running),
        selfId: session && session.selfId,
        hasWorld: !!(session && session.world),
        hasSnapshot: !!(session && session.latestSnapshot),
        entityCount: session && session.latestSnapshot && Array.isArray(session.latestSnapshot.entities)
          ? session.latestSnapshot.entities.length
          : 0
      };
    }).catch((evalErr) => ({ evalError: evalErr.message }));
    await page.screenshot({ path: `/private/tmp/minecraft-fps-v2-${label}-timeout.png`, fullPage: true }).catch(() => {});
    throw new Error(`${label} snapshot wait failed: ${err.message}\n` +
      `diagnostic=${JSON.stringify(diagnostic)}\n` +
      `pageErrors=${pageErrors.join('\n')}\n` +
      `console=${consoleMessages.join('\n')}\n` +
      `badResponses=${badResponses.join('\n')}`);
  }
  await page.waitForTimeout(450);

  const status = await page.evaluate(() => {
    const session = globalThis.__PVP_V2_SESSION__;
    const canvas = document.getElementById('game-canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    const width = gl.drawingBufferWidth;
    const height = gl.drawingBufferHeight;
    const sample = new Uint8Array(4);
    const unique = new Set();
    let litPixels = 0;
    for (let y = 1; y <= 5; y++) {
      for (let x = 1; x <= 5; x++) {
        const px = Math.floor((width * x) / 6);
        const py = Math.floor((height * y) / 6);
        gl.readPixels(px, py, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, sample);
        const key = `${sample[0]},${sample[1]},${sample[2]},${sample[3]}`;
        unique.add(key);
        if (sample[3] > 0 && (sample[0] + sample[1] + sample[2]) > 15) litPixels++;
      }
    }
    return {
      canvasWidth: canvas.clientWidth,
      canvasHeight: canvas.clientHeight,
      drawingWidth: width,
      drawingHeight: height,
      uniquePixels: unique.size,
      litPixels,
      hasWeaponView: !!(session && session.renderer && session.renderer.weaponView),
      hasSnapshot: !!(session && session.latestSnapshot),
      entityCount: session && session.latestSnapshot ? session.latestSnapshot.entities.length : 0,
      self: session && session.predictedSelf ? {
        x: session.predictedSelf.x,
        y: session.predictedSelf.y,
        z: session.predictedSelf.z,
        yaw: session.predictedSelf.yaw,
        pitch: session.predictedSelf.pitch
      } : null,
      camera: session && session.renderer ? {
        x: session.renderer.camera.position.x,
        y: session.renderer.camera.position.y,
        z: session.renderer.camera.position.z,
        rx: session.renderer.camera.rotation.x,
        ry: session.renderer.camera.rotation.y
      } : null
    };
  });

  await page.screenshot({ path: `/private/tmp/minecraft-fps-v2-${label}.png`, fullPage: true });
  await page.close();

  assert.equal(pageErrors.length, 0, `${label} page errors: ${pageErrors.join('\n')}`);
  assert.equal(badResponses.length, 0, `${label} bad responses: ${badResponses.join('\n')}`);
  assert.ok(status.canvasWidth > 0 && status.canvasHeight > 0, `${label} canvas has layout`);
  assert.ok(status.drawingWidth > 0 && status.drawingHeight > 0, `${label} canvas has drawing buffer`);
  assert.ok(status.uniquePixels >= 3, `${label} canvas should not be visually flat: ${JSON.stringify(status)}`);
  assert.ok(status.litPixels >= 10, `${label} canvas should contain visible rendered pixels: ${JSON.stringify(status)}`);
  assert.ok(status.hasWeaponView, `${label} weapon view should be created`);
  assert.ok(status.hasSnapshot && status.entityCount >= 3, `${label} should have authoritative snapshot entities`);
  return status;
}

const browser = await chromium.launch({
  args: [
    '--disable-gpu-sandbox',
    '--enable-unsafe-swiftshader',
    '--ignore-gpu-blocklist',
    '--use-angle=swiftshader',
    '--use-gl=swiftshader'
  ]
});
try {
  const desktop = await verifyViewport(browser, 'desktop', { width: 1280, height: 720 });
  const mobile = await verifyViewport(browser, 'mobile', { width: 390, height: 844, isMobile: true, hasTouch: true });
  console.log(JSON.stringify({ ok: true, desktop, mobile }, null, 2));
} finally {
  await browser.close();
}
