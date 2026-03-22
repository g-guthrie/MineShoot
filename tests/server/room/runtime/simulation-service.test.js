import test from 'node:test';
import assert from 'node:assert/strict';

import { buildSnapshot } from '../../../../cloudflare/server/room/runtime/services/simulation-service.mjs';

function makePlayer(id, x) {
  return {
    id,
    kind: 'player',
    username: id.toUpperCase(),
    classId: 'abilities',
    x,
    y: 1.6,
    z: 0,
    yaw: 0,
    pitch: 0,
    seq: 0,
    weaponId: 'rifle',
    moveSpeedNorm: 0,
    sprinting: false,
    inputState: { forward: false, backward: false },
    velocityY: 0,
    isGrounded: true,
    jumpHoldTimer: 0,
    jumpHeldLast: false,
    hp: 100,
    hpMax: 100,
    armor: 0,
    armorMax: 0,
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
  };
}

test('simulation service builds a snapshot from frozen entity states before later payload work mutates live players', () => {
  const first = makePlayer('u1', 1);
  const second = makePlayer('u2', 2);
  let nowCalls = 0;
  const runtime = {
    players: new Map([
      ['u1', first],
      ['u2', second]
    ]),
    MSG_S2C: { SNAPSHOT: 'snapshot' },
    nowMs() {
      const stamp = 500 + nowCalls;
      nowCalls += 1;
      return stamp;
    },
    gameMode: 'ffa',
    serializeMatchState() {
      second.x = 99;
      return { gameMode: 'ffa', started: false };
    },
    lastBroadcastEntityState: new Map(),
    rateConfig: {
      preset: 'test',
      renderHz: 60,
      simHz: 60,
      snapshotHz: 20
    }
  };

  const payload = buildSnapshot(runtime, false);

  assert.equal(payload.serverTime, 500);
  assert.deepEqual(payload.entities.map((entity) => entity.x), [1, 2]);
  assert.equal(nowCalls, 1);
});
