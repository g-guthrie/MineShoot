import { getSharedTuningWu } from '../../lib/shared-tuning.js';
import { getSharedProtocol } from '../../lib/shared-protocol.js';
import { nowMs } from '../transport.js';
import { buildDeadeyeState } from '../sim/abilities.js';
import {
  applyDamageFromSource,
  broadcastDamageEvent,
  broadcastDeathRespawn
} from './CombatService.js';

const GAMEPLAY_TUNING_WU = getSharedTuningWu();
const ABILITY_CATALOG = GAMEPLAY_TUNING_WU.abilityCatalog || {};
const DEFAULT_ABILITY_LOADOUT = GAMEPLAY_TUNING_WU.defaultAbilityLoadout || { slot1: 'choke', slot2: 'deadeye' };

const SHARED_PROTOCOL = getSharedProtocol();
const MSG_S2C = SHARED_PROTOCOL.msg.s2c;

function hookHeadPosition(state, now) {
  if (!state || !state.startPos || !state.endPos) return null;
  const startAt = Number(state.startedAt || 0);
  const hitAt = Math.max(startAt + 1, Number(state.hitAt || startAt + 1));
  const t = Math.max(0, Math.min(1, (Number(now || nowMs()) - startAt) / (hitAt - startAt)));
  return {
    x: state.startPos.x + ((state.endPos.x - state.startPos.x) * t),
    y: state.startPos.y + ((state.endPos.y - state.startPos.y) * t),
    z: state.startPos.z + ((state.endPos.z - state.startPos.z) * t)
  };
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
  let landed = 0;
  for (let i = 0; i < lockCount; i++) {
    const target = room.getEntityById(ids[i]);
    if (!room.canTargetEntity(target, player.id)) continue;
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
  const target = room.resolveLockedHostile(player, lockedTargetId, cfg.range || 24, cfg.minDot || 0.05);
  if (!target) return { ok: false };

  const endsAt = now + Math.round((cfg.duration || 1.6) * 1000);
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
  return { ok: true, kind: 'ability_choke', payload: { targetId: target.id } };
}

export function castDeadeye(room, player, cfg, _msg, now) {
  const maxTargets = Math.max(1, Math.round(cfg.maxTargets || 2));
  const picks = room.deadeyeCandidates(player, cfg.range || 70, cfg.minDot || 0.22, maxTargets);
  if (picks.length === 0) return { ok: false };
  player.deadeye = buildDeadeyeState(cfg, picks, now);
  player.deadeye.range = Number(cfg.range || 70);
  player.deadeye.minDot = Number(cfg.minDot || 0.22);
  return { ok: true, kind: 'ability_deadeye_start', payload: { targetCount: picks.length } };
}

export function castHook(room, player, cfg, _msg, now) {
  const forward = room.entityForward(player);
  const startPos = room.entityCorePosition(player);
  const range = Math.max(1, Number(cfg.range || 24));
  const endPos = {
    x: startPos.x + (forward.x * range),
    y: startPos.y + (forward.y * range),
    z: startPos.z + (forward.z * range)
  };
  const travelSpeed = Math.max(8, Number(cfg.travelSpeed || 26));
  const travelMs = Math.max(120, Math.round((range / travelSpeed) * 1000));
  player.hookState = {
    phase: 'travel',
    targetId: '',
    startPos,
    endPos,
    headPos: startPos,
    catchRadius: Number(cfg.catchRadius || 1.6),
    pullDistance: Number(cfg.pullDistance || 3.2),
    stunDuration: Number(cfg.stunDuration || 0.5),
    castDamage: Number(cfg.castDamage || 35),
    travelSpeed: Number(cfg.travelSpeed || 24),
    startedAt: now,
    hitAt: now + travelMs,
    endsAt: now + travelMs
  };
  return { ok: true, kind: 'ability_hook_start' };
}

export function castHeal(_room, player, cfg, _msg, now) {
  player.healState = {
    startedAt: now,
    endsAt: now + Math.round(Math.max(0.1, Number(cfg.duration || 0.85)) * 1000),
    healAmount: Math.max(1, Math.round(Number(cfg.healAmount || 150))),
    applied: false
  };
  return { ok: true, kind: 'ability_heal_start' };
}

export function castAbility(room, player, abilityId, cfg, msg, now) {
  if (abilityId === 'choke') return castChoke(room, player, cfg, msg, now);
  if (abilityId === 'hook') return castHook(room, player, cfg, msg, now);
  if (abilityId === 'heal') return castHeal(room, player, cfg, msg, now);
  if (abilityId === 'deadeye') return castDeadeye(room, player, cfg, msg, now);
  return { ok: false };
}

export function handleClassCast(room, player, msg, ws) {
  if (!player || !player.alive) return;
  if (room && typeof room.canEntityUseAbility === 'function' && !room.canEntityUseAbility(player)) {
    room.send(ws, { t: MSG_S2C.CLASS_CAST_REJECT, reason: 'action_locked', slot: Number(msg && msg.slot || 0), classId: 'abilities' });
    return;
  }
  const slot = Number(msg.slot || 0);
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

  const sharedCooldownUntil = Math.max(player.abilityCooldownUntil || 0, player.ultimateCooldownUntil || 0);
  if (now < sharedCooldownUntil) {
    room.send(ws, { t: MSG_S2C.CLASS_CAST_REJECT, reason: 'ability_cooldown' });
    return;
  }

  const result = castAbility(room, player, abilityId, cfg, msg, now);
  if (result.ok) {
    const cooldownUntil = now + Math.max(0, cfg.cooldownMs || 0);
    player.abilityCooldownUntil = cooldownUntil;
    player.ultimateCooldownUntil = cooldownUntil;
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
      const forward = room.entityForward(source);
      const targetDist = Math.max(1.5, Number(pull.pullDistance || 3.2));
      const desiredX = Math.max(room.boundsMin, Math.min(room.boundsMax, source.x + (forward.x * targetDist)));
      const desiredZ = Math.max(room.boundsMin, Math.min(room.boundsMax, source.z + (forward.z * targetDist)));
      const toX = desiredX - entity.x;
      const toZ = desiredZ - entity.z;
      const dist = Math.sqrt((toX * toX) + (toZ * toZ));
      const baseStep = Math.max(0.001, Number(pull.pullSpeed || 26)) * (1 / 20);
      const step = Math.min(dist, Math.max(baseStep * 0.45, dist * 0.24));
      if (dist <= 0.08) {
        entity.x = desiredX;
        entity.z = desiredZ;
        entity.hookPullState = null;
      } else {
        entity.x += (toX / dist) * step;
        entity.z += (toZ / dist) * step;
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

  if (entity.hookState) {
    const state = entity.hookState;
    if (state.phase === 'travel') {
      state.headPos = hookHeadPosition(state, now) || state.headPos || state.startPos;
      const target = closestHostileToHookPoint(room, entity, state.headPos, state.catchRadius);
      if (target) {
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
        room.pullEntityToward(entity, target, state.pullDistance || 3.2, state.travelSpeed || 24);
        state.phase = 'latched';
        state.targetId = target.id;
        state.headPos = room.entityAimTargetPosition(target);
        state.endsAt = now + 260;
      } else if (now >= (state.hitAt || 0)) {
        entity.hookState = null;
      }
    } else if (now >= (state.endsAt || 0)) {
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
      entity.healState = null;
    }
  }

  if (entity.deadeye) {
    const d = entity.deadeye;
    if (!d.queue || !d.queue.length) {
      entity.deadeye = null;
    } else {
      d.queue = d.queue.filter((targetId) => !!room.resolveLockedHostile(entity, targetId, d.range || 70, d.minDot || 0.22));
      d.lockIndex = Math.min(d.queue.length, Number(d.lockIndex || 0));
      if (!d.queue.length) {
        entity.deadeye = null;
        return;
      }
      const lockEveryMs = Math.max(1, Math.round(d.lockEveryMs || 420));
      while ((d.lockIndex || 0) < d.queue.length && now >= (d.nextLockAt || 0)) {
        d.lockIndex = Math.min(d.queue.length, (d.lockIndex || 0) + 1);
        d.nextLockAt = (d.nextLockAt || now) + lockEveryMs;
      }
      if ((d.lockIndex || 0) >= d.queue.length || now >= (d.endsAt || 0)) {
        fireDeadeyeLocks(room, entity);
      }
    }
  }
}
