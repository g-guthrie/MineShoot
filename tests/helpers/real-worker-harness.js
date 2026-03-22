import { spawn } from 'node:child_process';
import { once } from 'node:events';
import fs from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '../..');
const READY_TIMEOUT_MS = 120_000;
const MESSAGE_TIMEOUT_MS = 8_000;
const PROCESS_STOP_TIMEOUT_MS = 8_000;
const CLIENT_CLOSE_TIMEOUT_MS = 2_000;
const MAX_LOG_LENGTH = 24_000;
const MAX_MESSAGE_COUNT = 400;

function trimLog(text) {
  const value = String(text || '');
  if (value.length <= MAX_LOG_LENGTH) return value;
  return value.slice(value.length - MAX_LOG_LENGTH);
}

function appendLog(buffer, chunk) {
  return trimLog(buffer + String(chunk || ''));
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function waitForTargetEvent(target, type) {
  return new Promise((resolve) => {
    const handler = (event) => {
      target.removeEventListener(type, handler);
      resolve(event);
    };
    target.addEventListener(type, handler);
  });
}

async function reservePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = address && typeof address === 'object' ? address.port : 0;
      server.close((err) => {
        if (err) reject(err);
        else resolve(port);
      });
    });
  });
}

function createSeededRandom(seed) {
  let state = (Number(seed) || 1) >>> 0;
  if (!state) state = 1;
  return function nextRandom() {
    state = (state + 0x6D2B79F5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(value) {
  const text = String(value || '');
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function encodeQuery(parts) {
  const url = new URL(parts.path, parts.baseUrl);
  const params = parts.params || {};
  for (const key of Object.keys(params)) {
    if (params[key] == null) continue;
    url.searchParams.set(key, String(params[key]));
  }
  return url.toString();
}

async function readMessageText(data) {
  if (typeof data === 'string') return data;
  if (data == null) return '';
  if (typeof data.text === 'function') return data.text();
  if (data instanceof ArrayBuffer) return Buffer.from(data).toString('utf8');
  if (ArrayBuffer.isView(data)) {
    return Buffer.from(data.buffer, data.byteOffset, data.byteLength).toString('utf8');
  }
  return String(data);
}

function summarizeEntity(entity) {
  if (!entity || typeof entity !== 'object') return null;
  return {
    id: String(entity.id || ''),
    x: Number(entity.x || 0),
    y: Number(entity.y || 0),
    z: Number(entity.z || 0),
    seq: Number(entity.seq || 0),
    hp: Number(entity.hp || 0),
    armor: Number(entity.armor || 0),
    alive: entity.alive !== false,
    weaponId: String(entity.weaponId || '')
  };
}

function formatMessage(entry) {
  const message = entry && entry.message && typeof entry.message === 'object' ? entry.message : {};
  return {
    index: Number(entry && entry.index || 0),
    receivedAt: Number(entry && entry.receivedAt || 0),
    type: String(message.t || ''),
    serverTime: Number(message.serverTime || 0),
    entityIds: Array.isArray(message.entities) ? message.entities.map((entity) => String(entity && entity.id || '')) : [],
    sourceId: String(message.sourceId || ''),
    targetId: String(message.targetId || ''),
    shotToken: String(message.shotToken || ''),
    killed: !!message.killed,
    code: entry && entry.close ? entry.close.code : undefined
  };
}

function buildDebugState(worker, roomId, clients) {
  const clientList = Array.isArray(clients) ? clients : [];
  return {
    roomId: String(roomId || ''),
    worker: {
      port: Number(worker && worker.port || 0),
      stdout: trimLog(worker && worker.logs ? worker.logs.stdout : ''),
      stderr: trimLog(worker && worker.logs ? worker.logs.stderr : '')
    },
    clients: clientList.map((client) => ({
      userId: client.userId,
      roomId: client.roomId,
      closeInfo: client.closeInfo,
      messages: client.messages.slice(-20).map(formatMessage),
      entities: Array.from(client.snapshotMap.values()).map(summarizeEntity).filter(Boolean)
    }))
  };
}

async function waitForWorkerReady(worker, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (worker.exited) {
      throw new Error('Local worker exited before becoming ready.\n' + JSON.stringify(buildDebugState(worker, '', []), null, 2));
    }
    try {
      const response = await fetch(worker.baseHttpUrl + '/api/me');
      if (response) return;
    } catch (_err) {
      // Keep polling until the worker answers or exits.
    }
    await delay(500);
  }
  throw new Error('Timed out waiting for local worker readiness.\n' + JSON.stringify(buildDebugState(worker, '', []), null, 2));
}

function computeOutboundDelay(client) {
  const baseDelayMs = Math.max(0, Number(client.outboundDelayMs || 0));
  const jitterMs = Math.max(0, Number(client.outboundJitterMs || 0));
  if (!(jitterMs > 0)) return baseDelayMs;
  return Math.max(0, baseDelayMs + ((client.random() * 2 - 1) * jitterMs));
}

function applySnapshot(client, message) {
  if (!message || typeof message !== 'object') return;
  if (!message.delta) {
    client.snapshotMap.clear();
  }
  if (Array.isArray(message.entities)) {
    for (let i = 0; i < message.entities.length; i++) {
      const entity = message.entities[i];
      if (!entity || !entity.id) continue;
      client.snapshotMap.set(String(entity.id), JSON.parse(JSON.stringify(entity)));
    }
  }
  if (Array.isArray(message.removedEntityIds)) {
    for (let i = 0; i < message.removedEntityIds.length; i++) {
      client.snapshotMap.delete(String(message.removedEntityIds[i] || ''));
    }
  }
  client.latestSnapshot = JSON.parse(JSON.stringify(message));
}

function findMessage(client, type, predicate) {
  for (let i = 0; i < client.messages.length; i++) {
    const entry = client.messages[i];
    const message = entry.message;
    if (String(message && message.t || '') !== String(type || '')) continue;
    if (predicate && !predicate(message, entry, client.api)) continue;
    return message;
  }
  return null;
}

function rejectWaiters(client, error) {
  while (client.waiters.length > 0) {
    const waiter = client.waiters.shift();
    clearTimeout(waiter.timer);
    waiter.reject(error);
  }
}

function handleClientMessage(client, message) {
  const entry = {
    index: client.messageIndex++,
    receivedAt: Date.now(),
    message
  };
  client.messages.push(entry);
  if (client.messages.length > MAX_MESSAGE_COUNT) client.messages.shift();
  if (String(message && message.t || '') === 'snapshot') {
    applySnapshot(client, message);
  }

  const remaining = [];
  for (let i = 0; i < client.waiters.length; i++) {
    const waiter = client.waiters[i];
    if (String(message && message.t || '') !== waiter.type) {
      remaining.push(waiter);
      continue;
    }
    if (waiter.predicate && !waiter.predicate(message, entry, client.api)) {
      remaining.push(waiter);
      continue;
    }
    clearTimeout(waiter.timer);
    waiter.resolve(message);
  }
  client.waiters = remaining;
}

async function closeClient(client) {
  for (const timer of client.pendingTimers) {
    clearTimeout(timer);
  }
  client.pendingTimers.clear();

  if (!client.ws || client.ws.readyState === WebSocket.CLOSED) return;
  if (client.ws.readyState === WebSocket.CLOSING) {
    await Promise.race([client.closePromise, delay(CLIENT_CLOSE_TIMEOUT_MS)]);
    return;
  }
  client.ws.close(1000, 'test complete');
  await Promise.race([client.closePromise, delay(CLIENT_CLOSE_TIMEOUT_MS)]);
}

function buildClientApi(client) {
  client.api = {
    userId: client.userId,
    username: client.username,
    roomId: client.roomId,
    messages: client.messages,
    snapshotMap: client.snapshotMap,
    get latestSnapshot() {
      return client.latestSnapshot;
    },
    get closeInfo() {
      return client.closeInfo;
    },
    latestEntity(entityId) {
      return client.snapshotMap.get(String(entityId || '')) || null;
    },
    waitForMessage(type, predicate = null, timeoutMs = MESSAGE_TIMEOUT_MS) {
      const existing = findMessage(client, type, predicate);
      if (existing) return Promise.resolve(existing);
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          client.waiters = client.waiters.filter((waiter) => waiter !== entry);
          reject(new Error(`Timed out waiting for ${type} for ${client.userId}.`));
        }, timeoutMs);
        const entry = { type: String(type || ''), predicate, resolve, reject, timer };
        client.waiters.push(entry);
      });
    },
    waitForSnapshot(predicate = null, timeoutMs = MESSAGE_TIMEOUT_MS) {
      return this.waitForMessage('snapshot', predicate, timeoutMs);
    },
    waitForClose(timeoutMs = MESSAGE_TIMEOUT_MS) {
      if (client.closeInfo) return Promise.resolve(client.closeInfo);
      return Promise.race([
        client.closePromise.then(() => client.closeInfo),
        delay(timeoutMs).then(() => {
          throw new Error(`Timed out waiting for ${client.userId} to close.`);
        })
      ]);
    },
    async send(payload) {
      const message = JSON.stringify(payload);
      const sendAfterMs = computeOutboundDelay(client);
      if (sendAfterMs <= 0) {
        if (client.ws.readyState !== WebSocket.OPEN) {
          throw new Error(`WebSocket is not open for ${client.userId}.`);
        }
        client.ws.send(message);
        return;
      }
      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          client.pendingTimers.delete(timer);
          try {
            if (client.ws.readyState !== WebSocket.OPEN) {
              reject(new Error(`WebSocket is not open for ${client.userId}.`));
              return;
            }
            client.ws.send(message);
            resolve();
          } catch (err) {
            reject(err);
          }
        }, sendAfterMs);
        client.pendingTimers.add(timer);
      });
    },
    async sendInput(sample) {
      const input = sample || {};
      await this.send({
        t: 'input',
        seq: Math.max(0, Number(input.seq || 0)),
        dtMs: Math.max(0, Number(input.dtMs || 0)),
        yaw: Number(input.yaw || 0),
        pitch: Number(input.pitch || 0),
        forward: !!input.forward,
        backward: !!input.backward,
        left: !!input.left,
        right: !!input.right,
        jump: !!input.jump,
        sprint: !!input.sprint,
        adsActive: !!input.adsActive,
        weaponId: String(input.weaponId || 'rifle'),
        inputMode: 'intent'
      });
    },
    async sendFire(options) {
      const fire = options || {};
      const payload = {
        t: 'fire',
        weaponId: String(fire.weaponId || 'rifle'),
        shotToken: String(fire.shotToken || '')
      };
      if (fire.adsActive) payload.adsActive = true;
      if (Number.isFinite(Number(fire.viewFovDeg))) payload.viewFovDeg = Number(fire.viewFovDeg);
      if (Number.isFinite(Number(fire.estimatedServerShotTime))) {
        payload.estimatedServerShotTime = Math.round(Number(fire.estimatedServerShotTime));
      }
      if (fire.aimOrigin) {
        payload.aimOrigin = {
          x: Number(fire.aimOrigin.x || 0),
          y: Number(fire.aimOrigin.y || 0),
          z: Number(fire.aimOrigin.z || 0)
        };
      }
      if (fire.aimForward) {
        payload.aimForward = {
          x: Number(fire.aimForward.x || 0),
          y: Number(fire.aimForward.y || 0),
          z: Number(fire.aimForward.z || 0)
        };
      }
      await this.send(payload);
    },
    async sendWeaponLoadout(slot1, slot2) {
      await this.send({
        t: 'weapon_loadout',
        slot1: String(slot1 || ''),
        slot2: String(slot2 || '')
      });
    },
    async sendEquipWeapon(weaponId) {
      await this.send({
        t: 'equip_weapon',
        weaponId: String(weaponId || '')
      });
    },
    async close() {
      await closeClient(client);
    }
  };
  return client.api;
}

export async function createRealWorkerHarness(options = {}) {
  const port = options.port || await reservePort();
  const persistDir = options.persistDir || path.join(
    ROOT_DIR,
    '.wrangler',
    `itest-state-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  );

  await fs.mkdir(path.dirname(persistDir), { recursive: true });

  const worker = {
    port,
    persistDir,
    baseHttpUrl: `http://127.0.0.1:${port}`,
    baseWsUrl: `ws://127.0.0.1:${port}`,
    logs: { stdout: '', stderr: '' },
    clients: new Set(),
    exited: false,
    process: null
  };

  const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  worker.process = spawn(npmCommand, ['run', 'dev:e2e:worker'], {
    cwd: ROOT_DIR,
    env: {
      ...process.env,
      WORKER_PORT: String(port),
      WRANGLER_PERSIST_DIR: persistDir,
      REUSE_EXISTING_SERVER: '0',
      WRANGLER_ENV: 'e2e'
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  worker.process.stdout.on('data', (chunk) => {
    worker.logs.stdout = appendLog(worker.logs.stdout, chunk);
  });
  worker.process.stderr.on('data', (chunk) => {
    worker.logs.stderr = appendLog(worker.logs.stderr, chunk);
  });
  const exitPromise = once(worker.process, 'exit').then(([code, signal]) => {
    worker.exited = true;
    worker.exitInfo = { code, signal };
    return worker.exitInfo;
  });

  await waitForWorkerReady(worker, options.readyTimeoutMs || READY_TIMEOUT_MS);

  async function connectClient(config = {}) {
    const roomId = String(config.roomId || 'global');
    const userId = String(config.userId || `usr_${Date.now()}`);
    const username = String(config.username || userId);
    const classId = String(config.classId || 'abilities');
    const url = encodeQuery({
      baseUrl: worker.baseWsUrl,
      path: '/api/ws',
      params: {
        room: roomId,
        pid: userId,
        uid: userId,
        username,
        classId
      }
    });

    const ws = new WebSocket(url);
    const client = {
      ws,
      roomId,
      userId,
      username,
      outboundDelayMs: Math.max(0, Number(config.outboundDelayMs || 0)),
      outboundJitterMs: Math.max(0, Number(config.outboundJitterMs || 0)),
      random: createSeededRandom(hashSeed(config.randomSeed || `${roomId}:${userId}`)),
      snapshotMap: new Map(),
      latestSnapshot: null,
      waiters: [],
      messages: [],
      messageIndex: 0,
      pendingTimers: new Set(),
      closeInfo: null,
      closePromise: null,
      messageChain: Promise.resolve(),
      api: null
    };
    buildClientApi(client);

    worker.clients.add(client.api);
    const openPromise = waitForTargetEvent(ws, 'open');
    const errorPromise = waitForTargetEvent(ws, 'error').then((event) => {
      throw (event && event.error) ? event.error : new Error(`WebSocket error for ${client.userId}.`);
    });
    client.closePromise = waitForTargetEvent(ws, 'close').then((event) => {
      client.closeInfo = {
        code: Number(event && event.code || 0),
        reason: String(event && event.reason || ''),
        wasClean: !!(event && event.wasClean)
      };
      rejectWaiters(client, new Error(`WebSocket closed for ${client.userId}.`));
      return client.closeInfo;
    });

    ws.addEventListener('message', (event) => {
      client.messageChain = client.messageChain.then(async () => {
        const raw = await readMessageText(event.data);
        const message = JSON.parse(raw);
        handleClientMessage(client, message);
      }).catch((err) => {
        worker.logs.stderr = appendLog(worker.logs.stderr, `[harness-message-error] ${err && err.stack ? err.stack : err}\n`);
      });
    });

    ws.addEventListener('error', (event) => {
      const error = event && event.error ? event.error : new Error(`WebSocket error for ${client.userId}.`);
      worker.logs.stderr = appendLog(worker.logs.stderr, `[harness-ws-error] ${error && error.stack ? error.stack : error}\n`);
    });

    await Promise.race([openPromise, errorPromise]);
    return client.api;
  }

  async function applyFixture(fixture) {
    const response = await fetch(worker.baseHttpUrl + '/api/test/room-fixture', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fixture || {})
    });
    const raw = await response.text();
    const body = raw ? JSON.parse(raw) : null;
    if (!response.ok) {
      throw new Error(`Fixture request failed with ${response.status}: ${raw}`);
    }
    return body;
  }

  async function close() {
    const clients = Array.from(worker.clients.values());
    for (let i = 0; i < clients.length; i++) {
      await clients[i].close().catch(() => null);
    }
    worker.clients.clear();

    if (worker.process && !worker.exited) {
      worker.process.kill('SIGTERM');
      const result = await Promise.race([
        exitPromise,
        delay(PROCESS_STOP_TIMEOUT_MS).then(() => null)
      ]);
      if (!result && !worker.exited) {
        worker.process.kill('SIGKILL');
        await exitPromise.catch(() => null);
      }
    } else {
      await exitPromise.catch(() => null);
    }

    await fs.rm(persistDir, { recursive: true, force: true }).catch(() => null);
  }

  return {
    port,
    baseHttpUrl: worker.baseHttpUrl,
    baseWsUrl: worker.baseWsUrl,
    logs: worker.logs,
    connectClient,
    applyFixture,
    latestEntity(client, entityId) {
      return client.latestEntity(entityId);
    },
    debugState(roomId, clients) {
      return buildDebugState(worker, roomId, clients);
    },
    async close() {
      await close();
    }
  };
}
