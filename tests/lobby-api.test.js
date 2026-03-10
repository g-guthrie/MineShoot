import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

async function loadLobbyApi(fetchImpl) {
  const code = await fs.readFile(new URL('../js/app/lobby-api.js', import.meta.url), 'utf8');
  const sandbox = {
    globalThis: {
      __MAYHEM_RUNTIME: {
        GameRuntimeProfile: {
          resolveApiUrl(path) {
            return 'https://menu.test' + String(path || '');
          }
        }
      }
    },
    window: { location: { origin: 'https://menu.test' } },
    fetch: fetchImpl,
    URL,
    Response,
    console
  };
  vm.runInContext(code, vm.createContext(sandbox));
  return sandbox.globalThis.__MAYHEM_RUNTIME.GameLobbyApi;
}

test('lobby api surfaces status and url for failed menu requests', async () => {
  const api = await loadLobbyApi(async () => new Response(JSON.stringify({
    ok: false,
    error: 'Endpoint missing.'
  }), {
    status: 404,
    headers: { 'Content-Type': 'application/json' }
  }));

  await assert.rejects(
    api.requestJson('/api/party', { method: 'GET' }),
    (err) => err && err.status === 404 && /Endpoint missing\./.test(err.message) && /menu\.test\/api\/party/.test(err.url)
  );
});
