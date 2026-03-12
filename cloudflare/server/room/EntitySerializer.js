import { getSharedTuningWu } from '../../lib/shared-tuning.js';

const GAMEPLAY_TUNING_WU = getSharedTuningWu();
const THROWABLE_STATS = GAMEPLAY_TUNING_WU.throwables;

export function toEntityState(entity) {
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
    y: Number((entity.y || 1.6).toFixed(3)),
    z: Number(entity.z.toFixed(3)),
    yaw: Number((entity.yaw || 0).toFixed(4)),
    pitch: Number((entity.pitch || 0).toFixed(4)),
    weaponId: entity.weaponId || 'rifle',
    moveSpeedNorm: Number((entity.moveSpeedNorm || 0).toFixed(3)),
    sprinting: !!entity.sprinting,
    hp: Number(entity.hp.toFixed(2)),
    hpMax: Number(entity.hpMax.toFixed(2)),
    armor: Number(entity.armor.toFixed(2)),
    armorMax: Number(entity.armorMax.toFixed(2)),
    kills: Math.max(0, Number(entity.kills || 0)),
    deaths: Math.max(0, Number(entity.deaths || 0)),
    progressScore: Number((entity.progressScore || 0).toFixed(3)),
    teamId: entity.teamId || '',
    wallhackRadius: entity.wallhackRadius,
    alive: !!entity.alive,
    spawnShieldUntil: entity.spawnShieldUntil || 0,
    streamHeat: Number((entity.streamHeat || 0).toFixed(3)),
    streamOverheatedUntil: entity.streamOverheatedUntil || 0,
    muzzleFlashUntil: entity.muzzleFlashUntil || 0,
    stunUntil: entity.stunUntil || 0,
    slowUntil: entity.slowUntil || 0,
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
    age: Number(projectile.age.toFixed(3))
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
