import test from 'node:test';
import assert from 'node:assert/strict';

import { GlobalArenaRuntime } from '../cloudflare/server/room/runtime/GlobalArenaRuntime.mjs';

function connectedIds() {
  return ['user-1', 'user-2'];
}

test('global arena runtime supports input, kill, snapshot, and respawn flow', () => {
  const broadcasts = [];
  const runtime = new GlobalArenaRuntime({
    roomName: 'ffa-01',
    broadcast(payload) {
      broadcasts.push(payload);
    }
  });

  const attacker = runtime.ensurePlayer('user-1', 'Alice');
  const target = runtime.ensurePlayer('user-2', 'Bob');
  runtime.startPublicMatchIfReady(connectedIds());
  attacker.spawnShieldUntil = 0;
  target.spawnShieldUntil = 0;

  runtime.handleClientMessage('user-1', {
    t: 'input',
    x: 12,
    y: 1.6,
    z: 18,
    yaw: 0.3,
    pitch: 0.1,
    seq: 4,
    moveSpeedNorm: 0.8,
    sprinting: true
  });

  assert.equal(attacker.x, 12);
  assert.equal(attacker.z, 18);
  assert.equal(attacker.seq, 4);
  assert.equal(attacker.sprinting, true);

  target.hp = 1;
  target.armor = 0;
  runtime.handleClientMessage('user-1', {
    t: 'fire',
    targetId: 'user-2',
    hitType: 'body',
    shotToken: 'finisher'
  });

  assert.equal(target.alive, false);
  assert.equal(Number(attacker.kills || 0), 1);
  assert.equal(Number(target.deaths || 0), 1);
  assert.equal(broadcasts.some((payload) => payload.t === 'damage_event'), true);
  assert.equal(broadcasts.some((payload) => payload.t === 'death_respawn'), true);

  const snapshot = runtime.buildSnapshot(true);
  assert.equal(snapshot.t, 'snapshot');
  assert.equal(snapshot.entities.length >= 2, true);

  target.respawnAt = 0;
  runtime.tick(connectedIds());
  assert.equal(target.alive, true);
  assert.equal(target.hp, target.hpMax);
  assert.equal(target.armor, target.armorMax);
});
