import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

async function loadDemonicCoordinator() {
  const inputCode = await fs.readFile(new URL('../demonic/gameplay/input/runtime.js', import.meta.url), 'utf8');
  const playerCode = await fs.readFile(new URL('../demonic/gameplay/player/runtime.js', import.meta.url), 'utf8');
  const worldCode = await fs.readFile(new URL('../demonic/gameplay/world/runtime.js', import.meta.url), 'utf8');
  const combatCode = await fs.readFile(new URL('../demonic/gameplay/combat/runtime.js', import.meta.url), 'utf8');
  const cameraCode = await fs.readFile(new URL('../demonic/gameplay/camera/runtime.js', import.meta.url), 'utf8');
  const coordinatorCode = await fs.readFile(new URL('../demonic/runtime/coordinator.js', import.meta.url), 'utf8');

  const sandbox = {
    __MAYHEM_RUNTIME: {
      GameShared: {
        gameplayTuning: {
          movement: { jogSpeed: 8, runSpeed: 14, jumpVelocity: 8.8 }
        },
        getWeaponStats(weaponId) {
          return {
            machinegun: { cooldownMs: 82, adsFovDeg: 56 },
            shotgun: { cooldownMs: 1000, adsFovDeg: 56 }
          }[weaponId] || { cooldownMs: 250, adsFovDeg: 56 };
        },
        resolveWeaponAdsFovDeg(weaponStats) {
          return Number(weaponStats && weaponStats.adsFovDeg || 56);
        },
        getSelectableWeaponIds() {
          return ['machinegun', 'shotgun'];
        }
      }
    },
    __DEMONIC_RUNTIME: {
      GameLoop: {
        create(options) {
          let running = false;
          return {
            start() {
              running = true;
              options.onFrame(0.016, 16);
            },
            stop() {
              running = false;
            },
            isRunning() {
              return running;
            }
          };
        }
      }
    },
    globalThis: null,
    console
  };
  sandbox.globalThis = sandbox;

  const context = vm.createContext(sandbox);
  vm.runInContext(inputCode, context);
  vm.runInContext(playerCode, context);
  vm.runInContext(worldCode, context);
  vm.runInContext(combatCode, context);
  vm.runInContext(cameraCode, context);
  vm.runInContext(coordinatorCode, context);
  return sandbox.__DEMONIC_RUNTIME.GameRuntimeCoordinator;
}

test('demonic coordinator combines subsystem snapshots under one runtime contract', async () => {
  const coordinatorApi = await loadDemonicCoordinator();
  let latest = null;
  const coordinator = coordinatorApi.create({
    mode: { id: 'single_full_sandbox', label: 'Offline Sandbox', authorityMode: 'offline', backendLabel: 'OFFLINE SANDBOX' },
    context: { gameMode: 'ffa', roomId: '' },
    onUpdate(snapshot) {
      latest = snapshot;
    }
  });

  const started = coordinator.start();

  assert.equal(started.mode.id, 'single_full_sandbox');
  assert.equal(started.input.moveForward, false);
  assert.equal(started.player.runSpeed, 14);
  assert.equal(started.world.worldSeed, 'demonic-seed-a');
  assert.equal(started.combat.selectedWeaponId, 'machinegun');
  assert.equal(typeof started.camera.fov, 'number');
  assert.ok(latest);
  assert.equal(latest.player.jogSpeed, 8);
  assert.equal(latest.combat.weaponCatalog[1], 'shotgun');

  coordinator.setInputState({ moveForward: true, sprint: true, ads: false });
  const afterInput = coordinator.getSnapshot();
  assert.equal(afterInput.input.moveForward, true);

  coordinator.start();
  const afterMotion = coordinator.getSnapshot();
  assert.ok(afterMotion.player.speed >= 8);

  const fired = coordinator.fire();
  assert.equal(fired, true);
  const afterFire = coordinator.getSnapshot();
  assert.equal(afterFire.combat.fireCooldownRemainingMs > 0, true);

  const equipped = coordinator.equipWeapon('shotgun');
  assert.equal(equipped, true);
  assert.equal(coordinator.getSnapshot().combat.selectedWeaponId, 'shotgun');
});
