import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

async function loadDemonicCoordinator() {
  const inputCode = await fs.readFile(new URL('../demonic/gameplay/input/runtime.js', import.meta.url), 'utf8');
  const bindingsCode = await fs.readFile(new URL('../demonic/gameplay/input/bindings.js', import.meta.url), 'utf8');
  const playerCode = await fs.readFile(new URL('../demonic/gameplay/player/runtime.js', import.meta.url), 'utf8');
  const worldCode = await fs.readFile(new URL('../demonic/gameplay/world/runtime.js', import.meta.url), 'utf8');
  const combatCode = await fs.readFile(new URL('../demonic/gameplay/combat/runtime.js', import.meta.url), 'utf8');
  const abilitiesCode = await fs.readFile(new URL('../demonic/gameplay/abilities/runtime.js', import.meta.url), 'utf8');
  const cameraCode = await fs.readFile(new URL('../demonic/gameplay/camera/runtime.js', import.meta.url), 'utf8');
  const hudCode = await fs.readFile(new URL('../demonic/gameplay/hud/runtime.js', import.meta.url), 'utf8');
  const coordinatorCode = await fs.readFile(new URL('../demonic/runtime/coordinator.js', import.meta.url), 'utf8');

  const sandbox = {
    __MAYHEM_RUNTIME: {
      GameShared: {
        gameplayTuning: {
          movement: { jogSpeed: 8, runSpeed: 14, jumpVelocity: 8.8 }
        },
        getWeaponStats(weaponId) {
          return {
            machinegun: { id: 'machinegun', cooldownMs: 82, reloadMs: 1388, magazineSize: 3, adsFovDeg: 56, automatic: true },
            shotgun: { id: 'shotgun', cooldownMs: 0, reloadMs: 1850, magazineSize: 2, adsFovDeg: 56, automatic: false }
          }[weaponId] || { id: weaponId, cooldownMs: 250, reloadMs: 1200, magazineSize: 1, adsFovDeg: 56, automatic: false };
        },
        resolveWeaponAdsFovDeg(weaponStats) {
          return Number(weaponStats && weaponStats.adsFovDeg || 56);
        },
        getSelectableWeaponIds() {
          return ['machinegun', 'shotgun'];
        },
        getDefaultAbilityLoadout() {
          return { slot1: 'choke', slot2: 'missile' };
        },
        getAbilityCatalog() {
          return {
            choke: { id: 'choke', name: 'Vader Choke', cooldownMs: 15000 },
            missile: { id: 'missile', name: 'Missile', cooldownMs: 900 }
          };
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
    document: {
      addEventListener() {},
      removeEventListener() {}
    },
    window: {
      addEventListener() {},
      removeEventListener() {}
    },
    globalThis: null,
    console
  };
  sandbox.globalThis = sandbox;

  const context = vm.createContext(sandbox);
  vm.runInContext(inputCode, context);
  vm.runInContext(bindingsCode, context);
  vm.runInContext(playerCode, context);
  vm.runInContext(worldCode, context);
  vm.runInContext(combatCode, context);
  vm.runInContext(abilitiesCode, context);
  vm.runInContext(cameraCode, context);
  vm.runInContext(hudCode, context);
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
  assert.equal(started.abilities.loadout.slot1, 'choke');
  assert.equal(typeof started.hud.weaponInfo, 'string');
  assert.ok(latest);
  assert.equal(latest.player.jogSpeed, 8);
  assert.equal(latest.combat.weaponCatalog[1], 'shotgun');

  coordinator.setInputState({ moveForward: true, sprint: true, ads: false });
  coordinator.start();
  const afterMotion = coordinator.getSnapshot();
  assert.equal(afterMotion.input.moveForward, true);
  assert.ok(afterMotion.player.speed >= 8);
  assert.ok(afterMotion.player.z < started.player.z);
  assert.equal(afterMotion.hud.movementInfo, 'SPRINT');

  const fired = coordinator.fire();
  assert.equal(fired, true);
  const afterFire = coordinator.getSnapshot();
  assert.equal(afterFire.combat.fireCooldownRemainingMs > 0, true);
  assert.equal(afterFire.combat.ammoInMag, 2);
  assert.equal(afterFire.hud.weaponInfo.includes('MACHINEGUN'), true);

  const equipped = coordinator.equipWeapon('shotgun');
  assert.equal(equipped, true);
  assert.equal(coordinator.getSnapshot().combat.selectedWeaponId, 'shotgun');

  const cycled = coordinator.cycleWeapon(1);
  assert.equal(cycled.combat.selectedWeaponId, 'machinegun');

  const reloadCoordinator = coordinatorApi.create({
    mode: { id: 'single_full_sandbox', label: 'Offline Sandbox', authorityMode: 'offline', backendLabel: 'OFFLINE SANDBOX' },
    context: { gameMode: 'ffa', roomId: '' },
    onUpdate() {}
  });
  reloadCoordinator.start();
  reloadCoordinator.equipWeapon('shotgun');
  reloadCoordinator.fire();
  reloadCoordinator.start();
  reloadCoordinator.fire();
  reloadCoordinator.start();
  const afterEmpty = reloadCoordinator.getSnapshot();
  assert.equal(afterEmpty.combat.reloadRemainingMs > 0, true);

  const reloaded = reloadCoordinator.reload();
  assert.equal(reloaded, false);

  const abilityResult = coordinator.triggerAbility(1);
  assert.equal(abilityResult.ok, true);
  assert.equal(coordinator.getSnapshot().abilities.lastCast.abilityId, 'choke');

  const autoCoordinator = coordinatorApi.create({
    mode: { id: 'single_full_sandbox', label: 'Offline Sandbox', authorityMode: 'offline', backendLabel: 'OFFLINE SANDBOX' },
    context: { gameMode: 'ffa', roomId: '' },
    onUpdate() {}
  });
  autoCoordinator.start();
  autoCoordinator.setInputState({ triggerHeld: true });
  autoCoordinator.start();
  const afterAuto = autoCoordinator.getSnapshot();
  assert.equal(afterAuto.combat.ammoInMag < 3, true);
});
