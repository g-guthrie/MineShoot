import test from 'node:test';
import assert from 'node:assert/strict';

import { toEntityState } from '../cloudflare/server/room/EntitySerializer.js';

test('toEntityState exposes compact abilityFx instead of raw room runtime internals', () => {
  const state = toEntityState({
    id: 'usr_test',
    kind: 'player',
    username: 'TEST',
    classId: 'abilities',
    x: 1,
    y: 1.6,
    z: 2,
    yaw: 0.25,
    pitch: -0.1,
    seq: 3,
    weaponId: 'rifle',
    moveSpeedNorm: 0.5,
    sprinting: false,
    velocityY: 0,
    isGrounded: true,
    jumpHoldTimer: 0,
    jumpHeldLast: false,
    hp: 500,
    hpMax: 500,
    armor: 90,
    armorMax: 90,
    kills: 0,
    deaths: 0,
    progressScore: 0,
    lmsLives: 0,
    lmsCharge: 0,
    teamId: '',
    wallhackRadius: 90,
    alive: true,
    spawnShieldUntil: 0,
    streamHeat: 0,
    streamOverheatedUntil: 0,
    muzzleFlashUntil: 0,
    weaponLoadout: ['rifle', 'shotgun'],
    weaponAmmo: {},
    abilityLoadout: { slot1: 'choke', slot2: 'missile' },
    throwables: {},
    stunUntil: 0,
    slowUntil: 0,
    chokeState: { targetId: 'usr_enemy', startedAt: 1000, endsAt: 1400, liftHeight: 1.4 },
    chokeVictimState: { sourceId: 'usr_other', startedAt: 1100, endsAt: 1500, liftHeight: 1.6 },
    justBeenHookedState: { startedAt: 1200, endsAt: 1600 },
    hookPullState: { sourceId: 'usr_other', pullDistance: 3.2, pullSpeed: 26, facingYaw: 0.5, startedAt: 1250, endsAt: 1700 },
    hookState: {
      phase: 'travel',
      targetId: '',
      startPos: { x: 1, y: 2, z: 3 },
      endPos: { x: 4, y: 5, z: 6 },
      headPos: { x: 7, y: 8, z: 9 },
      catchRadius: 1.8,
      startedAt: 1300,
      hitAt: 1350,
      endsAt: 1800
    },
    healState: { startedAt: 1400, endsAt: 1900, healAmount: 150 },
    deadeye: { lockIndex: 1, maxLocks: 2, nextLockAt: 2000, lockEveryMs: 300, endsAt: 2300, queue: ['usr_enemy'] }
  });

  assert.deepEqual(state.abilityFx, {
    chokeCasterUntil: 1400,
    chokeVictim: { startedAt: 1100, endsAt: 1500, liftHeight: 1.6 },
    hookedUntil: 1700,
    hookVisual: { phase: 'travel', targetId: '', headPos: { x: 7, y: 8, z: 9 }, endsAt: 1800 },
    healUntil: 1900
  });
  assert.equal(state.chokeState, undefined);
  assert.equal(state.chokeVictimState, undefined);
  assert.equal(state.justBeenHookedState, undefined);
  assert.equal(state.hookPullState, undefined);
  assert.equal(state.hookState, undefined);
  assert.equal(state.healState, undefined);
});
