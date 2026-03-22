import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

async function loadHarness(sharedOverride = null) {
  const [loadoutStateCode, loadoutRuntimeCode] = await Promise.all([
    fs.readFile(new URL('../../js/app/loadout-state.js', import.meta.url), 'utf8'),
    fs.readFile(new URL('../../js/app/loadout-runtime-sync.js', import.meta.url), 'utf8')
  ]);

  const weaponOrderCalls = [];
  const playerLoadoutCalls = [];
  const throwableSelectionCalls = [];
  const abilityLoadoutCalls = [];
  const netWeaponLoadoutCalls = [];
  const netAbilityLoadoutCalls = [];
  const abilityHudCalls = [];
  const storage = new Map();

  const shared = sharedOverride || {
    gameplayTuning: {
      throwables: {
        order: ['frag', 'plasma'],
        frag: { id: 'frag', label: 'Frag' },
        plasma: { id: 'plasma', label: 'Plasma' }
      },
      abilityCatalog: {
        deadeye: { id: 'deadeye', name: 'Deadeye' },
        hook: { id: 'hook', name: 'Hook' }
      },
      defaultAbilityId: 'deadeye'
    },
    getSelectableWeaponIds() {
      return ['machinegun', 'shotgun', 'rifle'];
    },
    getDefaultWeaponLoadout() {
      return ['rifle', 'shotgun'];
    },
    getDefaultAbilityId() {
      return 'deadeye';
    },
    normalizeAbilityId(abilityId) {
      return String(abilityId || 'deadeye');
    },
    getDefaultThrowableId() {
      return 'frag';
    },
    normalizeThrowableId(throwableId) {
      return String(throwableId || 'frag');
    }
  };

  const sandbox = {
    window: {
      localStorage: {
        getItem(key) {
          return storage.has(String(key || '')) ? storage.get(String(key || '')) : null;
        },
        setItem(key, value) {
          storage.set(String(key || ''), String(value || ''));
        }
      }
    },
    __MAYHEM_RUNTIME: {
      GameShared: shared,
      GameHitscan: {
        setWeaponOrder(slots) {
          weaponOrderCalls.push(Array.from(slots || []));
        }
      },
      GamePlayer: {
        setLoadout(loadout) {
          playerLoadoutCalls.push(JSON.parse(JSON.stringify(loadout || null)));
        }
      },
      GameThrowables: {
        setSelectedThrowable(id) {
          throwableSelectionCalls.push(String(id || ''));
        }
      },
      GameAbilities: {
        setLoadout(id) {
          abilityLoadoutCalls.push(String(id || ''));
        },
        getHudState() {
          return { abilityName: 'Deadeye', cooldown: 0 };
        }
      },
      GameUI: {
        updateAbilityInfo(payload) {
          abilityHudCalls.push(payload || null);
        }
      },
      GameNet: {
        commands: {
          sendWeaponLoadout(slot1, slot2) {
            netWeaponLoadoutCalls.push([String(slot1 || ''), String(slot2 || '')]);
          },
          sendAbilityLoadout(id) {
            netAbilityLoadoutCalls.push(String(id || ''));
          }
        }
      }
    },
    globalThis: null,
    console
  };
  sandbox.globalThis = sandbox;
  sandbox.globalThis.window = sandbox.window;

  const context = vm.createContext(sandbox);
  vm.runInContext(loadoutStateCode, context);
  vm.runInContext(loadoutRuntimeCode, context);

  return {
    runtime: sandbox.__MAYHEM_RUNTIME,
    weaponOrderCalls,
    playerLoadoutCalls,
    throwableSelectionCalls,
    abilityLoadoutCalls,
    netWeaponLoadoutCalls,
    netAbilityLoadoutCalls,
    abilityHudCalls,
    storage
  };
}

test('loadout runtime sync applies committed state to gameplay and net while ignoring weapon draft', async () => {
  const harness = await loadHarness();
  const loadoutState = harness.runtime.GameLoadoutState;
  const loadoutRuntime = harness.runtime.GameLoadoutRuntimeSync;

  loadoutState.init();
  loadoutState.beginWeaponDraft('machinegun');
  loadoutState.setSelectedThrowable('plasma');
  loadoutState.setSelectedAbility('hook');

  const committedBefore = loadoutState.getCommittedLoadout();
  assert.deepEqual(JSON.parse(JSON.stringify(committedBefore.weaponSlots)), ['rifle', 'shotgun']);

  const syncedBefore = loadoutRuntime.applyCommittedLoadout(true);
  assert.deepEqual(JSON.parse(JSON.stringify(syncedBefore.weaponSlots)), ['rifle', 'shotgun']);
  assert.deepEqual(harness.weaponOrderCalls, [['rifle', 'shotgun']]);
  assert.deepEqual(harness.playerLoadoutCalls, [{ slots: ['rifle', 'shotgun'] }]);
  assert.deepEqual(harness.netWeaponLoadoutCalls, [['rifle', 'shotgun']]);
  assert.equal(harness.throwableSelectionCalls.at(-1), 'plasma');
  assert.equal(harness.abilityLoadoutCalls.at(-1), 'hook');
  assert.equal(harness.netAbilityLoadoutCalls.at(-1), 'hook');

  loadoutState.commitWeaponDraft('rifle');
  const syncedAfter = loadoutRuntime.applyCommittedLoadout(true);
  assert.deepEqual(JSON.parse(JSON.stringify(syncedAfter.weaponSlots)), ['machinegun', 'rifle']);
  assert.deepEqual(harness.weaponOrderCalls.at(-1), ['machinegun', 'rifle']);
  assert.deepEqual(harness.playerLoadoutCalls.at(-1), { slots: ['machinegun', 'rifle'] });
  assert.deepEqual(harness.netWeaponLoadoutCalls.at(-1), ['machinegun', 'rifle']);
});
