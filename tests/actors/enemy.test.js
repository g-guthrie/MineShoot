import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import * as THREE from 'three';

async function loadEnemyHarness(options = {}) {
  const code = await fs.readFile(new URL('../../js/actors/enemy.js', import.meta.url), 'utf8');
  const destroyCalls = [];
  const includeHitboxes = options.includeHitboxes !== false;
  const runtime = {
    GameCombatTuning: {
      getEnemyTuning() {
        return {
          fireRange: 34,
          headshotNearRange: 12,
          headshotMidRange: 22,
          defaultWallhackRadius: 90
        };
      }
    },
    GameShared: {
      entityConstants: {
        ENEMY_HP: 360,
        ENEMY_ARMOR: 90
      },
      getSurvivabilityTuning() {
        return { armorRegenDelaySec: 8.0 };
      },
      damage: null
    },
    GameWorld: {
      getBounds() {
        return { minX: 0, maxX: 50, minZ: 0, maxZ: 50 };
      },
      getRandomSpawnPoint() {
        return { x: 10, z: 10 };
      },
      getCollidables() {
        return [];
      }
    },
    GamePlayer: {
      getPosition(outVec3) {
        const out = outVec3 || new THREE.Vector3();
        return out.set(15, 1.6, 15);
      },
      getRotation() {
        return { yaw: 0, pitch: 0 };
      }
    },
    GameActorVisualFactory: {
      create(config) {
        const root = new THREE.Group();
        const bodyHitbox = includeHitboxes
          ? new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial())
          : null;
        const headHitbox = includeHitboxes
          ? new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), new THREE.MeshBasicMaterial())
          : null;

        function syncHitboxes(position) {
          if (bodyHitbox) bodyHitbox.position.set(position.x, position.y + 1.0, position.z);
          if (headHitbox) headHitbox.position.set(position.x, position.y + 2.0, position.z);
        }

        return {
          root,
          visual: root,
          revealGhost: null,
          bodyHitbox,
          headHitbox,
          rig: null,
          rigApi: null,
          setWorldTransform(position, yaw) {
            root.position.set(Number(position.x || 0), Number(position.y || 0), Number(position.z || 0));
            root.rotation.y = Number(yaw || 0);
            syncHitboxes(root.position);
          },
          syncHitboxes(position) {
            syncHitboxes(position);
          },
          getCoreWorldPosition(outVec3) {
            const out = outVec3 || new THREE.Vector3();
            return out.copy(root.position).setY(root.position.y + 1.0);
          },
          setHitboxVisibility() {},
          setYaw(yaw) {
            root.rotation.y = Number(yaw || 0);
          },
          setAlive() {},
          setMuzzleVisible() {},
          setRevealGhostState() {},
          setDamageFlash() {},
          updateAnimation() {},
          destroy() {
            destroyCalls.push(String(config.targetId || ''));
            if (root.parent) root.parent.remove(root);
            if (bodyHitbox && bodyHitbox.parent) bodyHitbox.parent.remove(bodyHitbox);
            if (headHitbox && headHitbox.parent) headHitbox.parent.remove(headHitbox);
          }
        };
      }
    }
  };

  const sandbox = {
    __MAYHEM_RUNTIME: runtime,
    globalThis: null,
    console,
    THREE,
    Date,
    Math,
    performance: { now: () => 0 }
  };
  sandbox.globalThis = sandbox;

  vm.runInContext(code, vm.createContext(sandbox));
  return {
    GameEnemy: sandbox.__MAYHEM_RUNTIME.GameEnemy,
    destroyCalls
  };
}

test('enemy init and dispose destroy prior actor visuals', async () => {
  const harness = await loadEnemyHarness();
  const scene = new THREE.Scene();

  harness.GameEnemy.init(scene, 2);
  harness.GameEnemy.init(scene, 1);

  assert.equal(harness.destroyCalls.length, 2);
  assert.equal(harness.GameEnemy.getEnemies().length, 1);

  harness.GameEnemy.dispose();
  assert.equal(harness.destroyCalls.length, 3);
  assert.equal(harness.GameEnemy.getEnemies().length, 0);
});

test('enemy lock targets reuse cached world position vectors across calls', async () => {
  const harness = await loadEnemyHarness();
  const scene = new THREE.Scene();
  harness.GameEnemy.init(scene, 1);

  const firstTargets = harness.GameEnemy.getLockTargets();
  const secondTargets = harness.GameEnemy.getLockTargets();

  assert.equal(firstTargets.length, 1);
  assert.equal(secondTargets.length, 1);
  assert.notEqual(firstTargets, secondTargets);
  assert.notEqual(firstTargets[0], secondTargets[0]);
  assert.equal(firstTargets[0].worldPos, secondTargets[0].worldPos);
});

test('enemy kill tolerates missing hitboxes', async () => {
  const harness = await loadEnemyHarness({ includeHitboxes: false });
  const scene = new THREE.Scene();
  harness.GameEnemy.init(scene, 1);
  const enemy = harness.GameEnemy.getEnemies()[0];

  assert.doesNotThrow(() => {
    harness.GameEnemy.kill(enemy);
  });
});

test('enemy update finalizes expired hook pulls and applies post-hook stun state', async () => {
  const harness = await loadEnemyHarness();
  const scene = new THREE.Scene();
  harness.GameEnemy.init(scene, 1);
  const enemy = harness.GameEnemy.getEnemies()[0];
  enemy.hookPullState = {
    pullDistance: 3.2,
    pullSpeed: 26,
    startedAt: 1000,
    endsAt: 0,
    postHookStunDuration: 0.5
  };

  harness.GameEnemy.update(0.016, new THREE.Vector3(0, 1.6, 0), function () {});

  assert.equal(enemy.hookPullState, null);
  assert.ok(enemy.justBeenHookedStartedAt > 0);
  assert.ok(enemy.justBeenHookedUntil > enemy.justBeenHookedStartedAt);
  assert.ok(enemy.stunTimer > 0);
});
