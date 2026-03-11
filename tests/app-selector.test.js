import test from 'node:test';
import assert from 'node:assert/strict';

import { resolveAppId } from '../js/app/app-selector.js';

test('resolveAppId defaults to mayhem', () => {
  assert.equal(resolveAppId(''), 'mayhem');
  assert.equal(resolveAppId('?room=global'), 'mayhem');
});

test('resolveAppId accepts the demonic app query', () => {
  assert.equal(resolveAppId('?app=demonic'), 'demonic');
  assert.equal(resolveAppId('?mode=single_full_sandbox&app=demonic'), 'demonic');
});

test('resolveAppId ignores unsupported app ids', () => {
  assert.equal(resolveAppId('?app=unknown'), 'mayhem');
  assert.equal(resolveAppId('?app=DEMONIC'), 'demonic');
});
