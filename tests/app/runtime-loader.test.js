import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createRetryableMemoizedLoader,
  resolveGameplayRuntimeApi,
  resolveDocsRuntimeApi
} from '../../js/app/runtime-loader.js';

test('createRetryableMemoizedLoader retries after a rejected load', async () => {
  let attempts = 0;
  const load = createRetryableMemoizedLoader(() => {
    attempts += 1;
    return Promise.reject(new Error(`boom ${attempts}`));
  });

  await assert.rejects(load(), /boom 1/);
  await assert.rejects(load(), /boom 2/);
  assert.equal(attempts, 2);
});

test('createRetryableMemoizedLoader memoizes a successful load', async () => {
  let attempts = 0;
  const sentinel = { ok: true };
  const load = createRetryableMemoizedLoader(() => {
    attempts += 1;
    return Promise.resolve(sentinel);
  });

  const firstLoad = load();
  const secondLoad = load();
  const [firstResolved, secondResolved] = await Promise.all([firstLoad, secondLoad]);

  assert.equal(firstLoad, secondLoad);
  assert.equal(firstResolved, sentinel);
  assert.equal(secondResolved, sentinel);
  assert.equal(attempts, 1);
});

test('resolveGameplayRuntimeApi reads the explicit module export', () => {
  const moduleApi = { launchModeById() {} };

  assert.equal(
    resolveGameplayRuntimeApi({ gameplayRuntimeApi: moduleApi }),
    moduleApi
  );
});

test('resolveGameplayRuntimeApi returns null when the gameplay module export is missing', () => {
  assert.equal(resolveGameplayRuntimeApi({}), null);
});

test('resolveDocsRuntimeApi reads the explicit module export', () => {
  const moduleApi = { init() {}, open() {} };

  assert.equal(
    resolveDocsRuntimeApi({ docsRuntimeApi: moduleApi }),
    moduleApi
  );
});
