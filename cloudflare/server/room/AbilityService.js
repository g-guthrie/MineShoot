import { nowMs } from '../transport.js';
import { buildDeadeyeState } from '../sim/abilities.js';
import { gameplayTuning, getDefaultAbilityLoadout } from '../../../shared/gameplay-tuning.js';
import { normalizeClassCastPayload, protocol } from '../../../shared/protocol.js';
import {
  applyDamageFromSource,
  broadcastDamageEvent,
  broadcastDeathRespawn
} from './CombatService.js';

const ABILITY_CATALOG = gameplayTuning.abilityCatalog || {};
const DEFAULT_ABILITY_LOADOUT = getDefaultAbilityLoadout();

const MSG_S2C = protocol.msg.s2c;
const DEAD_EYE_LOCKS = { weapon: true, throwable: true };
const HOOK_LOCKS = { weapon: true, throwable: true };
const HEAL_LOCKS = { weapon: true, throwable: true };

function applyActionLocks(entity, until, locks) {
  if (!entity || !locks) return;
  const endsAt = Math.max(0, Number(until || 0));
  if (locks.weapon) entity.weaponLockUntil = Math.max(Number(entity.weaponLockUntil || 0), endsAt);
  if (locks.throwable) entity.throwableLockUntil = Math.max(Number(entity.throwableLockUntil || 0), endsAt);
  if (locks.ability) entity.abilityLockUntil = Math.max(Number(entity.abilityLockUntil || 0), endsAt);
}

function clearActionLocks(entity, until, locks) {
  if (!entity || !locks) return;
  const stamp = Math.max(0, Number(until || 0));
  if (locks.weapon && Number(entity.weaponLockUntil || 0) <= stamp) entity.weaponLockUntil = 0;
  if (locks.throwable && Number(entity.throwableLockUntil || 0) <= stamp) entity.throwableLockUntil = 0;
  if (locks.ability && Number(entity.abilityLockUntil || 0) <= stamp) entity.abilityLockUntil = 0;
}

function hookHeadPosition(state, now, liveOrigin) {
  if (!state) return null;
  if (state.phase === 'retract') {
    const retractStart = state.retractStartPos || state.endPos || state.headPos || state.startPos;
    const retractEnd = liveOrigin || state.startPos;
    if (!retractStart || !retractEnd) return null;
    const retractStartedAt = Number(state.retractStartedAt || 0);
    const retractEndsAt = Math.max(retractStartedAt + 1, Number(state.endsAt || retractStartedAt + 1));
    const retractT = Math.max(0, Math.min(1, (Number(now || nowMs()) - retractStartedAt) / (retractEndsAt - retractStartedAt)));
    return {
      x: retractStart.x + ((retractEnd.x - retractStart.x) * retractT),
      y: retractStart.y + ((retractEnd.y - retractStart.y) * retractT),
      z: retractStart.z + ((retractEnd.z - retractStart.z) * retractT)
    };
  }
  if (!state.startPos || !state.endPos) return null;
  const startAt = Number(state.startedAt || 0);
  const hitAt = Math.max(startAt + 1, Number(state.hitAt || startAt + 1));
  const t = Math.max(0, Math.min(1, (Number(now || nowMs()) - startAt) / (hitAt - startAt)));
  return {
    x: state.startPos.x + ((state.endPos.x - state.startPos.x) * t),
    y: state.startPos.y + ((state.endPos.y - state.startPos.y) * t),
    z: state.startPos.z + ((state.endPos.z - state.startPos.z) * t)
  };
}

function beginHookRetract(state, now) {
  if (!state) return;
  const retractDuration = Math.max(120, Number(state.hitAt || 0) - Number(state.startedAt || 0));
  state.phase = 'retract';
  state.targetId = '';
  state.retractStartPos = state.retractStartPos || state.attachPos || state.endPos || state.headPos || state.startPos;
  state.attachPos = null;
  state.retractStartedAt = now;
  state.headPos = state.retractStartPos;
  state.endsAt = now + retractDuration;
}

function distanceSq3(a, b) {
  if (!a || !b) return Infinity;
  const dx = Number(a.x || 0) - Number(b.x || 0);
  const dy = Number(a.y || 0) - Number(b.y || 0);
  const dz = Number(a.z || 0) - Number(b.z || 0);
  return (dx * dx) + (dy * dy) + (dz * dz);
}

function closestHostileToHookPoint(room, player, point, catchRadius) {
  if (!room || !player || !point) return null;
  const maxDistSq = Math.max(0.01, Number(catchRadius || 1.8)) ** 2;
  const entities = room.getAliveEntities();
  let best = null;
  let bestDistSq = maxDistSq;
  for (let i = 0; i < entities.length; i++) {
    const entity = entities[i];
    if (!room.canTargetEntity(entity, player.id)) continue;
    const core = room.entityAimTargetPosition(entity);
    const distSq = distanceSq3(core, point);
    if (distSq > bestDistSq) continue;
    if (!room.hasWorldLineOfSight(point, core, Math.sqrt(distSq) + 0.25)) continue;
    best = entity;
    bestDistSq = distSq;
  }
  return best;
}

function abilityDef(abilityId) {
  return ABILITY_CATALOG[abilityId] || null;
}

export function getAbilityConfig(abilityId) {
  return abilityDef(abilityId) || {};
}

export function fireDeadeyeLocks(room, player) {
  if (!player || !player.deadeye) return { fired: false, landed: 0 };
  const d = player.deadeye;
  const ids = Array.isArray(d.queue) ? d.queue : [];
  const lockCount = Math.max(0, Math.min(ids.length, Number(d.lockIndex || 0)));
  const origin = room.entityAimTargetPosition(player);
  let landed = 0;
  for (let i = 0; i < lockCount; i++) {
    const target = room.getEntityById(ids[i]);
    if (!room.canTargetEntity(target, player.id)) continue;
    const targetPos = room.entityAimTargetPosition(target);
    if (!room.hasWorldLineOfSight(origin, targetPos, Number(d.range || 70))) continue;
    const out = applyDamageFromSource(player, target, d.damage || 260, {
      hitType: 'body',
      sourceKind: 'ability',
      applyOutgoing: false
    });
    if (!out) continue;
    landed++;
    broadcastDamageEvent(room, player.id, target, out, 'body');
    if (out.killed) {
      broadcastDeathRespawn(room, target);
    }
  }
  clearActionLocks(player, d.lockEndsAt || d.endsAt || 0, DEAD_EYE_LOCKS);
  player.deadeye = null;
  return { fired: true, landed };
}

export function applyChokeTick(room, owner, targetId, damagePerTick) {
  if (!owner || !targetId) return;
  const target = room.getEntityById(targetId);
  if (!room.canTargetEntity(target, owner.id)) return;
  if (damagePerTick <= 0) return;
  const out = applyDamageFromSource(owner, target, damagePerTick, {
    hitType: 'body',
    sourceKind: 'ability',
    applyOutgoing: false
  });
  if (!out) return;
  broadcastDamageEvent(room, owner.id, target, out, 'body');
  if (out.killed) {
    broadcastDeathRespawn(room, target);
  }
}

export function castChoke(room, player, cfg, msg, now) {
  const lockedTargetId = String(msg && msg.lockTargetId ? msg.lockTargetId : '');
  const target = room.resolveLockedHostile(player, lockedTargetId, cfg.range || 24, cfg.minDot || 0.05, {
    aimPoint: msg && msg.aimPoint ? msg.aimPoint : null,
    targetTolerance: cfg.targetTolerance || 0,
    requireLos: true
  });
  if (!target) return { ok: false };

  const endsAt = now + Math.round((cfg.duration || 1.6) * 1000);
  if (Number(cfg.castDamage || 0) > 0) {
    const out = applyDamageFromSource(player, target, cfg.castDamage || 0, {
      hitType: 'body',
      sourceKind: 'ability',
      applyOutgoing: false
    });
    if (out) {
      broadcastDamageEvent(room, player.id, target, out, 'body');
      if (out.killed) {
        broadcastDeathRespawn(room, target);
        return { ok: true, kind: 'ability_choke', payload: { targetId: target.id } };
      }
    }
  }
  room.applyTimedStun(target, cfg.duration || 1.6);
  target.chokeVictimState = {
    sourceId: player.id,
    startedAt: now,
    endsAt: endsAt,
    liftHeight: cfg.liftHeight || 1.0
  };
  player.chokeState = {
    targetId: target.id,
    startedAt: now,
    endsAt: endsAt,
    nextTickAt: now + Math.round((cfg.tickRate || 0.25) * 1000),
    tickRateMs: Math.round((cfg.tickRate || 0.25) * 1000),
    dotPerTick: Math.max(0, Math.round(cfg.dotPerTick || 0)),
    liftHeight: cfg.liftHeight || 1.0
  };
  room.broadcast({
    t: MSG_S2C.ABILITY_EVENT,
    abilityId: 'choke',
    sourceId: player.id,
    targetId: target.id
  });
  return { ok: true, kind: 'ability_choke', payload: { targetId: target.id } };
}

export function castDeadeye(room, player, cfg, _msg, now) {
  const maxTargets = Math.max(1, Math.round(cfg.maxTargets || 2));
  const picks = room.deadeyeCandidates(player, cfg.range || 70, cfg.minDot || 0.22, maxTargets);
  if (picks.length === 0) return { ok: false };
  player.deadeye = buildDeadeyeState(cfg, picks, now);
  player.deadeye.range = Number(cfg.range || 70);
  player.deadeye.minDot = Number(cfg.minDot || 0.22);
  player.deadeye.lockEndsAt = Number(player.deadeye.endsAt || now);
  applyActionLocks(player, player.deadeye.lockEndsAt, DEAD_EYE_LOCKS);
  return { ok: true, kind: 'ability_deadeye_start', payload: { targetCount: picks.length } };
}

export function castHook(room, player, cfg, _msg, now) {
  const throwOrigin = room.buildDefaultThrowOriginAndDirection
    ? room.buildDefaultThrowOriginAndDirection(player)
    : null;
  const startPos = throwOrigin && throwOrigin.origin
    ? throwOrigin.origin
    : room.entityCorePosition(player);
  const range = Math.max(1, Number(cfg.range || 24));
  const aimPoint = room.resolveClassAimPoint(player, _msg || {}, range);
  const endPos = room.clampWorldAimPoint(startPos, aimPoint, range);
  const travelSpeed = Math.max(8, Number(cfg.travelSpeed || 26));
  const dx = endPos.x - startPos.x;
  const dy = endPos.y - startPos.y;
  const dz = endPos.z - startPos.z;
  const travelDistance = Math.sqrt((dx * dx) + (dy * dy) + (dz * dz));
  const travelMs = Math.max(120, Math.round((travelDistance / travelSpeed) * 1000));
  const pullSpeed = Math.max(8, Number(cfg.pullSpeed || cfg.travelSpeed || 24));
  player.hookState = {
    phase: 'travel',
    targetId: '',
    startPos,
    endPos,
    headPos: startPos,
    attachPos: null,
    catchRadius: Number(cfg.catchRadius || 1.6),
    pullDistance: Number(cfg.pullDistance || 3.2),
    stunDuration: Number(cfg.stunDuration || 0.5),
    castDamage: Number(cfg.castDamage || 35),
    travelSpeed: Number(cfg.travelSpeed || 24),
    pullSpeed: pullSpeed,
    startedAt: now,
    hitAt: now + travelMs,
    endsAt: now + travelMs,
    lockEndsAt: now + travelMs
  };
  applyActionLocks(player, player.hookState.lockEndsAt, HOOK_LOCKS);
  return { ok: true, kind: 'ability_hook_start' };
}

export function castHeal(_room, player, cfg, _msg, now) {
  player.healState = {
    startedAt: now,
    endsAt: now + Math.round(Math.max(0.1, Number(cfg.duration || 0.85)) * 1000),
    healAmount: Math.max(1, Math.round(Number(cfg.healAmount || 150))),
    applied: false,
    lockEndsAt: now + Math.round(Math.max(0.1, Number(cfg.duration || 0.85)) * 1000)
  };
  applyActionLocks(player, player.healState.lockEndsAt, HEAL_LOCKS);
  return { ok: true, kind: 'ability_heal_start' };
}

export function castMissile(room, player, cfg, msg, _now) {
  const projectile = room.spawnProjectile(
    player,
    'missile',
    '',
    msg && msg.projectileIntent ? msg.projectileIntent : null,
    {}
  );
  if (!projectile) return { ok: false };
  room.broadcast({
    t: MSG_S2C.THROW_SPAWN,
    projectileId: projectile.id,
    ownerId: projectile.ownerId,
    clientThrowId: projectile.clientThrowId || '',
    throwableId: projectile.type
  });
  return { ok: true, kind: 'ability_missile_launch', payload: { projectileId: projectile.id } };
}

export function castAbility(room, player, abilityId, cfg, msg, now) {
  if (abilityId === 'choke') return castChoke(room, player, cfg, msg, now);
  if (abilityId === 'hook') return castHook(room, player, cfg, msg, now);
  if (abilityId === 'missile') return castMissile(room, player, cfg, msg, now);
  if (abilityId === 'heal') return castHeal(room, player, cfg, msg, now);
  if (abilityId === 'deadeye') return castDeadeye(room, player, cfg, msg, now);
  return { ok: false };
}

export function handleClassCast(room, player, msg, ws) {
  if (!player || !player.alive) return;
  const normalizedMsg = normalizeClassCastPayload(msg && msg.slot, msg);
  if (room && typeof room.canEntityUseAbility === 'function' && !room.canEntityUseAbility(player)) {
    room.send(ws, { t: MSG_S2C.CLASS_CAST_REJECT, reason: 'action_locked', slot: Number(normalizedMsg.slot || 0), classId: 'abilities' });
    return;
  }
  const slot = Number(normalizedMsg.slot || 0);
  if (slot !== 1 && slot !== 2) return;
  const now = nowMs();

  const loadout = player.abilityLoadout || DEFAULT_ABILITY_LOADOUT;
  const abilityId = slot === 1 ? loadout.slot1 : loadout.slot2;
  const cfg = getAbilityConfig(abilityId);
  if (!cfg || !cfg.id) {
    room.send(ws, { t: MSG_S2C.CLASS_CAST_REJECT, reason: 'cast_failed', slot });
    return;
  }

  if (abilityId === 'deadeye' && player.deadeye) {
    const release = fireDeadeyeLocks(room, player);
    room.send(ws, {
      t: MSG_S2C.CLASS_CAST_OK,
      slot,
      classId: 'abilities',
      kind: 'deadeye_release',
      landed: release.landed || 0
    });
    return;
  }

  const slotCooldownUntil = slot === 2
    ? Math.max(0, Number(player.slot2CooldownUntil || 0))
    : Math.max(0, Number(player.slot1CooldownUntil || 0));
  if (now < slotCooldownUntil) {
    room.send(ws, { t: MSG_S2C.CLASS_CAST_REJECT, reason: 'ability_cooldown' });
    return;
  }

  const result = castAbility(room, player, abilityId, cfg, normalizedMsg, now);
  if (result.ok) {
    const cooldownUntil = now + Math.max(0, cfg.cooldownMs || 0);
    if (slot === 2) {
      player.slot2CooldownUntil = cooldownUntil;
      player.ultimateCooldownUntil = cooldownUntil;
    } else {
      player.slot1CooldownUntil = cooldownUntil;
      player.abilityCooldownUntil = cooldownUntil;
    }
    room.send(ws, {
      t: MSG_S2C.CLASS_CAST_OK,
      slot,
      classId: 'abilities',
      kind: result.kind || ('ability_' + abilityId),
      ...result.payload
    });
  } else {
    room.send(ws, { t: MSG_S2C.CLASS_CAST_REJECT, reason: 'cast_failed', slot, classId: 'abilities' });
  }
}

export function tickClassAbilityState(room, entity) {
  if (!entity || !entity.alive) return;
  const now = nowMs();

  if ((entity.slowUntil || 0) > 0 && now >= (entity.slowUntil || 0)) {
    entity.slowUntil = 0;
    entity.slowMultiplier = 1;
  }

  if (entity.hookPullState) {
    const pull = entity.hookPullState;
    const source = room.getEntityById(String(pull.sourceId || ''));
    if (!source || !source.alive) {
      entity.hookPullState = null;
    } else {
      const targetDist = Math.max(1.5, Number(pull.pullDistance || 3.2));
      const forward = room.entityForward(source);
      const desiredX = Math.max(room.boundsMin, Math.min(room.boundsMax, source.x + (forward.x * targetDist)));
      const desiredZ = Math.max(room.boundsMin, Math.min(room.boundsMax, source.z + (forward.z * targetDist)));
      const toX = desiredX - entity.x;
      const toZ = desiredZ - entity.z;
      const dist = Math.sqrt((toX * toX) + (toZ * toZ));
      const sourceDx = source.x - entity.x;
      const sourceDz = source.z - entity.z;
      const sourceDist = Math.sqrt((sourceDx * sourceDx) + (sourceDz * sourceDz));
      const baseStep = Math.max(0.001, Number(pull.pullSpeed || 26)) * (1 / 20);
      const step = Math.min(dist, Math.max(baseStep * 0.45, dist * 0.24));
      if (sourceDist <= (targetDist + 0.08) || dist <= 0.08 || now >= (pull.endsAt || 0)) {
        entity.x = desiredX;
        entity.z = desiredZ;
        room.applyJustBeenHooked(entity, Number(pull.postHookStunDuration || 0));
        entity.hookPullState = null;
      } else {
        entity.x += (toX / dist) * step;
        entity.z += (toZ / dist) * step;
        const sourceDxAfter = source.x - entity.x;
        const sourceDzAfter = source.z - entity.z;
        const sourceDistAfter = Math.sqrt((sourceDxAfter * sourceDxAfter) + (sourceDzAfter * sourceDzAfter));
        if (sourceDistAfter <= (targetDist + 0.08)) {
          room.applyJustBeenHooked(entity, Number(pull.postHookStunDuration || 0));
          entity.hookPullState = null;
        }
      }
      entity.yaw = Math.atan2(source.x - entity.x, source.z - entity.z) + Math.PI;
      entity.moveSpeedNorm = 0;
      entity.sprinting = false;
    }
  }

  if (entity.chokeState) {
    const state = entity.chokeState;
    if (!state.targetId || now >= (state.endsAt || 0)) {
      entity.chokeState = null;
    } else {
      if (now >= (state.nextTickAt || 0)) {
        applyChokeTick(room, entity, state.targetId, state.dotPerTick || 0);
        state.nextTickAt = now + (state.tickRateMs || 250);
      }
      const target = room.getEntityById(state.targetId);
      if (!target || !target.alive) {
        entity.chokeState = null;
      }
    }
  }

  if (entity.chokeVictimState) {
    const state = entity.chokeVictimState;
    if ((state.endsAt || 0) <= now) {
      entity.chokeVictimState = null;
    }
  }

  if (entity.justBeenHookedState) {
    const state = entity.justBeenHookedState;
    if ((state.endsAt || 0) <= now) {
      entity.justBeenHookedState = null;
    }
  }

  if (entity.hookState) {
    const state = entity.hookState;
    if (state.phase === 'travel') {
      state.headPos = hookHeadPosition(state, now) || state.headPos || state.startPos;
      const target = closestHostileToHookPoint(room, entity, state.headPos, state.catchRadius);
      if (target) {
        const attachPos = room.entityCorePosition(target);
        const out = applyDamageFromSource(entity, target, state.castDamage || 40, {
          hitType: 'body',
          sourceKind: 'ability',
          applyOutgoing: false
        });
        if (out) {
          broadcastDamageEvent(room, entity.id, target, out, 'body');
          if (out.killed) {
            broadcastDeathRespawn(room, target);
          }
        }
        room.pullEntityToward(
          entity,
          target,
          state.pullDistance || 3.2,
          state.pullSpeed || state.travelSpeed || 24,
          state.stunDuration || 0
        );
        state.phase = 'latched';
        state.targetId = target.id;
        state.attachPos = attachPos;
        state.headPos = attachPos;
        state.endsAt = now + 140;
        state.lockEndsAt = state.endsAt;
        applyActionLocks(entity, state.lockEndsAt, HOOK_LOCKS);
      } else if (now >= (state.hitAt || 0)) {
        beginHookRetract(state, now);
        state.lockEndsAt = state.endsAt;
        applyActionLocks(entity, state.lockEndsAt, HOOK_LOCKS);
      }
    } else if (state.phase === 'latched') {
      const target = room.getEntityById(String(state.targetId || ''));
      if (!target || !target.alive) {
        state.retractStartPos = state.attachPos || state.headPos || state.endPos || state.startPos;
        beginHookRetract(state, now);
      } else {
        state.attachPos = room.entityCorePosition(target);
        state.headPos = state.attachPos || state.headPos || state.startPos;
        if (now >= (state.endsAt || 0)) {
          state.retractStartPos = state.attachPos || state.headPos || state.endPos || state.startPos;
          beginHookRetract(state, now);
          state.lockEndsAt = state.endsAt;
          applyActionLocks(entity, state.lockEndsAt, HOOK_LOCKS);
        }
      }
    } else if (state.phase === 'retract') {
      state.headPos = hookHeadPosition(state, now, room.entityCorePosition(entity)) || state.headPos || state.startPos;
      if (now >= (state.endsAt || 0)) {
        clearActionLocks(entity, state.lockEndsAt || state.endsAt || 0, HOOK_LOCKS);
        entity.hookState = null;
      }
    } else if (now >= (state.endsAt || 0)) {
      clearActionLocks(entity, state.lockEndsAt || state.endsAt || 0, HOOK_LOCKS);
      entity.hookState = null;
    }
  }

  if (entity.healState) {
    const state = entity.healState;
    if (now >= (state.endsAt || 0)) {
      if (!state.applied) {
        entity.hp = Math.min(entity.hpMax, entity.hp + Math.max(1, Math.round(Number(state.healAmount || 150))));
        state.applied = true;
      }
      clearActionLocks(entity, state.lockEndsAt || state.endsAt || 0, HEAL_LOCKS);
      entity.healState = null;
    }
  }

  if (entity.deadeye) {
    const d = entity.deadeye;
    if (!d.queue || !d.queue.length) {
      clearActionLocks(entity, d.lockEndsAt || d.endsAt || 0, DEAD_EYE_LOCKS);
      entity.deadeye = null;
    } else {
      d.queue = d.queue.filter((targetId) => !!room.resolveLockedHostile(entity, targetId, d.range || 70, d.minDot || 0.22, {
        requireLos: true
      }));
      d.lockIndex = Math.min(d.queue.length, Number(d.lockIndex || 0));
      if (!d.queue.length) {
        clearActionLocks(entity, d.lockEndsAt || d.endsAt || 0, DEAD_EYE_LOCKS);
        entity.deadeye = null;
        return;
      }
      const lockEveryMs = Math.max(1, Math.round(d.lockEveryMs || 420));
      while ((d.lockIndex || 0) < d.queue.length && now >= (d.nextLockAt || 0)) {
        d.lockIndex = Math.min(d.queue.length, (d.lockIndex || 0) + 1);
        d.nextLockAt = (d.nextLockAt || now) + lockEveryMs;
      }
      if (now >= (d.endsAt || 0)) {
        fireDeadeyeLocks(room, entity);
      }
    }
  }
}
