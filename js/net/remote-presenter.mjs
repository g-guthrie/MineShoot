import { getRateConfig } from '../../shared/rate-presets.js';
import { sampleBufferedState } from './remote-entities.js';

function normalizeAngle(rad) {
  while (rad > Math.PI) rad -= Math.PI * 2;
  while (rad < -Math.PI) rad += Math.PI * 2;
  return rad;
}

export function updateRemotePresentation(options = {}) {
  const runtime = options.runtime;
  const entitiesApi = options.entitiesApi;
  const nowMs = typeof options.nowMs === 'function' ? options.nowMs : Date.now;
  const dt = Number(options.dt || 0);
  if (!entitiesApi || !entitiesApi.getRenderMap) return;

  const rateConfig = (runtime && runtime.getRateConfig) ? runtime.getRateConfig() : getRateConfig('30');
  const estimatedServerTime = (runtime && runtime.getEstimatedServerTime)
    ? runtime.getEstimatedServerTime()
    : nowMs();
  const renderTimeMs = estimatedServerTime - Math.max(0, Number(rateConfig && rateConfig.interpolationDelayMs || 0));
  const visualLerp = Math.min(
    1,
    dt * (rateConfig && rateConfig.renderHz >= 120 ? 24 : (rateConfig && rateConfig.renderHz <= 30 ? 8 : 14))
  );

  entitiesApi.getRenderMap().forEach(function updateRender(render) {
    const sampled = sampleBufferedState(render, renderTimeMs);
    const sampledEyeY = sampled && typeof sampled.y === 'number' ? sampled.y : render.targetY;
    const sampledFootY = sampledEyeY - 1.6;
    const sampledYaw = sampled && typeof sampled.yaw === 'number' ? sampled.yaw : render.targetYaw;
    const sampledPitch = sampled && typeof sampled.pitch === 'number' ? sampled.pitch : render.targetPitch;

    render.combatX = sampled && typeof sampled.x === 'number' ? sampled.x : render.targetX;
    render.combatY = sampledEyeY;
    render.combatZ = sampled && typeof sampled.z === 'number' ? sampled.z : render.targetZ;
    render.combatYaw = sampledYaw;
    render.combatPitch = sampledPitch;
    render.alive = sampled ? !!sampled.alive : render.alive;
    render.moveSpeedNorm = sampled ? Number(sampled.moveSpeedNorm || 0) : render.moveSpeedNorm;
    render.sprinting = sampled ? !!sampled.sprinting : render.sprinting;

    render.group.position.x += (render.combatX - render.group.position.x) * visualLerp;
    render.group.position.y += (sampledFootY - render.group.position.y) * visualLerp;
    render.group.position.z += (render.combatZ - render.group.position.z) * visualLerp;

    const deltaYaw = normalizeAngle(render.combatYaw - render.group.rotation.y);
    render.group.rotation.y += deltaYaw * visualLerp;
    render.group.visible = !!render.alive;

    if (render.rigApi) {
      render.rigApi.setWeapon(render.weaponId || 'rifle');
      render.rigApi.updateAimPitch(render.combatPitch || 0);
      render.rigApi.updateLocomotion(render.moveSpeedNorm || 0, !!render.sprinting, dt, false, null);
      if (render.rigApi.setMuzzleVisible) {
        render.rigApi.setMuzzleVisible((render.muzzleFlashUntil || 0) > nowMs());
      }
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
        y: render.combatY - 1.6,
        z: render.combatZ
      });
    } else if (render.bodyHitbox && render.headHitbox) {
      render.bodyHitbox.position.set(render.combatX, (render.combatY - 1.6) + 0.7625, render.combatZ);
      render.headHitbox.position.set(render.combatX, (render.combatY - 1.6) + 2.0, render.combatZ);
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
    Number(render.combatY || 1.6) - 0.6,
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
    y: Number(render.combatY || 1.6) + Number(heightOffset || 0) - 1.6,
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
