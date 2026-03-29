import { expect } from '@playwright/test';
import { buildExpectedWorldMeta } from '../../shared/protocol.js';
import { buildWorldCollisionData } from '../../shared/world-collision.js';
import { PLAYER_HEIGHT, PLAYER_RADIUS } from '../../shared/entity-constants.js';

const SNAPSHOT_TIMEOUT_MS = 15_000;
const MOVEMENT_STEP_DT_MS = 50;
const MOVEMENT_STEP_WAIT_MS = 15;
const FIXTURE_RADIUS = PLAYER_RADIUS + 0.2;
const WORKER_PORT = Number(process.env.WORKER_PORT || process.env.E2E_WORKER_PORT || 8791);

const worldCollision = buildWorldCollisionData(buildExpectedWorldMeta('itest-open-lane'));

function intersectsBox(x, z, radius, box) {
  const closestX = Math.max(Number(box.min.x || 0), Math.min(x, Number(box.max.x || 0)));
  const closestZ = Math.max(Number(box.min.z || 0), Math.min(z, Number(box.max.z || 0)));
  const dx = x - closestX;
  const dz = z - closestZ;
  return ((dx * dx) + (dz * dz)) < (radius * radius);
}

function pointBlocked(x, z, radius = FIXTURE_RADIUS) {
  if (x < (worldCollision.boundsMin + radius) || x > (worldCollision.boundsMax - radius)) return true;
  if (z < (worldCollision.boundsMin + radius) || z > (worldCollision.boundsMax - radius)) return true;
  for (let i = 0; i < worldCollision.collidables.length; i++) {
    const box = worldCollision.collidables[i];
    if (!box || !box.min || !box.max) continue;
    if (Number(box.max.y || 0) <= 0.05) continue;
    if (Number(box.min.y || 0) >= PLAYER_HEIGHT) continue;
    if (intersectsBox(x, z, radius, box)) return true;
  }
  return false;
}

function segmentBlocked(start, end, radius = FIXTURE_RADIUS, step = 0.5) {
  const dx = end.x - start.x;
  const dz = end.z - start.z;
  const distance = Math.sqrt((dx * dx) + (dz * dz));
  const steps = Math.max(1, Math.ceil(distance / step));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    if (pointBlocked(start.x + (dx * t), start.z + (dz * t), radius)) return true;
  }
  return false;
}

function findOpenLayout() {
  const sideOffsets = [6, -6, 8, -8];
  for (let x = 20; x <= 146; x += 4) {
    for (let z = 140; z >= 40; z -= 4) {
      const mover = { x, z };
      const target = { x, z: z - 16 };
      if (pointBlocked(mover.x, mover.z) || pointBlocked(target.x, target.z)) continue;
      if (segmentBlocked(mover, target)) continue;
      for (let i = 0; i < sideOffsets.length; i++) {
        const observer = { x: x + sideOffsets[i], z: z + 2 };
        if (pointBlocked(observer.x, observer.z)) continue;
        return { mover, observer, target };
      }
    }
  }
  throw new Error('Failed to find an open browser test layout in the shared world collision data.');
}

const openLayout = findOpenLayout();

function hashSeed(value) {
  const text = String(value || '');
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function buildRoomId(label) {
  return `e2e-${String(label || 'room').slice(0, 10)}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`.toLowerCase();
}

export function buildPrivateRoomId(label) {
  const compact = String(label || 'room').replace(/[^a-z0-9]/gi, '').toLowerCase().slice(0, 10);
  const token = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`.slice(0, 8);
  return `private-${compact || 'room'}${token}`.slice(0, 32);
}

export function buildUserId(label) {
  return `usr_${String(label || 'player').replace(/[^a-z0-9_]/gi, '').slice(0, 18)}_${Math.random().toString(36).slice(2, 8)}`;
}

function initScriptSource() {
  return function ({ seed }) {
    const globalState = globalThis.__MAYHEM_E2E = globalThis.__MAYHEM_E2E || {};
    globalState.active = true;
    let randomState = (Number(seed) || 1) >>> 0;
    if (!randomState) randomState = 1;

    function nextRandom() {
      randomState = (randomState + 0x6D2B79F5) >>> 0;
      let value = randomState;
      value = Math.imul(value ^ (value >>> 15), value | 1);
      value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
      return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    }

    const defaultConfig = {
      outboundDelayMs: 0,
      outboundJitterMs: 0,
      outboundDropRate: 0,
      inboundDelayMs: 0,
      inboundJitterMs: 0,
      inboundDropRate: 0,
      inboundReorderRate: 0,
      inboundReorderWindowMs: 0
    };
    const netState = globalState.netState = globalState.netState || {
      config: { ...defaultConfig },
      stats: {
        delayedOutboundCount: 0,
        droppedOutboundCount: 0,
        delayedInboundCount: 0,
        droppedInboundCount: 0,
        reorderedInboundCount: 0
      },
      messageIndex: 0,
      messages: [],
      sockets: new Set()
    };

    function clone(value) {
      if (value == null) return value;
      try {
        return JSON.parse(JSON.stringify(value));
      } catch (_err) {
        return value;
      }
    }

    function sanitizeConfig(input) {
      const next = input && typeof input === 'object' ? input : {};
      return {
        outboundDelayMs: Math.max(0, Number(next.outboundDelayMs || 0)),
        outboundJitterMs: Math.max(0, Number(next.outboundJitterMs || 0)),
        outboundDropRate: Math.max(0, Math.min(1, Number(next.outboundDropRate || 0))),
        inboundDelayMs: Math.max(0, Number(next.inboundDelayMs || 0)),
        inboundJitterMs: Math.max(0, Number(next.inboundJitterMs || 0)),
        inboundDropRate: Math.max(0, Math.min(1, Number(next.inboundDropRate || 0))),
        inboundReorderRate: Math.max(0, Math.min(1, Number(next.inboundReorderRate || 0))),
        inboundReorderWindowMs: Math.max(0, Number(next.inboundReorderWindowMs || 0))
      };
    }

    function setNetConfig(nextConfig) {
      netState.config = sanitizeConfig(nextConfig);
      return clone(netState.config);
    }

    function getNetStats() {
      return clone(netState.stats);
    }

    function computeDelay(baseDelayMs, jitterMs) {
      const delay = Math.max(0, Number(baseDelayMs || 0));
      const jitter = Math.max(0, Number(jitterMs || 0));
      if (!(jitter > 0)) return delay;
      return Math.max(0, delay + ((nextRandom() * 2 - 1) * jitter));
    }

    function recordInboundMessage(rawText) {
      let parsed = null;
      try {
        parsed = JSON.parse(rawText);
      } catch (_err) {
        parsed = rawText;
      }
      netState.messages.push({
        index: netState.messageIndex++,
        message: parsed
      });
      if (netState.messages.length > 500) netState.messages.shift();
    }

    let pointerLockElement = null;
    try {
      Object.defineProperty(document, 'pointerLockElement', {
        configurable: true,
        get() {
          return pointerLockElement;
        }
      });
    } catch (_err) {
      // Ignore if the browser refuses the override.
    }
    document.exitPointerLock = function () {
      pointerLockElement = null;
      document.dispatchEvent(new Event('pointerlockchange'));
      return Promise.resolve();
    };
    if (globalThis.Element && !globalThis.Element.prototype.__mayhemE2EPointerLockPatched) {
      globalThis.Element.prototype.__mayhemE2EPointerLockPatched = true;
      globalThis.Element.prototype.requestPointerLock = function () {
        pointerLockElement = this;
        document.dispatchEvent(new Event('pointerlockchange'));
        return Promise.resolve();
      };
    }

    const NativeWebSocket = globalThis.WebSocket;
    class WrappedWebSocket extends EventTarget {
      constructor(url, protocols) {
        super();
        this._ws = protocols === undefined ? new NativeWebSocket(url) : new NativeWebSocket(url, protocols);
        this._url = String(url || '');
        this._onopen = null;
        this._onmessage = null;
        this._onclose = null;
        this._onerror = null;
        netState.sockets.add(this);
        this._ws.addEventListener('open', () => {
          this._emit(new Event('open'));
        });
        this._ws.addEventListener('error', () => {
          this._emit(new Event('error'));
        });
        this._ws.addEventListener('close', (event) => {
          netState.sockets.delete(this);
          this._emit(new CloseEvent('close', {
            code: Number(event && event.code || 0),
            reason: String(event && event.reason || ''),
            wasClean: !!(event && event.wasClean)
          }));
        });
        this._ws.addEventListener('message', (event) => {
          const config = netState.config || defaultConfig;
          if (config.inboundDropRate > 0 && nextRandom() < config.inboundDropRate) {
            netState.stats.droppedInboundCount += 1;
            return;
          }
          let delayMs = computeDelay(config.inboundDelayMs, config.inboundJitterMs);
          if (config.inboundReorderRate > 0 && nextRandom() < config.inboundReorderRate) {
            delayMs += Math.max(1, Number(config.inboundReorderWindowMs || 0));
            netState.stats.reorderedInboundCount += 1;
          }
          const rawText = typeof event.data === 'string' ? event.data : event.data;
          const deliver = () => {
            if (typeof rawText === 'string') {
              recordInboundMessage(rawText);
            }
            this._emit(new MessageEvent('message', {
              data: rawText,
              origin: String(event && event.origin || '')
            }));
          };
          if (delayMs <= 0) {
            deliver();
            return;
          }
          netState.stats.delayedInboundCount += 1;
          setTimeout(deliver, delayMs);
        });
      }

      _emit(event) {
        this.dispatchEvent(event);
        const handler = event.type === 'open'
          ? this._onopen
          : event.type === 'message'
            ? this._onmessage
            : event.type === 'close'
              ? this._onclose
              : this._onerror;
        if (typeof handler === 'function') {
          handler.call(this, event);
        }
      }

      send(data) {
        const config = netState.config || defaultConfig;
        if (config.outboundDropRate > 0 && nextRandom() < config.outboundDropRate) {
          netState.stats.droppedOutboundCount += 1;
          return;
        }
        const delayMs = computeDelay(config.outboundDelayMs, config.outboundJitterMs);
        const deliver = () => {
          if (this._ws.readyState !== NativeWebSocket.OPEN) return;
          this._ws.send(data);
        };
        if (delayMs <= 0) {
          deliver();
          return;
        }
        netState.stats.delayedOutboundCount += 1;
        setTimeout(deliver, delayMs);
      }

      close(code, reason) {
        this._ws.close(code, reason);
      }

      get readyState() { return this._ws.readyState; }
      get bufferedAmount() { return this._ws.bufferedAmount; }
      get extensions() { return this._ws.extensions; }
      get protocol() { return this._ws.protocol; }
      get url() { return this._ws.url || this._url; }
      get binaryType() { return this._ws.binaryType; }
      set binaryType(value) { this._ws.binaryType = value; }

      set onopen(value) { this._onopen = value; }
      get onopen() { return this._onopen; }
      set onmessage(value) { this._onmessage = value; }
      get onmessage() { return this._onmessage; }
      set onclose(value) { this._onclose = value; }
      get onclose() { return this._onclose; }
      set onerror(value) { this._onerror = value; }
      get onerror() { return this._onerror; }
    }
    WrappedWebSocket.CONNECTING = NativeWebSocket.CONNECTING;
    WrappedWebSocket.OPEN = NativeWebSocket.OPEN;
    WrappedWebSocket.CLOSING = NativeWebSocket.CLOSING;
    WrappedWebSocket.CLOSED = NativeWebSocket.CLOSED;
    globalThis.WebSocket = WrappedWebSocket;

    function runtime() {
      return globalThis.__MAYHEM_RUNTIME || {};
    }

    function currentNetView() {
      const net = runtime().GameNet || null;
      return net && net.view ? net.view : null;
    }

    function clonePlayerPose() {
      const player = runtime().GamePlayer || null;
      if (!player || !player.getPosition || !player.getRotation) return null;
      const position = player.getPosition({
        x: 0,
        y: 0,
        z: 0,
        set(x, y, z) {
          this.x = x;
          this.y = y;
          this.z = z;
          return this;
        }
      });
      const rotation = player.getRotation();
      return {
        x: Number(position && position.x || 0),
        y: Number(position && position.y || 0),
        z: Number(position && position.z || 0),
        yaw: Number(rotation && rotation.yaw || 0),
        pitch: Number(rotation && rotation.pitch || 0)
      };
    }

    function getRemotePresentedState(entityId) {
      const view = currentNetView();
      if (view && view.sampleRemoteEntityPresentation) {
        return clone(view.sampleRemoteEntityPresentation(entityId, Date.now()));
      }
      const net = runtime().GameNet || null;
      const renderMap = net && net.getRenderMap ? net.getRenderMap() : new Map();
      const render = renderMap.get(String(entityId || ''));
      if (!render || !render.group) return null;
      return {
        x: Number(render.group.position.x || 0),
        y: Number(render.group.position.y || 0),
        z: Number(render.group.position.z || 0),
        yaw: Number(render.group.rotation && render.group.rotation.y || 0)
      };
    }

    async function samplePath(getter, durationMs, sampleMs) {
      const samples = [];
      const duration = Math.max(1, Number(durationMs || 0));
      const cadence = Math.max(1, Number(sampleMs || 16));
      const startAt = performance.now();
      return new Promise((resolve) => {
        function tick() {
          const elapsedMs = performance.now() - startAt;
          const value = getter();
          if (value) {
            samples.push({
              atMs: Math.round(elapsedMs),
              ...clone(value)
            });
          }
          if (elapsedMs >= duration) {
            resolve(samples);
            return;
          }
          setTimeout(tick, cadence);
        }
        tick();
      });
    }

    async function waitForRuntime(timeoutMs = 10_000) {
      const deadline = Date.now() + Math.max(1, Number(timeoutMs || 0));
      while (Date.now() < deadline) {
        const view = currentNetView();
        const session = runtime().GameSession || null;
        const player = runtime().GamePlayer || null;
        if (view && session && player) return true;
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
      return false;
    }

    globalThis.__MAYHEM_TEST_API = {
      async waitForRuntime(timeoutMs) {
        return waitForRuntime(timeoutMs);
      },
      async launchRoom(roomId, gameMode = 'ffa', modeId = 'cloud_multiplayer') {
        const loader = runtime().GameRuntimeLoader || null;
        if (!loader || !loader.loadGameplayRuntime) return { ok: false, error: 'Gameplay runtime loader unavailable.' };
        const api = await loader.loadGameplayRuntime();
        if (!api || !api.launchModeById) return { ok: false, error: 'Gameplay runtime unavailable.' };
        return api.launchModeById(String(modeId || 'cloud_multiplayer'), {
          roomId: String(roomId || 'global'),
          gameMode: String(gameMode || 'ffa')
        });
      },
      async enterGameplay() {
        const session = runtime().GameSession || null;
        if (!session || !session.enterGameplay) return { ok: false, error: 'GameSession unavailable.' };
        return session.enterGameplay();
      },
      isPlaying() {
        const session = runtime().GameSession || null;
        return !!(session && session.isPlaying && session.isPlaying());
      },
      isConnected() {
        const net = runtime().GameNet || null;
        return !!(net && net.isConnected && net.isConnected());
      },
      getRoomId() {
        const net = runtime().GameNet || null;
        return net && net.getRoomId ? String(net.getRoomId() || '') : '';
      },
      getSelfId() {
        const view = currentNetView();
        const selfState = view && view.getAuthoritativeSelfState ? view.getAuthoritativeSelfState() : null;
        return String(selfState && selfState.id || '');
      },
      getSelfState() {
        const view = currentNetView();
        return clone(view && view.getAuthoritativeSelfState ? view.getAuthoritativeSelfState() : null);
      },
      getInputSyncState() {
        const view = currentNetView();
        return clone(view && view.getInputSyncState ? view.getInputSyncState() : null);
      },
      getLocalPlayerState() {
        return clonePlayerPose();
      },
      getOwnerCorrectionState() {
        return {
          local: clonePlayerPose(),
          authoritative: this.getSelfState(),
          inputSync: this.getInputSyncState(),
          connected: this.isConnected()
        };
      },
      getRemotePresentedState(entityId) {
        return clone(getRemotePresentedState(entityId));
      },
      sampleRemotePresentedPath(entityId, durationMs, sampleMs) {
        return samplePath(() => getRemotePresentedState(entityId), durationMs, sampleMs);
      },
      sampleOwnerCorrectionPath(durationMs, sampleMs) {
        return samplePath(() => this.getOwnerCorrectionState(), durationMs, sampleMs);
      },
      triggerRealFire() {
        const actions = runtime().__activeMatchActionsApi || null;
        if (!actions || !actions.tryPlayerFire) return false;
        actions.tryPlayerFire();
        return true;
      },
      setAdsEnabled(enabled) {
        const player = runtime().GamePlayer || null;
        if (!player || !player.setAdsEnabled) return false;
        player.setAdsEnabled(!!enabled);
        return true;
      },
      setNetImpairment(config) {
        return setNetConfig(config);
      },
      getNetImpairmentStats() {
        return getNetStats();
      },
      forceNetworkDisconnect(durationMs = 1500) {
        const sockets = Array.from(netState.sockets.values());
        const previousConfig = clone(netState.config);
        const holdConfig = sanitizeConfig({
          ...previousConfig,
          outboundDropRate: 1,
          inboundDropRate: 1
        });
        setNetConfig(holdConfig);
        let closed = 0;
        for (let i = 0; i < sockets.length; i++) {
          const url = String(sockets[i] && sockets[i].url || '');
          if (!url.includes('/api/ws')) continue;
          try {
            sockets[i].close(4008, 'e2e_disconnect');
            closed += 1;
          } catch (_err) {
            // no-op
          }
        }
        setTimeout(() => {
          setNetConfig(previousConfig);
        }, Math.max(100, Number(durationMs || 0)));
        return closed;
      },
      markMessageIndex() {
        return Number(netState.messageIndex || 0);
      },
      getLatestSnapshotServerTime() {
        for (let i = netState.messages.length - 1; i >= 0; i--) {
          const entry = netState.messages[i];
          const message = entry && entry.message;
          if (!message || String(message.t || '') !== 'snapshot') continue;
          return Math.max(0, Number(message.serverTime || 0));
        }
        return 0;
      },
      getEntitySnapshotSeqs(entityId, minServerTime = 0, maxServerTime = Infinity) {
        const seen = new Set();
        const id = String(entityId || '');
        const minServerTimeMs = Math.max(0, Number(minServerTime || 0));
        const maxServerTimeMs = Number.isFinite(Number(maxServerTime))
          ? Math.max(minServerTimeMs, Number(maxServerTime || 0))
          : Infinity;
        for (let i = 0; i < netState.messages.length; i++) {
          const entry = netState.messages[i];
          const message = entry && entry.message;
          if (!message || String(message.t || '') !== 'snapshot') continue;
          const serverTime = Math.max(0, Number(message.serverTime || 0));
          if (serverTime < minServerTimeMs || serverTime > maxServerTimeMs) continue;
          const hasEntity = Array.isArray(message.entities) && message.entities.some((candidate) => String(candidate && candidate.id || '') === id);
          const hasPatch = Array.isArray(message.entityPatches) && message.entityPatches.some((candidate) => String(candidate && candidate.id || '') === id);
          if (!(hasEntity || hasPatch)) continue;
          if (Number(message.snapshotSeq || 0) > 0) {
            seen.add(Number(message.snapshotSeq || 0));
          } else {
            seen.add(`time:${serverTime}:${Number(entry && entry.index || 0)}`);
          }
        }
        return Array.from(seen.values());
      },
      countEntitySnapshotUpdates(entityId, sinceIndex = 0, minServerTime = 0) {
        const minIndex = Math.max(0, Number(sinceIndex || 0));
        const minServerTimeMs = Math.max(0, Number(minServerTime || 0));
        const filtered = [];
        const seqs = this.getEntitySnapshotSeqs(entityId, minServerTimeMs, Infinity);
        for (let i = 0; i < netState.messages.length; i++) {
          const entry = netState.messages[i];
          if (!entry || Number(entry.index || 0) < minIndex) continue;
          const message = entry.message;
          if (!message || String(message.t || '') !== 'snapshot') continue;
          const serverTime = Math.max(0, Number(message.serverTime || 0));
          if (serverTime <= minServerTimeMs) continue;
          if (Number(message.snapshotSeq || 0) > 0 && seqs.includes(Number(message.snapshotSeq || 0))) {
            filtered.push(Number(message.snapshotSeq || 0));
          }
        }
        return new Set(filtered).size;
      },
      getConnectionTimingState() {
        const view = currentNetView();
        const net = runtime().GameNet || null;
        const timing = net && net.timing ? net.timing : null;
        return clone(timing && timing.getConnectionTimingState ? timing.getConnectionTimingState() : null);
      },
      drainDamageFeedback() {
        const view = currentNetView();
        const out = [];
        if (!view || !view.consumeDamageFeedback) return out;
        for (;;) {
          const next = view.consumeDamageFeedback();
          if (!next) break;
          out.push(clone(next));
        }
        return out;
      }
    };
  };
}

export async function installBrowserHarness(page, options = {}) {
  const seed = hashSeed(options.randomSeed || `page-${Date.now()}-${Math.random()}`);
  await page.addInitScript(initScriptSource(), { seed });
}

export async function login(page, username, pin = '1234') {
  await page.locator('#account-toggle-btn').click();
  await expect(page.locator('#auth-overlay')).toBeVisible();
  for (let attempt = 0; attempt < 2; attempt++) {
    await page.locator('#auth-username').fill(username);
    await page.locator('#auth-pin').fill(pin);
    await page.locator('#auth-play-btn').click();
    try {
      await expect(page.locator('#auth-overlay')).toBeHidden({ timeout: 5000 });
      break;
    } catch (err) {
      if (attempt >= 1) throw err;
      await page.waitForTimeout(1000);
    }
  }
  await expect(page.locator('#account-toggle-btn')).toContainText(username);
}

export async function launchRoom(page, roomId, gameMode = 'ffa', modeId = 'cloud_multiplayer') {
  const result = await page.evaluate(async ({ roomId, gameMode, modeId }) => {
    if (!window.__MAYHEM_TEST_API) return { ok: false, error: 'Test API unavailable.' };
    return window.__MAYHEM_TEST_API.launchRoom(roomId, gameMode, modeId);
  }, { roomId, gameMode, modeId });
  expect(result && result.ok, JSON.stringify(result)).toBeTruthy();
  await expect(page.locator('#active-match-shell')).toBeVisible();
  await page.waitForFunction(() => !!(window.__MAYHEM_TEST_API && window.__MAYHEM_TEST_API.waitForRuntime && window.__MAYHEM_TEST_API.isConnected()), null, {
    timeout: SNAPSHOT_TIMEOUT_MS
  });
  const enterResult = await page.evaluate(() => window.__MAYHEM_TEST_API.enterGameplay());
  expect(enterResult && enterResult.ok).toBeTruthy();
  await page.waitForFunction(() => !!(window.__MAYHEM_TEST_API && window.__MAYHEM_TEST_API.isPlaying && window.__MAYHEM_TEST_API.isPlaying()), null, {
    timeout: SNAPSHOT_TIMEOUT_MS
  });
  await page.waitForFunction(() => {
    const api = window.__MAYHEM_TEST_API;
    const selfState = api && api.getSelfState ? api.getSelfState() : null;
    return !!(selfState && selfState.id);
  }, null, {
    timeout: SNAPSHOT_TIMEOUT_MS
  });
}

export async function launchQuickMatch(page) {
  const matchmakingResponsePromise = page.waitForResponse((response) => {
    return response.url().includes('/api/matchmaking') && response.request().method() === 'POST';
  });
  await page.locator('#primary-launch-btn').click();
  const matchmakingResponse = await matchmakingResponsePromise;
  const payload = await matchmakingResponse.json();
  expect(payload && payload.ok, JSON.stringify(payload)).toBeTruthy();
  const roomId = String(payload.roomId || '');
  const gameMode = String(payload.gameMode || 'ffa');
  await page.waitForFunction(() => {
    const shell = document.getElementById('active-match-shell');
    return !!(shell && !shell.hidden);
  }, null, { timeout: SNAPSHOT_TIMEOUT_MS });
  const enterResult = await page.evaluate(() => window.__MAYHEM_TEST_API.enterGameplay());
  expect(enterResult && enterResult.ok).toBeTruthy();
  await page.waitForFunction(() => !!(window.__MAYHEM_TEST_API && window.__MAYHEM_TEST_API.isPlaying && window.__MAYHEM_TEST_API.isPlaying()), null, {
    timeout: SNAPSHOT_TIMEOUT_MS
  });
  await page.waitForFunction(() => {
    const api = window.__MAYHEM_TEST_API;
    const selfState = api && api.getSelfState ? api.getSelfState() : null;
    return !!(selfState && selfState.id);
  }, null, {
    timeout: SNAPSHOT_TIMEOUT_MS
  });
  return { roomId, gameMode };
}

export async function openMatchPage(browser, options = {}) {
  let roomId = String(options.roomId || '');
  const requestedUserId = String(options.userId || buildUserId(options.label || 'player'));
  const username = String(options.username || requestedUserId);
  const page = await browser.newPage();
  await installBrowserHarness(page, { randomSeed: options.randomSeed || `${roomId}:${requestedUserId}` });
  await page.goto('/');
  await login(page, username, options.pin || '1234');
  let launchedGameMode = String(options.gameMode || 'ffa');
  if (options.quickMatch) {
    const launched = await launchQuickMatch(page);
    roomId = launched.roomId;
    launchedGameMode = launched.gameMode;
  } else {
    roomId = roomId || buildRoomId(options.label || 'room');
    await launchRoom(page, roomId, launchedGameMode, options.modeId || 'cloud_multiplayer');
  }
  if (options.netImpairment) {
    await setNetImpairment(page, options.netImpairment);
  }
  const userId = await page.evaluate(() => {
    return window.__MAYHEM_TEST_API && window.__MAYHEM_TEST_API.getSelfId
      ? window.__MAYHEM_TEST_API.getSelfId()
      : '';
  });
  return { page, roomId, gameMode: launchedGameMode, userId: String(userId || ''), username };
}

export async function applyFixture(page, roomId, players) {
  const response = await fetch(`http://127.0.0.1:${WORKER_PORT}/api/test/room-fixture`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ roomId, players })
  });
  const raw = await response.text();
  return raw ? JSON.parse(raw) : null;
}

export async function setNetImpairment(page, config) {
  return page.evaluate((nextConfig) => {
    return window.__MAYHEM_TEST_API.setNetImpairment(nextConfig);
  }, config || {});
}

export async function waitForEntity(page, entityId, timeoutMs = SNAPSHOT_TIMEOUT_MS) {
  await page.waitForFunction((nextEntityId) => {
    return !!(window.__MAYHEM_TEST_API &&
      window.__MAYHEM_TEST_API.getRemotePresentedState &&
      window.__MAYHEM_TEST_API.getRemotePresentedState(nextEntityId));
  }, entityId, { timeout: timeoutMs });
}

export async function sampleRemotePresentedPath(page, entityId, durationMs, sampleMs) {
  return page.evaluate(({ entityId, durationMs, sampleMs }) => {
    return window.__MAYHEM_TEST_API.sampleRemotePresentedPath(entityId, durationMs, sampleMs);
  }, { entityId, durationMs, sampleMs });
}

export async function sampleOwnerCorrectionPath(page, durationMs, sampleMs) {
  return page.evaluate(({ durationMs, sampleMs }) => {
    return window.__MAYHEM_TEST_API.sampleOwnerCorrectionPath(durationMs, sampleMs);
  }, { durationMs, sampleMs });
}

export async function getOwnerCorrectionState(page) {
  return page.evaluate(() => window.__MAYHEM_TEST_API.getOwnerCorrectionState());
}

export async function triggerRealFire(page, options = {}) {
  if (Object.prototype.hasOwnProperty.call(options, 'adsActive')) {
    await page.evaluate((enabled) => window.__MAYHEM_TEST_API.setAdsEnabled(enabled), !!options.adsActive);
  }
  return page.evaluate(() => window.__MAYHEM_TEST_API.triggerRealFire());
}

export async function forceNetworkDisconnect(page, durationMs = 1500) {
  return page.evaluate((durationMs) => window.__MAYHEM_TEST_API.forceNetworkDisconnect(durationMs), durationMs);
}

export async function markMessageIndex(page) {
  return page.evaluate(() => window.__MAYHEM_TEST_API.markMessageIndex());
}

export async function countEntitySnapshotUpdates(page, entityId, sinceIndex) {
  const options = sinceIndex && typeof sinceIndex === 'object' ? sinceIndex : { sinceIndex };
  return page.evaluate(({ entityId, sinceIndex, minServerTime }) => {
    return window.__MAYHEM_TEST_API.countEntitySnapshotUpdates(entityId, sinceIndex, minServerTime);
  }, {
    entityId,
    sinceIndex: Number(options && options.sinceIndex || 0),
    minServerTime: Number(options && options.minServerTime || 0)
  });
}

export async function getLatestSnapshotServerTime(page) {
  return page.evaluate(() => window.__MAYHEM_TEST_API.getLatestSnapshotServerTime());
}

export async function getEntitySnapshotSeqs(page, entityId, minServerTime, maxServerTime) {
  return page.evaluate(({ entityId, minServerTime, maxServerTime }) => {
    return window.__MAYHEM_TEST_API.getEntitySnapshotSeqs(entityId, minServerTime, maxServerTime);
  }, {
    entityId,
    minServerTime: Math.max(0, Number(minServerTime || 0)),
    maxServerTime: Number.isFinite(Number(maxServerTime)) ? Number(maxServerTime) : Infinity
  });
}

export async function getConnectionTimingState(page) {
  return page.evaluate(() => window.__MAYHEM_TEST_API.getConnectionTimingState());
}

export async function drainDamageFeedback(page) {
  return page.evaluate(() => window.__MAYHEM_TEST_API.drainDamageFeedback());
}

export async function holdMovementKey(page, key, holdMs) {
  await page.keyboard.down(key);
  await page.waitForTimeout(Math.max(0, Number(holdMs || 0)));
  await page.keyboard.up(key);
}

export function distanceXZ(a, b) {
  const dx = Number(a && a.x || 0) - Number(b && b.x || 0);
  const dz = Number(a && a.z || 0) - Number(b && b.z || 0);
  return Math.sqrt((dx * dx) + (dz * dz));
}

export function percentile(values, pct) {
  const list = Array.isArray(values) ? values.slice().sort((a, b) => a - b) : [];
  if (!list.length) return 0;
  const normalizedPct = Math.max(0, Math.min(1, Number(pct || 0)));
  const index = Math.min(list.length - 1, Math.max(0, Math.ceil((list.length * normalizedPct)) - 1));
  return Number(list[index] || 0);
}

export function summarizeMotionSamples(samples) {
  const steps = [];
  let maxStep = 0;
  let backtrackCount = 0;
  let largestBacktrack = 0;
  for (let i = 1; i < samples.length; i++) {
    const step = distanceXZ(samples[i], samples[i - 1]);
    steps.push(step);
    maxStep = Math.max(maxStep, step);
    const deltaZ = Number(samples[i].z || 0) - Number(samples[i - 1].z || 0);
    if (deltaZ > 0.18) {
      backtrackCount += 1;
      largestBacktrack = Math.max(largestBacktrack, deltaZ);
    }
  }
  return {
    maxStep,
    p95Step: percentile(steps, 0.95),
    backtrackCount,
    largestBacktrack
  };
}

export { openLayout, SNAPSHOT_TIMEOUT_MS, MOVEMENT_STEP_DT_MS, MOVEMENT_STEP_WAIT_MS };
