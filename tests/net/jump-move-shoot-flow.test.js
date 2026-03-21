import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import * as THREE from 'three';

import {
  buildExpectedWorldMeta,
  cloneWorldFlags,
  normalizeAbilityLoadoutPayload,
  normalizeClassCastPayload,
  normalizeThrowPayload,
  normalizeWeaponLoadoutPayload,
  sanitizeRoomId
} from '../../shared/protocol.js';
import { logicalHitscanOriginFromEye } from '../../shared/entity-points.js';
import { createMovementInputState, stepAuthoritativeMovement } from '../../shared/authoritative-movement.js';
import { gameplayTuning } from '../../shared/gameplay-tuning.js';
import { resolveHitscanShot } from '../../shared/hitscan-authority.js';
import { handleFire } from '../../cloudflare/server/room/RoomCombatRuntime.js';
import { applyDamageFromSource, broadcastDamageEvent } from '../../cloudflare/server/room/CombatService.js';
import {
  applyPendingInputAck,
  consumeQueuedAuthoritativeInputs,
  queueAuthoritativeInput
} from '../../cloudflare/server/room/RoomRuntime.js';
import { gameNetRuntimeScriptUrls } from '../../js/app/runtime-assembly.js';

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function createInputFromMessage(msg) {
  const input = createMovementInputState();
  input.forward = !!msg.forward;
  input.backward = !!msg.backward;
  input.left = !!msg.left;
  input.right = !!msg.right;
  input.jump = !!msg.jump;
  input.sprint = !!msg.sprint;
  input.adsActive = !!msg.adsActive;
  return input;
}

function createMotionState(patch = {}) {
  return {
    id: String(patch.id || ''),
    x: Number(patch.x || 0),
    y: Number(patch.y || 1.6),
    z: Number(patch.z || 0),
    yaw: Number(patch.yaw || 0),
    pitch: Number(patch.pitch || 0),
    velocityY: Number(patch.velocityY || 0),
    isGrounded: patch.isGrounded !== false,
    jumpHoldTimer: Number(patch.jumpHoldTimer || 0),
    jumpHeldLast: !!patch.jumpHeldLast,
    moveSpeedNorm: Number(patch.moveSpeedNorm || 0),
    sprinting: !!patch.sprinting,
    inputState: patch.inputState ? cloneJson(patch.inputState) : createMovementInputState(),
    lastShotAt: patch.lastShotAt ? { ...patch.lastShotAt } : {},
    lastShotTokenByWeapon: patch.lastShotTokenByWeapon ? { ...patch.lastShotTokenByWeapon } : {},
    alive: patch.alive !== false,
    weaponId: String(patch.weaponId || 'rifle'),
    hp: Number(patch.hp || 500),
    armor: Number(patch.armor || 0),
    classId: String(patch.classId || 'abilities'),
    seq: Number(patch.seq || 0),
    lastProcessedInputSeq: Number(patch.lastProcessedInputSeq || 0),
    lastReceivedInputSeq: Number(patch.lastReceivedInputSeq || 0),
    pendingInputSeq: Number(patch.pendingInputSeq || 0),
    inputQueue: Array.isArray(patch.inputQueue) ? patch.inputQueue.slice() : [],
    muzzleFlashUntil: Number(patch.muzzleFlashUntil || 0),
    spawnShieldUntil: Number(patch.spawnShieldUntil || 0)
  };
}

function flatMovementOptions(dtMs) {
  return {
    dtSec: Math.max(1 / 240, Number(dtMs || 0) / 1000),
    bounds: {
      minX: -100,
      maxX: 100,
      minZ: -100,
      maxZ: 100
    },
    collisionBoxes: [],
    getGroundHeightAt() {
      return 0;
    },
    movementLocked: false,
    eyeHeight: 1.6,
    playerHeight: 1.7,
    playerRadius: 0.35,
    epsilon: 0.001
  };
}

function processQueuedServerInput(serverPlayer, inputMessage) {
  queueAuthoritativeInput(serverPlayer, inputMessage, {
    createMovementInputState,
    canEntityUseWeapon() { return true; },
    clamp(value, min, max) {
      return Math.max(min, Math.min(max, Number(value || 0)));
    }
  });
  const movementPlan = consumeQueuedAuthoritativeInputs(serverPlayer, flatMovementOptions(inputMessage.dtMs).dtSec, {
    createMovementInputState
  });
  for (let i = 0; i < movementPlan.steps.length; i++) {
    const step = movementPlan.steps[i];
    serverPlayer.yaw = Number(step.yaw || 0);
    serverPlayer.pitch = Number(step.pitch || 0);
    stepAuthoritativeMovement(
      serverPlayer,
      step.inputState,
      flatMovementOptions(Number(step.dtSec || 0) * 1000)
    );
  }
  if (movementPlan.processedSeq > Number(serverPlayer.lastProcessedInputSeq || 0)) {
    serverPlayer.lastProcessedInputSeq = movementPlan.processedSeq;
  }
  applyPendingInputAck(serverPlayer);
}

function aimForward(from, to) {
  const dx = Number(to.x || 0) - Number(from.x || 0);
  const dy = Number(to.y || 0) - Number(from.y || 0);
  const dz = Number(to.z || 0) - Number(from.z || 0);
  const len = Math.sqrt((dx * dx) + (dy * dy) + (dz * dz)) || 1;
  return {
    x: dx / len,
    y: dy / len,
    z: dz / len
  };
}

function entityForward(entity) {
  const yaw = Number(entity && entity.yaw || 0);
  const pitch = Number(entity && entity.pitch || 0);
  const x = -Math.sin(yaw) * Math.cos(pitch);
  const y = Math.sin(-pitch);
  const z = -Math.cos(yaw) * Math.cos(pitch);
  const len = Math.sqrt((x * x) + (y * y) + (z * z)) || 1;
  return { x: x / len, y: y / len, z: z / len };
}

function serializeSelfEntity(entity) {
  return {
    id: entity.id,
    x: Number(entity.x || 0),
    y: Number(entity.y || 1.6),
    z: Number(entity.z || 0),
    yaw: Number(entity.yaw || 0),
    pitch: Number(entity.pitch || 0),
    velocityY: Number(entity.velocityY || 0),
    isGrounded: entity.isGrounded !== false,
    jumpHoldTimer: Number(entity.jumpHoldTimer || 0),
    jumpHeldLast: !!entity.jumpHeldLast,
    moveSpeedNorm: Number(entity.moveSpeedNorm || 0),
    sprinting: !!entity.sprinting,
    alive: entity.alive !== false,
    weaponId: entity.weaponId || 'rifle',
    hp: Number(entity.hp || 500),
    armor: Number(entity.armor || 0),
    classId: entity.classId || 'abilities',
    seq: Number(entity.seq || 0)
  };
}

function serializeTargetEntity(entity) {
  return {
    id: entity.id,
    x: Number(entity.x || 0),
    y: Number(entity.y || 1.6),
    z: Number(entity.z || 0),
    yaw: Number(entity.yaw || 0),
    pitch: Number(entity.pitch || 0),
    velocityY: Number(entity.velocityY || 0),
    isGrounded: entity.isGrounded !== false,
    moveSpeedNorm: Number(entity.moveSpeedNorm || 0),
    sprinting: !!entity.sprinting,
    alive: entity.alive !== false,
    weaponId: entity.weaponId || 'rifle',
    hp: Number(entity.hp || 500),
    armor: Number(entity.armor || 0),
    classId: entity.classId || 'abilities',
    username: entity.username || entity.id
  };
}

async function loadJumpMoveShootHarness(options = {}) {
  const weaponId = String(options.weaponId || 'rifle');
  const initialTarget = options.target || { x: 0, y: 1.6, z: -12 };
  const renderMap = new Map();
  const sentMessages = [];
  const uiEvents = [];
  const reconcileEvents = [];
  const currentInput = createMovementInputState();
  const localMotion = createMotionState({
    id: 'usr_test',
    x: 0,
    y: 1.6,
    z: 0,
    yaw: 0,
    pitch: 0,
    weaponId
  });
  const serverPlayer = createMotionState({
    id: 'usr_test',
    x: 0,
    y: 1.6,
    z: 0,
    yaw: 0,
    pitch: 0,
    weaponId
  });
  const target = createMotionState({
    id: 'usr_target',
    x: Number(initialTarget.x || 0),
    y: Number(initialTarget.y || 1.6),
    z: Number(initialTarget.z || 0),
    hp: 500,
    armor: 0
  });
  target.username = 'TARGET';
  const aimPoint = {
    x: Number((options.aimPoint && options.aimPoint.x) ?? target.x),
    y: Number((options.aimPoint && options.aimPoint.y) ?? target.y),
    z: Number((options.aimPoint && options.aimPoint.z) ?? target.z)
  };

  const camera = {
    fov: 75,
    position: { x: 0, y: 1.6, z: 0 }
  };

  const timeState = { now: 1000 };
  const runtime = {
    GameShared: {
      protocol: {
        wsPath: '/api/ws',
        world: {
          profileVersion: 6,
          seedPrefix: 'room-env-v6-static',
          flags: { envV2: true, terrainPhysicsV2: true }
        },
        sanitizeRoomId,
        cloneWorldFlags,
        buildExpectedWorldMeta,
        normalizeWeaponLoadoutPayload,
        normalizeThrowPayload,
        normalizeAbilityLoadoutPayload,
        normalizeClassCastPayload,
        msg: {
          c2s: { INPUT: 'input', FIRE: 'fire', PING: 'ping' },
          s2c: {
            WELCOME: 'welcome',
            SNAPSHOT: 'snapshot',
            DAMAGE_EVENT: 'damage_event',
            PONG: 'pong'
          }
        }
      },
      entityPoints: {
        logicalHitscanOriginFromEye
      }
    },
    GameNetAuth: {
      getSocketIdentity() { return { id: 'usr_test', username: 'TEST', classId: 'abilities' }; },
      getUser() { return { id: 'usr_test', username: 'TEST', classId: 'abilities' }; },
      ensureArenaIdentity() { return Promise.resolve(); }
    },
    GameNetEntities: {
      init() {},
      cleanup() {
        renderMap.clear();
      },
      updateFromSnapshot(entity) {
        if (!entity || !entity.id) return;
        const current = renderMap.get(entity.id) || {
          id: entity.id,
          group: {
            position: { x: 0, y: 0, z: 0 }
          }
        };
        current.group.position.x = Number(entity.x || 0);
        current.group.position.y = Number(entity.y || 1.6) - 1.6;
        current.group.position.z = Number(entity.z || 0);
        current.alive = entity.alive !== false;
        current.hp = Number(entity.hp || 0);
        current.armor = Number(entity.armor || 0);
        current.username = entity.username || current.username || entity.id;
        renderMap.set(entity.id, current);
      },
      removeRemoteVisual(id) {
        renderMap.delete(id);
      },
      getRenderMap() {
        return renderMap;
      },
      getHitboxArray() {
        return [];
      },
      classStats() {
        return { armorMax: 90, wallhackRadius: 90 };
      }
    },
    GameNetSnapshots: {
      create(hooks = {}) {
        return {
          applySnapshot(entities, projectiles, fireZones, opts = {}) {
            const list = Array.isArray(entities) ? entities : [];
            for (let i = 0; i < list.length; i++) {
              if (hooks.onEntity) hooks.onEntity(list[i], opts);
            }
            if (hooks.onPrune) hooks.onPrune(new Map(list.map((entity) => [entity.id, entity])));
            if (hooks.onProjectiles && projectiles !== undefined) hooks.onProjectiles(Array.isArray(projectiles) ? projectiles : []);
            if (hooks.onFireZones && fireZones !== undefined) hooks.onFireZones(Array.isArray(fireZones) ? fireZones : []);
          }
        };
      }
    },
    GameHitscan: {
      buildNetworkFireIntent() {
        const eye = {
          x: Number(localMotion.x || 0),
          y: Number(localMotion.y || 1.6),
          z: Number(localMotion.z || 0)
        };
        const forward = aimForward(eye, aimPoint);
        return {
          weaponId,
          aimOrigin: logicalHitscanOriginFromEye(eye, forward),
          aimForward: forward,
          adsActive: false,
          viewFovDeg: 75
        };
      }
    },
    GamePlayer: {
      getAnimNetState() {
        return { equippedWeaponId: weaponId };
      },
      getCamera() {
        return camera;
      },
      getEyeWorldPosition() {
        return new THREE.Vector3(Number(localMotion.x || 0), Number(localMotion.y || 1.6), Number(localMotion.z || 0));
      },
      getRotation() {
        return {
          yaw: Number(localMotion.yaw || 0),
          pitch: Number(localMotion.pitch || 0)
        };
      },
      getNetworkInputState() {
        return cloneJson(currentInput);
      },
      getPosition() {
        return new THREE.Vector3(Number(localMotion.x || 0), Number(localMotion.y || 1.6), Number(localMotion.z || 0));
      },
      reconcileAuthoritativeMotion(state, options) {
        reconcileEvents.push({
          at: timeState.now,
          state: cloneJson(state),
          options: cloneJson(options || {}),
          horizontalErrorWu: Number(Math.hypot(Number(state.x || 0) - Number(localMotion.x || 0), Number(state.z || 0) - Number(localMotion.z || 0)).toFixed(6)),
          verticalErrorWu: Number(Math.abs(Number(state.y || 0) - Number(localMotion.y || 0)).toFixed(6))
        });
      },
      applyAuthoritativeMotion(state) {
        reconcileEvents.push({
          at: timeState.now,
          state: cloneJson(state),
          options: { hardApply: true },
          horizontalErrorWu: Number(Math.hypot(Number(state.x || 0) - Number(localMotion.x || 0), Number(state.z || 0) - Number(localMotion.z || 0)).toFixed(6)),
          verticalErrorWu: Number(Math.abs(Number(state.y || 0) - Number(localMotion.y || 0)).toFixed(6))
        });
      },
      setAliveVisual() {},
      setStatusState() {},
      setActionRestrictions() {},
      respawn() {}
    },
    GamePlayerCombat: {
      syncFromNetwork() {},
      showIncomingFeedback() {}
    },
    GameThrowables: {
      syncAuthoritativeState() {},
      applyNetworkEvent() {},
      update() {},
      confirmPredictedThrow() {},
      rejectPredictedThrow() {}
    },
    GameUI: {
      showHitMarker() {
        uiEvents.push({ kind: 'hit', at: timeState.now });
      },
      showKillMarker() {
        uiEvents.push({ kind: 'kill', at: timeState.now });
      },
      showDamageNumber(_worldPoint, damage, isKill, _camera, hitType) {
        uiEvents.push({
          kind: 'damage',
          at: timeState.now,
          damage: Number(damage || 0),
          isKill: !!isKill,
          hitType: String(hitType || 'body')
        });
      }
    },
    GameAudio: {
      play() {}
    },
    GameNetTransport: null
  };

  const sandbox = {
    globalThis: { __MAYHEM_RUNTIME: runtime },
    window: {
      location: { protocol: 'https:', host: 'example.test' }
    },
    URL,
    URLSearchParams,
    console,
    Date: {
      now() {
        return timeState.now;
      }
    },
    TextDecoder: class {
      decode(value) {
        return String(value || '');
      }
    },
    WebSocket: { OPEN: 1 },
    setTimeout() { return 1; },
    clearTimeout() {},
    Math,
    Map,
    JSON,
    THREE
  };

  const context = vm.createContext(sandbox);
  const scriptUrls = [
    new URL('../../js/combat/ability-fx.js', import.meta.url)
  ].concat(gameNetRuntimeScriptUrls, [
    new URL('../../js/net/feedback-sync.js', import.meta.url),
    new URL('../../js/net/self-sync.js', import.meta.url)
  ]);
  for (const scriptUrl of scriptUrls) {
    const code = await fs.readFile(scriptUrl, 'utf8');
    vm.runInContext(code, context);
  }

  const GameNet = sandbox.globalThis.__MAYHEM_RUNTIME.GameNet;
  const GameNetFeedbackSync = sandbox.globalThis.__MAYHEM_RUNTIME.GameNetFeedbackSync;
  const GameNetSelfSync = sandbox.globalThis.__MAYHEM_RUNTIME.GameNetSelfSync;
  let transportHooks = null;
  runtime.GameNetTransport = {
    create(opts) {
      transportHooks = opts;
      return {
        connect() {
          const socket = { readyState: 1 };
          if (opts.onOpen) opts.onOpen(socket);
        },
        send(msg) {
          sentMessages.push(cloneJson(msg));
          return true;
        },
        shutdown() {}
      };
    }
  };

  GameNet.init({});

  return {
    GameNet,
    GameNetFeedbackSync,
    GameNetSelfSync,
    weaponId,
    currentInput,
    localMotion,
    serverPlayer,
    sentMessages,
    uiEvents,
    reconcileEvents,
    target,
    aimPoint,
    timeState,
    handleMessage(message) {
      if (transportHooks && transportHooks.onMessage) {
        transportHooks.onMessage(JSON.stringify(message));
      }
    }
  };
}

async function runMeasuredScenario(options = {}) {
  const harness = await loadJumpMoveShootHarness(options);
  const {
    GameNet,
    GameNetFeedbackSync,
    GameNetSelfSync,
    currentInput,
    localMotion,
    serverPlayer,
    sentMessages,
    uiEvents,
    reconcileEvents,
    target,
    timeState,
    handleMessage,
    weaponId
  } = harness;

  handleMessage({
    t: 'welcome',
    selfId: 'usr_test',
    roomId: 'global',
    tickRate: 60,
    worldSeed: 'seed',
    worldProfileVersion: 6,
    worldFlags: { envV2: true, terrainPhysicsV2: true }
  });
  handleMessage({
    t: 'snapshot',
    serverTime: 940,
    delta: false,
    entities: [
      serializeSelfEntity(serverPlayer),
      serializeTargetEntity(target)
    ],
    removedEntityIds: [],
    projectiles: [],
    fireZones: []
  });

  currentInput.forward = options.forward !== false;
  currentInput.jump = options.jump !== false;

  GameNet.update(0.05, { x: localMotion.x, y: localMotion.y, z: localMotion.z }, { yaw: localMotion.yaw, pitch: localMotion.pitch });
  const firstInput = sentMessages.find((message) => message.t === 'input');
  stepAuthoritativeMovement(localMotion, createInputFromMessage(firstInput), flatMovementOptions(firstInput.dtMs));
  processQueuedServerInput(serverPlayer, firstInput);

  timeState.now = 1050;
  GameNet.update(0.05, { x: localMotion.x, y: localMotion.y, z: localMotion.z }, { yaw: localMotion.yaw, pitch: localMotion.pitch });
  const secondInput = sentMessages.filter((message) => message.t === 'input').at(-1);
  stepAuthoritativeMovement(localMotion, createInputFromMessage(secondInput), flatMovementOptions(secondInput.dtMs));
  if (options.processSecondInputOnServer) {
    processQueuedServerInput(serverPlayer, secondInput);
  }

  const shots = Array.isArray(options.shots) && options.shots.length > 0
    ? options.shots
    : [{
        token: 'jump-shot',
        at: 1060,
        predicted: false,
        deliverDamage: true,
        serverDelayMs: 60
      }];
  const metrics = {
    scenario: String(options.name || weaponId),
    weaponId,
    serverDamageEvents: 0,
    damageNumberCount: 0,
    hitMarkerCount: 0,
    hitMarkerDelaysMs: [],
    correctionCount: 0,
    shotMetrics: []
  };
  const bodyDamage = Number((gameplayTuning.weaponStats[weaponId] && gameplayTuning.weaponStats[weaponId].bodyDamage) || 0);
  let correctionApplied = false;

  for (let i = 0; i < shots.length; i++) {
    const shot = shots[i];
    timeState.now = Number(shot.at || 1060);
    const shotAt = timeState.now;
    const preUiCount = uiEvents.length;
    assert.equal(GameNet.sendFire(weaponId, shot.token), true);
    const fireMsg = sentMessages.at(-1);
    assert.equal(fireMsg.t, 'fire');

    if (shot.predicted) {
      GameNetFeedbackSync.emitPredictedLocalDamageFeedback({
        weaponId,
        hitType: 'body',
        shotToken: shot.token,
        pelletIndex: 0,
        damage: bodyDamage,
        worldPos: { x: target.x, y: target.y, z: target.z },
        camera: {}
      });
    }

    timeState.now = shotAt + Number(shot.serverDelayMs || 0);
    const broadcasts = [];
    const room = {
      canEntityUseWeapon() { return true; },
      syncWeaponAmmoState() {
        const stats = gameplayTuning.weaponStats[weaponId] || {};
        return {
          ammoInMag: Number(stats.magazineSize || 30),
          reloadUntil: 0,
          reloadedFlashUntil: 0
        };
      },
      reloadRemainingForWeapon() { return 0; },
      beginWeaponReload() { throw new Error('unexpected reload'); },
      consumeWeaponAmmo() {},
      entityForward(entity) { return entityForward(entity); },
      getAliveEntities() { return [target]; },
      canTargetEntity(entity, sourceId) { return !!entity && entity.id !== sourceId; },
      worldCollidables() { return []; },
      getEntityById(id) {
        if (id === serverPlayer.id) return serverPlayer;
        if (id === target.id) return target;
        return null;
      },
      broadcast(payload) {
        broadcasts.push(cloneJson(payload));
      }
    };

    handleFire(room, serverPlayer, fireMsg, {
      nowMs: () => timeState.now,
      weaponStats: gameplayTuning.weaponStats,
      weaponFalloff: gameplayTuning.weaponFalloff,
      resolveHitscanShot,
      applyDamageFromSource,
      broadcastDamageEvent,
      broadcastDeathRespawn() {},
      canEquipWeaponId() { return true; },
      playerEyeHeight: 1.6,
      remoteMuzzleFlashHoldMs: 90
    });

    const damageEvents = broadcasts.filter((message) => message.t === 'damage_event');
    metrics.serverDamageEvents += damageEvents.length;

    handleMessage({
      t: 'snapshot',
      serverTime: shotAt,
      delta: false,
      entities: [
        serializeSelfEntity(serverPlayer),
        serializeTargetEntity(target)
      ],
      removedEntityIds: [],
      projectiles: [],
      fireZones: []
    });
    if (shot.deliverDamage !== false) {
      for (let d = 0; d < damageEvents.length; d++) {
        handleMessage(damageEvents[d]);
      }
    }

    if (options.applyCorrection && !correctionApplied) {
      GameNetSelfSync.syncPlayerState(GameNet.getSelfState(), 0.016);
      correctionApplied = true;
    }
    GameNetFeedbackSync.syncGameplayFeedback({
      selfState: GameNet.getSelfState(),
      camera: {},
      dt: 0.016
    });

    const nextUiEvents = uiEvents.slice(preUiCount);
    const damageNumbers = nextUiEvents.filter((event) => event.kind === 'damage');
    const hitMarkers = nextUiEvents.filter((event) => event.kind === 'hit');
    metrics.damageNumberCount += damageNumbers.length;
    metrics.hitMarkerCount += hitMarkers.length;
    metrics.hitMarkerDelaysMs.push(...hitMarkers.map((event) => event.at - shotAt));
    metrics.shotMetrics.push({
      token: shot.token,
      shotAt,
      serverDamageEvents: damageEvents.length,
      deliveredDamageEvents: shot.deliverDamage === false ? 0 : damageEvents.length,
      damageNumberCount: damageNumbers.length,
      hitMarkerCount: hitMarkers.length,
      hitMarkerDelaysMs: hitMarkers.map((event) => event.at - shotAt)
    });
  }

  metrics.correctionCount = reconcileEvents.length;
  metrics.reconciliation = reconcileEvents.length > 0 ? cloneJson(reconcileEvents[0]) : null;
  return metrics;
}

function formatScenarioTable(rows) {
  const header = 'scenario | weapon | server regs | hitmarkers | damage nums | delays ms | corrections';
  const divider = '---|---|---:|---:|---:|---|---:';
  const body = rows.map((row) => {
    const delays = row.hitMarkerDelaysMs.length > 0 ? row.hitMarkerDelaysMs.join(',') : '-';
    return [
      row.scenario,
      row.weaponId,
      String(row.serverDamageEvents),
      String(row.hitMarkerCount),
      String(row.damageNumberCount),
      delays,
      String(row.correctionCount)
    ].join(' | ');
  });
  return [header, divider].concat(body).join('\n');
}

test('jump move shoot flow records hitmarker timing, server registrations, and reconciliation drift', async () => {
  const harness = await loadJumpMoveShootHarness();
  const {
    GameNet,
    GameNetFeedbackSync,
    GameNetSelfSync,
    currentInput,
    localMotion,
    serverPlayer,
    sentMessages,
    uiEvents,
    reconcileEvents,
    target,
    timeState,
    handleMessage
  } = harness;

  handleMessage({
    t: 'welcome',
    selfId: 'usr_test',
    roomId: 'global',
    tickRate: 60,
    worldSeed: 'seed',
    worldProfileVersion: 6,
    worldFlags: { envV2: true, terrainPhysicsV2: true }
  });
  handleMessage({
    t: 'snapshot',
    serverTime: 940,
    delta: false,
    entities: [
      serializeSelfEntity(serverPlayer),
      serializeTargetEntity(target)
    ],
    removedEntityIds: [],
    projectiles: [],
    fireZones: []
  });

  currentInput.forward = true;
  currentInput.jump = true;

  GameNet.update(0.05, { x: localMotion.x, y: localMotion.y, z: localMotion.z }, { yaw: localMotion.yaw, pitch: localMotion.pitch });
  const firstInput = sentMessages.find((msg) => msg.t === 'input');
  assert.ok(firstInput);
  stepAuthoritativeMovement(localMotion, createInputFromMessage(firstInput), flatMovementOptions(firstInput.dtMs));
  processQueuedServerInput(serverPlayer, firstInput);

  timeState.now = 1050;
  GameNet.update(0.05, { x: localMotion.x, y: localMotion.y, z: localMotion.z }, { yaw: localMotion.yaw, pitch: localMotion.pitch });
  const secondInput = sentMessages.filter((msg) => msg.t === 'input').at(-1);
  assert.ok(secondInput);
  stepAuthoritativeMovement(localMotion, createInputFromMessage(secondInput), flatMovementOptions(secondInput.dtMs));

  timeState.now = 1060;
  const shotAt = timeState.now;
  assert.equal(GameNet.sendFire('rifle', 'jump-shot'), true);
  const fireMsg = sentMessages.at(-1);
  assert.equal(fireMsg.t, 'fire');
  GameNetFeedbackSync.emitPredictedLocalDamageFeedback({
    weaponId: 'rifle',
    hitType: 'body',
    shotToken: 'jump-shot',
    pelletIndex: 0,
    damage: Number(gameplayTuning.weaponStats.rifle.bodyDamage || 0),
    worldPos: { x: target.x, y: target.y, z: target.z },
    camera: {}
  });

  timeState.now = 1120;
  const broadcasts = [];
  const room = {
    canEntityUseWeapon() { return true; },
    syncWeaponAmmoState() { return { ammoInMag: 30, reloadUntil: 0, reloadedFlashUntil: 0 }; },
    reloadRemainingForWeapon() { return 0; },
    beginWeaponReload() { throw new Error('unexpected reload'); },
    consumeWeaponAmmo() {},
    entityForward(entity) { return entityForward(entity); },
    getAliveEntities() { return [target]; },
    canTargetEntity(entity, sourceId) { return !!entity && entity.id !== sourceId; },
    worldCollidables() { return []; },
    getEntityById(id) {
      if (id === serverPlayer.id) return serverPlayer;
      if (id === target.id) return target;
      return null;
    },
    broadcast(payload) {
      broadcasts.push(cloneJson(payload));
    }
  };

  handleFire(room, serverPlayer, fireMsg, {
    nowMs: () => timeState.now,
    weaponStats: gameplayTuning.weaponStats,
    weaponFalloff: gameplayTuning.weaponFalloff,
    resolveHitscanShot,
    applyDamageFromSource,
    broadcastDamageEvent,
    broadcastDeathRespawn() {},
    canEquipWeaponId() { return true; },
    playerEyeHeight: 1.6,
    remoteMuzzleFlashHoldMs: 90
  });

  const damageEvents = broadcasts.filter((message) => message.t === 'damage_event');
  assert.equal(damageEvents.length, 1);
  assert.equal(damageEvents[0].shotToken, 'jump-shot');
  assert.equal(damageEvents[0].targetId, 'usr_target');

  handleMessage({
    t: 'snapshot',
    serverTime: 1060,
    delta: false,
    entities: [
      serializeSelfEntity(serverPlayer),
      serializeTargetEntity(target)
    ],
    removedEntityIds: [],
    projectiles: [],
    fireZones: []
  });
  handleMessage(damageEvents[0]);

  GameNetSelfSync.syncPlayerState(GameNet.getSelfState(), 0.016);
  GameNetFeedbackSync.syncGameplayFeedback({
    selfState: GameNet.getSelfState(),
    camera: {},
    dt: 0.016
  });

  const damageNumbers = uiEvents.filter((event) => event.kind === 'damage');
  const hitMarkers = uiEvents.filter((event) => event.kind === 'hit');

  assert.equal(damageNumbers.length, 1);
  assert.equal(damageNumbers[0].at, shotAt);
  assert.equal(hitMarkers.length, 1);
  assert.equal(hitMarkers[0].at, 1120);
  assert.equal(hitMarkers[0].at - shotAt, 60);

  assert.equal(reconcileEvents.length, 1);
  assert.equal(reconcileEvents[0].at, 1120);
  assert.equal(reconcileEvents[0].options.pendingInputCount, 1);
  assert.equal(reconcileEvents[0].options.lastAckedSeq, 1);
  assert.equal(reconcileEvents[0].options.pendingInputs.length, 1);
  assert.ok(reconcileEvents[0].horizontalErrorWu > 0.2);
});

test('scenario matrix covers shotgun, misses, packet loss, and airborne burst timing', async (t) => {
  const results = [];

  const shotgun = await runMeasuredScenario({
    name: 'shotgun-hit',
    weaponId: 'shotgun',
    target: { x: 0, y: 1.6, z: -6 },
    shots: [{
      token: 'shotgun-jump',
      at: 1060,
      predicted: false,
      deliverDamage: true,
      serverDelayMs: 80
    }]
  });
  results.push(shotgun);
  assert.ok(shotgun.serverDamageEvents > 1);
  assert.equal(shotgun.hitMarkerCount, 1);
  assert.deepEqual(shotgun.hitMarkerDelaysMs, [80]);

  const miss = await runMeasuredScenario({
    name: 'rifle-miss',
    weaponId: 'rifle',
    aimPoint: { x: 8, y: 1.6, z: -12 },
    shots: [{
      token: 'miss-jump',
      at: 1060,
      predicted: false,
      deliverDamage: true,
      serverDelayMs: 60
    }]
  });
  results.push(miss);
  assert.equal(miss.serverDamageEvents, 0);
  assert.equal(miss.hitMarkerCount, 0);
  assert.equal(miss.damageNumberCount, 0);

  const loss = await runMeasuredScenario({
    name: 'rifle-loss',
    weaponId: 'rifle',
    shots: [{
      token: 'loss-jump',
      at: 1060,
      predicted: true,
      deliverDamage: false,
      serverDelayMs: 60
    }]
  });
  results.push(loss);
  assert.equal(loss.serverDamageEvents, 1);
  assert.equal(loss.hitMarkerCount, 0);
  assert.equal(loss.damageNumberCount, 1);

  const burst = await runMeasuredScenario({
    name: 'machinegun-burst',
    weaponId: 'machinegun',
    shots: [
      { token: 'burst-1', at: 1060, predicted: false, deliverDamage: true, serverDelayMs: 45 },
      { token: 'burst-2', at: 1180, predicted: false, deliverDamage: true, serverDelayMs: 45 },
      { token: 'burst-3', at: 1300, predicted: false, deliverDamage: true, serverDelayMs: 45 }
    ]
  });
  results.push(burst);
  assert.equal(burst.serverDamageEvents, 3);
  assert.equal(burst.hitMarkerCount, 3);
  assert.deepEqual(burst.hitMarkerDelaysMs, [45, 45, 45]);

  t.diagnostic('\n' + formatScenarioTable(results));
});
