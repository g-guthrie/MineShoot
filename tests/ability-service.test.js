import test from 'node:test';
import assert from 'node:assert/strict';

import { castChoke } from '../cloudflare/server/room/AbilityService.js';

test('castChoke leaves the caster action timers alone and applies lift to the victim', () => {
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
});
