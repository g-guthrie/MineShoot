import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

async function loadAuthClient(fetchImpl) {
  const code = await fs.readFile(new URL('../../js/net/auth.js', import.meta.url), 'utf8');
  const sandbox = {
    __MAYHEM_RUNTIME: {},
    window: {
      dispatchEvent() {},
      sessionStorage: null
    },
    document: {
      activeElement: null,
      getElementById() {
        return null;
      }
    },
    fetch: fetchImpl,
    console,
    CustomEvent: class CustomEvent {
      constructor(type, init) {
        this.type = type;
        this.detail = init && init.detail;
      }
    }
  };
  sandbox.globalThis = sandbox;

  vm.runInContext(code, vm.createContext(sandbox));
  return sandbox.__MAYHEM_RUNTIME.GameNetAuth;
}

test('auth client reports a readable error when login returns an empty body', async () => {
  const requests = [];
  const auth = await loadAuthClient(async function (url, init) {
    requests.push({ url, init });
    return new Response('', {
      status: 502,
      headers: { 'Content-Type': 'text/plain' }
    });
  });

  await assert.rejects(auth.login('AlphaAuth', '1234'), {
    message: 'Login failed.'
  });

  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, '/api/auth/login');
  assert.equal(requests[0].init.method, 'POST');
});
