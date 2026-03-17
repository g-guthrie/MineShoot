import test from 'node:test';
import assert from 'node:assert/strict';

import { tickBots } from '../../../cloudflare/server/room/BotAI.js';

test('bot ai stops at collision geometry instead of walking through it', () => {
  const bot = {
    id: 'bot-1',
    alive: true,
    x: 0,
    y: 1.6,
    z: 0,
    aiTurnTimer: 10,
    aiDirX: 1,
    aiDirZ: 0,
    aiSpeed: 2,
    moveSpeedNorm: 0,
    sprinting: false,
    throwables: {}
  };
  const room = {
    players: new Map(),
    bots: new Map([['bot-1', bot]]),
    boundsMin: -50,
    boundsMax: 50,
    canTargetEntity() { return false; },
    respawnIfNeeded() {},
    worldCollidables() {
      return [{
        min: { x: 0.5, y: 0, z: -1 },
        max: { x: 2.5, y: 3, z: 1 }
      }];
    },
    regenArmor() {},
    tickStreamState() {},
    tickThrowableRegen() {},
    handleThrow() {}
  };

  tickBots(room, 1);

  assert.equal(bot.x, 0);
  assert.equal(bot.z, 0);
  assert.equal(bot.moveSpeedNorm, 0);
  assert.equal(bot.aiDirX < 0, true);
});
