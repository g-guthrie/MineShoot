import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

async function loadRuntimeModeUi() {
  const code = await fs.readFile(new URL('../../js/core/runtime-mode-ui.js', import.meta.url), 'utf8');
  const indicator = {
    textContent: '',
    hidden: false,
    classList: {
      toggle(_token, _force) {}
    }
  };
  const sandbox = {
    __MAYHEM_RUNTIME: {
      GameShared: {
        privateRoomCodes: {
          privateRoomCodeFromId(roomId) {
            return String(roomId || '').replace(/^private-/, '').toUpperCase();
          }
        }
      }
    },
    globalThis: null,
    document: {
      getElementById(id) {
        if (id === 'runtime-indicator') return indicator;
        return null;
      }
    }
  };
  sandbox.globalThis = sandbox;
  vm.runInContext(code, vm.createContext(sandbox));
  return {
    ui: sandbox.__MAYHEM_RUNTIME.GameRuntimeModeUi,
    indicator
  };
}

test('runtime mode ui formats startup subtitles and share-code room labels consistently', async () => {
  const harness = await loadRuntimeModeUi();

  assert.equal(
    harness.ui.startupSubtitleForMode({ id: 'cloud_multiplayer', roomId: 'global', gameMode: 'ffa' }),
    'Connecting to Public Lobby: global...'
  );
  assert.equal(
    harness.ui.runtimeRoomLabel({ id: 'single_cloudflare', roomId: 'private-room1', gameMode: 'tdm' }),
    'Team Deathmatch Code ROOM1'
  );
  assert.equal(
    harness.ui.startupSubtitleForMode({ id: 'single_dev_server', roomId: 'local-shared', gameMode: 'ffa' }),
    'Connecting to Local Multiplayer: local-shared...'
  );
  assert.equal(
    harness.ui.startupSubtitleForMode({ id: 'single_full_sandbox', roomId: '', gameMode: 'ffa' }),
    'Starting Offline Sandbox: Free For All...'
  );
  assert.equal(
    harness.ui.startupNoticeForMode({ id: 'single_full_sandbox', roomId: '', gameMode: 'ffa' }),
    'Offline Sandbox Free For All: local-only match.'
  );
});

test('runtime mode ui renders indicator text from one shared formatter', async () => {
  const harness = await loadRuntimeModeUi();

  harness.ui.setRuntimeIndicator({
    id: 'single_cloudflare',
    label: 'Private Cloudflare Room',
    backendLabel: 'Cloudflare Prod',
    roomId: 'private-room1',
    gameMode: 'tdm'
  }, { debugActive: false });

  assert.equal(
    harness.indicator.textContent,
    'Profile - Private Cloudflare Room - Cloudflare Prod - Team Deathmatch Code ROOM1'
  );
  assert.equal(harness.indicator.hidden, true);
});

test('runtime mode ui only shows the indicator while debug mode is active', async () => {
  const harness = await loadRuntimeModeUi();

  harness.ui.setRuntimeIndicator({
    id: 'single_dev_server',
    label: 'Local Multiplayer',
    backendLabel: 'Local Worker',
    roomId: 'ffa-01',
    gameMode: 'ffa'
  }, { debugActive: true });

  assert.equal(harness.indicator.hidden, false);
  assert.equal(
    harness.indicator.textContent,
    'Debug Mode - Press H to Switch'
  );
});
