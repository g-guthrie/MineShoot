import { createEventQueue } from '../event-queue.mjs';

function cloneSerializable(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function cloneWorldFlags(flags) {
  return {
    envV2: !!(flags && flags.envV2),
    terrainPhysicsV2: !!(flags && flags.terrainPhysicsV2)
  };
}

function sanitizeRoomId(protocol, rawRoomId) {
  if (protocol && typeof protocol.sanitizeRoomId === 'function') {
    return protocol.sanitizeRoomId(rawRoomId);
  }
  const normalized = String(rawRoomId || '').trim().toLowerCase();
  return normalized || 'global';
}

function buildExpectedWorldMeta(protocol, roomId) {
  const worldConfig = (protocol && protocol.world) ? protocol.world : {};
  const profileVersion = Math.max(1, Math.round(Number(worldConfig.profileVersion) || 6));
  const seedPrefix = String(worldConfig.seedPrefix || 'room-env-v6-static');
  const normalizedRoomId = sanitizeRoomId(protocol, roomId || 'global');
  return {
    roomId: normalizedRoomId,
    worldSeed: `${seedPrefix}-${normalizedRoomId}`,
    worldProfileVersion: profileVersion,
    worldFlags: cloneWorldFlags(worldConfig.flags)
  };
}

export function createClientNetRuntime(options = {}) {
  const protocol = options.protocol;
  const transportFactory = options.transportFactory;
  const selfChannel = options.selfChannel;
  const remoteChannel = options.remoteChannel;
  const resolveEndpoint = options.resolveEndpoint;

  if (!protocol || typeof protocol !== 'object') {
    throw new Error('Client net runtime requires protocol.');
  }
  if (!transportFactory || typeof transportFactory.create !== 'function') {
    throw new Error('Client net runtime requires a transport factory.');
  }
  if (!selfChannel || typeof selfChannel.setWelcome !== 'function') {
    throw new Error('Client net runtime requires a self channel.');
  }
  if (!remoteChannel || typeof remoteChannel.applySnapshot !== 'function') {
    throw new Error('Client net runtime requires a remote channel.');
  }
  if (typeof resolveEndpoint !== 'function') {
    throw new Error('Client net runtime requires an endpoint resolver.');
  }

  const nowMs = typeof options.nowMs === 'function' ? options.nowMs : Date.now;
  const getActiveWorldMeta = typeof options.getActiveWorldMeta === 'function' ? options.getActiveWorldMeta : null;
  const inputSendIntervalSec = Math.max(0.01, Number(options.inputSendIntervalSec) || 0.05);
  const noticeQueue = options.noticeQueue || createEventQueue({ capacity: 8 });
  const outgoingDamageQueue = options.outgoingDamageQueue || createEventQueue({ capacity: 48 });
  const incomingDamageQueue = options.incomingDamageQueue || createEventQueue({ capacity: 32 });
  const selfCommandQueue = options.selfCommandQueue || createEventQueue({ capacity: 8 });

  const MSG_C2S = (protocol.msg && protocol.msg.c2s) ? protocol.msg.c2s : {};
  const MSG_S2C = (protocol.msg && protocol.msg.s2c) ? protocol.msg.s2c : {};

  let active = false;
  let connected = false;
  let inputSeq = 1;
  let inputSendTimer = 0;
  let transport = null;
  let roomId = sanitizeRoomId(protocol, options.roomId || (protocol.defaults && protocol.defaults.roomId) || 'global');
  let expectedWorldMeta = buildExpectedWorldMeta(protocol, roomId);
  let inputHistory = [];

  function pushNotice(text) {
    if (!text) return;
    noticeQueue.push(String(text));
  }

  function resetQueues() {
    noticeQueue.clear();
    outgoingDamageQueue.clear();
    incomingDamageQueue.clear();
    selfCommandQueue.clear();
  }

  function flushSelfCommands() {
    let command = selfChannel.consumeSpawnCommand(nowMs());
    while (command) {
      selfCommandQueue.push(command);
      command = selfChannel.consumeSpawnCommand(nowMs());
    }
  }

  function wsSend(payload) {
    if (!transport || typeof transport.send !== 'function') return false;
    return transport.send(payload);
  }

  function handleWelcome(message) {
    roomId = sanitizeRoomId(protocol, message.roomId || roomId || 'global');
    expectedWorldMeta = buildExpectedWorldMeta(protocol, roomId);

    const nextWorldMeta = {
      roomId,
      worldSeed: (typeof message.worldSeed === 'string' && message.worldSeed.trim())
        ? message.worldSeed.trim()
        : expectedWorldMeta.worldSeed,
      worldProfileVersion: Math.max(
        1,
        Math.round(Number(message.worldProfileVersion) || expectedWorldMeta.worldProfileVersion)
      ),
      worldFlags: cloneWorldFlags(
        (message.worldFlags && typeof message.worldFlags === 'object')
          ? message.worldFlags
          : expectedWorldMeta.worldFlags
      )
    };

    selfChannel.setWelcome({
      selfId: message.selfId || '',
      roomId,
      gameMode: String(message.gameMode || '').toLowerCase(),
      matchState: message.matchState && typeof message.matchState === 'object' ? message.matchState : null,
      worldMeta: nextWorldMeta
    });

    if (!message.worldSeed) {
      pushNotice('Server world metadata missing; using local fallback profile.');
    } else if (
      expectedWorldMeta.worldSeed !== nextWorldMeta.worldSeed ||
      expectedWorldMeta.worldProfileVersion !== nextWorldMeta.worldProfileVersion ||
      expectedWorldMeta.worldFlags.envV2 !== nextWorldMeta.worldFlags.envV2 ||
      expectedWorldMeta.worldFlags.terrainPhysicsV2 !== nextWorldMeta.worldFlags.terrainPhysicsV2
    ) {
      pushNotice('Server world profile differs from local defaults.');
    }

    const activeWorldMeta = getActiveWorldMeta ? getActiveWorldMeta() : null;
    if (
      activeWorldMeta &&
      activeWorldMeta.worldSeed &&
      (
        String(activeWorldMeta.worldSeed) !== nextWorldMeta.worldSeed ||
        Number(activeWorldMeta.worldProfileVersion || 0) !== nextWorldMeta.worldProfileVersion
      )
    ) {
      pushNotice('World metadata mismatch with active scene. Rejoin room to resync.');
    }

    pushNotice(`Joined room ${roomId}`);
  }

  function handleSnapshot(message) {
    selfChannel.setGameMode(message.gameMode || selfChannel.getGameMode());
    if (message.matchState && typeof message.matchState === 'object') {
      selfChannel.setMatchState(message.matchState);
    }

    const entities = Array.isArray(message.entities) ? message.entities : [];
    const remoteEntities = [];
    for (let i = 0; i < entities.length; i++) {
      if (!selfChannel.ingestSnapshotEntity(entities[i])) {
        remoteEntities.push(entities[i]);
      }
    }

    const removedEntityIds = Array.isArray(message.removedEntityIds)
      ? message.removedEntityIds.filter((entityId) => String(entityId || '') !== selfChannel.getSelfId())
      : [];

    remoteChannel.applySnapshot({
      entities: remoteEntities,
      delta: !!message.delta,
      removedEntityIds
    });

    flushSelfCommands();
  }

  function handleDamageEvent(message) {
    if (selfChannel.applyDamageEvent(message)) {
      incomingDamageQueue.push({
        sourceId: String(message.sourceId || ''),
        damage: Math.max(0, Number(message.damage || 0)),
        hitType: message.hitType === 'head' ? 'head' : 'body'
      });
    }

    const targetId = String(message.targetId || '');
    const selfId = selfChannel.getSelfId();
    if (targetId && targetId !== selfId) {
      remoteChannel.mutateEntity(targetId, (entity) => {
        if (typeof message.health === 'number') entity.hp = Number(message.health);
        if (typeof message.armor === 'number') entity.armor = Number(message.armor);
        if (message.killed) entity.alive = false;
        return entity;
      });
    }

    if (String(message.sourceId || '') === selfId) {
      outgoingDamageQueue.push({
        targetId,
        damage: Math.max(0, Number(message.damage || 0)),
        hitType: message.hitType === 'head' ? 'head' : 'body',
        weaponId: String(message.weaponId || ''),
        shotToken: String(message.shotToken || ''),
        killed: !!message.killed
      });
    }
  }

  function handleDeathRespawn(message) {
    if (!selfChannel.applyDeathRespawn(message)) return;
    flushSelfCommands();
  }

  function handleMessage(rawMessage) {
    let message = null;
    try {
      message = JSON.parse(rawMessage);
    } catch (_err) {
      return;
    }
    if (!message || !message.t) return;

    const type = String(message.t || '');
    if (type === (MSG_S2C.WELCOME || 'welcome')) {
      handleWelcome(message);
      return;
    }
    if (type === (MSG_S2C.SNAPSHOT || 'snapshot')) {
      handleSnapshot(message);
      return;
    }
    if (type === (MSG_S2C.DAMAGE_EVENT || 'damage_event')) {
      handleDamageEvent(message);
      return;
    }
    if (type === (MSG_S2C.DEATH_RESPAWN || 'death_respawn')) {
      handleDeathRespawn(message);
      return;
    }
    if (type === (MSG_S2C.ERROR || 'error')) {
      pushNotice(message.message || 'Server error');
    }
  }

  function connect() {
    transport = transportFactory.create({
      endpoint() {
        return resolveEndpoint(roomId);
      },
      isActive() {
        return active;
      },
      reconnectMs: 1200,
      onOpen() {
        connected = true;
        wsSend({ t: (MSG_C2S.JOIN_ROOM || 'join_room') });
      },
      onMessage: handleMessage,
      onClose() {
        connected = false;
      },
      onError() {
        connected = false;
      }
    });
    transport.connect();
  }

  function buildInputPayload(localInputState) {
    if (!localInputState || !localInputState.position || !localInputState.rotation) return null;
    const animation = localInputState.animation || {};
    return {
      t: (MSG_C2S.INPUT || 'input'),
      seq: inputSeq++,
      x: Number(localInputState.position.x || 0),
      y: Number(localInputState.position.y || 0),
      z: Number(localInputState.position.z || 0),
      yaw: Number(localInputState.rotation.yaw || 0),
      pitch: Number(localInputState.rotation.pitch || 0),
      sprint: !!animation.sprinting,
      jump: !!animation.jump,
      weaponId: String(animation.equippedWeaponId || 'rifle'),
      moveSpeedNorm: typeof animation.moveSpeedNorm === 'number' ? animation.moveSpeedNorm : 0,
      sprinting: !!animation.sprinting
    };
  }

  return {
    init() {
      if (active) return;
      active = true;
      connected = false;
      inputSeq = 1;
      inputSendTimer = 0;
      inputHistory = [];
      expectedWorldMeta = buildExpectedWorldMeta(protocol, roomId);
      connect();
    },
    shutdown() {
      active = false;
      connected = false;
      if (transport && typeof transport.shutdown === 'function') {
        transport.shutdown();
      }
      transport = null;
      inputHistory = [];
      remoteChannel.clear();
      selfChannel.reset();
      expectedWorldMeta = buildExpectedWorldMeta(protocol, roomId);
      resetQueues();
    },
    update(dt, localInputState) {
      if (!active) return;
      selfChannel.updateClock(nowMs());
      flushSelfCommands();

      inputSendTimer -= Number(dt || 0);
      if (inputSendTimer > 0) return;

      inputSendTimer = inputSendIntervalSec;
      const payload = buildInputPayload(localInputState);
      if (!payload) return;
      if (!wsSend(payload)) return;

      inputHistory.push({
        clientTime: nowMs(),
        payload: cloneSerializable(payload)
      });
      if (inputHistory.length > 64) {
        inputHistory.splice(0, inputHistory.length - 64);
      }
    },
    setRoomId(nextRoomId) {
      roomId = sanitizeRoomId(protocol, nextRoomId);
      expectedWorldMeta = buildExpectedWorldMeta(protocol, roomId);
      remoteChannel.clear();
      selfChannel.reset();
      inputHistory = [];
      resetQueues();
      return roomId;
    },
    getRoomId() {
      return roomId;
    },
    getExpectedWorldMeta() {
      return {
        roomId: expectedWorldMeta.roomId,
        worldSeed: expectedWorldMeta.worldSeed,
        worldProfileVersion: expectedWorldMeta.worldProfileVersion,
        worldFlags: cloneWorldFlags(expectedWorldMeta.worldFlags)
      };
    },
    getWorldMeta() {
      return selfChannel.getWorldMeta();
    },
    isActive() {
      return !!active;
    },
    isConnected() {
      return !!connected;
    },
    hasAuthoritativeSelfState() {
      return selfChannel.hasAuthoritativeSelfState();
    },
    getAuthoritativeSelfState() {
      return selfChannel.getAuthoritativeSelfState();
    },
    getSelfPreviewState() {
      return selfChannel.getSelfPreviewState();
    },
    getMatchState() {
      return selfChannel.getMatchState();
    },
    getRespawnState() {
      return selfChannel.getRespawnState(nowMs());
    },
    getGameMode() {
      return selfChannel.getGameMode();
    },
    getEntityName(entityId) {
      const id = String(entityId || '');
      if (!id) return '';
      const selfState = selfChannel.getAuthoritativeSelfState();
      if (selfState && id === String(selfState.id || '')) {
        return String(selfState.username || selfState.id || '');
      }
      return remoteChannel.getEntityName(id);
    },
    getInputHistory() {
      return cloneSerializable(inputHistory);
    },
    sendFire(payload = {}) {
      if (!payload.targetId) return false;
      return wsSend({
        t: (MSG_C2S.FIRE || 'fire'),
        targetId: String(payload.targetId || ''),
        weaponId: String(payload.weaponId || 'rifle'),
        hitType: payload.hitType === 'head' ? 'head' : 'body',
        adsActive: !!payload.adsActive,
        shotToken: String(payload.shotToken || '')
      });
    },
    consumeNotice() {
      return noticeQueue.shift();
    },
    consumeDamageFeedback() {
      return outgoingDamageQueue.shift();
    },
    consumeIncomingDamageFeedback() {
      return incomingDamageQueue.shift();
    },
    consumeSelfCommand() {
      return selfCommandQueue.shift();
    }
  };
}
