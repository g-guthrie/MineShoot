#!/usr/bin/env node
/**
 * Two-client multiplayer smoke test against `wrangler dev`.
 *
 * Proves the milestone contract end to end:
 *   - two WebSocket clients join the same room (Durable Object)
 *   - inputs flow client -> DO, the DO ticks the authoritative sim
 *   - both clients receive snapshots, including each other's movement
 *   - the round starts and zombies spawn
 *
 * Usage: node e2e/two-client.mjs  (expects `npm run build` output to exist)
 */
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const PORT = 8788;
const BASE = `http://127.0.0.1:${PORT}`;
const ROOM_URL = `ws://127.0.0.1:${PORT}/api/room/E2E/ws?countdown=2`;

let wrangler = null;
let failed = false;

function log(message) {
  console.log(`[e2e] ${message}`);
}

function fail(message) {
  console.error(`[e2e] FAIL: ${message}`);
  failed = true;
}

function assert(condition, message) {
  if (condition) {
    log(`ok: ${message}`);
  } else {
    fail(message);
  }
}

async function waitForServer(timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${BASE}/api/health`);
      if (res.ok) return;
    } catch {
      // not up yet
    }
    await sleep(500);
  }
  throw new Error('wrangler dev did not become healthy in time');
}

class TestClient {
  constructor(name) {
    this.name = name;
    this.playerId = null;
    this.snapshots = [];
    this.events = [];
    this.ws = null;
  }

  connect() {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(ROOM_URL);
      this.ws = ws;
      const timeout = setTimeout(() => reject(new Error(`${this.name}: welcome timeout`)), 10_000);

      ws.addEventListener('open', () => {
        ws.send(
          JSON.stringify({
            type: 'join',
            protocol: 1,
            name: this.name,
            clientId: `e2e-${this.name}-${Math.random().toString(36).slice(2, 10)}`,
          }),
        );
      });

      ws.addEventListener('message', event => {
        const msg = JSON.parse(event.data);
        if (msg.type === 'welcome') {
          this.playerId = msg.playerId;
          clearTimeout(timeout);
          resolve();
        } else if (msg.type === 'snapshot') {
          this.snapshots.push(msg.snapshot);
          if (this.snapshots.length > 400) this.snapshots.shift();
          this.events.push(...msg.snapshot.events);
        } else if (msg.type === 'error') {
          clearTimeout(timeout);
          reject(new Error(`${this.name}: server error ${msg.code}`));
        }
      });

      ws.addEventListener('error', () => {
        clearTimeout(timeout);
        reject(new Error(`${this.name}: socket error`));
      });
    });
  }

  sendInput(partial) {
    this.ws.send(
      JSON.stringify({
        type: 'input',
        seq: (this.seq = (this.seq ?? 0) + 1),
        moveX: 0,
        moveZ: 0,
        yaw: 0,
        pitch: 0,
        jump: false,
        sprint: false,
        fire: false,
        reload: false,
        interact: false,
        ...partial,
      }),
    );
  }

  latest() {
    return this.snapshots[this.snapshots.length - 1];
  }

  me() {
    return this.latest()?.players.find(p => p.id === this.playerId);
  }

  close() {
    try {
      this.ws?.close();
    } catch {
      // already closed
    }
  }
}

async function main() {
  log('starting wrangler dev…');
  wrangler = spawn('npx', ['wrangler', 'dev', '--port', String(PORT)], {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, CI: '1', WRANGLER_SEND_METRICS: 'false' },
  });
  wrangler.stdout.on('data', () => {});
  wrangler.stderr.on('data', () => {});

  await waitForServer();
  log('server is healthy');

  const alice = new TestClient('Alice');
  const bob = new TestClient('Bob');
  await alice.connect();
  await bob.connect();

  assert(alice.playerId && bob.playerId, 'both clients received welcome with player ids');
  assert(alice.playerId !== bob.playerId, 'player ids are distinct');

  // Let snapshots flow.
  await sleep(1_000);
  assert(alice.snapshots.length > 10, `alice receives snapshots (${alice.snapshots.length})`);
  assert(bob.snapshots.length > 10, `bob receives snapshots (${bob.snapshots.length})`);
  assert(
    alice.latest().players.length === 2 && bob.latest().players.length === 2,
    'both clients see both players',
  );

  // Alice walks east for 1.5s (the spawn room is open to the east).
  const aliceStart = { ...alice.me() };
  const walkTimer = setInterval(() => alice.sendInput({ moveZ: 1, yaw: -Math.PI / 2 }), 50);
  await sleep(1_500);
  clearInterval(walkTimer);
  alice.sendInput({});
  await sleep(300);

  const aliceNow = alice.me();
  const aliceSeenByBob = bob.latest().players.find(p => p.id === alice.playerId);
  const moved = Math.hypot(aliceNow.x - aliceStart.x, aliceNow.z - aliceStart.z);
  const movedForBob = Math.hypot(aliceSeenByBob.x - aliceStart.x, aliceSeenByBob.z - aliceStart.z);
  assert(moved > 2, `alice moved on the server (${moved.toFixed(2)}m)`);
  assert(movedForBob > 2, `bob sees alice's movement (${movedForBob.toFixed(2)}m)`);
  assert(aliceNow.y > 0, `alice is standing on the map (y=${aliceNow.y})`);

  // Round starts after the 2s countdown override; zombies spawn for wave 1.
  log('waiting for the round to start…');
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    const snap = alice.latest();
    if (snap?.phase === 'running' && snap.enemies.length > 0) break;
    await sleep(250);
  }
  const running = alice.latest();
  assert(running.phase === 'running', `round is running (phase=${running.phase})`);
  assert(running.wave >= 1, `wave counter advanced (wave=${running.wave})`);
  assert(running.enemies.length > 0, `zombies spawned (${running.enemies.length})`);
  assert(
    bob.latest().enemies.length > 0,
    `bob sees the zombies too (${bob.latest().enemies.length})`,
  );
  assert(
    alice.events.some(e => e.type === 'gameStarted') &&
      alice.events.some(e => e.type === 'waveStarted'),
    'gameStarted and waveStarted events were broadcast',
  );

  // Alice shoots; the shot event comes back.
  alice.sendInput({ fire: true });
  await sleep(200);
  alice.sendInput({ fire: false });
  await sleep(300);
  assert(
    alice.events.some(e => e.type === 'shot' && e.playerId === alice.playerId),
    'shot event broadcast after firing',
  );
  const afterShot = alice.me();
  assert(afterShot.ammo < 10, `ammo consumed (${afterShot.ammo}/10)`);

  alice.close();
  bob.close();
}

main()
  .catch(err => {
    fail(err.message);
  })
  .finally(() => {
    if (wrangler) wrangler.kill('SIGTERM');
    setTimeout(() => {
      if (wrangler) wrangler.kill('SIGKILL');
      process.exit(failed ? 1 : 0);
    }, 1_500);
  });
