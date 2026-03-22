import test from 'node:test';
import assert from 'node:assert/strict';

import { touchPartyPresence } from '../../cloudflare/server/party.js';
import { createFakeEnv } from '../helpers/fake-d1.js';

test('party presence skips identical rewrites inside the throttle window and updates immediately on state change', async () => {
  const env = createFakeEnv();
  const originalNow = Date.now;
  let fakeNow = 1_700_000_000_000;
  Date.now = function () {
    return fakeNow;
  };

  try {
    await touchPartyPresence(env, { id: 'actor-1', displayName: 'ALPHA' }, 'menu');
    const first = { ...env.__state.partyPresence.get('actor-1') };

    fakeNow += 5000;
    await touchPartyPresence(env, { id: 'actor-1', displayName: 'ALPHA' }, 'menu');
    const second = { ...env.__state.partyPresence.get('actor-1') };

    assert.deepEqual(second, first);

    fakeNow += 1000;
    await touchPartyPresence(env, { id: 'actor-1', displayName: 'ALPHA' }, 'in_match');
    const changed = { ...env.__state.partyPresence.get('actor-1') };

    assert.equal(changed.activity_state, 'in_match');
    assert.equal(changed.last_seen_at >= first.last_seen_at, true);
  } finally {
    Date.now = originalNow;
  }
});

