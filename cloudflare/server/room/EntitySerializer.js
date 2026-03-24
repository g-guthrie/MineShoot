import { gameplayTuning, getDefaultAbilityId, getDefaultWeaponLoadout } from '../../../shared/gameplay-tuning.js';
import { EYE_HEIGHT } from '../../../shared/entity-constants.js';
import { nowMs } from '../transport.js';

const THROWABLE_STATS = gameplayTuning.throwables;
const WEAPON_STATS = gameplayTuning.weaponStats || {};
const DEFAULT_ABILITY_ID = getDefaultAbilityId();
const DEFAULT_WEAPON_LOADOUT = getDefaultWeaponLoadout();

function cloneVec3(value) {
  if (!value || typeof value !== 'object') return null;
  const x = Number(value.x);
  const y = Number(value.y);
  const z = Number(value.z);
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) return null;
  return { x, y, z };
}

function buildAbilityFx(entity) {
  const hookPullEndsAt = Number(entity.hookPullState && entity.hookPullState.endsAt || 0);
  const justBeenHookedEndsAt = Number(entity.justBeenHookedState && entity.justBeenHookedState.endsAt || 0);
  const chokeVictim = entity.chokeVictimState
    ? {
        startedAt: Number(entity.chokeVictimState.startedAt || 0),
        endsAt: Number(entity.chokeVictimState.endsAt || 0),
        liftHeight: Number(entity.chokeVictimState.liftHeight || 1.0)
      }
    : null;
  const hookVisual = entity.hookState
    ? {
        phase: entity.hookState.phase || 'travel',
        targetId: entity.hookState.targetId || '',
        headPos: cloneVec3(entity.hookState.headPos || null),
        attachPos: cloneVec3(entity.hookState.attachPos || null),
        endsAt: Number(entity.hookState.endsAt || 0)
      }
    : null;
  const hookedUntil = Math.max(hookPullEndsAt, justBeenHookedEndsAt);
  const hookedStartedAt = hookPullEndsAt >= justBeenHookedEndsAt
    ? Number(entity.hookPullState && entity.hookPullState.startedAt || 0)
    : Number(entity.justBeenHookedState && entity.justBeenHookedState.startedAt || 0);
  const chokeCasterUntil = Number(entity.chokeState && entity.chokeState.endsAt || 0);
  return {
    chokeCasterUntil,
    chokeVictim,
    hookedStartedAt,
    hookedUntil,
    hookVisual
  };
}

export function toEntityState(entity, now = nowMs()) {
  const cooldownRemaining = Math.max(0, ((entity.abilityCooldownUntil || 0) - now) / 1000);
  const weaponAmmo = {};
  if (entity.weaponAmmo && typeof entity.weaponAmmo === 'object') {
    for (const weaponId in entity.weaponAmmo) {
      if (!Object.prototype.hasOwnProperty.call(entity.weaponAmmo, weaponId)) continue;
      const entry = entity.weaponAmmo[weaponId];
      if (!entry) continue;
      const stats = WEAPON_STATS[weaponId];
      const reloadUntil = Number(entry.reloadUntil || 0);
      const reloadCompleted = reloadUntil > 0 && reloadUntil <= now;
      const ammoInMag = reloadCompleted && stats && Number(stats.magazineSize || 0) > 0
        ? Math.max(0, Number(stats.magazineSize || 0))
        : Math.max(0, Number(entry.ammoInMag || 0));
      weaponAmmo[weaponId] = {
        ammoInMag,
        reloadRemaining: Math.max(0, (reloadUntil - now) / 1000),
        reloading: reloadUntil > now,
        reloadedFlashRemaining: Math.max(0, ((entry.reloadedFlashUntil || 0) - now) / 1000)
      };
    }
  }
  const throwables = {};
  const order = THROWABLE_STATS.order || [];
  for (let i = 0; i < order.length; i++) {
    const id = order[i];
    const inv = entity.throwables && entity.throwables[id];
    if (!inv) continue;
    throwables[id] = {
      charges: inv.charges,
      maxCharges: inv.maxCharges,
      cooldownRemaining: Number((inv.cooldownRemaining || 0).toFixed(3))
    };
  }
  return {
    id: entity.id,
    kind: entity.kind,
    username: entity.username,
    classId: entity.classId,
    x: Number(entity.x.toFixed(3)),
    y: Number((entity.y || EYE_HEIGHT).toFixed(3)),
    z: Number(entity.z.toFixed(3)),
    yaw: Number((entity.yaw || 0).toFixed(4)),
    pitch: Number((entity.pitch || 0).toFixed(4)),
    seq: Math.max(0, Number(
      entity.lastProcessedInputSeq != null
        ? entity.lastProcessedInputSeq
        : entity.seq || 0
    )),
    weaponId: entity.weaponId || 'rifle',
    moveSpeedNorm: Number((entity.moveSpeedNorm || 0).toFixed(3)),
    sprinting: !!entity.sprinting,
    movingForward: !!(entity.inputState && entity.inputState.forward),
    movingBackward: !!(entity.inputState && entity.inputState.backward),
    movingLeft: !!(entity.inputState && entity.inputState.left),
    movingRight: !!(entity.inputState && entity.inputState.right),
    velocityY: Number((entity.velocityY || 0).toFixed(4)),
    isGrounded: !!entity.isGrounded,
    jumpHoldTimer: Number((entity.jumpHoldTimer || 0).toFixed(4)),
    jumpHeldLast: !!entity.jumpHeldLast,
    hp: Number(entity.hp.toFixed(2)),
    hpMax: Number(entity.hpMax.toFixed(2)),
    armor: Number(entity.armor.toFixed(2)),
    armorMax: Number(entity.armorMax.toFixed(2)),
    kills: Math.max(0, Number(entity.kills || 0)),
    deaths: Math.max(0, Number(entity.deaths || 0)),
    progressScore: Number((entity.progressScore || 0).toFixed(3)),
    stocksRemaining: Math.max(0, Number(entity.stocksRemaining || 0)),
    maxStocks: Math.max(0, Number(entity.maxStocks || 0)),
    bonusLivesEarned: Math.max(0, Number(entity.bonusLivesEarned || 0)),
    extraLifeProgressPct: Number((entity.extraLifeProgressPct || 0).toFixed(2)),
    eliminated: !!entity.eliminated,
    teamId: entity.teamId || '',
    wallhackRadius: entity.wallhackRadius,
    alive: !!entity.alive,
    spawnShieldUntil: entity.spawnShieldUntil || 0,
    streamHeat: Number((entity.streamHeat || 0).toFixed(3)),
    streamOverheatedUntil: entity.streamOverheatedUntil || 0,
    muzzleFlashUntil: entity.muzzleFlashUntil || 0,
    weaponLoadout: Array.isArray(entity.weaponLoadout) && entity.weaponLoadout.length
      ? entity.weaponLoadout.slice(0, 2)
      : DEFAULT_WEAPON_LOADOUT.slice(),
    weaponAmmo,
    abilityId: entity.abilityId || DEFAULT_ABILITY_ID,
    cooldownRemaining,
    abilityCooldownRemaining: cooldownRemaining,
    weaponLockUntil: Number(entity.weaponLockUntil || 0),
    throwableLockUntil: Number(entity.throwableLockUntil || 0),
    abilityLockUntil: Number(entity.abilityLockUntil || 0),
    abilityFx: buildAbilityFx(entity),
    stunUntil: entity.stunUntil || 0,
    slowUntil: entity.slowUntil || 0,
    deadeyeState: entity.deadeye ? {
      lockCount: entity.deadeye.lockIndex || 0,
      maxLocks: entity.deadeye.maxLocks || (entity.deadeye.queue ? entity.deadeye.queue.length : 0),
      nextLockAt: entity.deadeye.nextLockAt || 0,
      lockEveryMs: entity.deadeye.lockEveryMs || 0,
      endsAt: entity.deadeye.endsAt || 0,
      targetIds: entity.deadeye.queue ? entity.deadeye.queue.slice(0) : []
    } : null,
    throwables,
    visibleWallhack: true
  };
}

export function toProjectileState(projectile) {
  return {
    id: projectile.id,
    type: projectile.type,
    ownerId: projectile.ownerId,
    clientThrowId: projectile.clientThrowId || '',
    x: Number(projectile.x.toFixed(3)),
    y: Number(projectile.y.toFixed(3)),
    z: Number(projectile.z.toFixed(3)),
    vx: Number(projectile.vx.toFixed(3)),
    vy: Number(projectile.vy.toFixed(3)),
    vz: Number(projectile.vz.toFixed(3)),
    age: Number(projectile.age.toFixed(3)),
    stickyUntil: Number(projectile.stickyUntil || 0),
    stuckToTargetId: projectile.stuckToTargetId || '',
    stuckOffsetX: Number(projectile.stuckOffsetX || 0),
    stuckOffsetY: Number(projectile.stuckOffsetY || 0),
    stuckOffsetZ: Number(projectile.stuckOffsetZ || 0)
  };
}

export function toFireZoneState(zone) {
  return {
    id: zone.id,
    ownerId: zone.ownerId,
    x: Number(zone.x.toFixed(3)),
    y: Number(zone.y.toFixed(3)),
    z: Number(zone.z.toFixed(3)),
    radius: Number(zone.radius.toFixed(3)),
    life: Number(zone.life.toFixed(3))
  };
}
