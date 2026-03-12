import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

async function loadDemonicAbilities() {
  const code = await fs.readFile(new URL('../demonic/gameplay/abilities/runtime.js', import.meta.url), 'utf8');
  const sandbox = {
    __MAYHEM_RUNTIME: {
      GameShared: {
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
    __DEMONIC_RUNTIME: {},
    globalThis: null,
    console,
    Date
  };
  sandbox.globalThis = sandbox;
  vm.runInContext(code, vm.createContext(sandbox));
  return sandbox.__DEMONIC_RUNTIME.GameAbilityRuntime;
}

test('demonic ability runtime exposes default loadout and cooldown-backed trigger state', async () => {
  const api = await loadDemonicAbilities();
  const runtime = api.create();

  const before = runtime.getSnapshot();
  assert.equal(before.loadout.slot1, 'choke');
  assert.equal(before.hud.slot2Name, 'Missile');

  const cast = runtime.trigger(1);
  assert.equal(cast.ok, true);
  const after = runtime.getSnapshot();
  assert.equal(after.lastCast.abilityId, 'choke');
  assert.equal(after.hud.slot1CooldownMs > 0, true);
  assert.equal(after.hud.slot1Active, true);
  assert.equal(after.activeStates.slot1.abilityId, 'choke');
});
