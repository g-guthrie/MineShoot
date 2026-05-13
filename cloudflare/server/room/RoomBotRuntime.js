import { PUBLIC_ROOM_SOFT_TARGET } from '../../../shared/matchmaking-config.js';

export const PUBLIC_BOT_FIXTURE_TYPE = 'public_bot';

const BOT_ID_PREFIX = 'public-bot-';
const BOT_NAMES = [
  'Quartz',
  'Mako',
  'Rook',
  'Vex',
  'Ivy',
  'Knox',
  'Juno',
  'Slate',
  'Rift',
  'Echo',
  'Nova',
  'Dash'
];
const BOT_LOADOUTS = [
  ['rifle', 'shotgun'],
  ['rifle', 'pistol'],
  ['shotgun', 'machinegun'],
  ['sniper', 'pistol'],
  ['rifle', 'shotgun'],
  ['machinegun', 'rifle']
];
const BOT_THROWABLES = ['frag', 'plasma', 'molotov', 'knife'];
const BOT_TARGET_RANGE = 82;
const BOT_CLOSE_RANGE = 15;
const BOT_IDEAL_RANGE = 27;
const BOT_THROW_MIN_RANGE = 12;
const BOT_THROW_MAX_RANGE = 34;
const BOT_PROFILES = [
  {
    role: 'boss',
    difficulty: 0.94,
    thinkMs: 82,
    fireCooldownScale: 0.84,
    fireJitter: 0.24,
    fireMinDot: 0.76,
    maxFireRange: 112,
    reactionMs: 65,
    aimSpreadScale: 0.52,
    targetStickiness: 18,
    woundedBias: 14,
    throwChance: 0.72,
    rollCloseChance: 0.82,
    rollFarChance: 0.28,
    retreatHealth: 0.42,
    idealRange: 31,
    closeRange: 17,
    finishPushHealth: 0.35
  },
  {
    role: 'aggressive',
    difficulty: 0.8,
    thinkMs: 118,
    fireCooldownScale: 1.02,
    fireJitter: 0.36,
    fireMinDot: 0.82,
    maxFireRange: 94,
    reactionMs: 90,
    aimSpreadScale: 0.88,
    targetStickiness: 10,
    woundedBias: 9,
    throwChance: 0.48,
    rollCloseChance: 0.48,
    rollFarChance: 0.14,
    retreatHealth: 0.3,
    idealRange: 25,
    closeRange: 14,
    finishPushHealth: 0.45
  },
  {
    role: 'balanced',
    difficulty: 0.72,
    thinkMs: 138,
    fireCooldownScale: 1.12,
    fireJitter: 0.42,
    fireMinDot: 0.85,
    maxFireRange: 88,
    reactionMs: 110,
    aimSpreadScale: 1.0,
    targetStickiness: 8,
    woundedBias: 7,
    throwChance: 0.38,
    rollCloseChance: 0.36,
    rollFarChance: 0.1,
    retreatHealth: 0.24,
    idealRange: BOT_IDEAL_RANGE,
    closeRange: BOT_CLOSE_RANGE,
    finishPushHealth: 0.42
  },
  {
    role: 'skirmisher',
    difficulty: 0.76,
    thinkMs: 124,
    fireCooldownScale: 1.08,
    fireJitter: 0.38,
    fireMinDot: 0.84,
    maxFireRange: 90,
    reactionMs: 100,
    aimSpreadScale: 0.95,
    targetStickiness: 9,
    woundedBias: 8,
    throwChance: 0.44,
    rollCloseChance: 0.62,
    rollFarChance: 0.18,
    retreatHealth: 0.34,
    idealRange: 29,
    closeRange: 16,
    finishPushHealth: 0.4
  }
];

function clamp(value, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

function finiteNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function distanceSq(a, b) {
  if (!a || !b) return Infinity;
  const dx = finiteNumber(a.x) - finiteNumber(b.x);
  const dy = finiteNumber(a.y) - finiteNumber(b.y);
  const dz = finiteNumber(a.z) - finiteNumber(b.z);
  return (dx * dx) + (dy * dy) + (dz * dz);
}

function normalizeVec3(vec, fallback = { x: 0, y: 0, z: -1 }) {
  const x = finiteNumber(vec && vec.x);
  const y = finiteNumber(vec && vec.y);
  const z = finiteNumber(vec && vec.z);
  const len = Math.sqrt((x * x) + (y * y) + (z * z));
  if (!(len > 0.000001)) return { x: fallback.x, y: fallback.y, z: fallback.z };
  return { x: x / len, y: y / len, z: z / len };
}

function dotVec3(a, b) {
  return (finiteNumber(a && a.x) * finiteNumber(b && b.x)) +
    (finiteNumber(a && a.y) * finiteNumber(b && b.y)) +
    (finiteNumber(a && a.z) * finiteNumber(b && b.z));
}

function forwardFromYawPitch(yaw, pitch) {
  const y = finiteNumber(yaw);
  const p = finiteNumber(pitch);
  return normalizeVec3({
    x: -Math.sin(y) * Math.cos(p),
    y: Math.sin(-p),
    z: -Math.cos(y) * Math.cos(p)
  });
}

function yawPitchFromDirection(direction) {
  const dir = normalizeVec3(direction);
  const horizontal = Math.sqrt((dir.x * dir.x) + (dir.z * dir.z));
  return {
    yaw: Math.atan2(-dir.x, -dir.z),
    pitch: Math.atan2(-dir.y, Math.max(0.000001, horizontal))
  };
}

function botIdForIndex(index) {
  return BOT_ID_PREFIX + String(Math.max(1, Number(index || 0) + 1)).padStart(2, '0');
}

function botNameForIndex(index) {
  const name = BOT_NAMES[index % BOT_NAMES.length] || String(index + 1);
  return index === 0 ? 'BOT BOSS ' + name : 'BOT ' + name;
}

function botIndexFromId(id) {
  const match = String(id || '').match(/^public-bot-(\d+)$/);
  return match ? Math.max(0, Number(match[1]) - 1) : 0;
}

function botProfileForIndex(index) {
  const n = Math.max(0, Math.floor(Number(index) || 0));
  if (n === 0) return BOT_PROFILES[0];
  const rotating = BOT_PROFILES.slice(1);
  return rotating[(n - 1) % rotating.length] || BOT_PROFILES[1] || BOT_PROFILES[0];
}

function applyBotProfile(bot, index) {
  const profile = botProfileForIndex(index);
  if (!bot || !profile) return profile;
  bot.botRole = profile.role;
  bot.botDifficulty = clamp(profile.difficulty, 0.55, 0.97);
  return profile;
}

function nowMs(room, deps) {
  if (deps && typeof deps.nowMs === 'function') return Number(deps.nowMs() || 0);
  if (room && typeof room.currentNowMs === 'function') return Number(room.currentNowMs() || 0);
  return Date.now();
}

function randomValue(deps) {
  return deps && typeof deps.random === 'function' ? Number(deps.random() || 0) : Math.random();
}

function isPublicRoomOpenForBots(room) {
  if (!room || typeof room.isPublicMatchRoom !== 'function' || !room.isPublicMatchRoom()) return false;
  if (room.matchState && room.matchState.ended) return false;
  return true;
}

function botLoadoutForIndex(index, deps = {}) {
  const selectable = Array.isArray(deps.selectableWeaponIds) && deps.selectableWeaponIds.length
    ? deps.selectableWeaponIds.map(String)
    : ['machinegun', 'shotgun', 'rifle', 'pistol', 'sniper'];
  const fallback = Array.isArray(deps.defaultWeaponLoadout) && deps.defaultWeaponLoadout.length
    ? deps.defaultWeaponLoadout.map(String)
    : ['machinegun', 'shotgun'];
  const preferred = BOT_LOADOUTS[index % BOT_LOADOUTS.length] || fallback;
  const out = [];
  for (let i = 0; i < preferred.length; i++) {
    const weaponId = String(preferred[i] || '');
    if (weaponId && selectable.indexOf(weaponId) >= 0 && out.indexOf(weaponId) < 0) out.push(weaponId);
    if (out.length >= 2) break;
  }
  for (let i = 0; i < fallback.length && out.length < 2; i++) {
    const weaponId = String(fallback[i] || '');
    if (weaponId && selectable.indexOf(weaponId) >= 0 && out.indexOf(weaponId) < 0) out.push(weaponId);
  }
  return out.length ? out : ['machinegun'];
}

function botThrowableForIndex(index, deps = {}) {
  const order = Array.isArray(deps.throwableIds) && deps.throwableIds.length
    ? deps.throwableIds.map(String)
    : BOT_THROWABLES;
  const preferred = BOT_THROWABLES[index % BOT_THROWABLES.length];
  return order.indexOf(preferred) >= 0 ? preferred : (order[0] || 'frag');
}

function createBotAi(index, now, deps = {}) {
  const jitter = Math.floor(randomValue(deps) * 500);
  return {
    seq: 0,
    targetId: '',
    nextThinkAt: now + jitter,
    nextFireAt: now + 350 + jitter,
    nextThrowAt: now + 2200 + jitter,
    nextRollAt: now + 1800 + jitter,
    nextWeaponSwitchAt: 0,
    strafeSign: index % 2 === 0 ? 1 : -1,
    strafeUntil: now + 900,
    wanderYaw: ((index * 0.79) % (Math.PI * 2)) - Math.PI,
    nextWanderAt: now + 600,
    stuckTicks: 0,
    forceJumpUntil: 0,
    lastMoveWanted: false,
    throwableId: botThrowableForIndex(index, deps)
  };
}

function ensureBotAi(bot, index, now, deps) {
  if (!bot.botAi || typeof bot.botAi !== 'object') {
    bot.botAi = createBotAi(index, now, deps);
  }
  if (!Number.isFinite(Number(bot.botAi.seq))) bot.botAi.seq = Math.max(0, Number(bot.seq || 0));
  if (!bot.botAi.throwableId) bot.botAi.throwableId = botThrowableForIndex(index, deps);
  return bot.botAi;
}

function applyBotLoadout(room, bot, index, deps) {
  const loadout = botLoadoutForIndex(index, deps);
  bot.weaponLoadout = loadout.slice();
  bot.weaponId = loadout[0];
  if (typeof room.createWeaponAmmoRuntime === 'function') {
    bot.weaponAmmo = room.createWeaponAmmoRuntime(loadout);
  }
  if (typeof room.createThrowableRuntime === 'function') {
    bot.throwables = room.createThrowableRuntime();
  }
}

function activePublicBots(room) {
  const bots = [];
  if (!room || !(room.players instanceof Map)) return bots;
  for (const player of room.players.values()) {
    if (!isPublicBotEntity(player)) continue;
    bots.push(player);
  }
  bots.sort((a, b) => {
    const ai = Number.isFinite(Number(a.publicBotIndex)) ? Number(a.publicBotIndex) : botIndexFromId(a.id);
    const bi = Number.isFinite(Number(b.publicBotIndex)) ? Number(b.publicBotIndex) : botIndexFromId(b.id);
    return ai - bi;
  });
  return bots;
}

function cleanupBotOwnedRuntime(room, ownerId) {
  if (!room || !ownerId) return;
  if (room.projectiles instanceof Map) {
    for (const [projectileId, projectile] of room.projectiles.entries()) {
      if (projectile && String(projectile.ownerId || '') === ownerId) room.projectiles.delete(projectileId);
    }
  }
  if (room.fireZones instanceof Map) {
    for (const [zoneId, zone] of room.fireZones.entries()) {
      if (zone && String(zone.ownerId || '') === ownerId) room.fireZones.delete(zoneId);
    }
  }
}

function removeBot(room, bot) {
  if (!room || !bot || !(room.players instanceof Map)) return false;
  cleanupBotOwnedRuntime(room, bot.id);
  room.players.delete(bot.id);
  if (room.activeSocketByUserId instanceof Map) room.activeSocketByUserId.delete(bot.id);
  return true;
}

function createPublicBot(room, index, deps) {
  const id = botIdForIndex(index);
  if (!room || !(room.players instanceof Map)) return null;
  if (room.players.has(id)) return room.players.get(id) || null;
  if (typeof room.buildPlayerEntity !== 'function') return null;

  const name = botNameForIndex(index);
  const bot = room.buildPlayerEntity(id, name, String(room.gameMode || 'ffa'), {
    actorId: id,
    actorName: name,
    fixtureType: PUBLIC_BOT_FIXTURE_TYPE
  });
  if (!bot) return null;
  bot.fixtureType = PUBLIC_BOT_FIXTURE_TYPE;
  bot.publicBotIndex = index;
  bot.disconnectedAt = 0;
  bot.matchEntryPending = false;
  bot.matchEntryStartedAt = 0;
  bot.matchEntryUntil = 0;
  applyBotProfile(bot, index);
  applyBotLoadout(room, bot, index, deps);
  bot.botAi = createBotAi(index, nowMs(room, deps), deps);
  if (typeof room.applyJoinBaseline === 'function') room.applyJoinBaseline(bot);
  room.players.set(id, bot);
  return bot;
}

function humanConnectedCount(room) {
  return typeof room.connectedHumanCount === 'function' ? Math.max(0, Number(room.connectedHumanCount() || 0)) : 0;
}

function activeConnectedHumanCount(room) {
  if (!room || !(room.players instanceof Map)) return 0;
  const ids = typeof room.connectedHumanIds === 'function' ? room.connectedHumanIds() : null;
  let count = 0;
  if (Array.isArray(ids) && ids.length > 0) {
    for (let i = 0; i < ids.length; i++) {
      const player = room.players.get(ids[i]);
      if (!player || isPublicBotEntity(player) || player.fixtureType === 'sim_player') continue;
      if (typeof room.isEntityMatchEntryPending === 'function' && room.isEntityMatchEntryPending(player)) continue;
      count += 1;
    }
    return count;
  }
  for (const player of room.players.values()) {
    if (!player || isPublicBotEntity(player) || player.fixtureType === 'sim_player') continue;
    if (typeof room.isEntityDisconnected === 'function' && room.isEntityDisconnected(player)) continue;
    if (typeof room.isEntityMatchEntryPending === 'function' && room.isEntityMatchEntryPending(player)) continue;
    count += 1;
  }
  return count;
}

export function isPublicBotEntity(entity) {
  return !!(entity && String(entity.fixtureType || '') === PUBLIC_BOT_FIXTURE_TYPE);
}

export function publicBotCount(room) {
  return activePublicBots(room).length;
}

export function publicParticipantCount(room) {
  return humanConnectedCount(room) + publicBotCount(room);
}

export function removePublicMatchBots(room) {
  const bots = activePublicBots(room);
  for (let i = 0; i < bots.length; i++) removeBot(room, bots[i]);
  return bots.length;
}

export function syncPublicMatchBots(room, deps = {}) {
  if (!room || !(room.players instanceof Map)) return 0;
  const now = nowMs(room, deps);
  const targetPlayers = Math.max(0, Number(deps.targetPlayers || PUBLIC_ROOM_SOFT_TARGET));
  const humanCount = humanConnectedCount(room);
  const desiredBotCount = isPublicRoomOpenForBots(room) && humanCount > 0
    ? Math.max(0, targetPlayers - humanCount)
    : 0;

  const bots = activePublicBots(room);
  let changed = 0;
  for (let i = bots.length - 1; i >= 0; i--) {
    const index = Number.isFinite(Number(bots[i].publicBotIndex)) ? Number(bots[i].publicBotIndex) : botIndexFromId(bots[i].id);
    if (index >= desiredBotCount && removeBot(room, bots[i])) changed += 1;
  }
  for (let i = 0; i < desiredBotCount; i++) {
    const id = botIdForIndex(i);
    let bot = room.players.get(id);
    if (!bot) {
      bot = createPublicBot(room, i, deps);
      if (bot) changed += 1;
    }
    if (!bot) continue;
    bot.fixtureType = PUBLIC_BOT_FIXTURE_TYPE;
    bot.publicBotIndex = i;
    bot.disconnectedAt = 0;
    applyBotProfile(bot, i);
    bot.botAi = ensureBotAi(bot, i, now, deps);
  }
  return changed;
}

function entityAimPosition(room, entity) {
  if (room && typeof room.entityAimTargetPosition === 'function') {
    return room.entityAimTargetPosition(entity);
  }
  return {
    x: finiteNumber(entity && entity.x),
    y: finiteNumber(entity && entity.y),
    z: finiteNumber(entity && entity.z)
  };
}

function isActiveTarget(room, bot, entity) {
  if (!entity || entity.id === bot.id) return false;
  if (entity.alive === false || entity.eliminated) return false;
  if (typeof room.isEntityDisconnected === 'function' && room.isEntityDisconnected(entity)) return false;
  if (typeof room.isEntityMatchEntryPending === 'function' && room.isEntityMatchEntryPending(entity)) return false;
  return typeof room.canTargetEntity === 'function' ? room.canTargetEntity(entity, bot.id) : true;
}

function entityHealthRatio(entity) {
  if (!entity) return 1;
  const max = Math.max(1, finiteNumber(entity.hpMax, finiteNumber(entity.maxHp, 100)));
  return clamp(finiteNumber(entity.hp, max) / max, 0, 1);
}

function lineOfSight(room, origin, targetPos, range) {
  if (!room || typeof room.hasWorldLineOfSight !== 'function') return true;
  return !!room.hasWorldLineOfSight(origin, targetPos, range);
}

function chooseBotTarget(room, bot, ai, profile) {
  const entities = typeof room.getAliveEntities === 'function'
    ? room.getAliveEntities()
    : Array.from(room.players && room.players.values ? room.players.values() : []);
  const origin = entityAimPosition(room, bot);
  const profileTargetRange = Math.max(
    BOT_TARGET_RANGE,
    finiteNumber(profile && profile.maxFireRange, BOT_TARGET_RANGE) + 8,
    finiteNumber(profile && profile.idealRange, BOT_IDEAL_RANGE) * 2
  );
  const botHealth = entityHealthRatio(bot);
  let best = null;
  let bestScore = Infinity;
  for (let i = 0; i < entities.length; i++) {
    const target = entities[i];
    if (!isActiveTarget(room, bot, target)) continue;
    const targetPos = entityAimPosition(room, target);
    const d2 = distanceSq(origin, targetPos);
    if (d2 > profileTargetRange * profileTargetRange) continue;
    const dist = Math.sqrt(d2);
    const visible = lineOfSight(room, origin, targetPos, dist);
    const targetId = String(target.id || '');
    const targetHealth = entityHealthRatio(target);
    let score = dist + (visible ? 0 : 35);
    if (targetId === String(ai.targetId || '')) score -= finiteNumber(profile && profile.targetStickiness, 8);
    score -= finiteNumber(profile && profile.woundedBias, 0) * (1 - targetHealth);
    if (botHealth < 0.35 && dist < finiteNumber(profile && profile.closeRange, BOT_CLOSE_RANGE) + 4 && targetHealth > 0.55) {
      score += 12;
    }
    if (score < bestScore) {
      bestScore = score;
      best = {
        entity: target,
        position: targetPos,
        distance: dist,
        visible,
        healthRatio: targetHealth,
        score
      };
    }
  }
  if (best) ai.targetId = String(best.entity.id || '');
  return best;
}

function moveIntentForTarget(bot, targetInfo, ai, profile, now) {
  const distance = targetInfo ? Number(targetInfo.distance || 0) : Infinity;
  const closeRange = finiteNumber(profile && profile.closeRange, BOT_CLOSE_RANGE);
  const idealRange = finiteNumber(profile && profile.idealRange, BOT_IDEAL_RANGE);
  const botHealth = entityHealthRatio(bot);
  const targetHealth = targetInfo ? finiteNumber(targetInfo.healthRatio, 1) : 1;
  const targetWeak = targetHealth <= finiteNumber(profile && profile.finishPushHealth, 0.4);
  const lowHealth = botHealth <= finiteNumber(profile && profile.retreatHealth, 0.25);
  const retreating = !!targetInfo && lowHealth && !targetWeak && distance < idealRange + 14;
  const tooClose = distance < closeRange;
  const backward = retreating || (tooClose && !targetWeak);
  const forward = !backward && (distance > idealRange || (targetWeak && distance > closeRange));
  return {
    forward,
    backward,
    left: ai.strafeSign < 0,
    right: ai.strafeSign > 0,
    jump: now < Number(ai.forceJumpUntil || 0),
    sprint: retreating || distance > (idealRange + 10) || (targetWeak && distance > closeRange + 2),
    adsActive: distance > 18 && !retreating
  };
}

function weaponForRange(bot, distance, deps, profile) {
  const loadout = Array.isArray(bot.weaponLoadout) && bot.weaponLoadout.length ? bot.weaponLoadout.map(String) : ['machinegun'];
  const closeRange = finiteNumber(profile && profile.closeRange, BOT_CLOSE_RANGE);
  if (distance < closeRange + 4 && loadout.indexOf('shotgun') >= 0) return 'shotgun';
  if (distance > 52 && loadout.indexOf('sniper') >= 0) return 'sniper';
  if (distance > 24 && loadout.indexOf('rifle') >= 0) return 'rifle';
  if (loadout.indexOf('machinegun') >= 0) return 'machinegun';
  return loadout[0];
}

function buildAim(room, bot, targetInfo, deps, profile) {
  const origin = typeof room.authoritativeHitscanOrigin === 'function'
    ? room.authoritativeHitscanOrigin(bot, 0, nowMs(room, deps))
    : entityAimPosition(room, bot);
  if (!targetInfo) {
    const dir = forwardFromYawPitch(bot.yaw, bot.pitch);
    return { origin, direction: dir, yaw: bot.yaw || 0, pitch: bot.pitch || 0, dotToTarget: 0 };
  }
  const toTarget = normalizeVec3({
    x: targetInfo.position.x - origin.x,
    y: targetInfo.position.y - origin.y,
    z: targetInfo.position.z - origin.z
  });
  const difficulty = clamp(finiteNumber(bot.botDifficulty, profile && profile.difficulty), 0.55, 0.97);
  const spreadScale = clamp(finiteNumber(profile && profile.aimSpreadScale, 1), 0.35, 1.5);
  const spread = (1 - difficulty) * spreadScale * clamp(0.012 + (targetInfo.distance * 0.00055), 0.012, 0.065);
  const missX = (randomValue(deps) - 0.5) * spread;
  const missY = (randomValue(deps) - 0.5) * spread;
  const direction = normalizeVec3({
    x: toTarget.x + missX,
    y: toTarget.y + missY,
    z: toTarget.z
  }, toTarget);
  const rotation = yawPitchFromDirection(direction);
  return {
    origin,
    direction,
    yaw: rotation.yaw,
    pitch: rotation.pitch,
    dotToTarget: dotVec3(direction, toTarget)
  };
}

function queueBotInput(room, bot, input, aim, dtSec) {
  const ai = bot.botAi || {};
  ai.seq = Math.max(Number(ai.seq || 0), Number(bot.lastReceivedInputSeq || 0), Number(bot.lastProcessedInputSeq || 0)) + 1;
  bot.botAi = ai;
  const msg = {
    inputMode: 'intent',
    seq: ai.seq,
    dtMs: Math.max(1, Math.round(Math.max(0.001, Number(dtSec || 0.016)) * 1000)),
    yaw: finiteNumber(aim && aim.yaw, bot.yaw || 0),
    pitch: finiteNumber(aim && aim.pitch, bot.pitch || 0),
    forward: !!input.forward,
    backward: !!input.backward,
    left: !!input.left,
    right: !!input.right,
    jump: !!input.jump,
    sprint: !!input.sprint,
    adsActive: !!input.adsActive
  };
  ai.lastMoveWanted = !!(msg.forward || msg.backward || msg.left || msg.right);
  if (typeof room.handleInput === 'function') room.handleInput(bot, msg);
  return msg;
}

function updateBotMobilityState(bot, ai, now, deps) {
  if (!bot || !ai) return;
  const x = finiteNumber(bot.x, 0);
  const z = finiteNumber(bot.z, 0);
  if (Number.isFinite(ai.lastX) && Number.isFinite(ai.lastZ) && ai.lastMoveWanted) {
    const dx = x - ai.lastX;
    const dz = z - ai.lastZ;
    const movedSq = (dx * dx) + (dz * dz);
    ai.stuckTicks = movedSq < 0.0064 ? Math.min(8, Number(ai.stuckTicks || 0) + 1) : Math.max(0, Number(ai.stuckTicks || 0) - 2);
    if (ai.stuckTicks >= 3) {
      ai.strafeSign = ai.strafeSign < 0 ? 1 : -1;
      ai.wanderYaw += (randomValue(deps) > 0.5 ? 0.95 : -0.95);
      ai.forceJumpUntil = now + 260;
      ai.nextRollAt = Math.min(Number(ai.nextRollAt || now), now);
      ai.stuckTicks = 1;
    }
  }
  ai.lastX = x;
  ai.lastZ = z;
}

function maybeSwitchWeapon(room, bot, weaponId, ai, now) {
  if (!weaponId || weaponId === bot.weaponId) return;
  if (now < Number(ai.nextWeaponSwitchAt || 0)) return;
  if (typeof room.handleEquipWeapon === 'function') room.handleEquipWeapon(bot, { weaponId });
  else bot.weaponId = weaponId;
  ai.nextWeaponSwitchAt = now + 450;
}

function maybeReload(room, bot, weaponId, now) {
  if (!weaponId || typeof room.syncWeaponAmmoState !== 'function') return false;
  const ammo = room.syncWeaponAmmoState(bot, weaponId, now);
  if (!ammo) return false;
  if (Number(ammo.reloadUntil || 0) > now) return true;
  if (Number(ammo.ammoInMag || 0) > 0) return false;
  if (typeof room.handleReload === 'function') room.handleReload(bot, { weaponId });
  return true;
}

function maybeFire(room, bot, weaponId, targetInfo, aim, ai, now, deps, profile) {
  if (!targetInfo || !targetInfo.visible) return false;
  if (targetInfo.distance > finiteNumber(profile && profile.maxFireRange, 92)) return false;
  if (aim.dotToTarget < finiteNumber(profile && profile.fireMinDot, 0.84)) return false;
  if (now < Number(ai.nextFireAt || 0)) return false;
  if (maybeReload(room, bot, weaponId, now)) return false;
  const stats = (deps.weaponStats && deps.weaponStats[weaponId]) || {};
  const cooldown = Math.max(120, Number(stats.cooldownMs || 380));
  const tokenSeq = Math.max(1, Number(ai.seq || 1));
  if (typeof room.handleFire === 'function') {
    room.handleFire(bot, {
      weaponId,
      shotToken: 'bot-' + bot.publicBotIndex + '-' + now + '-' + tokenSeq,
      aimOrigin: aim.origin,
      aimForward: aim.direction,
      adsActive: weaponId === 'sniper' || targetInfo.distance > 20,
      viewFovDeg: weaponId === 'sniper' ? 24 : 56,
      estimatedServerShotTime: now - finiteNumber(profile && profile.reactionMs, 95)
    });
  }
  const finishMultiplier = targetInfo.healthRatio <= finiteNumber(profile && profile.finishPushHealth, 0.4) ? 0.88 : 1;
  const cooldownScale = clamp(finiteNumber(profile && profile.fireCooldownScale, 1.05), 0.72, 1.45);
  const fireJitter = clamp(finiteNumber(profile && profile.fireJitter, 0.4), 0.1, 0.8);
  ai.nextFireAt = now + Math.round(cooldown * cooldownScale * finishMultiplier * (1 + (randomValue(deps) * fireJitter)));
  return true;
}

function buildThrowIntent(room, bot, targetInfo, deps) {
  const fallback = typeof room.buildDefaultThrowOriginAndDirection === 'function'
    ? room.buildDefaultThrowOriginAndDirection(bot)
    : { origin: entityAimPosition(room, bot), direction: forwardFromYawPitch(bot.yaw, bot.pitch) };
  if (!targetInfo) return fallback;
  const origin = fallback.origin;
  const target = targetInfo.position;
  const horizontal = Math.sqrt(
    Math.pow(finiteNumber(target.x) - finiteNumber(origin.x), 2) +
    Math.pow(finiteNumber(target.z) - finiteNumber(origin.z), 2)
  );
  const lift = clamp(0.12 + (horizontal * 0.012), 0.12, 0.55);
  return {
    origin,
    direction: normalizeVec3({
      x: finiteNumber(target.x) - finiteNumber(origin.x),
      y: finiteNumber(target.y) + lift - finiteNumber(origin.y),
      z: finiteNumber(target.z) - finiteNumber(origin.z)
    }, fallback.direction),
    aimPoint: {
      x: finiteNumber(target.x),
      y: finiteNumber(target.y),
      z: finiteNumber(target.z)
    }
  };
}

function maybeThrow(room, bot, targetInfo, ai, now, deps, profile) {
  if (!targetInfo || !targetInfo.visible) return false;
  if (targetInfo.distance < BOT_THROW_MIN_RANGE || targetInfo.distance > BOT_THROW_MAX_RANGE) return false;
  if (now < Number(ai.nextThrowAt || 0)) return false;
  if (randomValue(deps) > finiteNumber(profile && profile.throwChance, 0.42)) {
    ai.nextThrowAt = now + 1300;
    return false;
  }
  const throwableId = ai.throwableId || botThrowableForIndex(bot.publicBotIndex || 0, deps);
  if (typeof room.handleThrow === 'function') {
    room.handleThrow(bot, {
      throwableId,
      clientThrowId: 'bot-throw-' + bot.publicBotIndex + '-' + now,
      throwIntent: buildThrowIntent(room, bot, targetInfo, deps)
    }, null);
  }
  ai.throwableId = botThrowableForIndex((bot.publicBotIndex || 0) + Math.floor(now / 7000), deps);
  const isBoss = String(profile && profile.role || '') === 'boss';
  ai.nextThrowAt = now + (isBoss ? 3300 : 4600) + Math.round(randomValue(deps) * (isBoss ? 2100 : 2800));
  return true;
}

function maybeRoll(room, bot, targetInfo, ai, now, deps, profile) {
  if (!targetInfo || !targetInfo.visible) return false;
  if (now < Number(ai.nextRollAt || 0)) return false;
  const closeRange = finiteNumber(profile && profile.closeRange, BOT_CLOSE_RANGE);
  const closeChance = finiteNumber(profile && profile.rollCloseChance, 0.36);
  const farChance = finiteNumber(profile && profile.rollFarChance, 0.12);
  const chance = targetInfo.distance <= closeRange + 8
    ? closeChance
    : (entityHealthRatio(bot) < finiteNumber(profile && profile.retreatHealth, 0.25) ? Math.max(farChance, 0.3) : farChance);
  if (randomValue(deps) > chance) return false;
  const lateral = ai.strafeSign < 0 ? 'movingLeft' : 'movingRight';
  const rollInput = {
    movingForward: targetInfo.distance > closeRange,
    movingBackward: targetInfo.distance <= closeRange || entityHealthRatio(bot) < finiteNumber(profile && profile.retreatHealth, 0.25),
    movingLeft: false,
    movingRight: false
  };
  rollInput[lateral] = true;
  if (typeof room.handleRoll === 'function') room.handleRoll(bot, rollInput);
  ai.nextRollAt = now + 3100 + Math.round(randomValue(deps) * 2400);
  return true;
}

function tickWander(room, bot, ai, now, dtSec, deps) {
  if (now >= Number(ai.nextWanderAt || 0)) {
    ai.wanderYaw += (randomValue(deps) - 0.5) * 1.6;
    ai.nextWanderAt = now + 800 + Math.round(randomValue(deps) * 1100);
  }
  const aim = {
    yaw: ai.wanderYaw,
    pitch: 0,
    direction: forwardFromYawPitch(ai.wanderYaw, 0),
    origin: entityAimPosition(room, bot),
    dotToTarget: 0
  };
  queueBotInput(room, bot, {
    forward: true,
    backward: false,
    left: ai.strafeSign < 0,
    right: ai.strafeSign > 0,
    jump: false,
    sprint: true,
    adsActive: false
  }, aim, dtSec);
}

function tickOneBot(room, bot, dtSec, deps) {
  if (!bot || !bot.alive || bot.eliminated) return;
  if (typeof room.isEntityMatchEntryPending === 'function' && room.isEntityMatchEntryPending(bot)) return;
  const now = nowMs(room, deps);
  const index = Number.isFinite(Number(bot.publicBotIndex)) ? Number(bot.publicBotIndex) : botIndexFromId(bot.id);
  const profile = applyBotProfile(bot, index);
  const ai = ensureBotAi(bot, index, now, deps);
  updateBotMobilityState(bot, ai, now, deps);
  if (now >= Number(ai.strafeUntil || 0)) {
    ai.strafeSign = randomValue(deps) > 0.5 ? 1 : -1;
    ai.strafeUntil = now + 850 + Math.round(randomValue(deps) * 1300);
  }
  if (now < Number(ai.nextThinkAt || 0)) {
    return;
  }
  const thinkMs = Math.max(60, finiteNumber(profile && profile.thinkMs, 140));
  ai.nextThinkAt = now + thinkMs + Math.round(randomValue(deps) * Math.max(24, thinkMs * 0.35));

  const targetInfo = chooseBotTarget(room, bot, ai, profile);
  if (!targetInfo) {
    tickWander(room, bot, ai, now, dtSec, deps);
    return;
  }

  const weaponId = weaponForRange(bot, targetInfo.distance, deps, profile);
  maybeSwitchWeapon(room, bot, weaponId, ai, now);
  const aim = buildAim(room, bot, targetInfo, deps, profile);
  const input = moveIntentForTarget(bot, targetInfo, ai, profile, now);
  queueBotInput(room, bot, input, aim, dtSec);
  maybeFire(room, bot, weaponId, targetInfo, aim, ai, now, deps, profile);
  maybeThrow(room, bot, targetInfo, ai, now, deps, profile);
  maybeRoll(room, bot, targetInfo, ai, now, deps, profile);
}

export function tickPublicMatchBots(room, dtSec, deps = {}) {
  if (!isPublicRoomOpenForBots(room)) return 0;
  syncPublicMatchBots(room, deps);
  const bots = activePublicBots(room);
  if (activeConnectedHumanCount(room) <= 0) return bots.length;
  for (let i = 0; i < bots.length; i++) {
    tickOneBot(room, bots[i], dtSec, deps);
  }
  return bots.length;
}
