import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import * as THREE from 'three';

import { gameplayTuning } from '../../shared/gameplay-tuning.js';

async function loadFireZoneHarness(enemy) {
  const code = await fs.readFile(new URL('../../js/combat/throwables-fire-zones.js', import.meta.url), 'utf8');
  const scene = new THREE.Scene();
  const timeState = { now: 1000 };
  const audioCalls = [];
  const damageCalls = [];
  const burstCalls = [];
  const hitEvents = [];

  const sandbox = {
    __MAYHEM_RUNTIME: {
      GameAudio: {
        play(name) {
          audioCalls.push(String(name || ''));
        }
      },
      GameEnemy: {
        getEnemies() {
          return enemy ? [enemy] : [];
        },
        damage(hitbox, damage) {
          damageCalls.push({ hitbox, damage });
          return {
            enemy: hitbox && hitbox.userData ? hitbox.userData.enemyRef || null : null
          };
        }
      }
    },
    globalThis: null,
    console,
    THREE,
    Date: {
      now() {
        return timeState.now;
      }
    }
  };
  sandbox.globalThis = sandbox;

  const context = vm.createContext(sandbox);
  vm.runInContext(code, context);

  const factory = sandbox.__MAYHEM_RUNTIME.GameThrowablesFireZones;
  const api = factory.create({
    getDefs() {
      return {
        molotov: gameplayTuning.throwables.molotov
      };
    },
    getScene() {
      return scene;
    },
    effectPaletteForProjectileType() {
      return {
        flash: 0xffffff,
        explosion: 0xff6622
      };
    },
    spawnExplosionBurst(position, color, radius) {
      burstCalls.push({
        position: position.clone(),
        color,
        radius
      });
    }
  });

  function step(dt) {
    timeState.now += Math.round(Number(dt || 0) * 1000);
    api.update(dt, function (event) {
      hitEvents.push({
        damage: event.damage,
        source: event.source,
        special: event.special ? { ...event.special } : null
      });
    });
  }

  return {
    api,
    scene,
    audioCalls,
    damageCalls,
    burstCalls,
    hitEvents,
    step
  };
}

function createEnemy(x, z, bodyY) {
  const enemy = {
    index: 7,
    alive: true,
    group: {
      position: new THREE.Vector3(x, 0, z)
    },
    bodyHitbox: {
      position: new THREE.Vector3(x, bodyY, z),
      userData: {}
    }
  };
  enemy.bodyHitbox.userData.enemyRef = enemy;
  return enemy;
}

test('throwables fire zones deal base damage in the zone and lingering damage after the target leaves', async () => {
  const enemy = createEnemy(0, 0, 1.05);
  const harness = await loadFireZoneHarness(enemy);

  harness.api.createFireZone(new THREE.Vector3(0, 0, 0));
  assert.equal(harness.scene.children.length, 1);
  const zoneParts = harness.scene.children[0].userData.zoneParts;
  assert.ok(Array.isArray(zoneParts.flameJets));
  assert.equal(zoneParts.flameJets.length, 8);
  assert.ok(zoneParts.scorch);
  assert.deepEqual(harness.audioCalls, ['molotov_ignite', 'fireBurning']);
  assert.equal(harness.burstCalls.length, 1);
  assert.equal(harness.burstCalls[0].radius, gameplayTuning.throwables.molotov.fireRadius);

  harness.step(gameplayTuning.throwables.molotov.fireTickRate);

  assert.equal(harness.damageCalls.length, 1);
  assert.equal(harness.damageCalls[0].damage, gameplayTuning.throwables.molotov.fireTickDamage);
  assert.deepEqual(harness.hitEvents[0], {
    damage: gameplayTuning.throwables.molotov.fireTickDamage,
    source: 'molotov',
    special: null
  });

  enemy.group.position.set(9, 0, 0);
  enemy.bodyHitbox.position.set(9, 1.05, 0);
  harness.step(gameplayTuning.throwables.molotov.fireLingerTickRate);

  assert.equal(harness.damageCalls.length, 2);
  assert.equal(harness.damageCalls[1].damage, gameplayTuning.throwables.molotov.fireLingerTickDamage);
  assert.deepEqual(harness.hitEvents[1], {
    damage: gameplayTuning.throwables.molotov.fireLingerTickDamage,
    source: 'molotov',
    special: { burnLinger: true }
  });
});

test('throwables fire zones ignore targets that are too high above the flame volume', async () => {
  const enemy = createEnemy(0, 0, 3.2);
  const harness = await loadFireZoneHarness(enemy);

  harness.api.createFireZone(new THREE.Vector3(0, 0, 0));
  harness.step(gameplayTuning.throwables.molotov.fireTickRate);

  assert.equal(harness.damageCalls.length, 0);
  assert.equal(harness.hitEvents.length, 0);
});

test('throwables fire zones reset active zone meshes and clear lingering burn state', async () => {
  const enemy = createEnemy(0, 0, 1.05);
  const harness = await loadFireZoneHarness(enemy);

  harness.api.createFireZone(new THREE.Vector3(0, 0, 0));
  harness.step(gameplayTuning.throwables.molotov.fireTickRate);
  assert.equal(harness.damageCalls.length, 1);

  harness.api.reset();
  assert.equal(harness.scene.children.length, 0);

  enemy.group.position.set(9, 0, 0);
  enemy.bodyHitbox.position.set(9, 1.05, 0);
  harness.step(gameplayTuning.throwables.molotov.fireLingerTickRate);

  assert.equal(harness.damageCalls.length, 1);
  assert.equal(harness.hitEvents.length, 1);
});
