import test from 'node:test';
import assert from 'node:assert/strict';

import { normalizeOpaqueId, parseCookies } from '../../cloudflare/server/transport.js';

test('server transport ignores malformed cookie segments instead of throwing', () => {
  assert.deepEqual(parseCookies('good=value; broken=%E0%A4%A; sid=session%201'), {
    good: 'value',
    sid: 'session 1'
  });
});

test('server transport normalizes friendly guest ids with or without separators', () => {
  assert.equal(normalizeOpaqueId('Amber Otter 314'), 'amber-otter-314');
  assert.equal(normalizeOpaqueId('AMBEROTTER314'), 'amber-otter-314');
  assert.equal(normalizeOpaqueId('amber-otter-314'), 'amber-otter-314');
});
