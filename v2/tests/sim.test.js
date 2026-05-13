import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld } from '../src/shared/world.js';
import { createPlayerState, stepPlayer } from '../src/shared/movement.js';
import { resolveFire } from '../src/shared/combat.js';
import { V2Room } from '../src/server/room.js';

test('movement advances relative to yaw and respects world bounds', () => {
  const world = createWorld();
  const player = createPlayerState({ id: 'p1', spawn: { x: 0, z: 0, yaw: 0 } });
  for (let i = 0; i < 60; i++) {
    stepPlayer(player, { forward: true, yaw: 0, pitch: 0 }, 1 / 60, world);
  }
  assert.ok(player.z < -2, `expected forward movement on -Z, got ${player.z}`);
  player.x = 999;
  stepPlayer(player, { yaw: 0 }, 1 / 60, world);
  assert.ok(player.x <= world.bounds.maxX);
});

test('authoritative fire damages the closest target on the ray', () => {
  const room = new V2Room({ botCount: 0 });
  const shooter = createPlayerState({ id: 'a', spawn: { x: 0, z: 0, yaw: 0 } });
  const target = createPlayerState({ id: 'b', spawn: { x: 0, z: -10, yaw: Math.PI } });
  room.entities.set(shooter.id, shooter);
  room.entities.set(target.id, target);
  const event = resolveFire(room, shooter, {
    weaponId: 'rifle',
    shotId: 1,
    yaw: 0,
    pitch: 0
  }, 1000);
  assert.equal(event.type, 'shot');
  assert.equal(event.hits.length, 1);
  assert.equal(event.hits[0].targetId, 'b');
  assert.ok(target.health < 100);
});

test('local room connects a player and produces snapshots with bots', () => {
  const room = new V2Room({ botCount: 2 });
  const welcome = room.connect('human-1', 'Human');
  assert.equal(welcome.selfId, 'human-1');
  room.receive('human-1', {
    t: 'input',
    input: { forward: true, yaw: 0, pitch: 0, seq: 1 }
  });
  room.step(1000 / 60);
  const snapshot = room.snapshotFor('human-1');
  assert.equal(snapshot.t, 'snapshot');
  assert.equal(snapshot.selfId, 'human-1');
  assert.ok(snapshot.entities.length >= 3);
});

