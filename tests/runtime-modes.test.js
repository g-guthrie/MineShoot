import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getRuntimeModeCatalog,
  getRuntimeMode,
  getDefaultRuntimeModeId,
  normalizeRuntimeModeId
} from '../shared/runtime-modes.js';

test('runtime mode catalog exposes the supported launch surfaces', () => {
  const modes = getRuntimeModeCatalog();
  assert.deepEqual(
    modes.map((mode) => mode.id),
    ['cloud_multiplayer', 'single_cloudflare', 'single_dev_server']
  );
});

test('runtime mode helpers normalize unknown ids safely', () => {
  assert.equal(getDefaultRuntimeModeId(), 'cloud_multiplayer');
  assert.equal(normalizeRuntimeModeId('single_dev_server'), 'single_dev_server');
  assert.equal(normalizeRuntimeModeId('unknown'), 'cloud_multiplayer');
  assert.equal(getRuntimeMode('cloud_multiplayer').backendKind, 'cloudflare-prod');
  assert.equal(getRuntimeMode('single_cloudflare').authoritativeTesting, true);
});
