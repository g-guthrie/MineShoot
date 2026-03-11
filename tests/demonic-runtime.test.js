import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

async function loadDemonicRuntime() {
  const sessionCode = await fs.readFile(new URL('../demonic/runtime/session.js', import.meta.url), 'utf8');
  const mainCode = await fs.readFile(new URL('../demonic/runtime/main.js', import.meta.url), 'utf8');

  const sandbox = {
    __MAYHEM_RUNTIME: {
      GameRuntimeProfile: {
        selectMode(modeId) {
          if (modeId !== 'single_full_sandbox') return null;
          return {
            id: 'single_full_sandbox',
            label: 'Offline Sandbox',
            backendLabel: 'OFFLINE SANDBOX',
            authorityMode: 'offline',
            roomId: '',
            gameMode: ''
          };
        }
      },
      GameRuntimeModeUi: {
        startupNoticeForMode(mode) {
          return 'Notice for ' + String(mode && mode.id || '');
        }
      }
    },
    __DEMONIC_RUNTIME: {},
    globalThis: null,
    Date,
    Promise,
    console
  };
  sandbox.globalThis = sandbox;

  const context = vm.createContext(sandbox);
  vm.runInContext(sessionCode, context);
  vm.runInContext(mainCode, context);
  return sandbox.__DEMONIC_RUNTIME;
}

test('demonic runtime launchModeById records a session-backed launch snapshot', async () => {
  const runtime = await loadDemonicRuntime();
  runtime.GameRuntimeState = {
    _value: null,
    setCurrentRuntime(value) { this._value = value; },
    getCurrentRuntime() { return this._value; },
    clearCurrentRuntime() { this._value = null; }
  };
  runtime.GameMatchRuntime = {
    create(options) {
      return {
        start() {
          return {
            phase: 'starting',
            modeId: options.mode.id,
            gameMode: options.context.gameMode,
            roomId: options.context.roomId,
            tickCount: 0,
            elapsedMs: 0,
            statusText: 'launch accepted'
          };
        },
        stop() {},
        getSnapshot() {
          return {
            phase: 'running',
            modeId: options.mode.id,
            gameMode: options.context.gameMode,
            roomId: options.context.roomId,
            tickCount: 1,
            elapsedMs: 16,
            statusText: 'runtime skeleton active'
          };
        }
      };
    }
  };

  const result = await runtime.GameMain.launchModeById('single_full_sandbox', { gameMode: 'tdm' });

  assert.equal(result.ok, true);
  assert.equal(result.mode.id, 'single_full_sandbox');
  assert.equal(result.mode.gameMode, 'tdm');
  assert.equal(result.session.phase, 'in_match');
  assert.equal(result.session.context.gameMode, 'tdm');
  assert.equal(result.session.runtimeSnapshot.phase, 'running');
  assert.equal(result.session.runtimeSnapshot.statusText, 'runtime skeleton active');
});
