import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

async function loadHudSyncHarness(runtimeOverrides = {}, globals = {}) {
  const code = await fs.readFile(new URL('../js/gameplay-hud-sync.js', import.meta.url), 'utf8');
  const calls = {
    cooldown: [],
    damageEffects: [],
    abilityInfo: [],
    healFlash: [],
    statusState: [],
    chokeReticle: [],
    hookReticle: [],
    deadeyeRect: [],
    abilityDebugPanel: [],
    deadeyeReticle: [],
    deadeyeHighlights: [],
    chokeAudio: []
  };
  const runtime = {
    GameShared: {
      gameplayTuning: {
        abilityCatalog: {
          choke: { id: 'choke', name: 'Vader Choke', debugSummary: 'Square', tunableParams: ['lockBoxPx'] },
          deadeye: { id: 'deadeye', name: 'Deadeye', minDot: 0.22, debugSummary: 'Rect', tunableParams: [] }
        }
      }
    },
    GameHitscan: {
      getHudState() {
        return { status: 'ready', pct: 1 };
      }
    },
    GameUI: {
      updateCooldown(state) { calls.cooldown.push(state); },
      updateDamageEffects(dt) { calls.damageEffects.push(dt); },
      updateAbilityInfo(state) { calls.abilityInfo.push(state); },
      updateChokeReticle(visible, width, height) { calls.chokeReticle.push({ visible, width, height }); },
      updateHookReticle(visible, size) { calls.hookReticle.push({ visible, size }); },
      updateDeadeyeDebugRect(visible, width, height) { calls.deadeyeRect.push({ visible, width, height }); },
      updateAbilityDebugPanel(visible, text) { calls.abilityDebugPanel.push({ visible, text }); },
      updateDeadeyeReticle(camera, state) { calls.deadeyeReticle.push({ camera, state }); }
    },
    GameAbilities: {
      getHudState() { return { slot1Cooldown: 3, slot2Cooldown: 5 }; },
      getLoadout() { return { slot1: 'choke', slot2: 'deadeye' }; },
      getChokeState() { return { endsAt: 1400 }; },
      getHealState() { return { endsAt: 1500 }; },
      getDeadeyeState() { return { targets: [{ id: 'a' }] }; },
      getChokeRectSize() { return { width: 240, height: 180 }; }
    },
    GamePlayer: {
      setHealFlash(value) { calls.healFlash.push(value); },
      setStatusState(value) { calls.statusState.push(value); },
      isChoked() { return false; }
    },
    GameAudio: {
      setChokeAudioState(value) { calls.chokeAudio.push(JSON.parse(JSON.stringify(value))); }
    },
    GameEnemy: {
      setDeadeyeHighlights(value) { calls.deadeyeHighlights.push(JSON.parse(JSON.stringify(value))); }
    },
    GamePlayerCombat: {
      isInvulnerable() { return true; }
    },
    GameCombatTuning: {
      getClassAbilityTuning() { return { hookReticleRadiusPx: 60 }; }
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
  vm.runInContext(code, vm.createContext(sandbox));
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

  assert.deepEqual(harness.calls.cooldown[0], { status: 'ready', pct: 1 });
  assert.equal(harness.calls.damageEffects[0], 0.16);
  assert.deepEqual(harness.calls.abilityInfo[0], { slot1Cooldown: 3, slot2Cooldown: 5 });
  assert.equal(harness.calls.healFlash[0], true);
  assert.equal(harness.calls.statusState.length, 1);
  assert.deepEqual(harness.calls.chokeReticle[0], { visible: true, width: 240, height: 180 });
  assert.deepEqual(harness.calls.hookReticle[0], { visible: false, size: 120 });
  assert.equal(harness.calls.deadeyeRect[0].visible, true);
  assert.equal(harness.calls.abilityDebugPanel[0].visible, true);
  assert.ok(harness.calls.abilityDebugPanel[0].text.includes('VADER CHOKE'));
  assert.deepEqual(harness.calls.deadeyeReticle[0].state, { targets: [{ id: 'a' }] });
  assert.deepEqual(harness.calls.deadeyeHighlights[0], {});
  assert.deepEqual(harness.calls.chokeAudio[0], { casterActive: true, victimActive: false });
});

test('gameplay hud sync uses network deadeye shaping in multiplayer', async () => {
  const harness = await loadHudSyncHarness({
    GameNet: {
      getSelfAbilityState() {
        return {
          abilityLoadout: { slot1: 'deadeye', slot2: 'choke' },
          chokeState: { endsAt: 1400 },
          deadeyeState: {
            maxLocks: 2,
            lockCount: 1,
            targetIds: ['usr_remote']
          }
        };
      },
      damagePointForEntityId(id) {
        if (id === 'usr_remote') return { x: 1, y: 2, z: 3 };
        return null;
      }
    },
    GameNetEntities: {
      setDeadeyeHighlights(value) { harness.calls.deadeyeHighlights.push(JSON.parse(JSON.stringify(value))); }
    },
    GameAbilityBoundary: {
      buildNetworkDeadeyeUiState(state, resolveTargetWorldPos) {
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
  harness.hudSync.update({
    camera: { fov: 60, aspect: 16 / 9 },
    dt: 0.05,
    multiplayerMode: true,
    debugVisualsOn: false
  });

  assert.equal(harness.calls.abilityInfo.length, 0);
  assert.deepEqual(harness.calls.deadeyeReticle[0].state, {
    targets: [{ targetId: 'usr_remote', worldPos: { x: 1, y: 2, z: 3 }, locked: true, progress: 1 }]
  });
  assert.deepEqual(harness.calls.deadeyeHighlights[0], {
    usr_remote: { locked: true, progress: 1 }
  });
  assert.deepEqual(harness.calls.chokeAudio[0], { casterActive: true, victimActive: false });
});
