import { gameplayTuning } from '../../../shared/gameplay-tuning.js';
import { isBlockedAt } from '../../../shared/authoritative-movement.js';
import { nowMs, clamp } from '../transport.js';
import { createBotEntity } from './EntityLifecycle.js';

const THROWABLE_STATS = gameplayTuning.throwables;

const THROWABLE_BOT_THROW_COOLDOWN_S = 2.8;

export function createBot(room, index) {
  return createBotEntity(index, {
    eyeHeight: 1.6,
    createThrowableRuntime: () => room.createThrowableRuntime()
  });
}

export function ensureBots(room) {
  const desired = room && typeof room.desiredBotCount === 'function'
    ? Math.max(0, Number(room.desiredBotCount() || 0))
    : Math.max(0, Number(room.env.BOT_COUNT || '6'));

  const toRemove = [];
  for (const id of room.bots.keys()) {
    const match = /^bot-(\d+)$/.exec(String(id || ''));
    if (!match) continue;
    const idx = Math.max(0, Number(match[1]) || 0);
    if (idx > desired) toRemove.push(id);
  }
  for (let i = 0; i < toRemove.length; i++) {
    room.bots.delete(toRemove[i]);
  }

  for (let i = 0; i < desired; i++) {
    const id = `bot-${i + 1}`;
    if (room.bots.has(id)) continue;
    const bot = createBot(room, i);
    room.bots.set(id, bot);
    if (room && typeof room.seedEntityPoseHistory === 'function') {
      room.seedEntityPoseHistory(bot);
    }
  }
}

export function tickBots(room, dtSec) {
  const players = Array.from(room.players.values()).filter((p) => room.canTargetEntity(p));
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
      const colliders = room && typeof room.worldCollidables === 'function' ? room.worldCollidables() : [];
      const feetY = Number(bot.y || 1.6) - 1.6;
      const nextX = clamp(bot.x + bot.aiDirX * bot.aiSpeed * slowMult * dtSec, room.boundsMin, room.boundsMax);
      const nextZ = clamp(bot.z + bot.aiDirZ * bot.aiSpeed * slowMult * dtSec, room.boundsMin, room.boundsMax);
      var moved = false;

      if (!isBlockedAt(nextX, nextZ, feetY, colliders)) {
        bot.x = nextX;
        bot.z = nextZ;
        moved = true;
      } else {
        if (nextX !== bot.x && !isBlockedAt(nextX, bot.z, feetY, colliders)) {
          bot.x = nextX;
          moved = true;
        }
        if (nextZ !== bot.z && !isBlockedAt(bot.x, nextZ, feetY, colliders)) {
          bot.z = nextZ;
          moved = true;
        }
      }
      if (!moved) {
        bot.aiDirX *= -1;
        bot.aiDirZ *= -1;
        bot.aiTurnTimer = Math.min(Number(bot.aiTurnTimer || 0), 0.2);
      }
      bot.yaw = Math.atan2(bot.aiDirX, bot.aiDirZ);
      bot.pitch = 0;
      bot.moveSpeedNorm = moved ? clamp((bot.aiSpeed * slowMult) / 3.2, 0, 1.4) : 0;
      bot.sprinting = moved && (bot.aiSpeed * slowMult) > 2.5;
    }

    room.regenArmor(bot, dtSec);
    room.tickStreamState(bot, dtSec);
    room.tickThrowableRegen(bot, dtSec);

    if ((nowMs() - (bot.lastThrowAt || 0)) > (THROWABLE_BOT_THROW_COOLDOWN_S * 1000) && players.length > 0 && Math.random() < 0.02) {
      const throwableId = THROWABLE_STATS.order[Math.floor(Math.random() * THROWABLE_STATS.order.length)];
      room.handleThrow(bot, { throwableId, clientThrowId: '' }, null);
    }
  }
}
