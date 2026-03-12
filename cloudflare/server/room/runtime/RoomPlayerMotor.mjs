export function buildSpawnAvoidPoints(entity, entities) {
  const avoidPoints = [];
  const selfId = entity && entity.id ? entity.id : '';
  for (let i = 0; i < entities.length; i++) {
    const other = entities[i];
    if (!other || !other.alive || other.id === selfId) continue;
    avoidPoints.push({
      x: Number(other.x || 0),
      z: Number(other.z || 0)
    });
  }
  return avoidPoints;
}

export function applySpawnPoint(entity, spawn, terrainEyeYAt) {
  if (!entity || !spawn) return;
  entity.x = Number(spawn.x || 0);
  entity.z = Number(spawn.z || 0);
  entity.y = terrainEyeYAt(entity.x, entity.z);
}

export function applySpawnShield(entity, now, spawnShieldMs) {
  if (!entity) return;
  entity.spawnShieldUntil = Number(now || 0) + Math.max(0, Number(spawnShieldMs || 0));
}

export function spawnEntityRandomly(options = {}) {
  const entity = options.entity;
  const chooseSpawnPoint = options.chooseSpawnPoint;
  const terrainEyeYAt = options.terrainEyeYAt;
  if (!entity || typeof chooseSpawnPoint !== 'function' || typeof terrainEyeYAt !== 'function') return null;
  const spawn = chooseSpawnPoint(entity);
  applySpawnPoint(entity, spawn, terrainEyeYAt);
  entity.plannedSpawnPoint = null;
  return spawn;
}

export function planEntityRespawn(options = {}) {
  const entity = options.entity;
  const chooseSpawnPoint = options.chooseSpawnPoint;
  if (!entity || typeof chooseSpawnPoint !== 'function') return null;
  const spawn = chooseSpawnPoint(entity);
  entity.plannedSpawnPoint = {
    x: Number(spawn.x || 0),
    z: Number(spawn.z || 0)
  };
  return entity.plannedSpawnPoint;
}

export function buildPlayerEntity(options = {}) {
  const chooseSpawnPoint = options.chooseSpawnPoint;
  const terrainEyeYAt = options.terrainEyeYAt;
  const now = Number(options.now || 0);
  const preset = options.preset || { armorMax: 90, wallhackRadius: 90 };

  const entity = {
    id: String(options.userId || ''),
    kind: 'player',
    username: String(options.username || 'player'),
    classId: String(options.classId || 'ffa'),
    x: 0,
    y: Number(options.eyeHeight || 1.6),
    z: 0,
    yaw: 0,
    pitch: 0,
    hp: Number(options.maxHp || 500),
    hpMax: Number(options.maxHp || 500),
    armor: Number(preset.armorMax || 0),
    armorMax: Number(preset.armorMax || 0),
    wallhackRadius: Number(preset.wallhackRadius || 0),
    alive: true,
    respawnAt: 0,
    plannedSpawnPoint: null,
    spawnShieldUntil: 0,
    lastDamageAt: 0,
    seq: 0,
    lastShotAt: {},
    weaponId: 'rifle',
    moveSpeedNorm: 0,
    sprinting: false,
    muzzleFlashUntil: 0,
    kills: 0,
    deaths: 0,
    progressScore: 0,
    teamId: '',
    disconnectedAt: 0,
    stunUntil: 0,
    slowUntil: 0,
    slowMultiplier: 1,
    streamHeat: 0,
    streamOverheatedUntil: 0
  };

  spawnEntityRandomly({
    entity,
    chooseSpawnPoint,
    terrainEyeYAt
  });
  applySpawnShield(entity, now, options.spawnShieldMs);
  return entity;
}

export function enforceTerrainFloor(options = {}) {
  const entity = options.entity;
  const terrainEyeYAt = options.terrainEyeYAt;
  if (!entity || typeof terrainEyeYAt !== 'function') return 0;
  const floorEyeY = terrainEyeYAt(entity.x, entity.z);
  if (!Number.isFinite(entity.y) || entity.y < floorEyeY) {
    entity.y = floorEyeY;
  }
  return floorEyeY;
}

export function applyInput(options = {}) {
  const entity = options.entity;
  const message = options.message || {};
  const terrainEyeYAt = options.terrainEyeYAt;
  const clamp = options.clamp;
  const now = Number(options.now || 0);
  const boundsMin = Number(options.boundsMin || 0);
  const boundsMax = Number(options.boundsMax || 0);

  if (!entity || !entity.alive || typeof terrainEyeYAt !== 'function' || typeof clamp !== 'function') return;

  const actionLocked = (entity.stunUntil || 0) > now;
  let slowMultiplier = 1;
  if (!actionLocked) {
    slowMultiplier = (entity.slowUntil || 0) > now
      ? clamp(Number(entity.slowMultiplier || 1), 0.1, 1)
      : 1;

    if (typeof message.x === 'number') {
      const targetX = clamp(message.x, boundsMin, boundsMax);
      entity.x = entity.x + ((targetX - entity.x) * slowMultiplier);
    }
    if (typeof message.z === 'number') {
      const targetZ = clamp(message.z, boundsMin, boundsMax);
      entity.z = entity.z + ((targetZ - entity.z) * slowMultiplier);
    }
    if (typeof message.y === 'number') {
      const floorEyeY = terrainEyeYAt(entity.x, entity.z);
      const targetY = clamp(message.y, floorEyeY, 16);
      entity.y = entity.y + ((targetY - entity.y) * slowMultiplier);
    }
  }

  if (!actionLocked && typeof message.yaw === 'number') entity.yaw = message.yaw;
  if (!actionLocked && typeof message.pitch === 'number') entity.pitch = clamp(message.pitch, -1.55, 1.55);
  if (typeof message.seq === 'number') entity.seq = Math.max(entity.seq, message.seq);

  if (!actionLocked) {
    if (typeof message.moveSpeedNorm === 'number') entity.moveSpeedNorm = clamp(message.moveSpeedNorm, 0, 1.4);
    if (typeof message.sprinting === 'boolean') entity.sprinting = message.sprinting;
    if (typeof message.sprint === 'boolean') entity.sprinting = message.sprint;
  } else {
    entity.moveSpeedNorm = 0;
    entity.sprinting = false;
  }

  entity.weaponId = 'rifle';
  enforceTerrainFloor({
    entity,
    terrainEyeYAt
  });
}

export function regenArmor(options = {}) {
  const entity = options.entity;
  const now = Number(options.now || 0);
  const dtSec = Math.max(0, Number(options.dtSec || 0));
  const regenDelayMs = Math.max(0, Number(options.regenDelayMs || 6000));
  const regenPerSec = Math.max(0, Number(options.regenPerSec || 12));

  if (!entity || !entity.alive || entity.armor >= entity.armorMax) return;
  if ((now - Number(entity.lastDamageAt || 0)) < regenDelayMs) return;
  entity.armor = Math.min(entity.armorMax, entity.armor + (regenPerSec * dtSec));
}

export function respawnIfNeeded(options = {}) {
  const entity = options.entity;
  const now = Number(options.now || 0);
  const chooseSpawnPoint = options.chooseSpawnPoint;
  const terrainEyeYAt = options.terrainEyeYAt;
  const spawnShieldMs = options.spawnShieldMs;

  if (!entity || entity.alive || Number(entity.respawnAt || 0) > now) return false;

  entity.hp = entity.hpMax;
  entity.armor = entity.armorMax;
  entity.alive = true;
  entity.respawnAt = 0;
  entity.lastDamageAt = 0;

  if (entity.plannedSpawnPoint) {
    applySpawnPoint(entity, entity.plannedSpawnPoint, terrainEyeYAt);
    entity.plannedSpawnPoint = null;
  } else {
    spawnEntityRandomly({
      entity,
      chooseSpawnPoint,
      terrainEyeYAt
    });
  }

  applySpawnShield(entity, now, spawnShieldMs);
  entity.lastShotAt = {};
  entity.muzzleFlashUntil = 0;
  entity.moveSpeedNorm = 0;
  entity.sprinting = false;
  entity.stunUntil = 0;
  entity.slowUntil = 0;
  entity.slowMultiplier = 1;
  return true;
}
