import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import { gameplayTuning } from '../../shared/gameplay-tuning.js';

async function loadCombatTuningHarness(sharedOverrides = {}) {
  const code = await fs.readFile(new URL('../../js/combat/combat-tuning.js', import.meta.url), 'utf8');
  const sandbox = {
    __MAYHEM_RUNTIME: {
      GameShared: {
        gameplayTuning: {
          abilityCatalog: {
            choke: gameplayTuning.abilityCatalog.choke,
            hook: gameplayTuning.abilityCatalog.hook,
            deadeye: gameplayTuning.abilityCatalog.deadeye,
            missile: gameplayTuning.abilityCatalog.missile
          },
          classPresets: {
            abilities: gameplayTuning.classPresets.abilities
          },
          throwables: {},
          awareness: {},
          enemy: {},
          throwableMechanics: {}
        },
        ...sharedOverrides
      }
    },
    globalThis: null
  };
  sandbox.globalThis = sandbox;
  const context = vm.createContext(sandbox);
  vm.runInContext(code, context);
  return {
    tuning: sandbox.__MAYHEM_RUNTIME.GameCombatTuning,
    context
  };
}

test('combat tuning returns one frozen class ability tuning object', async () => {
  const { tuning, context } = await loadCombatTuningHarness();

  const first = tuning.getClassAbilityTuning();
  assert.equal(first.hookReticleRadiusPx, gameplayTuning.abilityCatalog.hook.reticleRadiusPx);
  assert.equal(first.deadeyeLockBoxPx, gameplayTuning.abilityCatalog.deadeye.lockBoxPx);
  assert.equal(
    vm.runInContext(
      'Object.isFrozen(__MAYHEM_RUNTIME.GameCombatTuning.getClassAbilityTuning()) && (__MAYHEM_RUNTIME.GameCombatTuning.getClassAbilityTuning() === __MAYHEM_RUNTIME.GameCombatTuning.getClassAbilityTuning())',
      context
    ),
    true
  );
});
