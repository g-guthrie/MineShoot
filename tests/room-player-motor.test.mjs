import test from 'node:test';
import assert from 'node:assert/strict';

import {
  applyInput,
  respawnIfNeeded
} from '../cloudflare/server/room/runtime/RoomPlayerMotor.mjs';

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

test('room player motor applies bounded authoritative input', () => {
  const entity = {
    alive: true,
    x: 10,
    y: 1.6,
    z: 10,
    yaw: 0,
    pitch: 0,
    seq: 0,
    moveSpeedNorm: 0,
    sprinting: false,
    weaponId: '',
    stunUntil: 0,
    slowUntil: 0,
    slowMultiplier: 1
  };

  applyInput({
    entity,
    message: {
      x: 200,
      y: 0,
      z: -50,
      yaw: 2.4,
      pitch: 8,
      seq: 7,
      moveSpeedNorm: 2,
      sprinting: true
    },
    now: 1000,
    boundsMin: 2,
    boundsMax: 110,
    terrainEyeYAt() {
      return 1.6;
    },
    clamp
  });

  assert.equal(entity.x, 110);
  assert.equal(entity.z, 2);
  assert.equal(entity.y, 1.6);
  assert.equal(entity.yaw, 2.4);
  assert.equal(entity.pitch, 1.55);
  assert.equal(entity.seq, 7);
  assert.equal(entity.moveSpeedNorm, 1.4);
  assert.equal(entity.sprinting, true);
  assert.equal(entity.weaponId, 'rifle');
});

test('room player motor restores authoritative spawn state on respawn', () => {
  let spawnedRandomly = false;
  const entity = {
    alive: false,
    x: 0,
    y: 0,
    z: 0,
    hp: 0,
    hpMax: 500,
    armor: 0,
    armorMax: 90,
    respawnAt: 1200,
    lastDamageAt: 1000,
    plannedSpawnPoint: { x: 33, z: 44 },
    spawnShieldUntil: 0,
    lastShotAt: { rifle: 800 },
    muzzleFlashUntil: 900,
    moveSpeedNorm: 1,
    sprinting: true,
    stunUntil: 1300,
    slowUntil: 1400,
    slowMultiplier: 0.5
  };

  const changed = respawnIfNeeded({
    entity,
    now: 1200,
    spawnShieldMs: 1000,
    chooseSpawnPoint() {
      spawnedRandomly = true;
      return { x: 88, z: 99 };
    },
    terrainEyeYAt() {
      return 1.6;
    }
  });

  assert.equal(changed, true);
  assert.equal(spawnedRandomly, false);
  assert.equal(entity.alive, true);
  assert.equal(entity.hp, 500);
  assert.equal(entity.armor, 90);
  assert.equal(entity.x, 33);
  assert.equal(entity.z, 44);
  assert.equal(entity.y, 1.6);
  assert.equal(entity.spawnShieldUntil, 2200);
  assert.deepEqual(entity.lastShotAt, {});
  assert.equal(entity.moveSpeedNorm, 0);
  assert.equal(entity.sprinting, false);
  assert.equal(entity.stunUntil, 0);
  assert.equal(entity.slowUntil, 0);
  assert.equal(entity.slowMultiplier, 1);
});
