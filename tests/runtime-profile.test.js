import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

async function loadRuntimeProfile(location) {
  const code = await fs.readFile(new URL('../js/core/runtime-profile.js', import.meta.url), 'utf8');
  const sandbox = {
    globalThis: { __MAYHEM_RUNTIME: {} },
    window: {
      location,
      sessionStorage: {
        getItem() { return null; },
        setItem() {}
      }
    },
    URL,
    URLSearchParams,
    console,
    crypto: { randomUUID: () => '12345678-1234-1234-1234-123456789abc' }
  };
  vm.runInContext(code, vm.createContext(sandbox));
  return sandbox.globalThis.__MAYHEM_RUNTIME.GameRuntimeProfile;
}

test('runtime profile resolves menu api calls through same-origin on local http', async () => {
  const profile = await loadRuntimeProfile({
    protocol: 'http:',
    hostname: '127.0.0.1',
    origin: 'http://127.0.0.1:3004',
    search: ''
  });

  assert.equal(profile.resolveApiUrl('/api/party'), 'http://127.0.0.1:3004/api/party');
});

test('runtime profile resolves menu api calls through same-origin on production http', async () => {
  const profile = await loadRuntimeProfile({
    protocol: 'https:',
    hostname: 'mayhem.example',
    origin: 'https://mayhem.example',
    search: ''
  });

  assert.equal(profile.resolveApiUrl('/api/friends'), 'https://mayhem.example/api/friends');
});
