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
    if (!target || !target.alive || target.id === player.id) continue;
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
  if (!target || !target.alive || target.id === owner.id) return;
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
  let target = room.resolveLockedHostile(player, lockedTargetId, cfg.range || 24, cfg.minDot || 0.05);
  if (!target) {
    target = room.closestHostileInRange(player, cfg.range || 24, cfg.minDot || 0.05);
  }
  if (!target) return { ok: false };

  const castOut = applyDamageFromSource(player, target, cfg.castDamage || 95, {
    hitType: 'body',
    sourceKind: 'ability',
    applyOutgoing: false
  });
  if (castOut) {
    broadcastDamageEvent(room, player.id, target, castOut, 'body');
    if (castOut.killed) {
      broadcastDeathRespawn(room, target);
    }
  }
  room.applyTimedStun(target, cfg.duration || 1.6);
  player.chokeState = {
    targetId: target.id,
    endsAt: now + Math.round((cfg.duration || 1.6) * 1000),
    nextTickAt: now + Math.round((cfg.tickRate || 0.25) * 1000),
    tickRateMs: Math.round((cfg.tickRate || 0.25) * 1000),
    dotPerTick: Math.max(0, Math.round(cfg.dotPerTick || 0)),
    liftHeight: cfg.liftHeight || 1.0
  };
  return { ok: true, kind: 'ability_choke', payload: { targetId: target.id } };
}

export function castDeadeye(room, player, cfg, _msg, now) {
  const maxTargets = Math.max(1, Math.round(cfg.maxTargets || 3));
  const picks = room.deadeyeCandidates(player, cfg.range || 80, cfg.minDot || 0.18, maxTargets);
  if (picks.length === 0) return { ok: false };
  player.deadeye = buildDeadeyeState(cfg, picks, now);
  return { ok: true, kind: 'ability_deadeye_start', payload: { targetCount: picks.length } };
}

export function castAbility(room, player, abilityId, cfg, msg, now) {
  if (abilityId === 'choke') return castChoke(room, player, cfg, msg, now);
  if (abilityId === 'deadeye') return castDeadeye(room, player, cfg, msg, now);
  return { ok: false };
}

export function handleClassCast(room, player, msg, ws) {
  if (!player || !player.alive) return;
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

  const cooldownKey = slot === 1 ? 'abilityCooldownUntil' : 'ultimateCooldownUntil';
  if (now < (player[cooldownKey] || 0)) {
    room.send(ws, { t: MSG_S2C.CLASS_CAST_REJECT, reason: slot === 1 ? 'ability_cooldown' : 'ultimate_cooldown' });
    return;
  }

  const result = castAbility(room, player, abilityId, cfg, msg, now);
  if (result.ok) {
    player[cooldownKey] = now + Math.max(0, cfg.cooldownMs || 0);
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

  if (entity.deadeye) {
    const d = entity.deadeye;
    if (!d.queue || !d.queue.length) {
      entity.deadeye = null;
    } else {
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
