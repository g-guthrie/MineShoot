import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

async function loadTransportHarness() {
  const code = await fs.readFile(new URL('../js/net/transport.js', import.meta.url), 'utf8');
  const sockets = [];
  const timers = [];
  let nextTimerId = 1;

  class FakeSocket {
    constructor() {
      this.handlers = {};
      this.readyState = 1;
      sockets.push(this);
    }
    addEventListener(type, handler) {
      this.handlers[type] = handler;
    }
    send() {}
    close() {}
    emit(type, event = {}) {
      if (this.handlers[type]) this.handlers[type](event);
    }
  }

  const sandbox = {
    __MAYHEM_RUNTIME: {},
    globalThis: null,
    WebSocket: FakeSocket,
    setTimeout(fn) {
      const id = nextTimerId++;
      timers.push({ id, fn });
      return id;
    },
    clearTimeout(id) {
      const idx = timers.findIndex((entry) => entry.id === id);
      if (idx >= 0) timers.splice(idx, 1);
    },
    console
  };
  sandbox.globalThis = sandbox;
  vm.runInContext(code, vm.createContext(sandbox));
  return {
    create: sandbox.__MAYHEM_RUNTIME.GameNetTransport.create,
    sockets,
    flushTimers() {
      while (timers.length) {
        const next = timers.shift();
        if (typeof next.fn === 'function') next.fn();
      }
    }
  };
}

test('transport regenerates identity before reconnecting after a superseded close', async () => {
  const harness = await loadTransportHarness();
  let regenerated = 0;
  const transport = harness.create({
    endpoint() { return 'wss://example.test'; },
    isActive() { return true; },
    reconnectMs: 1,
    onSupersededClose() {
      regenerated += 1;
      return Promise.resolve();
    }
  });

  transport.connect();
  assert.equal(harness.sockets.length, 1);
  harness.sockets[0].emit('close', { code: 4001 });
  await Promise.resolve();
  harness.flushTimers();

  assert.equal(regenerated, 1);
  assert.equal(harness.sockets.length, 2);
});

test('transport does not reconnect after shutdown while superseded recovery is still resolving', async () => {
  const harness = await loadTransportHarness();
  let resolveRecovery;
  const recovery = new Promise((resolve) => {
    resolveRecovery = resolve;
  });
  const transport = harness.create({
    endpoint() { return 'wss://example.test'; },
    isActive() { return true; },
    reconnectMs: 1,
    onSupersededClose() {
      return recovery;
    }
  });

  transport.connect();
  harness.sockets[0].emit('close', { code: 4001 });
  transport.shutdown();
  resolveRecovery();
  await Promise.resolve();
  harness.flushTimers();

  assert.equal(harness.sockets.length, 1);
});
