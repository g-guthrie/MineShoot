import test from 'node:test';
import assert from 'node:assert/strict';

import { createMatchClientStack } from '../js/runtime/client/match-client-stack.mjs';

test('match client stack waits for backend world metadata before bootstrapping', async () => {
  let now = 0;
  let initScene = null;
  let bootstrapArgs = null;

  const stack = createMatchClientStack({
    netApi: {
      init(scene) {
        initScene = scene;
      },
      getWorldMeta() {
        return now >= 100 ? { worldSeed: 'room-env-v6-static-ffa-01' } : null;
      },
      getExpectedWorldMeta() {
        return { worldSeed: 'fallback-world' };
      }
    },
    coordinator: {
      bootstrap(args) {
        bootstrapArgs = args;
        return { kind: 'camera' };
      },
      updateFrame() {
        return { camera: { kind: 'camera' } };
      },
      fire() {
        return true;
      },
      setDebugVisuals() {},
      syncWeaponPresentation() {
        return { id: 'rifle' };
      }
    },
    performanceApi: {
      now() {
        return now;
      }
    },
    setTimeoutFn(fn) {
      now += 50;
      fn();
    }
  });

  const scene = { tag: 'scene' };
  const result = await stack.startSession({
    scene,
    isPlaying() {
      return true;
    },
    metaTimeoutMs: 140
  });

  assert.equal(initScene, scene);
  assert.equal(result.camera.kind, 'camera');
  assert.equal(result.startupNotice, '');
  assert.equal(bootstrapArgs.worldMeta.worldSeed, 'room-env-v6-static-ffa-01');
});

test('match client stack falls back to expected world metadata after timeout', async () => {
  let now = 0;

  const stack = createMatchClientStack({
    netApi: {
      init() {},
      getWorldMeta() {
        return null;
      },
      getExpectedWorldMeta() {
        return { worldSeed: 'fallback-world' };
      }
    },
    coordinator: {
      bootstrap(args) {
        return args.worldMeta;
      },
      updateFrame() {
        return null;
      },
      fire() {
        return false;
      },
      setDebugVisuals() {},
      syncWeaponPresentation() {
        return null;
      }
    },
    performanceApi: {
      now() {
        return now;
      }
    },
    setTimeoutFn(fn) {
      now += 80;
      fn();
    }
  });

  const result = await stack.startSession({
    scene: {},
    isPlaying() {
      return false;
    },
    metaTimeoutMs: 140
  });

  assert.equal(result.worldMeta.worldSeed, 'fallback-world');
  assert.match(result.startupNotice, /world metadata timeout/i);
});
