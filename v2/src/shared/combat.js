import { PLAYER, WEAPONS } from './constants.js';
import { clamp, lookToDirection, rayHitVerticalCylinder, seededNoise } from './math.js';

function weaponFor(id) {
  return WEAPONS[id] || WEAPONS.rifle;
}

function applySpread(dir, weapon, shotSeed) {
  const spread = Number(weapon.spreadRad || 0);
  if (spread <= 0) return dir;
  const a = (seededNoise(shotSeed) - 0.5) * spread;
  const b = (seededNoise(shotSeed + 101) - 0.5) * spread;
  return {
    x: dir.x + a,
    y: dir.y + b,
    z: dir.z
  };
}

function normalize3(v) {
  const len = Math.sqrt((v.x * v.x) + (v.y * v.y) + (v.z * v.z));
  if (len <= 0.000001) return { x: 0, y: 0, z: -1 };
  return { x: v.x / len, y: v.y / len, z: v.z / len };
}

export function resolveFire(room, shooter, message, nowMs) {
  if (!room || !shooter || !shooter.alive) return null;
  const weapon = weaponFor(message.weaponId || shooter.weaponId);
  if (nowMs - Number(shooter.lastFireAt || -Infinity) < weapon.fireIntervalMs) {
    return { type: 'shot_rejected', shooterId: shooter.id, reason: 'cooldown' };
  }
  shooter.weaponId = weapon.id;
  shooter.lastFireAt = nowMs;

  const pelletCount = Math.max(1, Math.floor(Number(weapon.pellets || 1)));
  const origin = {
    x: shooter.x,
    y: shooter.y - 0.08,
    z: shooter.z
  };
  const shotId = Math.max(1, Number(message.shotId || nowMs));
  const hits = [];

  for (let pellet = 0; pellet < pelletCount; pellet++) {
    const baseDir = lookToDirection(
      Number.isFinite(Number(message.yaw)) ? Number(message.yaw) : shooter.yaw,
      clamp(Number.isFinite(Number(message.pitch)) ? Number(message.pitch) : shooter.pitch, -1.45, 1.45)
    );
    const dir = normalize3(applySpread(baseDir, weapon, shotId + pellet));
    let best = null;
    for (const target of room.entities.values()) {
      if (!target || target.id === shooter.id || !target.alive) continue;
      const minY = Number(target.y || PLAYER.eyeHeight) - PLAYER.eyeHeight;
      const maxY = minY + PLAYER.height;
      const t = rayHitVerticalCylinder(origin, dir, target, PLAYER.radius, minY, maxY, weapon.range);
      if (t == null) continue;
      if (!best || t < best.t) best = { target, t };
    }
    if (!best) continue;
    const damage = Math.max(1, Number(weapon.damage || 1));
    best.target.health = Math.max(0, Number(best.target.health || 0) - damage);
    hits.push({
      targetId: best.target.id,
      damage,
      killed: best.target.health <= 0
    });
    if (best.target.health <= 0 && best.target.alive) {
      best.target.alive = false;
      best.target.deaths += 1;
      best.target.respawnAt = nowMs + PLAYER.respawnMs;
      shooter.kills += 1;
    }
  }

  return {
    type: 'shot',
    shooterId: shooter.id,
    weaponId: weapon.id,
    origin,
    yaw: Number(message.yaw || shooter.yaw),
    pitch: Number(message.pitch || shooter.pitch),
    hits
  };
}

