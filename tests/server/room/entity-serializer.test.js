import test from 'node:test';
import assert from 'node:assert/strict';

import { toEntityState, toProjectileState } from '../../../cloudflare/server/room/EntitySerializer.js';

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
    fastBackpedal: true,
    inputState: { forward: true, backward: false, left: true, right: false },
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
    teamId: '',
    wallhackRadius: 90,
    alive: true,
    spawnShieldUntil: 0,
    streamHeat: 0,
    streamOverheatedUntil: 0,
    muzzleFlashUntil: 0,
    weaponLoadout: ['rifle', 'shotgun'],
    weaponAmmo: {},
    abilityId: 'choke',
    throwables: {},
    rollStartedAt: 1400,
    rollUntil: 1760,
    rollInputState: { movingForward: false, movingBackward: true, movingLeft: false, movingRight: true },
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
    deadeye: { lockIndex: 1, maxLocks: 2, nextLockAt: 2000, lockEveryMs: 300, endsAt: 2300, queue: ['usr_enemy'] }
  });

  assert.deepEqual(state.abilityFx, {
    chokeCasterUntil: 1400,
    chokeVictim: { startedAt: 1100, endsAt: 1500, liftHeight: 1.6 },
    hookedStartedAt: 1250,
    hookedUntil: 1700,
    hookVisual: { phase: 'travel', targetId: '', headPos: { x: 7, y: 8, z: 9 }, attachPos: null, endsAt: 1800 }
  });
  assert.equal(state.weaponLockUntil, 0);
  assert.equal(state.throwableLockUntil, 0);
  assert.equal(state.abilityLockUntil, 0);
  assert.equal(state.rollStartedAt, 1400);
  assert.equal(state.rollUntil, 1760);
  assert.deepEqual(state.rollInputState, { movingForward: false, movingBackward: true, movingLeft: false, movingRight: true });
  assert.equal(state.fastBackpedal, true);
  assert.equal(state.movingForward, true);
  assert.equal(state.movingBackward, false);
  assert.equal(state.movingLeft, true);
  assert.equal(state.movingRight, false);
  assert.equal(state.chokeState, undefined);
  assert.equal(state.chokeVictimState, undefined);
  assert.equal(state.justBeenHookedState, undefined);
  assert.equal(state.hookPullState, undefined);
  assert.equal(state.hookState, undefined);
});

test('toEntityState carries authoritative action lock timers', () => {
  const state = toEntityState({
    id: 'usr_test',
    kind: 'player',
    username: 'TEST',
    classId: 'abilities',
    x: 0,
    y: 1.6,
    z: 0,
    yaw: 0,
    pitch: 0,
    seq: 0,
    weaponId: 'rifle',
    moveSpeedNorm: 0,
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
    teamId: '',
    wallhackRadius: 90,
    alive: true,
    spawnShieldUntil: 0,
    streamHeat: 0,
    streamOverheatedUntil: 0,
    muzzleFlashUntil: 0,
    weaponLoadout: ['rifle', 'shotgun'],
    weaponAmmo: {},
    abilityId: 'choke',
    throwables: {},
    weaponLockUntil: 2100,
    throwableLockUntil: 2200,
    abilityLockUntil: 2300
  });

  assert.equal(state.weaponLockUntil, 2100);
  assert.equal(state.throwableLockUntil, 2200);
  assert.equal(state.abilityLockUntil, 2300);
});

test('toEntityState exposes last processed input seq for snapshot acknowledgements', () => {
  const state = toEntityState({
    id: 'usr_test',
    kind: 'player',
    username: 'TEST',
    classId: 'abilities',
    x: 0,
    y: 1.6,
    z: 0,
    yaw: 0,
    pitch: 0,
    seq: 9,
    lastProcessedInputSeq: 4,
    weaponId: 'rifle',
    moveSpeedNorm: 0,
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
    teamId: '',
    wallhackRadius: 90,
    alive: true,
    spawnShieldUntil: 0,
    streamHeat: 0,
    streamOverheatedUntil: 0,
    muzzleFlashUntil: 0,
    weaponLoadout: ['rifle', 'shotgun'],
    weaponAmmo: {},
    abilityId: 'choke',
    throwables: {}
  });

  assert.equal(state.seq, 4);
});

test('toEntityState resolves completed weapon reloads into a full authoritative magazine for snapshots', () => {
  const originalNow = Date.now;
  Date.now = () => 2000;
  try {
    const state = toEntityState({
      id: 'usr_test',
      kind: 'player',
      username: 'TEST',
      classId: 'abilities',
      x: 0,
      y: 1.6,
      z: 0,
      yaw: 0,
      pitch: 0,
      seq: 0,
      weaponId: 'machinegun',
      moveSpeedNorm: 0,
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
      teamId: '',
      wallhackRadius: 90,
      alive: true,
      spawnShieldUntil: 0,
      streamHeat: 0,
      streamOverheatedUntil: 0,
      muzzleFlashUntil: 0,
      weaponLoadout: ['machinegun', 'shotgun'],
      weaponAmmo: {
        machinegun: {
          ammoInMag: 0,
          reloadUntil: 1900,
          reloadedFlashUntil: 0
        }
      },
      abilityId: 'choke',
      throwables: {}
    });

  assert.equal(state.weaponAmmo.machinegun.ammoInMag, 32);
    assert.equal(state.weaponAmmo.machinegun.reloading, false);
    assert.equal(state.weaponAmmo.machinegun.reloadRemaining, 0);
  } finally {
    Date.now = originalNow;
  }
});

test('toProjectileState carries sticky attachment state for remote rendering', () => {
  const state = toProjectileState({
    id: 'proj_plasma',
    type: 'plasma',
    ownerId: 'usr_owner',
    clientThrowId: 'cthrow_1',
    x: 1.2345,
    y: 2.3456,
    z: 3.4567,
    vx: 0,
    vy: 0,
    vz: -10.234,
    age: 0.789,
    stickyUntil: 2200,
    stuckToTargetId: 'usr_target',
    stuckOffsetX: 0.2,
    stuckOffsetY: 0.1,
    stuckOffsetZ: -0.3
  });

  assert.deepEqual(state, {
    id: 'proj_plasma',
    type: 'plasma',
    ownerId: 'usr_owner',
    clientThrowId: 'cthrow_1',
    x: 1.234,
    y: 2.346,
    z: 3.457,
    vx: 0,
    vy: 0,
    vz: -10.234,
    age: 0.789,
    stickyUntil: 2200,
    stuckToTargetId: 'usr_target',
    stuckOffsetX: 0.2,
    stuckOffsetY: 0.1,
    stuckOffsetZ: -0.3
  });
});
