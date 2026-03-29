import { spawn } from 'node:child_process';
import { once } from 'node:events';
import fs from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { applySnapshotEntityPatch, cloneSnapshotValue } from '../../shared/protocol.js';

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

function reservePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = address && typeof address === 'object' ? address.port : 0;
      resolve({ port, release() { return new Promise((res) => server.close(() => res())); } });
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
      transport: {
        delayedOutboundCount: Number(client.delayedOutboundCount || 0),
        droppedOutboundCount: Number(client.droppedOutboundCount || 0),
        delayedInboundCount: Number(client.delayedInboundCount || 0),
        droppedInboundCount: Number(client.droppedInboundCount || 0),
        reorderedInboundCount: Number(client.reorderedInboundCount || 0),
        outboundDelayMs: Number(client.outboundDelayMs || 0),
        outboundJitterMs: Number(client.outboundJitterMs || 0),
        outboundDropRate: Number(client.outboundDropRate || 0),
        inboundDelayMs: Number(client.inboundDelayMs || 0),
        inboundJitterMs: Number(client.inboundJitterMs || 0),
        inboundDropRate: Number(client.inboundDropRate || 0),
        inboundReorderRate: Number(client.inboundReorderRate || 0),
        inboundReorderWindowMs: Number(client.inboundReorderWindowMs || 0)
      },
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

function computeInboundDelay(client) {
  const baseDelayMs = Math.max(0, Number(client.inboundDelayMs || 0));
  const jitterMs = Math.max(0, Number(client.inboundJitterMs || 0));
  let totalDelayMs = !(jitterMs > 0)
    ? baseDelayMs
    : Math.max(0, baseDelayMs + ((client.random() * 2 - 1) * jitterMs));
  if (client.inboundReorderRate > 0 && client.random() < client.inboundReorderRate) {
    totalDelayMs += Math.max(1, Number(client.inboundReorderWindowMs || 0));
    client.reorderedInboundCount += 1;
  }
  return totalDelayMs;
}

function applyInboundNetworkConditions(client, config = {}) {
  client.inboundDelayMs = Math.max(0, Number(config.inboundDelayMs != null ? config.inboundDelayMs : client.inboundDelayMs || 0));
  client.inboundJitterMs = Math.max(0, Number(config.inboundJitterMs != null ? config.inboundJitterMs : client.inboundJitterMs || 0));
  client.inboundDropRate = Math.max(0, Math.min(1, Number(config.inboundDropRate != null ? config.inboundDropRate : client.inboundDropRate || 0)));
  client.inboundReorderRate = Math.max(0, Math.min(1, Number(config.inboundReorderRate != null ? config.inboundReorderRate : client.inboundReorderRate || 0)));
  client.inboundReorderWindowMs = Math.max(0, Number(config.inboundReorderWindowMs != null ? config.inboundReorderWindowMs : client.inboundReorderWindowMs || 0));
}

function rememberSnapshotBaseline(client, snapshotSeq) {
  const seq = Math.max(0, Math.floor(Number(snapshotSeq || 0)));
  if (!(seq > 0)) return;
  const cloned = new Map();
  client.snapshotMap.forEach((entity, id) => {
    cloned.set(String(id || ''), cloneSnapshotValue(entity));
  });
  client.snapshotBaselines.set(seq, cloned);
  client.snapshotBaselineOrder.push(seq);
  while (client.snapshotBaselineOrder.length > 16) {
    const staleSeq = client.snapshotBaselineOrder.shift();
    client.snapshotBaselines.delete(staleSeq);
  }
}

function applySnapshot(client, message) {
  if (!message || typeof message !== 'object') return;
  const useEntityPatches = !!message.delta && Array.isArray(message.entityPatches);
  if (!message.delta) {
    client.snapshotMap.clear();
  }
  if (useEntityPatches) {
    const baseSnapshotSeq = Math.max(0, Number(message.baseSnapshotSeq || 0));
    const baseline = client.snapshotBaselines.get(baseSnapshotSeq);
    if (!baseline && message.entityPatches.length > 0) {
      client.latestSnapshot = JSON.parse(JSON.stringify(message));
      return;
    }
    for (let i = 0; i < message.entityPatches.length; i++) {
      const patch = message.entityPatches[i];
      if (!patch || !patch.id) continue;
      const nextEntity = applySnapshotEntityPatch(baseline ? baseline.get(String(patch.id || '')) || null : null, patch);
      if (!nextEntity || !nextEntity.id) continue;
      client.snapshotMap.set(String(nextEntity.id), cloneSnapshotValue(nextEntity));
    }
  }
  if (Array.isArray(message.entities)) {
    for (let i = 0; i < message.entities.length; i++) {
      const entity = message.entities[i];
      if (!entity || !entity.id) continue;
      client.snapshotMap.set(String(entity.id), cloneSnapshotValue(entity));
    }
  }
  if (Array.isArray(message.removedEntityIds)) {
    for (let i = 0; i < message.removedEntityIds.length; i++) {
      client.snapshotMap.delete(String(message.removedEntityIds[i] || ''));
    }
  }
  client.snapshotAckSeq = Math.max(0, Number(message.snapshotSeq || client.snapshotAckSeq || 0));
  rememberSnapshotBaseline(client, message.snapshotSeq);
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

function scheduleInboundMessage(client, rawMessage, worker) {
  if (client.inboundDropRate > 0 && client.random() < client.inboundDropRate) {
    client.droppedInboundCount += 1;
    return;
  }
  const deliveryDelayMs = computeInboundDelay(client);
  const deliver = async () => {
    const message = JSON.parse(rawMessage);
    handleClientMessage(client, message);
  };
  if (deliveryDelayMs <= 0) {
    client.messageChain = client.messageChain.then(deliver).catch((err) => {
      worker.logs.stderr = appendLog(worker.logs.stderr, `[harness-message-error] ${err && err.stack ? err.stack : err}\n`);
    });
    return;
  }
  client.delayedInboundCount += 1;
  const timer = setTimeout(() => {
    client.pendingTimers.delete(timer);
    client.messageChain = client.messageChain.then(deliver).catch((err) => {
      worker.logs.stderr = appendLog(worker.logs.stderr, `[harness-message-error] ${err && err.stack ? err.stack : err}\n`);
    });
  }, deliveryDelayMs);
  client.pendingTimers.add(timer);
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
      const messagePayload = payload && typeof payload === 'object' ? { ...payload } : payload;
      if (messagePayload && typeof messagePayload === 'object' && (messagePayload.t === 'input' || messagePayload.t === 'ping')) {
        if (!Object.prototype.hasOwnProperty.call(messagePayload, 'snapshotAckSeq')) {
          messagePayload.snapshotAckSeq = Math.max(0, Number(client.snapshotAckSeq || 0));
        }
        if (!Object.prototype.hasOwnProperty.call(messagePayload, 'linkRttMs')) {
          messagePayload.linkRttMs = 0;
        }
        if (!Object.prototype.hasOwnProperty.call(messagePayload, 'linkJitterMs')) {
          messagePayload.linkJitterMs = 0;
        }
      }
      const message = JSON.stringify(messagePayload);
      if (client.outboundDropRate > 0 && client.random() < client.outboundDropRate) {
        client.droppedOutboundCount += 1;
        return;
      }
      const sendAfterMs = computeOutboundDelay(client);
      if (sendAfterMs <= 0) {
        if (client.ws.readyState !== WebSocket.OPEN) {
          throw new Error(`WebSocket is not open for ${client.userId}.`);
        }
        client.ws.send(message);
        return;
      }
      client.delayedOutboundCount += 1;
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
    async sendEnterMatch() {
      await this.send({
        t: 'enter_match'
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
      async sendReload(weaponId) {
        await this.send({
          t: 'reload',
          weaponId: String(weaponId || '')
        });
    },
      getTransportStats() {
        return {
          delayedOutboundCount: Number(client.delayedOutboundCount || 0),
          droppedOutboundCount: Number(client.droppedOutboundCount || 0),
          delayedInboundCount: Number(client.delayedInboundCount || 0),
          droppedInboundCount: Number(client.droppedInboundCount || 0),
          reorderedInboundCount: Number(client.reorderedInboundCount || 0),
          outboundDelayMs: Number(client.outboundDelayMs || 0),
          outboundJitterMs: Number(client.outboundJitterMs || 0),
          outboundDropRate: Number(client.outboundDropRate || 0),
          inboundDelayMs: Number(client.inboundDelayMs || 0),
          inboundJitterMs: Number(client.inboundJitterMs || 0),
          inboundDropRate: Number(client.inboundDropRate || 0),
          inboundReorderRate: Number(client.inboundReorderRate || 0),
          inboundReorderWindowMs: Number(client.inboundReorderWindowMs || 0)
        };
      },
      setInboundNetworkConditions(config = {}) {
        applyInboundNetworkConditions(client, config);
        return this.getTransportStats();
      },
      async close() {
        await closeClient(client);
      }
  };
  return client.api;
}

export async function createRealWorkerHarness(options = {}) {
  let port = options.port;
  let portRelease = null;
  if (!port) {
    const reserved = await reservePort();
    port = reserved.port;
    portRelease = reserved.release;
  }
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

  if (portRelease) await portRelease();

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
    const classId = String(config.classId || 'ffa');
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
      outboundDropRate: Math.max(0, Math.min(1, Number(config.outboundDropRate || 0))),
      inboundDelayMs: Math.max(0, Number(config.inboundDelayMs || 0)),
      inboundJitterMs: Math.max(0, Number(config.inboundJitterMs || 0)),
      inboundDropRate: Math.max(0, Math.min(1, Number(config.inboundDropRate || 0))),
      inboundReorderRate: Math.max(0, Math.min(1, Number(config.inboundReorderRate || 0))),
      inboundReorderWindowMs: Math.max(0, Number(config.inboundReorderWindowMs || 0)),
      random: createSeededRandom(hashSeed(config.randomSeed || `${roomId}:${userId}`)),
      snapshotMap: new Map(),
      latestSnapshot: null,
      waiters: [],
      messages: [],
      messageIndex: 0,
      snapshotBaselines: new Map(),
      snapshotBaselineOrder: [],
      snapshotAckSeq: 0,
      pendingTimers: new Set(),
      closeInfo: null,
      delayedOutboundCount: 0,
      droppedOutboundCount: 0,
      delayedInboundCount: 0,
      droppedInboundCount: 0,
      reorderedInboundCount: 0,
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
        scheduleInboundMessage(client, raw, worker);
      }).catch((err) => {
        worker.logs.stderr = appendLog(worker.logs.stderr, `[harness-message-error] ${err && err.stack ? err.stack : err}\n`);
      });
    });

    ws.addEventListener('error', (event) => {
      const error = event && event.error ? event.error : new Error(`WebSocket error for ${client.userId}.`);
      worker.logs.stderr = appendLog(worker.logs.stderr, `[harness-ws-error] ${error && error.stack ? error.stack : error}\n`);
    });

    await Promise.race([openPromise, errorPromise]);
    if (config.autoEnter !== false) {
      await client.api.sendEnterMatch();
    }
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
