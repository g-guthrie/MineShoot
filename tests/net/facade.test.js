import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

async function loadFacadeFactory() {
  const sandbox = {
    console,
    globalThis: {
      __MAYHEM_RUNTIME: {}
    }
  };
  const context = vm.createContext(sandbox);
  const code = await fs.readFile(new URL('../../js/net/facade.js', import.meta.url), 'utf8');
  vm.runInContext(code, context);
  return sandbox.globalThis.__MAYHEM_RUNTIME.GameNetFacade;
}

test('GameNetFacade.create reports missing required dependency methods clearly', async () => {
  const GameNetFacade = await loadFacadeFactory();

  assert.throws(
    function () {
      GameNetFacade.create({
        netState: {},
        joinState: {},
        connectionTiming: {},
        runtimeCore: {},
        stateView: {},
        commandsApi: {},
        effects: {}
      });
    },
    function (err) {
      assert.match(err.message, /GameNetFacade\.create missing required dependencies:/);
      assert.match(err.message, /joinState\.beginJoinAttempt/);
      assert.match(err.message, /stateView\.getEntityStateList/);
      assert.match(err.message, /commandsApi\.sendFire/);
      return true;
    }
  );
});
