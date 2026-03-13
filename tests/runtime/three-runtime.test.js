import test from 'node:test';
import assert from 'node:assert/strict';

const originalThree = globalThis.THREE;
let importTag = 0;

function restoreOriginalThree() {
  if (typeof originalThree === 'undefined') {
    delete globalThis.THREE;
    return;
  }
  globalThis.THREE = originalThree;
}

async function importFreshThreeRuntime() {
  const url = new URL('../../js/app/three-runtime.js', import.meta.url);
  importTag += 1;
  url.searchParams.set('t', String(importTag));
  return import(url.href);
}

test('ensureThreeGlobal installs npm three onto globalThis when missing', async () => {
  delete globalThis.THREE;
  try {
    const threeRuntime = await importFreshThreeRuntime();
    const installed = await threeRuntime.ensureThreeGlobal();

    assert.ok(installed);
    assert.equal(installed, globalThis.THREE);
    assert.equal(installed.REVISION, '160');
  } finally {
    restoreOriginalThree();
  }
});

test('ensureThreeGlobal reuses an existing global THREE object', async () => {
  const sentinel = { sentinel: true };
  globalThis.THREE = sentinel;
  try {
    const threeRuntime = await importFreshThreeRuntime();
    const installed = await threeRuntime.ensureThreeGlobal();

    assert.equal(installed, sentinel);
    assert.equal(globalThis.THREE, sentinel);
  } finally {
    restoreOriginalThree();
  }
});

test('ensureThreeGlobal caches the pending load promise and resolves once', async () => {
  delete globalThis.THREE;
  try {
    const threeRuntime = await importFreshThreeRuntime();
    const firstLoad = threeRuntime.ensureThreeGlobal();
    const secondLoad = threeRuntime.ensureThreeGlobal();
    const [firstResolved, secondResolved] = await Promise.all([firstLoad, secondLoad]);

    assert.equal(firstLoad, secondLoad);
    assert.equal(firstResolved, secondResolved);
    assert.equal(firstResolved, globalThis.THREE);
  } finally {
    restoreOriginalThree();
  }
});
