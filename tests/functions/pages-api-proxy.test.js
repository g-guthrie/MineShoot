import test from 'node:test';
import assert from 'node:assert/strict';

import { onRequest } from '../../functions/api/[[path]].js';

test('pages api proxy forwards websocket upgrade requests to the configured worker origin', async () => {
  const originalFetch = globalThis.fetch;
  const seen = [];

  globalThis.fetch = async function mockFetch(request) {
    seen.push(request);
    return { status: 101 };
  };

  try {
    const response = await onRequest({
      env: {
        WORKER_ORIGIN: 'https://worker.example'
      },
      request: new Request('https://preview.example/api/ws?room=ffa-01', {
        method: 'GET',
        headers: {
          Upgrade: 'websocket',
          Connection: 'Upgrade',
          Host: 'preview.example',
          'X-Test': 'ok'
        }
      })
    });

    assert.equal(response.status, 101);
    assert.equal(seen.length, 1);
    assert.equal(seen[0].url, 'https://worker.example/api/ws?room=ffa-01');
    assert.equal(seen[0].headers.get('upgrade'), 'websocket');
    assert.equal(seen[0].headers.get('x-test'), 'ok');
    assert.equal(seen[0].headers.get('host'), null);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('pages api proxy treats 0.0.0.0 preview hosts as local worker traffic', async () => {
  const originalFetch = globalThis.fetch;
  const seen = [];

  globalThis.fetch = async function mockFetch(request) {
    seen.push(request);
    return { status: 200 };
  };

  try {
    const response = await onRequest({
      env: {},
      request: new Request('http://0.0.0.0:3000/api/party')
    });

    assert.equal(response.status, 200);
    assert.equal(seen.length, 1);
    assert.equal(seen[0].url, 'http://127.0.0.1:8787/api/party');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('pages api proxy uses the live worker backend for hosted preview traffic by default', async () => {
  const originalFetch = globalThis.fetch;
  const seen = [];

  globalThis.fetch = async function mockFetch(request) {
    seen.push(request);
    return { status: 200 };
  };

  try {
    const response = await onRequest({
      env: {},
      request: new Request('https://preview.example/api/party')
    });

    assert.equal(response.status, 200);
    assert.equal(seen.length, 1);
    assert.equal(seen[0].url, 'https://mayhem.gguthrie-minecraft-fps.workers.dev/api/party');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
