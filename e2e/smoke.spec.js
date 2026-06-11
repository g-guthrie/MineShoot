import { test, expect } from '@playwright/test';

async function joinAs(page, name) {
  await page.goto('/');
  await page.waitForFunction(() => !!globalThis.__MINESHOOT, null, { timeout: 30000 });
  await page.fill('#name-input', name);
  await page.click('#play-btn');
  await page.waitForFunction(
    () => globalThis.__MINESHOOT.state.mode !== 'menu',
    null,
    { timeout: 20000 }
  );
}

test('two players join the arena and see each other', async ({ browser }) => {
  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();

  const errorsA = [];
  pageA.on('pageerror', (err) => errorsA.push(String(err)));

  await joinAs(pageA, 'Alice');
  await joinAs(pageB, 'Bob');

  // Each client should learn about the other via join/snapshot messages.
  await pageA.waitForFunction(
    () => globalThis.__MINESHOOT.remotes.count() >= 1,
    null,
    { timeout: 15000 }
  );
  await pageB.waitForFunction(
    () => globalThis.__MINESHOOT.remotes.count() >= 1,
    null,
    { timeout: 15000 }
  );

  const nameSeenByB = await pageB.evaluate(() => {
    const remotes = globalThis.__MINESHOOT.remotes;
    const state = globalThis.__MINESHOOT.state;
    const ids = [];
    // targets() only returns alive players; name lookup goes through nameOf.
    for (const target of remotes.targets()) ids.push(remotes.nameOf(target.id));
    return { ids, selfMode: state.mode };
  });
  expect(nameSeenByB.selfMode).toBe('playing');
  expect(nameSeenByB.ids).toContain('Alice');

  // Block placement should replicate to the other client.
  const placed = await pageA.evaluate(() => {
    const ms = globalThis.__MINESHOOT;
    const e = ms.player.entity;
    const key = ms.blocks.keyAt(e.x + 3, e.y + 2, e.z);
    ms.net.send({ t: 'place', k: key });
    return key;
  });
  await pageB.waitForFunction(
    (key) => globalThis.__MINESHOOT.blocks.has(key),
    placed,
    { timeout: 10000 }
  );

  expect(errorsA).toEqual([]);

  await pageA.screenshot({ path: 'tmp-e2e/player-a.png' });
  await pageB.screenshot({ path: 'tmp-e2e/player-b.png' });

  await contextA.close();
  await contextB.close();
});
