import test from 'node:test';
import assert from 'node:assert/strict';

import { castChoke, castHook, tickClassAbilityState } from '../../../cloudflare/server/room/AbilityService.js';
import { pullEntityToward } from '../../../cloudflare/server/room/RoomCombatRuntime.js';

test('castChoke leaves the caster action timers alone and applies lift to the victim', () => {
  const broadcasts = [];
  const player = {
    id: 'usr_vader',
    alive: true,
    weaponLockUntil: 50,
    throwableLockUntil: 60,
    abilityLockUntil: 70
  };
  const target = {
    id: 'usr_target',
    alive: true
  };
  const room = {
    resolveLockedHostile() {
      return target;
    },
    applyTimedStun(entity, duration) {
      entity.stunDuration = duration;
    },
    broadcast(payload) {
      broadcasts.push(payload);
    }
  };

  const result = castChoke(room, player, {
    duration: 1.6,
    liftHeight: 1.25,
    tickRate: 0.25,
    dotPerTick: 0
  }, {
    lockTargetId: target.id
  }, 1000);

  assert.deepEqual(result, {
    ok: true,
    kind: 'ability_choke',
    payload: { targetId: target.id }
  });
  assert.equal(player.weaponLockUntil, 50);
  assert.equal(player.throwableLockUntil, 60);
  assert.equal(player.abilityLockUntil, 70);
  assert.equal(player.chokeState.targetId, target.id);
  assert.equal(player.chokeState.startedAt, 1000);
  assert.equal(player.chokeState.endsAt, 2600);
  assert.equal(target.chokeVictimState.sourceId, player.id);
  assert.equal(target.chokeVictimState.startedAt, 1000);
  assert.equal(target.chokeVictimState.endsAt, 2600);
  assert.equal(target.chokeVictimState.liftHeight, 1.25);
  assert.deepEqual(broadcasts, [{
    t: 'ability_event',
    abilityId: 'choke',
    sourceId: player.id,
    targetId: target.id
  }]);
});

test('missed server hook retracts toward the current origin before clearing', () => {
  const realNow = Date.now;
  const timeState = { now: 1000 };
  Date.now = function () {
    return timeState.now;
  };

  try {
    const player = {
      id: 'usr_hook',
      alive: true,
      x: 0,
      y: 1.2,
      z: 0
    };
    const room = {
      entityCorePosition(entity) {
        return { x: entity.x, y: entity.y, z: entity.z };
      },
      resolveClassAimPoint() {
        return { x: 0, y: 1.2, z: -3 };
      },
      clampWorldAimPoint(_start, aimPoint) {
        return aimPoint;
      },
      getAliveEntities() {
        return [];
      },
      canTargetEntity() {
        return false;
      },
      hasWorldLineOfSight() {
        return true;
      },
      getEntityById() {
        return null;
      }
    };

    const result = castHook(room, player, {
      range: 24,
      catchRadius: 1.6,
      pullDistance: 3.2,
      stunDuration: 0.5,
      castDamage: 35,
      travelSpeed: 24
    }, {}, timeState.now);

    assert.equal(result.ok, true);
    assert.equal(player.hookState.phase, 'travel');

    timeState.now = 1125;
    tickClassAbilityState(room, player);
    assert.equal(player.hookState.phase, 'retract');

    player.z = 2;
    timeState.now = 1185;
    tickClassAbilityState(room, player);
    assert.ok(player.hookState.headPos.z > -1);
    assert.ok(player.hookState.headPos.z < 0);

    timeState.now = 1250;
    tickClassAbilityState(room, player);
    assert.equal(player.hookState, null);
  } finally {
    Date.now = realNow;
  }
});

test('hook pull releases once the target reaches the caster while following live movement', () => {
  const realNow = Date.now;
  const timeState = { now: 1000 };
  Date.now = function () {
    return timeState.now;
  };

  try {
    const player = {
      id: 'usr_hook',
      alive: true,
      x: 0,
      y: 1.2,
      z: 0,
      yaw: 0
    };
    const target = {
      id: 'usr_target',
      alive: true,
      x: 0,
      y: 1.2,
      z: -10
    };
    const room = {
      boundsMin: -50,
      boundsMax: 50,
      getEntityById(id) {
        return id === player.id ? player : null;
      },
      entityForward(entity) {
        return { x: -Math.sin(entity.yaw || 0), y: 0, z: -Math.cos(entity.yaw || 0) };
      },
      applyJustBeenHooked(entity, duration) {
        entity.justBeenHookedDuration = duration;
      }
    };

    pullEntityToward(player, target, 3.2, 40, 0.5, {
      nowMs: function () { return timeState.now; }
    });

    player.z = -6;
    timeState.now = 1050;
    tickClassAbilityState(room, target);

    assert.equal(target.hookPullState, null);
    assert.equal(target.z, -9.2);
    assert.equal(target.justBeenHookedDuration, 0.5);
  } finally {
    Date.now = realNow;
  }
});

test('landed server hook preserves an attachment point and retracts after the pull beat', () => {
  const realNow = Date.now;
  const timeState = { now: 1000 };
  Date.now = function () {
    return timeState.now;
  };

  try {
    const player = {
      id: 'usr_hook',
      alive: true,
      x: 0,
      y: 1.2,
      z: 0
    };
    const target = {
      id: 'usr_target',
      alive: true,
      x: 0,
      y: 1.2,
      z: -3
    };
    const room = {
      boundsMin: -50,
      boundsMax: 50,
      entityCorePosition(entity) {
        return { x: entity.x, y: entity.y, z: entity.z };
      },
      entityAimTargetPosition(entity) {
        return { x: entity.x, y: entity.y, z: entity.z };
      },
      resolveClassAimPoint() {
        return { x: 0, y: 1.2, z: -3 };
      },
      clampWorldAimPoint(_start, aimPoint) {
        return aimPoint;
      },
      getAliveEntities() {
        return [target];
      },
      canTargetEntity(entity) {
        return entity === target;
      },
      hasWorldLineOfSight() {
        return true;
      },
      broadcast() {},
      pullEntityToward() {},
      getEntityById(id) {
        if (id === player.id) return player;
        if (id === target.id) return target;
        return null;
      }
    };

    castHook(room, player, {
      range: 24,
      catchRadius: 1.6,
      pullDistance: 3.2,
      stunDuration: 0.5,
      castDamage: 35,
      travelSpeed: 24
    }, {}, timeState.now);

    timeState.now = 1100;
    tickClassAbilityState(room, player);
    assert.equal(player.hookState.phase, 'latched');
    assert.deepEqual(player.hookState.attachPos, { x: 0, y: 1.2, z: -3 });

    player.z = 1;
    timeState.now = 1270;
    tickClassAbilityState(room, player);
    assert.equal(player.hookState.phase, 'retract');

    timeState.now = 1320;
    tickClassAbilityState(room, player);
    assert.ok(player.hookState.headPos.z > -3);
    assert.ok(player.hookState.headPos.z < 1);
  } finally {
    Date.now = realNow;
  }
});
