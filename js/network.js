import { createClientNetRuntime } from './runtime/net/client-net-runtime.mjs';
import { createSelfAuthoritativeChannel } from './runtime/net/self-authoritative-channel.mjs';
import { createRemoteEntityChannel } from './runtime/net/remote-entity-channel.mjs';
import { createNetTransport } from './net/transport.js';
import { gameRuntimeProfile } from './core/runtime-profile.js';
import { GameNetEntities } from './net/remote-entities.js';
import { GamePlayer } from './player.js';
import { GameWorld } from './world.js';
import { protocol as PROTOCOL } from '../shared/protocol.js';

/**
 * network.js - GameNet facade over the new client net runtime.
 * Remote entity visuals remain in GameNetEntities and stay presentation-side.
 */

let configuredRoomId = sanitizeRoomId((PROTOCOL && PROTOCOL.defaults && PROTOCOL.defaults.roomId) || 'global');
let sceneRef = null;
let runtime = null;

function sanitizeRoomId(raw) {
  if (PROTOCOL && typeof PROTOCOL.sanitizeRoomId === 'function') {
    return PROTOCOL.sanitizeRoomId(raw);
  }
  return String(raw || 'global').trim().toLowerCase() || 'global';
}

function cloneWorldFlags(flags) {
  return {
    envV2: !!(flags && flags.envV2),
    terrainPhysicsV2: !!(flags && flags.terrainPhysicsV2)
  };
}

function buildExpectedWorldMeta(roomId) {
  const worldCfg = (PROTOCOL && PROTOCOL.world) ? PROTOCOL.world : null;
  const normalizedRoomId = sanitizeRoomId(roomId || configuredRoomId || 'global');
  return {
    roomId: normalizedRoomId,
    worldSeed: String((worldCfg && worldCfg.seedPrefix) || 'room-env-v6-static') + '-' + normalizedRoomId,
    worldProfileVersion: Math.max(1, Math.round(Number(worldCfg && worldCfg.profileVersion) || 6)),
    worldFlags: cloneWorldFlags((worldCfg && worldCfg.flags) ? worldCfg.flags : { envV2: true, terrainPhysicsV2: true })
  };
}

function resolveEndpoint(roomId) {
  const wsPath = (PROTOCOL && PROTOCOL.wsPath) ? PROTOCOL.wsPath : '/api/ws';
  const base = gameRuntimeProfile && gameRuntimeProfile.resolveWsUrl
    ? gameRuntimeProfile.resolveWsUrl(wsPath)
    : ((window.location.protocol === 'https:' ? 'wss:' : 'ws:') + '//' + window.location.host + wsPath);
  const params = new URLSearchParams();
  params.set('room', sanitizeRoomId(roomId || configuredRoomId || 'global'));
  return base + '?' + params.toString();
}

function requireRemoteEntities() {
  if (!GameNetEntities) {
    throw new Error('GameNet remote entities are not loaded.');
  }
}

function nowMs() {
  return Date.now();
}

function normalizeAngle(rad) {
  while (rad > Math.PI) rad -= Math.PI * 2;
  while (rad < -Math.PI) rad += Math.PI * 2;
  return rad;
}

function updateRemotePresentation(dt) {
  GameNetEntities.getRenderMap().forEach(function updateRender(render) {
    const lerp = Math.min(1, dt * 10);
    render.group.position.x += (render.targetX - render.group.position.x) * lerp;
    render.group.position.y += ((render.targetFootY || 0) - render.group.position.y) * lerp;
    render.group.position.z += (render.targetZ - render.group.position.z) * lerp;

    const deltaYaw = normalizeAngle(render.targetYaw - render.group.rotation.y);
    render.group.rotation.y += deltaYaw * lerp;

    if (render.rigApi) {
      render.rigApi.setWeapon(render.weaponId || 'rifle');
      render.rigApi.updateAimPitch(render.targetPitch || 0);
      render.rigApi.updateLocomotion(render.moveSpeedNorm || 0, !!render.sprinting, dt, false, null);
      if (render.rigApi.setMuzzleVisible) {
        render.rigApi.setMuzzleVisible((render.muzzleFlashUntil || 0) > nowMs());
      }
      if (render.rigApi.applyThrowPose) render.rigApi.applyThrowPose(dt);
    }

    if (render.actorVisual && render.actorVisual.visual) {
      render.actorVisual.visual.traverse(function updateSpawnShield(node) {
        if (!node || !node.isMesh || !node.material) return;
        const mat = node.material;
        if (mat.__spawnShieldBaseOpacity === undefined) {
          mat.__spawnShieldBaseOpacity = (typeof mat.opacity === 'number') ? mat.opacity : 1;
          mat.__spawnShieldBaseTransparent = !!mat.transparent;
        }
        if (render.spawnShieldUntil && render.spawnShieldUntil > nowMs()) {
          mat.transparent = true;
          mat.opacity = Math.min(mat.__spawnShieldBaseOpacity, 0.42);
        } else {
          mat.opacity = mat.__spawnShieldBaseOpacity;
          mat.transparent = mat.__spawnShieldBaseTransparent;
        }
        mat.needsUpdate = true;
      });
    }

    if (render.actorVisual && render.actorVisual.syncHitboxes) {
      render.actorVisual.syncHitboxes(render.group.position);
    } else if (render.bodyHitbox && render.headHitbox) {
      render.bodyHitbox.position.set(render.group.position.x, render.group.position.y + 0.7625, render.group.position.z);
      render.headHitbox.position.set(render.group.position.x, render.group.position.y + 2.0, render.group.position.z);
    }
  });
}

function getRenderCoreWorldPosition(render, outVec3) {
  if (!render) return null;
  const out = outVec3 || new THREE.Vector3();
  if (render.rigApi && render.rigApi.getCoreWorldPosition) {
    return render.rigApi.getCoreWorldPosition(out);
  }
  out.copy(render.group.position);
  out.y += 1.0;
  return out;
}

function pointForEntityId(entityId, heightOffset) {
  const id = String(entityId || '');
  if (!id) return null;

  const selfState = runtime && runtime.getAuthoritativeSelfState ? runtime.getAuthoritativeSelfState() : null;
  if (selfState && id === String(selfState.id || '')) {
    if (GamePlayer && GamePlayer.getPosition) {
      const selfPos = GamePlayer.getPosition();
      return {
        x: selfPos.x,
        y: selfPos.y + Number(heightOffset || 0),
        z: selfPos.z
      };
    }
    return {
      x: Number(selfState.x || 0),
      y: Number(selfState.y || 0) + Number(heightOffset || 0),
      z: Number(selfState.z || 0)
    };
  }

  const render = GameNetEntities.getRenderMap().get(id);
  if (!render || !render.group) return null;
  return {
    x: render.group.position.x,
    y: render.group.position.y + Number(heightOffset || 0),
    z: render.group.position.z
  };
}

function decorateOutgoingDamageFeedback(feedback) {
  if (!feedback) return null;
  return {
    targetId: feedback.targetId || '',
    damage: Math.max(0, Number(feedback.damage || 0)),
    hitType: feedback.hitType === 'head' ? 'head' : 'body',
    weaponId: feedback.weaponId || '',
    shotToken: feedback.shotToken || '',
    killed: !!feedback.killed,
    worldPos: pointForEntityId(feedback.targetId || '', 1.1)
  };
}

function decorateIncomingDamageFeedback(feedback) {
  if (!feedback) return null;
  return {
    sourcePos: pointForEntityId(feedback.sourceId || '', 1.1),
    damage: Math.max(0, Number(feedback.damage || 0)),
    hitType: feedback.hitType === 'head' ? 'head' : 'body'
  };
}

function createRuntime() {
  requireRemoteEntities();

  const selfChannel = createSelfAuthoritativeChannel({
    nowMs,
    createPreviewState(selfId) {
      if (!selfId) return null;
      const defaults = GameNetEntities.classStats('ffa');
      return {
        id: String(selfId),
        username: 'PLAYER',
        classId: 'ffa',
        wallhackRadius: defaults.wallhackRadius,
        kills: 0,
        deaths: 0,
        progressScore: 0,
        teamId: ''
      };
    }
  });

  const remoteChannel = createRemoteEntityChannel({
    onEntityUpsert(entity) {
      GameNetEntities.updateFromSnapshot(entity);
    },
    onEntityRemove(entityId) {
      GameNetEntities.removeRemoteVisual(entityId);
    }
  });

  return createClientNetRuntime({
    protocol: PROTOCOL,
    roomId: configuredRoomId,
    transportFactory: {
      create: createNetTransport
    },
    selfChannel,
    remoteChannel,
    nowMs,
    resolveEndpoint,
    getActiveWorldMeta() {
      if (GameWorld && GameWorld.getWorldMeta) {
        return GameWorld.getWorldMeta();
      }
      return null;
    }
  });
}

export const GameNet = {
  setRoomId(nextRoomId) {
    configuredRoomId = sanitizeRoomId(nextRoomId);
    if (runtime && runtime.setRoomId) {
      runtime.setRoomId(configuredRoomId);
    }
    return configuredRoomId;
  },
  getRoomId() {
    if (runtime && runtime.getRoomId) return runtime.getRoomId();
    return configuredRoomId;
  },
  getExpectedWorldMeta() {
    if (runtime && runtime.getExpectedWorldMeta) return runtime.getExpectedWorldMeta();
    return buildExpectedWorldMeta(configuredRoomId);
  },
  getWorldMeta() {
    return runtime && runtime.getWorldMeta ? runtime.getWorldMeta() : null;
  },
  init(scene) {
    sceneRef = scene;
    GameNetEntities.init(sceneRef);
    runtime = createRuntime();
    runtime.init();
  },
  shutdown() {
    if (runtime && runtime.shutdown) runtime.shutdown();
    runtime = null;
    GameNetEntities.cleanup();
    sceneRef = null;
  },
  isActive() {
    return !!(runtime && runtime.isActive && runtime.isActive());
  },
  isConnected() {
    return !!(runtime && runtime.isConnected && runtime.isConnected());
  },
  getHitboxArray() {
    return GameNetEntities.getHitboxArray();
  },
  setHitboxVisibility(visible) {
    GameNetEntities.setHitboxVisibility(visible);
  },
  getEntityStateList() {
    const out = [];
    GameNetEntities.getRenderMap().forEach(function eachRender(render) {
      out.push({
        id: render.id,
        kind: render.kind,
        username: render.username,
        classId: render.classId,
        hp: render.hp,
        hpMax: render.hpMax,
        armor: render.armor,
        armorMax: render.armorMax,
        alive: render.alive,
        worldPos: render.group.position,
        headY: 2.45,
        targetId: 'net:' + render.id
      });
    });
    return out;
  },
  getAuthoritativeSelfState() {
    return runtime && runtime.getAuthoritativeSelfState ? runtime.getAuthoritativeSelfState() : null;
  },
  getSelfPreviewState() {
    return runtime && runtime.getSelfPreviewState ? runtime.getSelfPreviewState() : null;
  },
  hasAuthoritativeSelfState() {
    return !!(runtime && runtime.hasAuthoritativeSelfState && runtime.hasAuthoritativeSelfState());
  },
  getSelfState() {
    return GameNet.getAuthoritativeSelfState();
  },
  update(dt, playerPos, rotation, animation) {
    if (!runtime) return;
    runtime.update(dt, {
      position: playerPos,
      rotation,
      animation: animation || null
    });
    updateRemotePresentation(dt);
  },
  sendFire(hitbox, weaponId, hitType, shotToken, adsActive) {
    if (!runtime || !runtime.sendFire || !hitbox || !hitbox.userData) return false;
    let targetEntityId = String(hitbox.userData.netEntityId || '');
    if (!targetEntityId && typeof hitbox.userData.targetId === 'string' && hitbox.userData.targetId.indexOf('net:') === 0) {
      targetEntityId = String(hitbox.userData.targetId).slice(4);
    }
    if (!targetEntityId) return false;
    return runtime.sendFire({
      targetId: targetEntityId,
      weaponId: weaponId || 'rifle',
      hitType: hitType === 'head' ? 'head' : 'body',
      shotToken: shotToken || '',
      adsActive: !!adsActive
    });
  },
  consumeDamageFeedback() {
    if (!runtime || !runtime.consumeDamageFeedback) return null;
    return decorateOutgoingDamageFeedback(runtime.consumeDamageFeedback());
  },
  consumeIncomingDamageFeedback() {
    if (!runtime || !runtime.consumeIncomingDamageFeedback) return null;
    return decorateIncomingDamageFeedback(runtime.consumeIncomingDamageFeedback());
  },
  consumeSelfCommand() {
    return runtime && runtime.consumeSelfCommand ? runtime.consumeSelfCommand() : null;
  },
  getMatchState() {
    return runtime && runtime.getMatchState ? runtime.getMatchState() : null;
  },
  getRespawnState() {
    return runtime && runtime.getRespawnState ? runtime.getRespawnState() : null;
  },
  getGameMode() {
    return runtime && runtime.getGameMode ? runtime.getGameMode() : '';
  },
  getEntityName(entityId) {
    return runtime && runtime.getEntityName ? runtime.getEntityName(entityId) : '';
  },
  getLockTargets() {
    const out = [];
    GameNetEntities.getRenderMap().forEach(function eachRender(render) {
      if (!render || !render.alive) return;
      const worldPos = getRenderCoreWorldPosition(render, new THREE.Vector3());
      if (!worldPos) return;
      out.push({
        targetId: 'net:' + render.id,
        ownerType: 'net',
        worldPos,
        hitbox: render.bodyHitbox || null,
        alive: true,
        netEntityId: render.id
      });
    });
    return out;
  },
  consumeNotice() {
    return runtime && runtime.consumeNotice ? runtime.consumeNotice() : '';
  }
};
