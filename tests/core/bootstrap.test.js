import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

async function loadBootstrap(threeImpl, documentImpl, windowImpl) {
  const code = await fs.readFile(new URL('../../js/core/bootstrap.js', import.meta.url), 'utf8');
  const sandbox = {
    THREE: threeImpl,
    document: documentImpl,
    window: windowImpl,
    globalThis: {
      __MAYHEM_RUNTIME: {}
    }
  };
  vm.runInContext(code, vm.createContext(sandbox));
  return sandbox.globalThis.__MAYHEM_RUNTIME.GameBootstrap;
}

test('createRenderContext retries with less expensive renderer settings after context failures', async () => {
  const appended = [];
  const attemptedOptions = [];
  let attempts = 0;

  function makeCanvas(tag) {
    return {
      tag,
      parentNode: null
    };
  }

  const bootstrap = await loadBootstrap({
    WebGLRenderer: function WebGLRenderer(options) {
      attemptedOptions.push({
        antialias: !!(options && options.antialias),
        powerPreference: String(options && options.powerPreference || '')
      });
      attempts += 1;
      this.domElement = makeCanvas('canvas-' + attempts);
      if (attempts < 3) {
        throw new Error('context failed');
      }
      this.setSize = function () {};
      this.setPixelRatio = function () {};
    },
    Scene: function Scene() {},
    Clock: function Clock() {}
  }, {
    body: {
      appendChild(node) {
        appended.push(node.tag);
      }
    }
  }, {
    innerWidth: 1280,
    innerHeight: 720,
    devicePixelRatio: 2
  });

  const renderCtx = bootstrap.createRenderContext();

  assert.ok(renderCtx.renderer, 'expected renderer');
  assert.equal(appended.length, 1);
  assert.deepEqual(appended, ['canvas-3']);
  assert.deepEqual(attemptedOptions, [
    { antialias: true, powerPreference: 'high-performance' },
    { antialias: false, powerPreference: 'high-performance' },
    { antialias: false, powerPreference: 'default' }
  ]);
});
