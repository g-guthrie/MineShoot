import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import { getWeaponPresentation, resolveReloadPresentationState } from '../../shared/gameplay-tuning.js';

async function loadHudSyncHarness(runtimeOverrides = {}, globals = {}) {
  const [inputLabelsCode, code] = await Promise.all([
    fs.readFile(new URL('../../js/core/input-labels.js', import.meta.url), 'utf8'),
    fs.readFile(new URL('../../js/presentation/gameplay-hud-sync.js', import.meta.url), 'utf8')
  ]);
  const calls = {
    health: [],
    armor: [],
    weaponInfo: [],
    cooldown: [],
    damageEffects: [],
    abilityInfo: [],
    statusState: [],
    chokeReticle: [],
    hookReticle: [],
    plasmaState: [],
    deadeyeRect: [],
    abilityDebugPanel: [],
    deadeyeReticle: [],
    deadeyeHighlights: [],
    chokeAudio: [],
    audio: []
  };
  const runtime = {
    GameShared: {
      gameplayTuning: {
        abilityCatalog: {
          choke: { id: 'choke', name: 'Vader Choke', debugSummary: 'Square', tunableParams: ['lockBoxPx'] },
          hook: { id: 'hook', name: 'Hook', reticleRadiusPx: 60, debugSummary: 'Circle', tunableParams: ['reticleRadiusPx'] },
          deadeye: { id: 'deadeye', name: 'Deadeye', minDot: 0.22, debugSummary: 'Rect', tunableParams: [] }
        }
      },
      getAbilityCatalog() {
        return this.gameplayTuning.abilityCatalog;
      },
      getWeaponPresentation,
      resolveReloadPresentationState
    },
    GameHitscan: {
      getHudState() {
        return { status: 'ready', pct: 1 };
      },
      getCurrentWeapon() {
        return {
          id: 'pistol',
          name: 'Pistol',
          magazineSize: 12,
          ammoInMag: 6,
          automatic: false,
          bodyDamage: 70,
          headDamage: 120
        };
      }
    },
    GameUI: {
      updateHealth(hp, maxHp) { calls.health.push({ hp, maxHp }); },
      updateArmor(armor, armorMax) { calls.armor.push({ armor, armorMax }); },
      updateWeaponInfo(state) { calls.weaponInfo.push(state); },
      updateCooldown(state) { calls.cooldown.push(state); },
      updateDamageEffects(dt) { calls.damageEffects.push(dt); },
      updateAbilityInfo(state) { calls.abilityInfo.push(state); },
      updateChokeReticle(visible, width, height) { calls.chokeReticle.push({ visible, width, height }); },
      updateHookReticle(visible, size) { calls.hookReticle.push({ visible, size }); },
      updatePlasmaState(state) { calls.plasmaState.push(state); },
      updateDeadeyeDebugRect(visible, width, height) { calls.deadeyeRect.push({ visible, width, height }); },
      updateAbilityDebugPanel(visible, text) {
        calls.abilityDebugPanel.push({
          visible,
          text: (text && typeof text === 'object') ? JSON.parse(JSON.stringify(text)) : text
        });
      },
      updateDeadeyeReticle(camera, state) { calls.deadeyeReticle.push({ camera, state }); }
    },
    GameThrowables: {
      getSelectedThrowable() { return 'frag'; },
      getPlasmaDebugState() { return null; },
      getDebugState() {
        return {
          selectedThrowableId: 'frag',
          label: 'Frag',
          previewType: 'trajectory',
          charges: 1,
          cooldownRemaining: 0,
          telemetry: { predictedCount: 0 },
          plasma: null
        };
      }
    },
    GameAbilities: {
      getHudState() { return { abilityName: 'Vader Choke', cooldown: 3 }; },
      getLoadout() { return { abilityId: 'choke' }; },
      getChokeState() { return { endsAt: 1400 }; },
      getDeadeyeState() { return { targets: [{ id: 'a' }] }; },
      getChokeRectSize() { return { width: 240, height: 180 }; }
    },
    GamePlayer: {
      setStatusState(value) { calls.statusState.push(value); },
      getEquippedWeaponId() { return 'shotgun'; },
      setWeaponModel(weaponId) { calls.weaponInfo.push({ syncedWeaponId: weaponId }); },
      isChoked() { return false; }
    },
    GameAudio: {
      play(soundId, options) {
        calls.audio.push({
          soundId,
          options: options ? JSON.parse(JSON.stringify(options)) : null
        });
      },
      setChokeAudioState(value) { calls.chokeAudio.push(JSON.parse(JSON.stringify(value))); }
    },
    GameEnemy: {
      setDeadeyeHighlights(value) { calls.deadeyeHighlights.push(JSON.parse(JSON.stringify(value))); }
    },
    GamePlayerCombat: {
      getState() {
        return {
          hp: 410,
          hpMax: 500,
          armor: 55,
          armorMax: 90,
          alive: true,
          invulnerable: true,
          spawnShieldUntil: 1120,
          respawn: null
        };
      },
      getCurrentWeaponState() {
        return {
          id: 'rifle',
          name: 'Rifle',
          magazineSize: 30,
          ammoInMag: 17,
          automatic: false,
          bodyDamage: 48,
          headDamage: 110
        };
      },
      getWeaponHudState() {
        return { status: 'reloading', pct: 0.25 };
      }
    },
    ...runtimeOverrides
  };
  const sandbox = {
    __MAYHEM_RUNTIME: runtime,
    globalThis: null,
    window: {
      innerWidth: 1280,
      innerHeight: 720
    },
    document: {},
    Date: {
      now() { return 1000; }
    },
    ...globals
  };
  sandbox.globalThis = sandbox;
  const context = vm.createContext(sandbox);
  vm.runInContext(inputLabelsCode, context);
  vm.runInContext(code, context);
  return {
    hudSync: sandbox.__MAYHEM_RUNTIME.GameGameplayHudSync,
    calls
  };
}

test('gameplay hud sync owns local HUD/status updates', async () => {
  const harness = await loadHudSyncHarness();

  harness.hudSync.update({
    camera: { fov: 60, aspect: 16 / 9 },
    dt: 0.16,
    multiplayerMode: false,
    debugVisualsOn: true
  });

  assert.deepEqual(harness.calls.weaponInfo[0], { syncedWeaponId: 'rifle' });
  assert.deepEqual(harness.calls.weaponInfo[1], {
    id: 'rifle',
    name: 'Rifle',
    magazineSize: 30,
    ammoInMag: 17,
    automatic: false,
    bodyDamage: 48,
    headDamage: 110
  });
  assert.deepEqual(harness.calls.cooldown[0], { status: 'reloading', pct: 0.25 });
  assert.deepEqual(harness.calls.health[0], { hp: 410, maxHp: 500 });
  assert.deepEqual(harness.calls.armor[0], { armor: 55, armorMax: 90 });
  assert.equal(harness.calls.damageEffects[0], 0.16);
  assert.deepEqual(harness.calls.abilityInfo[0], { abilityName: 'Vader Choke', cooldown: 3 });
  assert.equal(harness.calls.statusState.length, 1);
  assert.deepEqual(harness.calls.chokeReticle[0], { visible: true, width: 240, height: 180 });
  assert.deepEqual(harness.calls.hookReticle[0], { visible: false, size: 120 });
  assert.equal(harness.calls.plasmaState[0].visible, false);
  assert.equal(harness.calls.deadeyeRect[0].visible, false);
  assert.equal(harness.calls.abilityDebugPanel[0].visible, true);
  assert.equal(Array.isArray(harness.calls.abilityDebugPanel[0].text), true);
  assert.equal(harness.calls.abilityDebugPanel[0].text.length, 3);
  assert.deepEqual(Array.from(harness.calls.abilityDebugPanel[0].text, (section) => section.tone), ['weapon', 'ability1', 'throwable']);
  assert.ok(harness.calls.abilityDebugPanel[0].text[1].title.includes('VADER CHOKE'));
  assert.ok(harness.calls.abilityDebugPanel[0].text[2].title.includes('Q FRAG :: 1'));
  assert.deepEqual(harness.calls.deadeyeReticle[0].state, { targets: [{ id: 'a' }] });
  assert.deepEqual(harness.calls.deadeyeHighlights[0], {});
  assert.deepEqual(harness.calls.chokeAudio[0], { casterActive: true, victimActive: false });
});

test('gameplay hud sync passes a stable frame timestamp into weapon combat selectors', async () => {
  const weaponCallTimes = [];
  const harness = await loadHudSyncHarness({
    GamePlayerCombat: {
      getState() {
        return {
          hp: 410,
          hpMax: 500,
          armor: 55,
          armorMax: 90,
          alive: true,
          invulnerable: false,
          spawnShieldUntil: 0,
          respawn: null
        };
      },
      getCurrentWeaponState(now) {
        weaponCallTimes.push({ kind: 'weapon', now });
        return {
          id: 'rifle',
          name: 'Rifle',
          magazineSize: 30,
          ammoInMag: 17,
          automatic: false,
          bodyDamage: 48,
          headDamage: 110
        };
      },
      getWeaponHudState(now) {
        weaponCallTimes.push({ kind: 'hud', now });
        return { status: 'ready', pct: 1 };
      }
    }
  });

  harness.hudSync.update({
    camera: { fov: 60, aspect: 16 / 9 },
    dt: 0.16,
    multiplayerMode: false,
    debugVisualsOn: false
  });

  assert.deepEqual(weaponCallTimes, [
    { kind: 'weapon', now: 1000 },
    { kind: 'hud', now: 1000 }
  ]);
});

test('gameplay hud sync projects the plasma catch radius when debug visuals are on and plasma is equipped', async () => {
  const harness = await loadHudSyncHarness({
    GameThrowables: {
      getDebugState() {
        return {
          selectedThrowableId: 'plasma',
          label: 'Plasma Grenade',
          previewType: 'trajectory',
          charges: 1,
          cooldownRemaining: 0,
          telemetry: { predictedCount: 0 },
          plasma: {
            catchRadius: 3.0,
            stickDelaySec: 2.2,
            maxLifeSec: 6.0,
            blastRadius: 5.0,
            referenceDistance: 10
          }
        };
      }
    }
  });

  harness.hudSync.update({
    camera: { fov: 60, aspect: 16 / 9 },
    dt: 0.16,
    multiplayerMode: false,
    debugVisualsOn: true
  });

  assert.equal(harness.calls.plasmaState[0].visible, true);
  assert.equal(Array.isArray(harness.calls.plasmaState[0].ringDiametersPx), true);
  assert.equal(harness.calls.plasmaState[0].ringDiametersPx.length, 1);
  assert.ok(harness.calls.plasmaState[0].ringDiametersPx[0] > 185);
  assert.ok(harness.calls.plasmaState[0].ringDiametersPx[0] < 190);
  assert.equal(harness.calls.plasmaState[0].catchRadius, 3.0);
  assert.equal(harness.calls.plasmaState[0].stickDelaySec, 2.2);
  assert.equal(harness.calls.chokeReticle[0].visible, true);
  assert.equal(harness.calls.deadeyeRect[0].visible, false);
  assert.equal(Array.isArray(harness.calls.abilityDebugPanel[0].text), true);
  assert.ok(harness.calls.abilityDebugPanel[0].text[2].title.includes('Q PLASMA GRENADE :: 1'));
  assert.ok(harness.calls.abilityDebugPanel[0].text[2].body.includes('catch: 3.00m | stick: 2.2s'));
  assert.ok(harness.calls.abilityDebugPanel[0].text[2].body.includes('blast: 5.00m | life: 6.0s'));
});

test('gameplay hud sync uses network deadeye shaping in multiplayer', async () => {
  const harness = await loadHudSyncHarness({
    GameNet: {
      timing: {
        getAuthoritativeNow() {
          return 900;
        }
      },
      view: {
        getSelfAbilityState() {
          return {
            abilityId: 'deadeye',
            chokeState: { endsAt: 950 },
            deadeyeState: {
              maxLocks: 2,
              lockCount: 1,
              targetIds: ['usr_remote']
            }
          };
        }
      },
      effects: {
        damagePointForEntityId(id) {
          if (id === 'usr_remote') return { x: 1, y: 2, z: 3 };
          return null;
        }
      },
      remoteEntities: {
        setDeadeyeHighlights(value) { harness.calls.deadeyeHighlights.push(JSON.parse(JSON.stringify(value))); }
      }
    },
    GameAbilityBoundary: {
      buildNetworkDeadeyeUiState(state, resolveTargetWorldPos, now) {
        assert.equal(now, 900);
        return {
          targets: [{
            targetId: state.targetIds[0],
            worldPos: resolveTargetWorldPos(state.targetIds[0]),
            locked: true,
            progress: 1
          }]
        };
      }
    }
  });
  harness.calls.chokeAudio.length = 0;
  harness.calls.deadeyeHighlights.length = 0;
  harness.calls.health.length = 0;
  harness.calls.armor.length = 0;
  harness.hudSync.update({
    camera: { fov: 60, aspect: 16 / 9 },
    dt: 0.05,
    multiplayerMode: true,
    debugVisualsOn: false
  });

  assert.equal(harness.calls.abilityInfo.length, 0);
  assert.deepEqual(harness.calls.health[0], { hp: 410, maxHp: 500 });
  assert.deepEqual(harness.calls.armor[0], { armor: 55, armorMax: 90 });
  assert.deepEqual(harness.calls.deadeyeReticle[0].state, {
    targets: [{ targetId: 'usr_remote', worldPos: { x: 1, y: 2, z: 3 }, locked: true, progress: 1 }]
  });
  assert.deepEqual(harness.calls.deadeyeHighlights[0], {
    usr_remote: { locked: true, progress: 1 }
  });
  assert.deepEqual(harness.calls.chokeAudio[0], { casterActive: true, victimActive: false });
});

test('gameplay hud sync does not replay reload cues when a background reload completes before swap-back', async () => {
  var activeWeaponId = 'rifle';
  var weaponStates = {
    rifle: {
      id: 'rifle',
      name: 'Rifle',
      reloadMs: 1550,
      reloadRemaining: 1550,
      reloadedFlashRemaining: 0,
      reloading: true,
      reloadPct: 0,
      reloadPhase: 'raise',
      reloadPhasePct: 0,
      magazineSize: 15,
      ammoInMag: 0,
      automatic: false,
      bodyDamage: 44,
      headDamage: 104
    },
    sniper: {
      id: 'sniper',
      name: 'Sniper',
      reloadMs: 2100,
      reloadRemaining: 0,
      reloadedFlashRemaining: 0,
      reloading: false,
      reloadPct: 1,
      reloadPhase: 'ready',
      reloadPhasePct: 1,
      magazineSize: 5,
      ammoInMag: 5,
      automatic: false,
      bodyDamage: 230,
      headDamage: 500
    }
  };
  const harness = await loadHudSyncHarness({
    GamePlayerCombat: {
      getState() {
        return {
          hp: 410,
          hpMax: 500,
          armor: 55,
          armorMax: 90,
          alive: true,
          invulnerable: false,
          spawnShieldUntil: 0,
          respawn: null
        };
      },
      getWeaponLoadout() {
        return { slots: ['rifle', 'sniper'] };
      },
      getCurrentWeaponState() {
        return weaponStates[activeWeaponId];
      },
      getWeaponState(weaponId) {
        return weaponStates[weaponId];
      },
      getWeaponHudState() {
        var state = weaponStates[activeWeaponId];
        return state.reloading
          ? { status: 'reloading', pct: state.reloadPct, phase: state.reloadPhase }
          : (state.reloadedFlashRemaining > 0
            ? { status: 'reloaded', pct: 1, phase: 'complete' }
            : { status: 'ready', pct: 1, phase: 'ready' });
      }
    }
  });

  harness.hudSync.update({
    camera: { fov: 60, aspect: 16 / 9 },
    dt: 0.016,
    multiplayerMode: false,
    debugVisualsOn: false
  });
  assert.deepEqual(harness.calls.audio.map((entry) => entry.options && entry.options.cue), ['start']);

  weaponStates.rifle = {
    ...weaponStates.rifle,
    reloadRemaining: 700,
    reloadPct: 1 - (700 / 1550),
    reloadPhase: 'manipulate',
    reloadPhasePct: 0.35
  };
  harness.hudSync.update({
    camera: { fov: 60, aspect: 16 / 9 },
    dt: 0.016,
    multiplayerMode: false,
    debugVisualsOn: false
  });
  assert.deepEqual(harness.calls.audio.map((entry) => entry.options && entry.options.cue), ['start', 'manipulate']);

  activeWeaponId = 'sniper';
  harness.hudSync.update({
    camera: { fov: 60, aspect: 16 / 9 },
    dt: 0.016,
    multiplayerMode: false,
    debugVisualsOn: false
  });
  assert.deepEqual(harness.calls.audio.map((entry) => entry.options && entry.options.cue), ['start', 'manipulate']);

  weaponStates.rifle = {
    ...weaponStates.rifle,
    reloadRemaining: 0,
    reloadedFlashRemaining: 400,
    reloading: false,
    reloadPct: 1,
    reloadPhase: 'complete',
    reloadPhasePct: 1,
    ammoInMag: 15
  };
  harness.hudSync.update({
    camera: { fov: 60, aspect: 16 / 9 },
    dt: 0.016,
    multiplayerMode: false,
    debugVisualsOn: false
  });
  assert.deepEqual(harness.calls.audio.map((entry) => entry.options && entry.options.cue), ['start', 'manipulate']);

  activeWeaponId = 'rifle';
  harness.hudSync.update({
    camera: { fov: 60, aspect: 16 / 9 },
    dt: 0.016,
    multiplayerMode: false,
    debugVisualsOn: false
  });
  assert.deepEqual(harness.calls.audio.map((entry) => entry.options && entry.options.cue), ['start', 'manipulate']);
});
