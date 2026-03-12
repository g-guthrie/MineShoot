function cloneSerializable(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function cloneWorldFlags(flags) {
  return {
    envV2: !!(flags && flags.envV2),
    terrainPhysicsV2: !!(flags && flags.terrainPhysicsV2)
  };
}

export function createSelfAuthoritativeChannel(options = {}) {
  const nowMs = typeof options.nowMs === 'function' ? options.nowMs : Date.now;
  const createPreviewState = typeof options.createPreviewState === 'function'
    ? options.createPreviewState
    : function defaultPreviewState(selfId) {
        if (!selfId) return null;
        return {
          id: String(selfId),
          username: 'PLAYER',
          classId: 'ffa',
          wallhackRadius: 90,
          kills: 0,
          deaths: 0,
          progressScore: 0,
          teamId: ''
        };
      };

  let selfId = '';
  let roomId = '';
  let gameMode = '';
  let matchState = null;
  let worldMeta = null;
  let authoritativeSelfState = null;
  let pendingRespawnState = null;
  let pendingSpawnCommand = null;
  let initialSpawnApplied = false;

  function resetRuntimeState() {
    authoritativeSelfState = null;
    pendingRespawnState = null;
    pendingSpawnCommand = null;
    initialSpawnApplied = false;
  }

  function scheduleSpawnCommand(command) {
    pendingSpawnCommand = {
      type: 'apply_spawn',
      reason: String(command && command.reason || 'initial'),
      x: Number(command && command.x || 0),
      z: Number(command && command.z || 0),
      executeAt: Math.max(nowMs(), Number(command && command.executeAt || 0))
    };
  }

  return {
    reset() {
      selfId = '';
      roomId = '';
      gameMode = '';
      matchState = null;
      worldMeta = null;
      resetRuntimeState();
    },
    setWelcome(payload = {}) {
      selfId = String(payload.selfId || '');
      roomId = String(payload.roomId || roomId || '');
      gameMode = String(payload.gameMode || '').toLowerCase();
      matchState = payload.matchState && typeof payload.matchState === 'object'
        ? cloneSerializable(payload.matchState)
        : null;
      worldMeta = payload.worldMeta && typeof payload.worldMeta === 'object'
        ? {
            roomId: String(payload.worldMeta.roomId || roomId || ''),
            worldSeed: String(payload.worldMeta.worldSeed || ''),
            worldProfileVersion: Math.max(1, Math.round(Number(payload.worldMeta.worldProfileVersion) || 1)),
            worldFlags: cloneWorldFlags(payload.worldMeta.worldFlags)
          }
        : null;
      resetRuntimeState();
    },
    setGameMode(nextGameMode) {
      gameMode = String(nextGameMode || '').toLowerCase();
    },
    setMatchState(nextMatchState) {
      matchState = nextMatchState && typeof nextMatchState === 'object'
        ? cloneSerializable(nextMatchState)
        : null;
    },
    ingestSnapshotEntity(entity) {
      if (!entity || String(entity.id || '') !== selfId) return false;
      authoritativeSelfState = cloneSerializable(entity);
      if (!initialSpawnApplied) {
        scheduleSpawnCommand({
          reason: 'initial',
          x: Number(entity.x || 0),
          z: Number(entity.z || 0),
          executeAt: nowMs()
        });
      }
      return true;
    },
    applyDamageEvent(message) {
      if (!authoritativeSelfState || String(message && message.targetId || '') !== selfId) return false;
      if (typeof message.health === 'number') authoritativeSelfState.hp = Number(message.health);
      if (typeof message.armor === 'number') authoritativeSelfState.armor = Number(message.armor);
      if (message.killed) authoritativeSelfState.alive = false;
      return true;
    },
    applyDeathRespawn(message) {
      if (String(message && message.entityId || '') !== selfId) return false;
      const executeAt = Math.max(nowMs(), Number(message && message.respawnAt || 0));
      pendingRespawnState = {
        active: true,
        respawnAt: executeAt
      };
      if (authoritativeSelfState) authoritativeSelfState.alive = false;
      if (typeof message.x === 'number' && typeof message.z === 'number') {
        scheduleSpawnCommand({
          reason: 'respawn',
          x: Number(message.x || 0),
          z: Number(message.z || 0),
          executeAt
        });
      }
      return true;
    },
    updateClock(timeMs = nowMs()) {
      if (pendingRespawnState && timeMs >= Number(pendingRespawnState.respawnAt || 0)) {
        pendingRespawnState = null;
      }
    },
    consumeSpawnCommand(timeMs = nowMs()) {
      if (!pendingSpawnCommand) return null;
      if (timeMs < Number(pendingSpawnCommand.executeAt || 0)) return null;
      const command = cloneSerializable(pendingSpawnCommand);
      pendingSpawnCommand = null;
      initialSpawnApplied = true;
      return command;
    },
    getSelfId() {
      return selfId;
    },
    getRoomId() {
      return roomId;
    },
    getGameMode() {
      return gameMode;
    },
    getMatchState() {
      return cloneSerializable(matchState);
    },
    getWorldMeta() {
      if (!worldMeta) return null;
      return {
        roomId: String(worldMeta.roomId || ''),
        worldSeed: String(worldMeta.worldSeed || ''),
        worldProfileVersion: Math.max(1, Math.round(Number(worldMeta.worldProfileVersion) || 1)),
        worldFlags: cloneWorldFlags(worldMeta.worldFlags)
      };
    },
    hasAuthoritativeSelfState() {
      return !!authoritativeSelfState;
    },
    getAuthoritativeSelfState() {
      return cloneSerializable(authoritativeSelfState);
    },
    getSelfPreviewState() {
      if (authoritativeSelfState) return cloneSerializable(authoritativeSelfState);
      return createPreviewState(selfId);
    },
    getRespawnState(timeMs = nowMs()) {
      if (!pendingRespawnState || !pendingRespawnState.active) return null;
      return {
        active: true,
        respawnAt: Number(pendingRespawnState.respawnAt || 0),
        remainingMs: Math.max(0, Number(pendingRespawnState.respawnAt || 0) - timeMs)
      };
    }
  };
}
