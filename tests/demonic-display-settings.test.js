import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

async function loadDisplaySettings(initialValue = null) {
  const code = await fs.readFile(new URL('../demonic/platform/display-settings.js', import.meta.url), 'utf8');
  const store = new Map();
  if (initialValue !== null) store.set('demonic_display_fps_cap', String(initialValue));

  const sandbox = {
    __DEMONIC_RUNTIME: {},
    globalThis: null,
    window: {
      localStorage: {
        getItem(key) {
          return store.has(key) ? store.get(key) : null;
        },
        setItem(key, value) {
          store.set(key, String(value));
        }
      }
    },
    console
  };
  sandbox.globalThis = sandbox;
  vm.runInContext(code, vm.createContext(sandbox));
  return sandbox.__DEMONIC_RUNTIME.DisplaySettings;
}

test('demonic display settings default to 60 FPS and persist supported values', async () => {
  const settings = await loadDisplaySettings();

  assert.equal(settings.getTargetFps(), 60);
  assert.deepEqual(Array.from(settings.getFpsOptions()), [30, 60, 120, 144, 240, 0]);
  assert.equal(settings.setTargetFps(120), 120);
  assert.equal(settings.getTargetFps(), 120);
  assert.equal(settings.fpsLabel(0), 'UNLIMITED');
});
