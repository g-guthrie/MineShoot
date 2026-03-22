import {
  applyWeaponFalloff,
  applyDamageFromSource,
  broadcastDamageEvent,
  broadcastDeathRespawn
} from '../../CombatService.js';
import {
  findLagCompensatedHit,
  isAimPlausible,
  resolveShotServerTime
} from '../lag-compensation.mjs';
import { resolveRifleShot } from '../../../../../shared/rifle-shot.js';

export function buildShotResult(runtime, message, accepted, reason, extra = {}) {
  return {
    t: runtime.MSG_S2C.SHOT_RESULT,
    shotId: String(message && message.shotId || ''),
    accepted: !!accepted,
    reason: String(reason || (accepted ? 'accepted' : 'rejected')),
    targetId: String(extra.targetId || ''),
    hitType: String(extra.hitType || ''),
    killed: !!extra.killed,
    damage: Math.max(0, Number(extra.damage || 0)),
    serverTime: runtime.nowMs()
  };
}

export function handleFire(runtime, player, message, options = {}) {
  if (!player || !player.alive) return buildShotResult(runtime, message, false, 'shooter_dead');
  if (runtime.isEntityActionLocked(player)) return buildShotResult(runtime, message, false, 'action_locked');

  const weaponId = 'rifle';
  const stats = options.weaponStats && options.weaponStats[weaponId];
  if (!stats) return buildShotResult(runtime, message, false, 'weapon_unavailable');

  const now = runtime.nowMs();
  const previousShotAt = player.lastShotAt[weaponId] || 0;
  if ((now - previousShotAt) < stats.cooldownMs) return buildShotResult(runtime, message, false, 'cooldown');
  player.lastShotAt[weaponId] = now;
  player.weaponId = weaponId;
  player.muzzleFlashUntil = now + Math.max(0, Number(options.muzzleFlashHoldMs || 0));

  const shotToken = String(message.shotToken || '');
  const shotId = String(message.shotId || '');
  const rifleShot = resolveRifleShot({
    shotId,
    weaponId,
    adsActive: !!(message && message.adsActive),
    baseYaw: Number.isFinite(Number(message && message.baseYaw)) ? Number(message.baseYaw) : Number(player.yaw || 0),
    basePitch: Number.isFinite(Number(message && message.basePitch)) ? Number(message.basePitch) : Number(player.pitch || 0)
  });
  const aimYaw = rifleShot.yaw;
  const aimPitch = rifleShot.pitch;
  const shotServerTime = resolveShotServerTime(now, message && message.shotServerTime);
  if (!isAimPlausible(player, aimYaw, aimPitch, 0.82)) {
    return buildShotResult(runtime, message, false, 'implausible_aim');
  }
  let effectiveMaxRange = Number(rifleShot.maxRange || stats.maxRange || 0);
  if (stats.infiniteRange) effectiveMaxRange = Infinity;

  const hit = findLagCompensatedHit({
    shooter: player,
    entities: Array.from(runtime.players.values()),
    shotServerTime,
    maxDistance: effectiveMaxRange,
    aimYaw,
    aimPitch,
    colliders: runtime.worldColliders
  });
  if (!hit || !hit.entity) {
    return buildShotResult(runtime, message, false, hit && hit.reason ? hit.reason : 'rewind_miss');
  }

  const target = hit.entity;
  const hitType = hit.hitType === 'head' ? 'head' : 'body';
  const distance = hit.distance;

  let damage = hitType === 'head' ? stats.headDamage : stats.bodyDamage;
  damage = applyWeaponFalloff(weaponId, damage, distance);
  const out = applyDamageFromSource(player, target, damage, {
    hitType,
    weaponId,
    sourceKind: 'weapon',
    armorBufferMode: String(stats.armorBufferMode || 'normal')
  });
  if (!out) return buildShotResult(runtime, message, false, 'damage_rejected');

  runtime.recordEntityHistory(player, now);
  runtime.recordEntityHistory(target, now);
  broadcastDamageEvent(runtime, player.id, target, out, hitType, weaponId, shotToken, shotId);
  if (out.killed) {
    broadcastDeathRespawn(runtime, target);
  }
  return buildShotResult(runtime, message, true, 'accepted', {
    targetId: target.id,
    hitType,
    killed: !!out.killed,
    damage: out.damageApplied || 0
  });
}
