import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

function read(filePath) {
  return fs.readFileSync(path.join(process.cwd(), filePath), 'utf8');
}

test('app shell only boots the multiplayer rifle slice', () => {
  const appIndex = read('js/app/index.js');
  const runtimeEntry = read('js/app/runtime-entry.js');
  const player = read('js/player.js');
  const world = read('js/world.js');
  const matLib = read('js/world/material-library.js');
  const intersections = read('js/world/intersection-builder.js');
  const quadrantArctic = read('js/world/quadrant-arctic.js');
  const quadrantJungle = read('js/world/quadrant-jungle.js');
  assert.doesNotMatch(appIndex, /net\/auth\.js/);
  assert.doesNotMatch(appIndex, /throwables\.js/);
  assert.doesNotMatch(appIndex, /enemy\.js/);
  assert.doesNotMatch(appIndex, /docs\.js/);
  assert.doesNotMatch(appIndex, /overhead\.js/);
  assert.doesNotMatch(appIndex, /awareness\.js/);
  assert.doesNotMatch(appIndex, /seek-profiles\.js/);
  assert.doesNotMatch(appIndex, /seek-core\.js/);
  assert.doesNotMatch(appIndex, /core\/event-bus\.js/);
  assert.doesNotMatch(appIndex, /core\/mode-flow\.js/);
  assert.doesNotMatch(appIndex, /net\/snapshots\.js/);
  assert.match(runtimeEntry, /GameWorld\.configure/);
  assert.match(runtimeEntry, /quadrants:/);
  assert.doesNotMatch(player, /__MAYHEM_RUNTIME\.GameWorld/);
  assert.doesNotMatch(world, /__MAYHEM_RUNTIME\.WorldIntersections/);
  assert.doesNotMatch(world, /__MAYHEM_RUNTIME\.GameMaterialLibrary/);
  assert.doesNotMatch(world, /__MAYHEM_RUNTIME\.WorldQuadrants/);
  assert.doesNotMatch(matLib, /__MAYHEM_RUNTIME/);
  assert.doesNotMatch(intersections, /__MAYHEM_RUNTIME/);
  assert.doesNotMatch(quadrantArctic, /__MAYHEM_RUNTIME/);
  assert.doesNotMatch(quadrantJungle, /__MAYHEM_RUNTIME/);
});

test('shared protocol no longer exposes equip, seeker, or throwable messages', () => {
  const protocol = read('shared/protocol.js');
  assert.doesNotMatch(protocol, /EQUIP_WEAPON/);
  assert.doesNotMatch(protocol, /SEEKER_SHOT/);
  assert.doesNotMatch(protocol, /THROW:/);
  assert.doesNotMatch(protocol, /THROW_SPAWN/);
  assert.doesNotMatch(protocol, /THROW_REJECT/);
  assert.doesNotMatch(protocol, /SEEKER_REJECT/);
});

test('menu and hud markup are stripped to the multiplayer rifle slice', () => {
  const html = read('index.html');
  assert.match(html, /id="play-btn"/);
  assert.doesNotMatch(html, /primary-play-btn/);
  assert.doesNotMatch(html, /controls-toggle/);
  assert.doesNotMatch(html, /sound-toggle-btn/);
  assert.doesNotMatch(html, /auth-overlay/);
  assert.doesNotMatch(html, /auth-form/);
  assert.doesNotMatch(html, /hud-manual-btn/);
  assert.doesNotMatch(html, /open-manual-btn/);
  assert.doesNotMatch(html, /loadout-row/);
  assert.doesNotMatch(html, /throwable-info/);
  assert.doesNotMatch(html, /docs-panel/);
  assert.doesNotMatch(html, /shotgun-reticle/);
  assert.doesNotMatch(html, /sniper-scope/);
  assert.doesNotMatch(html, /seeker-reticle/);
  assert.doesNotMatch(html, /combat-radar/);
});

test('websocket upgrade assigns temporary guest identities on the backend', () => {
  const wsUpgrade = read('cloudflare/server/ws-upgrade.js');
  assert.doesNotMatch(wsUpgrade, /getSessionFromRequest/);
  assert.match(wsUpgrade, /randomId\('gst'\)/);
});
