// Two-client multiplayer smoke check. Expects the dev stack running
// (scripts/dev-games.sh). Joins two independent browser contexts and
// asserts the server sees both players.
//   node e2e/two-client.mjs            -> zombies (127.0.0.1:8081)
//   node e2e/two-client.mjs 127.0.0.1:8083  -> pvp
import { chromium } from '@playwright/test';

const JOIN_HOST = process.argv[2] || '127.0.0.1:8081';
const PLAY_URL = `http://localhost:5173/?join=${JOIN_HOST}`;
const HEALTH_URL = `http://${JOIN_HOST}`;

// Background pages get rAF-throttled, which stalls the game loop; these
// flags keep both clients simulating (pattern from the legacy e2e suite).
const LAUNCH_ARGS = [
  '--disable-background-timer-throttling',
  '--disable-backgrounding-occluded-windows',
  '--disable-renderer-backgrounding',
  // Newer headless Chromium refuses software WebGL without this.
  '--enable-unsafe-swiftshader',
];

const playerCount = async () => {
  const res = await fetch(HEALTH_URL);
  return (await res.json()).playerCount;
};

const browser = await chromium.launch({ args: LAUNCH_ARGS });
const errors = { a: [], b: [] };

try {
  const before = await playerCount();
  console.log(`playerCount before: ${before}`);

  const contexts = await Promise.all([browser.newContext(), browser.newContext()]);
  const [pageA, pageB] = await Promise.all(contexts.map(c => c.newPage()));

  pageA.on('pageerror', e => errors.a.push(String(e)));
  pageB.on('pageerror', e => errors.b.push(String(e)));

  await Promise.all([
    pageA.goto(PLAY_URL, { waitUntil: 'domcontentloaded' }),
    pageB.goto(PLAY_URL, { waitUntil: 'domcontentloaded' }),
  ]);

  // Wait for both websockets to register server-side.
  let count = 0;
  for (let i = 0; i < 30; i++) {
    count = await playerCount();
    if (count >= before + 2) break;
    await new Promise(r => setTimeout(r, 1000));
  }
  console.log(`playerCount after joins: ${count}`);

  if (count < before + 2) {
    throw new Error(`Expected ${before + 2} players, server reports ${count}`);
  }

  // Both clients should reach a connected game state (HUD present).
  await Promise.all([pageA, pageB].map(page =>
    page.waitForFunction(() => {
      const text = document.body.innerText || '';
      // Zombies shows "100/100" health; PvP shows the DEATHMATCH header.
      return /\d+\/\d+/.test(text) || /DEATHMATCH/i.test(text);
    }, { timeout: 30000 })
  ));
  console.log('Both clients render the in-game HUD.');

  await pageA.screenshot({ path: '/tmp/mp-client-a.png' });
  await pageB.screenshot({ path: '/tmp/mp-client-b.png' });

  if (errors.a.length || errors.b.length) {
    console.log('page errors:', JSON.stringify(errors, null, 2));
  } else {
    console.log('No page errors on either client.');
  }

  console.log('TWO-CLIENT CHECK PASSED');
} finally {
  await browser.close();
}
