import { getSharedTuningWu } from '../../lib/shared-tuning.js';
import { nowMs, clamp } from '../transport.js';
import { tickClassAbilityState } from './AbilityService.js';

const GAMEPLAY_TUNING_WU = getSharedTuningWu();
const THROWABLE_STATS = GAMEPLAY_TUNING_WU.throwables;
const DEFAULT_ABILITY_LOADOUT = GAMEPLAY_TUNING_WU.defaultAbilityLoadout || { slot1: 'choke', slot2: 'deadeye' };
const CLASS_PRESETS = GAMEPLAY_TUNING_WU.classPresets;

const MAX_HP = 500;
const THROWABLE_BOT_THROW_COOLDOWN_S = 2.8;

function classPreset(classId) {
  return CLASS_PRESETS[classId] || CLASS_PRESETS.abilities;
}

export function createBot(room, index) {
  const id = `bot-${index + 1}`;
  const classId = 'abilities';
  const preset = classPreset(classId);
  return {
    id,
    kind: 'bot',
    username: `BOT_${index + 1}`,
    classId,
    abilityLoadout: { slot1: DEFAULT_ABILITY_LOADOUT.slot1, slot2: DEFAULT_ABILITY_LOADOUT.slot2 },
    x: 10 + Math.random() * 90,
    y: 1.6,
    z: 10 + Math.random() * 90,
    yaw: Math.random() * Math.PI * 2,
    pitch: 0,
    hp: MAX_HP,
    hpMax: MAX_HP,
    armor: preset.armorMax,
    armorMax: preset.armorMax,
    wallhackRadius: preset.wallhackRadius,
    alive: true,
    respawnAt: 0,
    lastDamageAt: 0,
    weaponId: 'rifle',
    lastShotAt: {},
    shotBurstState: {},
    moveSpeedNorm: 0,
    sprinting: false,
    streamHeat: 0,
    streamOverheatedUntil: 0,
    muzzleFlashUntil: 0,
    throwables: room.createThrowableRuntime(),
    lastThrowAt: 0,
    abilityCooldownUntil: 0,
    ultimateCooldownUntil: 0,
    stunUntil: 0,
    slowUntil: 0,
    slowMultiplier: 1,
    deadeye: null,
    chokeState: null,
    aiDirX: Math.cos(Math.random() * Math.PI * 2),
    aiDirZ: Math.sin(Math.random() * Math.PI * 2),
    aiSpeed: 2.2,
    aiTurnTimer: 1 + Math.random() * 3
  };
}

export function ensureBots(room) {
  const desired = Math.max(0, Number(room.env.BOT_COUNT || '6'));
  for (let i = 0; i < desired; i++) {
    const id = `bot-${i + 1}`;
    if (room.bots.has(id)) continue;
    room.bots.set(id, createBot(room, i));
  }
}

export function tickBots(room, dtSec) {
  const players = Array.from(room.players.values()).filter((p) => p.alive);
  for (const bot of room.bots.values()) {
    room.respawnIfNeeded(bot);
    if (!bot.alive) continue;
    const now = nowMs();

    bot.aiTurnTimer -= dtSec;
    if (bot.aiTurnTimer <= 0) {
      bot.aiTurnTimer = 1 + Math.random() * 3;
      const angle = Math.random() * Math.PI * 2;
      bot.aiDirX = Math.cos(angle);
      bot.aiDirZ = Math.sin(angle);
      bot.aiSpeed = 1.8 + Math.random() * 1.2;
    }

    if (players.length > 0 && Math.random() < 0.015) {
      const target = players[Math.floor(Math.random() * players.length)];
      const dx = target.x - bot.x;
      const dz = target.z - bot.z;
      const len = Math.sqrt(dx * dx + dz * dz) || 1;
      bot.aiDirX = dx / len;
      bot.aiDirZ = dz / len;
    }

    const stunned = now < (bot.stunUntil || 0);
    if (stunned) {
      bot.moveSpeedNorm = 0;
      bot.sprinting = false;
    } else {
      const slowMult = now < (bot.slowUntil || 0)
        ? clamp(Number(bot.slowMultiplier || 1), 0.1, 1)
        : 1;
      bot.x = clamp(bot.x + bot.aiDirX * bot.aiSpeed * slowMult * dtSec, room.boundsMin, room.boundsMax);
      bot.z = clamp(bot.z + bot.aiDirZ * bot.aiSpeed * slowMult * dtSec, room.boundsMin, room.boundsMax);
      bot.yaw = Math.atan2(bot.aiDirX, bot.aiDirZ);
      bot.pitch = 0;
      bot.moveSpeedNorm = clamp((bot.aiSpeed * slowMult) / 3.2, 0, 1.4);
      bot.sprinting = (bot.aiSpeed * slowMult) > 2.5;
    }

    room.regenArmor(bot, dtSec);
    room.tickStreamState(bot, dtSec);
    room.tickThrowableRegen(bot, dtSec);
    tickClassAbilityState(room, bot);

    if ((nowMs() - (bot.lastThrowAt || 0)) > (THROWABLE_BOT_THROW_COOLDOWN_S * 1000) && players.length > 0 && Math.random() < 0.02) {
      const throwableId = THROWABLE_STATS.order[Math.floor(Math.random() * THROWABLE_STATS.order.length)];
      room.handleThrow(bot, { throwableId, clientThrowId: '' }, null);
    }
  }
}
