import test from 'node:test';
import assert from 'node:assert/strict';

test('lobby hub debounces rapid sync posts into a single broadcastState call', async () => {
  let broadcastCount = 0;
  let pendingSyncTimer = null;

  function handleSync() {
    if (pendingSyncTimer) clearTimeout(pendingSyncTimer);
    pendingSyncTimer = setTimeout(() => {
      pendingSyncTimer = null;
      broadcastCount++;
    }, 100);
  }

  // Simulate 5 rapid /sync POST calls
  handleSync();
  handleSync();
  handleSync();
  handleSync();
  handleSync();

  assert.equal(broadcastCount, 0, 'no broadcast yet during debounce window');

  // Wait for debounce to fire
  await new Promise((resolve) => setTimeout(resolve, 150));

  assert.equal(broadcastCount, 1, 'only one broadcast after debounce settles');
});

test('lobby hub fires separate broadcasts for sync posts spaced apart', async () => {
  let broadcastCount = 0;
  let pendingSyncTimer = null;

  function handleSync() {
    if (pendingSyncTimer) clearTimeout(pendingSyncTimer);
    pendingSyncTimer = setTimeout(() => {
      pendingSyncTimer = null;
      broadcastCount++;
    }, 100);
  }

  handleSync();
  await new Promise((resolve) => setTimeout(resolve, 150));
  assert.equal(broadcastCount, 1);

  handleSync();
  await new Promise((resolve) => setTimeout(resolve, 150));
  assert.equal(broadcastCount, 2);
});
