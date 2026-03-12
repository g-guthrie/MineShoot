import test from 'node:test';
import assert from 'node:assert/strict';

import {
  clearClientDiagnostics,
  getClientDiagnostics
} from '../js/runtime/diagnostics/client-diagnostics.mjs';
import { createQuickMatchFlow } from '../js/app/quick-match-flow.mjs';

test('quick match flow deduplicates concurrent launches and records success diagnostics', async () => {
  clearClientDiagnostics();
  const events = [];
  let starts = 0;

  const flow = createQuickMatchFlow({
    requestPointerLock() {
      events.push('pointerlock');
      return true;
    },
    setPlayButtonState(_busy, label) {
      events.push(`button:${label}`);
    },
    setRuntimeIndicator(label) {
      events.push(`indicator:${label}`);
    },
    loadApp() {
      starts++;
      return Promise.resolve({
        startQuickMatch() {
          events.push('start');
          return Promise.resolve(true);
        }
      });
    },
    exitPointerLock() {
      events.push('exit');
    }
  });

  const [a, b] = await Promise.all([flow.beginQuickMatch(), flow.beginQuickMatch()]);
  assert.equal(a, true);
  assert.equal(b, true);
  assert.equal(starts, 1);
  assert.deepEqual(events, [
    'pointerlock',
    'button:LOADING',
    'indicator:PROFILE :: LOADING',
    'start'
  ]);
  const diagnostics = getClientDiagnostics().map((event) => event.type);
  assert.deepEqual(diagnostics, ['quick_match_begin', 'quick_match_runtime_loaded']);
});

test('quick match flow resets UI and records diagnostics on failure', async () => {
  clearClientDiagnostics();
  const events = [];

  const flow = createQuickMatchFlow({
    requestPointerLock() {
      return true;
    },
    setPlayButtonState(_busy, label) {
      events.push(`button:${label}`);
    },
    setRuntimeIndicator(label) {
      events.push(`indicator:${label}`);
    },
    loadApp() {
      return Promise.resolve(null);
    },
    exitPointerLock() {
      events.push('exit');
    }
  });

  await assert.rejects(flow.beginQuickMatch(), /runtime entry is unavailable/i);
  assert.deepEqual(events, [
    'button:LOADING',
    'indicator:PROFILE :: LOADING',
    'button:PLAY',
    'indicator:PROFILE :: STANDBY',
    'exit'
  ]);
  const diagnostics = getClientDiagnostics().map((event) => event.type);
  assert.deepEqual(diagnostics, ['quick_match_begin', 'quick_match_error']);
});
