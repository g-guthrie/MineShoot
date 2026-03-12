import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

async function loadDemonicCoordinator() {
  const inputCode = await fs.readFile(new URL('../demonic/gameplay/input/runtime.js', import.meta.url), 'utf8');
  const bindingsCode = await fs.readFile(new URL('../demonic/gameplay/input/bindings.js', import.meta.url), 'utf8');
  const awarenessCode = await fs.readFile(new URL('../demonic/gameplay/awareness/runtime.js', import.meta.url), 'utf8');
  const playerCode = await fs.readFile(new URL('../demonic/gameplay/player/runtime.js', import.meta.url), 'utf8');
  const playerCombatCode = await fs.readFile(new URL('../demonic/gameplay/player/combat-runtime.js', import.meta.url), 'utf8');
  const worldCode = await fs.readFile(new URL('../demonic/gameplay/world/runtime.js', import.meta.url), 'utf8');
  const netTransportCode = await fs.readFile(new URL('../demonic/gameplay/net/transport.js', import.meta.url), 'utf8');
  const netInputHistoryCode = await fs.readFile(new URL('../demonic/gameplay/net/input-history.js', import.meta.url), 'utf8');
  const netStateViewCode = await fs.readFile(new URL('../demonic/gameplay/net/state-view.js', import.meta.url), 'utf8');
  const netCode = await fs.readFile(new URL('../demonic/gameplay/net/runtime.js', import.meta.url), 'utf8');
  const combatHudStateCode = await fs.readFile(new URL('../demonic/gameplay/combat/hud-state.js', import.meta.url), 'utf8');
  const weaponFeedbackCode = await fs.readFile(new URL('../demonic/gameplay/combat/weapon-feedback-runtime.js', import.meta.url), 'utf8');
  const combatCode = await fs.readFile(new URL('../demonic/gameplay/combat/runtime.js', import.meta.url), 'utf8');
  const abilityTargetingCode = await fs.readFile(new URL('../demonic/gameplay/abilities/targeting.js', import.meta.url), 'utf8');
  const abilityStateMachineCode = await fs.readFile(new URL('../demonic/gameplay/abilities/state-machine.js', import.meta.url), 'utf8');
  const abilitiesCode = await fs.readFile(new URL('../demonic/gameplay/abilities/runtime.js', import.meta.url), 'utf8');
  const cameraCode = await fs.readFile(new URL('../demonic/gameplay/camera/runtime.js', import.meta.url), 'utf8');
  const damageCode = await fs.readFile(new URL('../demonic/gameplay/feedback/damage-runtime.js', import.meta.url), 'utf8');
  const hudCode = await fs.readFile(new URL('../demonic/gameplay/hud/runtime.js', import.meta.url), 'utf8');
  const presentationCode = await fs.readFile(new URL('../demonic/gameplay/presentation/runtime.js', import.meta.url), 'utf8');
  const coordinatorCode = await fs.readFile(new URL('../demonic/runtime/coordinator.js', import.meta.url), 'utf8');

  const sandbox = {
    __MAYHEM_RUNTIME: {
      GameShared: {
        gameplayTuning: {
          movement: { jogSpeed: 8, runSpeed: 14, jumpVelocity: 8.8 }
        },
        getWeaponPresentation(weaponId) {
          return {
            machinegun: { recoil: { z: -0.024, x: -0.045, pitch: 0.009, yaw: 0.006, roll: 0.004, armR: 0.14, armL: 0.06, muzzleMs: 55 } },
            shotgun: { recoil: { z: -0.09, x: -0.16, pitch: 0.03, yaw: 0.012, roll: 0.008, armR: 0.26, armL: 0.12, muzzleMs: 70 } }
          }[weaponId] || { recoil: { z: -0.05, x: -0.09, pitch: 0.018, yaw: 0.009, roll: 0.006, armR: 0.22, armL: 0.1, muzzleMs: 60 } };
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
    GameRuntimeProfile: {
      resolveApiUrl(path) {
        return 'https://mayhem.test' + String(path || '');
      },
      resolveWsUrl(path) {
        return 'wss://mayhem.test' + String(path || '');
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
  vm.runInContext(awarenessCode, context);
  vm.runInContext(playerCode, context);
  vm.runInContext(playerCombatCode, context);
  vm.runInContext(worldCode, context);
  vm.runInContext(netTransportCode, context);
  vm.runInContext(netInputHistoryCode, context);
  vm.runInContext(netStateViewCode, context);
  vm.runInContext(netCode, context);
  vm.runInContext(combatHudStateCode, context);
  vm.runInContext(weaponFeedbackCode, context);
  vm.runInContext(combatCode, context);
  vm.runInContext(abilityTargetingCode, context);
  vm.runInContext(abilityStateMachineCode, context);
  vm.runInContext(abilitiesCode, context);
  vm.runInContext(cameraCode, context);
  vm.runInContext(damageCode, context);
  vm.runInContext(hudCode, context);
  vm.runInContext(presentationCode, context);
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
  assert.equal(started.net.authorityMode, 'offline');
  assert.equal(started.playerCombat.hp, 500);
  assert.equal(started.playerCombat.alive, true);
  assert.equal(started.combat.selectedWeaponId, 'machinegun');
  assert.equal(typeof started.camera.fov, 'number');
  assert.equal(started.abilities.loadout.slot1, 'choke');
  assert.equal(typeof started.hud.weaponInfo, 'string');
  assert.equal(started.presentation.pose, 'idle');
  assert.equal(started.display.targetFps, 60);
  assert.ok(latest);
  assert.equal(latest.player.jogSpeed, 8);
  assert.equal(latest.combat.weaponCatalog[1].id, 'shotgun');

  coordinator.setInputState({ moveForward: true, sprint: true, ads: false });
  coordinator.start();
  const afterMotion = coordinator.getSnapshot();
  assert.equal(afterMotion.input.moveForward, true);
  assert.ok(afterMotion.player.speed >= 8);
  assert.ok(afterMotion.player.z < started.player.z);
  assert.equal(afterMotion.hud.movementInfo, 'SPRINT');
  assert.equal(afterMotion.net.status, 'local fallback lane');
  assert.equal(afterMotion.presentation.pose, 'sprint');
  assert.equal(afterMotion.player.x >= 0, true);
  assert.equal(afterMotion.player.z >= 0, true);
  assert.equal(Array.isArray(afterMotion.hud.awareness.segments), true);
  assert.equal(afterMotion.hud.vitals.hp, 500);
  assert.equal(afterMotion.net.inputSync.pendingInputCount > 0, true);

  const fired = coordinator.fire();
  assert.equal(fired, true);
  const afterFire = coordinator.getSnapshot();
  assert.equal(afterFire.combat.fireCooldownRemainingMs > 0, true);
  assert.equal(afterFire.combat.ammoInMag, 2);
  assert.equal(afterFire.hud.weaponInfo.includes('MACHINEGUN'), true);
  assert.equal(afterFire.presentation.weaponPresentation.weaponId, 'machinegun');
  assert.equal(afterFire.weaponFeedback.gunKick < 0, true);
  assert.equal(afterFire.combat.bodyDamage >= 0, true);
  assert.equal(afterFire.combat.hudState.status, 'cooldown');

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
  coordinator.start();
  assert.equal(coordinator.getSnapshot().abilities.lastCast.abilityId, 'choke');
  assert.equal(coordinator.getSnapshot().presentation.abilityPresentation.slot1Active, true);
  assert.equal(coordinator.getSnapshot().presentation.overlayPose, 'ability_choke');

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

  const cloudCoordinator = coordinatorApi.create({
    mode: {
      id: 'single_cloudflare',
      label: 'Solo Cloudflare (Bots)',
      authorityMode: 'networked',
      backendKind: 'cloudflare-prod',
      backendLabel: 'CLOUDFLARE PROD',
      roomId: 'cf-room-1'
    },
    context: { gameMode: 'ffa', roomId: 'cf-room-1' },
    onUpdate() {}
  });
  cloudCoordinator.start();
  const cloudSnapshot = cloudCoordinator.getSnapshot();
  assert.equal(cloudSnapshot.net.authoritative, true);
  assert.equal(cloudSnapshot.net.roomId, 'cf-room-1');
  assert.match(cloudSnapshot.net.status, /authoritative/i);
  assert.equal(cloudSnapshot.net.selfState, null);
  assert.equal(cloudSnapshot.net.predictedSelfState.weaponId, 'machinegun');
  assert.equal(cloudSnapshot.net.connectionState, 'error');
  assert.equal(typeof cloudSnapshot.presentation.reticle.type, 'string');
  assert.equal(Array.isArray(cloudSnapshot.combat.weaponCatalog), true);
  assert.equal(typeof cloudSnapshot.combat.weaponCatalog[0].name, 'string');
  assert.equal(cloudSnapshot.combat.weaponCatalog[1].id, 'shotgun');

  const damageBefore = coordinator.getSnapshot().hud.damage.flashLevel;
  coordinator.triggerDamageFeedback({ x: 12, z: -8 }, 50);
  const damageAfter = coordinator.getSnapshot().hud.damage.flashLevel;
  assert.equal(damageAfter > damageBefore, true);
});
