import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

async function loadPlayerCombatHarness(runtimeOverrides = {}) {
  const code = await fs.readFile(new URL('../js/player-combat.js', import.meta.url), 'utf8');
  let clearTransientCalls = 0;
  const runtime = {
    GameShared: {
      damage: null
    },
    GameUI: {
      updateHealth() {},
      updateArmor() {},
      updateDamageEffects() {},
      updateAbilityInfo() {},
      showDirectionalDamage() {}
    },
    GamePlayer: {
      respawnRandom() {},
      getPosition() { return { x: 0, y: 0, z: 0 }; },
      getRotation() { return { yaw: 0 }; }
    },
    GameAbilities: {
      clearTransientState() {
        clearTransientCalls += 1;
      },
      getHudState() { return {}; }
    },
    GameAudio: {
      play() {}
    },
    GameEvents: {
      PLAYER_DAMAGED: 'player.damaged',
      emit() {}
    },
    ...runtimeOverrides
  };
  const sandbox = {
    __MAYHEM_RUNTIME: runtime,
    globalThis: null,
    console
  };
  sandbox.globalThis = sandbox;
  vm.runInContext(code, vm.createContext(sandbox));
  return {
    GamePlayerCombat: sandbox.__MAYHEM_RUNTIME.GamePlayerCombat,
    getClearTransientCalls() {
      return clearTransientCalls;
    }
  };
}

test('player combat clears transient ability effects when death forces a respawn', async () => {
  const harness = await loadPlayerCombatHarness();
  harness.GamePlayerCombat.init({
    isPlaying() { return true; },
    isMultiplayer() { return false; }
  });

  harness.GamePlayerCombat.consumeDamage(999, 'body', null);

  assert.equal(harness.getClearTransientCalls(), 2);
});
