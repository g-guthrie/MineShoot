import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

function read(filePath) {
  return fs.readFileSync(path.join(process.cwd(), filePath), 'utf8');
}

test('app shell no longer loads the ability runtime module', () => {
  const runtimeEntry = read('js/app/runtime-entry.js');
  assert.doesNotMatch(runtimeEntry, /abilities\.js/);
});

test('protocol no longer exposes ability queue or cast messages', () => {
  const protocol = read('shared/protocol.js');
  assert.doesNotMatch(protocol, /CLASS_QUEUE/);
  assert.doesNotMatch(protocol, /CLASS_CAST/);
  assert.doesNotMatch(protocol, /CLASS_CHANGED/);
  assert.doesNotMatch(protocol, /CLASS_QUEUED/);
});

test('menu markup no longer exposes ability loadout or ability hud nodes', () => {
  const html = read('index.html');
  assert.doesNotMatch(html, /ability-slot-panel/);
  assert.doesNotMatch(html, /ability-info/);
  assert.doesNotMatch(html, /ability-debug-panel/);
});

test('shell exposes a PLAY handoff for entering the live match', () => {
  const html = read('index.html');
  const main = read('js/main.js');
  const shell = read('js/shell.js');
  const runtimeEntry = read('js/app/runtime-entry.js');
  assert.match(html, /id="play-btn"[^>]*>PLAY</);
  assert.match(html, /type="module"\s+src="\/js\/shell\.js"/);
  assert.doesNotMatch(html, /vendor\/three\.min\.js/);
  assert.doesNotMatch(html, /primary-play-btn/);
  assert.doesNotMatch(html, /controls-toggle/);
  assert.doesNotMatch(html, /sound-toggle-btn/);
  assert.doesNotMatch(html, /back-mode-btn/);
  assert.match(shell, /beginQuickMatch/);
  assert.match(shell, /import\('\.\/app\/runtime-entry\.js'\)/);
  assert.doesNotMatch(runtimeEntry, /GameMainLauncher/);
  assert.match(main, /export function startQuickMatch\(/);
  assert.doesNotMatch(main, /GameMainLauncher/);
  assert.match(main, /function requestMatchmaking\(\)/);
  assert.match(main, /startAllocatedRoom\(result\.body\)/);
  assert.match(main, /requestControlMode\(\);/);
});
