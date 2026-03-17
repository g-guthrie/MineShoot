const DEFAULT_RATE_CONFIG = {
  renderHz: 60,
  interpolationDelayMs: 100
};

const DEFAULT_EYE_HEIGHT = 1.6;
const INFERRED_RUN_SPEED = 14;

function normalizeAngle(rad) {
  let value = Number(rad || 0);
  while (value > Math.PI) value -= Math.PI * 2;
  while (value < -Math.PI) value += Math.PI * 2;
  return value;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function lerpNumber(a, b, t) {
  return Number(a || 0) + ((Number(b || 0) - Number(a || 0)) * t);
}

function eyeHeight() {
  const runtime = globalThis.__MAYHEM_RUNTIME || {};
  const shared = runtime.GameShared || {};
  const constants = shared.entityConstants || {};
  return Number(constants.EYE_HEIGHT || DEFAULT_EYE_HEIGHT);
}

function resolveRateConfig(runtime) {
  if (runtime && typeof runtime.getRateConfig === 'function') {
    const config = runtime.getRateConfig();
    if (config && typeof config === 'object') {
      const renderHz = Number(config.renderHz);
      const interpolationDelayMs = Number(config.interpolationDelayMs);
      return {
        renderHz: Number.isFinite(renderHz) && renderHz > 0
          ? renderHz
          : DEFAULT_RATE_CONFIG.renderHz,
        interpolationDelayMs: Number.isFinite(interpolationDelayMs) && interpolationDelayMs >= 0
          ? interpolationDelayMs
          : DEFAULT_RATE_CONFIG.interpolationDelayMs
      };
    }
  }
  return { ...DEFAULT_RATE_CONFIG };
}

function snapshotToSample(snapshot, eyeOffset) {
  if (!snapshot) return null;
  return {
    serverTime: Number(snapshot.serverTime || 0),
    x: Number(snapshot.x || 0),
    y: Number(snapshot.footY || 0) + eyeOffset,
    z: Number(snapshot.z || 0),
    yaw: Number(snapshot.yaw || 0),
    pitch: Number(snapshot.pitch || 0)
  };
}

function sampleBufferedState(render, renderServerTime) {
  if (!render || !Array.isArray(render.snapshotHistory) || render.snapshotHistory.length === 0) {
    return null;
  }

  const history = render.snapshotHistory;
  const eyeOffset = eyeHeight();
  if (history.length === 1 || renderServerTime <= Number(history[0].serverTime || 0)) {
    return snapshotToSample(history[0], eyeOffset);
  }

  for (let i = 1; i < history.length; i++) {
    const newer = history[i];
    const older = history[i - 1];
    const olderTime = Number(older.serverTime || 0);
    const newerTime = Number(newer.serverTime || 0);
    if (renderServerTime > newerTime) continue;
    const spanMs = Math.max(1, newerTime - olderTime);
    const t = clamp((renderServerTime - olderTime) / spanMs, 0, 1);
    return {
      serverTime: renderServerTime,
      x: lerpNumber(older.x, newer.x, t),
      y: lerpNumber(older.footY, newer.footY, t) + eyeOffset,
      z: lerpNumber(older.z, newer.z, t),
      yaw: Number(older.yaw || 0) + (normalizeAngle(Number(newer.yaw || 0) - Number(older.yaw || 0)) * t),
      pitch: lerpNumber(older.pitch, newer.pitch, t)
    };
  }

  const last = history[history.length - 1];
  const prev = history.length > 1 ? history[history.length - 2] : last;
  const stepMs = Math.max(1, Number(last.serverTime || 0) - Number(prev.serverTime || 0));
  const extrapolationMs = clamp(renderServerTime - Number(last.serverTime || 0), 0, stepMs);
  const t = extrapolationMs / stepMs;
  return {
    serverTime: Number(last.serverTime || 0) + extrapolationMs,
    x: Number(last.x || 0) + ((Number(last.x || 0) - Number(prev.x || 0)) * t),
    y: Number(last.footY || 0) + ((Number(last.footY || 0) - Number(prev.footY || 0)) * t) + eyeOffset,
    z: Number(last.z || 0) + ((Number(last.z || 0) - Number(prev.z || 0)) * t),
    yaw: Number(last.yaw || 0) + (normalizeAngle(Number(last.yaw || 0) - Number(prev.yaw || 0)) * t),
    pitch: Number(last.pitch || 0) + ((Number(last.pitch || 0) - Number(prev.pitch || 0)) * t)
  };
}

function sharedWeaponStatsFor(weaponId) {
  const runtime = globalThis.__MAYHEM_RUNTIME || {};
  const shared = runtime.GameShared || {};
  if (shared.getWeaponStats) {
    const stats = shared.getWeaponStats(weaponId);
    if (stats) return stats;
  }
  const tuning = shared.gameplayTuning || {};
  const weaponStats = tuning.weaponStats || {};
  return weaponStats[String(weaponId || '')] || null;
}

function weaponPresentationFor(weaponId) {
  const runtime = globalThis.__MAYHEM_RUNTIME || {};
  const shared = runtime.GameShared || {};
  return shared.getWeaponPresentation ? shared.getWeaponPresentation(weaponId) : null;
}

function resolveRemoteReloadState(render, serverNowMs) {
  const runtime = globalThis.__MAYHEM_RUNTIME || {};
  const shared = runtime.GameShared || {};
  const emptyState = { reloading: false, reloadPct: 1, reloadPhase: 'ready', reloadPhasePct: 1 };
  if (!render || !render.weaponAmmo || typeof render.weaponAmmo !== 'object') return emptyState;
  const weaponId = String(render.weaponId || '');
  if (!weaponId) return emptyState;
  const ammoState = render.weaponAmmo[weaponId];
  if (!ammoState || !ammoState.reloading) return emptyState;
  const weaponStats = sharedWeaponStatsFor(weaponId);
  const reloadMs = Math.max(0, Number(weaponStats && weaponStats.reloadMs || 0));
  if (!(reloadMs > 0)) return emptyState;
  const snapshotServerTimeMs = Number(render.weaponAmmoServerTimeMs || 0);
  const elapsedMs = snapshotServerTimeMs > 0 ? Math.max(0, serverNowMs - snapshotServerTimeMs) : 0;
  const remainingMs = Math.max(0, Number(ammoState.reloadRemainingMs || 0) - elapsedMs);
  if (!(remainingMs > 0)) return emptyState;
  if (shared.resolveReloadPresentationState) {
    const presentation = weaponPresentationFor(weaponId);
    return shared.resolveReloadPresentationState({
      reloadMs,
      reloadRemaining: remainingMs,
      reloadedFlashRemaining: Math.max(0, Number(ammoState.reloadedFlashRemainingMs || 0)),
      reload: presentation ? presentation.reload : null
    }, null);
  }
  const reloadPct = clamp(1 - (remainingMs / reloadMs), 0, 1);
  return {
    reloading: true,
    reloadPct,
    reloadPhase: 'manipulate',
    reloadPhasePct: 0.5,
    phase: 'manipulate',
    phasePct: 0.5
  };
}

export function updateRemotePresentation(options = {}) {
  const runtime = options.runtime;
  const entitiesApi = options.entitiesApi;
  const nowMs = typeof options.nowMs === 'function' ? options.nowMs : Date.now;
  const dt = Number(options.dt || 0);
  if (!entitiesApi || !entitiesApi.getRenderMap) return;

  const rateConfig = resolveRateConfig(runtime);
  const estimatedServerTime = (runtime && typeof runtime.getEstimatedServerTime === 'function')
    ? Number(runtime.getEstimatedServerTime() || 0)
    : Number(nowMs() || 0);
  const renderTimeMs = Math.max(0, estimatedServerTime - Math.max(0, Number(rateConfig.interpolationDelayMs || 0)));
  const visualLerp = Math.min(
    1,
    dt * (rateConfig.renderHz >= 120 ? 24 : (rateConfig.renderHz <= 30 ? 8 : 14))
  );
  const eyeOffset = eyeHeight();

  entitiesApi.getRenderMap().forEach(function updateRender(render) {
    const sampled = sampleBufferedState(render, renderTimeMs);
    const sampledEyeY = sampled && typeof sampled.y === 'number' ? sampled.y : render.targetY;
    const sampledFootY = sampledEyeY - eyeOffset;
    const sampledYaw = sampled && typeof sampled.yaw === 'number' ? sampled.yaw : render.targetYaw;
    const sampledPitch = sampled && typeof sampled.pitch === 'number' ? sampled.pitch : render.targetPitch;

    render.combatX = sampled && typeof sampled.x === 'number' ? sampled.x : render.targetX;
    render.combatY = sampledEyeY;
    render.combatZ = sampled && typeof sampled.z === 'number' ? sampled.z : render.targetZ;
    render.combatYaw = sampledYaw;
    render.combatPitch = sampledPitch;
    render.group.position.x += (render.combatX - render.group.position.x) * visualLerp;
    render.group.position.y += (sampledFootY - render.group.position.y) * visualLerp;
    render.group.position.z += (render.combatZ - render.group.position.z) * visualLerp;

    const deltaYaw = normalizeAngle(render.combatYaw - render.group.rotation.y);
    render.group.rotation.y += deltaYaw * visualLerp;
    render.group.visible = !!render.alive;

    const weaponApi = (render.actorVisual && typeof render.actorVisual.setWeapon === 'function')
      ? render.actorVisual
      : render.rigApi;
    if (weaponApi && typeof weaponApi.setWeapon === 'function') {
      weaponApi.setWeapon(render.weaponId || 'rifle');
    }

    const remoteReloadState = resolveRemoteReloadState(render, renderTimeMs);
    const animationApi = (render.actorVisual && typeof render.actorVisual.updateAnimation === 'function')
      ? render.actorVisual
      : render.rigApi;
    if (animationApi && typeof animationApi.updateAnimation === 'function') {
      animationApi.updateAnimation(dt, {
        speedNorm: Number(render.moveSpeedNorm || 0),
        sprinting: !!render.sprinting,
        airborne: render.isGrounded === false,
        aimPitch: render.combatPitch || 0,
        hooked: false,
        hookStartedAt: 0,
        choked: false,
        startedAt: 0,
        adsActive: false,
        reloading: remoteReloadState.reloading,
        reloadPct: remoteReloadState.reloadPct,
        reloadPhase: remoteReloadState.phase || remoteReloadState.reloadPhase,
        reloadPhasePct: remoteReloadState.phasePct != null ? remoteReloadState.phasePct : remoteReloadState.reloadPhasePct,
        worldSpeed: Number(render.moveSpeedNorm || 0) * INFERRED_RUN_SPEED,
        movingForward: !!render.movingForward,
        movingBackward: !!render.movingBackward
      });
    } else if (render.rigApi) {
      if (typeof render.rigApi.updateAimPitch === 'function') {
        render.rigApi.updateAimPitch(render.combatPitch || 0);
      }
      if (typeof render.rigApi.updateLocomotion === 'function') {
        render.rigApi.updateLocomotion(render.moveSpeedNorm || 0, !!render.sprinting, dt, false, null);
      }
    }

    const muzzleApi = (render.actorVisual && typeof render.actorVisual.setMuzzleVisible === 'function')
      ? render.actorVisual
      : render.rigApi;
    if (muzzleApi && typeof muzzleApi.setMuzzleVisible === 'function') {
      muzzleApi.setMuzzleVisible((render.muzzleFlashUntil || 0) > nowMs());
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
      render.actorVisual.syncHitboxes({
        x: render.combatX,
        y: render.combatY - eyeOffset,
        z: render.combatZ
      });
    } else if (render.bodyHitbox && render.headHitbox) {
      render.bodyHitbox.position.set(render.combatX, (render.combatY - eyeOffset) + 0.7625, render.combatZ);
      render.headHitbox.position.set(render.combatX, (render.combatY - eyeOffset) + 2.0, render.combatZ);
    }
    if (render.bodyHitbox) render.bodyHitbox.visible = !!render.alive;
    if (render.headHitbox) render.headHitbox.visible = !!render.alive;
  });
}

export function getRenderCoreWorldPosition(render, THREERef, outVec3) {
  if (!render || !THREERef) return null;
  const out = outVec3 || new THREERef.Vector3();
  out.set(
    Number(render.combatX || render.group.position.x),
    Number(render.combatY || eyeHeight()) - 0.6,
    Number(render.combatZ || render.group.position.z)
  );
  return out;
}

export function pointForEntityId(runtime, entitiesApi, playerApi, entityId, heightOffset) {
  const id = String(entityId || '');
  if (!id) return null;

  const selfState = runtime && runtime.getAuthoritativeSelfState ? runtime.getAuthoritativeSelfState() : null;
  if (selfState && id === String(selfState.id || '')) {
    if (playerApi && playerApi.getPosition) {
      const selfPos = playerApi.getPosition();
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

  const render = entitiesApi && entitiesApi.getRenderMap ? entitiesApi.getRenderMap().get(id) : null;
  if (!render || !render.group) return null;
  return {
    x: Number(render.combatX || render.group.position.x),
    y: Number(render.combatY || eyeHeight()) + Number(heightOffset || 0) - eyeHeight(),
    z: Number(render.combatZ || render.group.position.z)
  };
}

export function decorateOutgoingDamageFeedback(runtime, entitiesApi, playerApi, feedback) {
  if (!feedback) return null;
  return {
    targetId: feedback.targetId || '',
    damage: Math.max(0, Number(feedback.damage || 0)),
    hitType: feedback.hitType === 'head' ? 'head' : 'body',
    weaponId: feedback.weaponId || '',
    shotToken: feedback.shotToken || '',
    shotId: feedback.shotId || '',
    killed: !!feedback.killed,
    worldPos: pointForEntityId(runtime, entitiesApi, playerApi, feedback.targetId || '', 1.1)
  };
}

export function decorateIncomingDamageFeedback(runtime, entitiesApi, playerApi, feedback) {
  if (!feedback) return null;
  return {
    sourcePos: pointForEntityId(runtime, entitiesApi, playerApi, feedback.sourceId || '', 1.1),
    damage: Math.max(0, Number(feedback.damage || 0)),
    hitType: feedback.hitType === 'head' ? 'head' : 'body'
  };
}

export function buildLockTargets(entitiesApi, THREERef) {
  const out = [];
  if (!entitiesApi || !entitiesApi.getRenderMap || !THREERef) return out;
  entitiesApi.getRenderMap().forEach(function eachRender(render) {
    if (!render || !render.alive) return;
    const worldPos = getRenderCoreWorldPosition(render, THREERef, new THREERef.Vector3());
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
}
