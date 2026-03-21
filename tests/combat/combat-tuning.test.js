import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

async function loadCombatTuningHarness(sharedOverrides = {}) {
  const code = await fs.readFile(new URL('../../js/combat/combat-tuning.js', import.meta.url), 'utf8');
  const sandbox = {
    __MAYHEM_RUNTIME: {
      GameShared: {
        gameplayTuning: {
          abilityCatalog: {
            choke: { range: 26, lockBoxPx: 315 },
            hook: { reticleRadiusPx: 68, range: 22 },
            deadeye: { range: 60, duration: 1.6, maxTargets: 2, damage: 160 },
            heal: { duration: 1.0, healAmount: 90 }
          },
          classPresets: {
            abilities: { wallhackRadius: 90 }
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
  assert.equal(first.hookReticleRadiusPx, 68);
  assert.equal(
    vm.runInContext(
      'Object.isFrozen(__MAYHEM_RUNTIME.GameCombatTuning.getClassAbilityTuning()) && (__MAYHEM_RUNTIME.GameCombatTuning.getClassAbilityTuning() === __MAYHEM_RUNTIME.GameCombatTuning.getClassAbilityTuning())',
      context
    ),
    true
  );
});
