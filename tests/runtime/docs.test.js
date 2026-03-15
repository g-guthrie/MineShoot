import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

import {
  gameplayTuning,
  getSelectableWeaponIds,
  getWeaponFalloffProfile,
  getWeaponPresentation,
  resolveWeaponAimProfile
} from '../../shared/gameplay-tuning.js';
import { getGameModeCatalog } from '../../shared/game-modes.js';
import { matchRules } from '../../shared/match-rules.js';
import { lmsRules } from '../../shared/lms-mode.js';

async function loadDocsHarness(loadoutOverride = null) {
  const code = await fs.readFile(new URL('../../js/runtime/docs.js', import.meta.url), 'utf8');
  const sandbox = {
    console,
    window: {},
    document: {},
    __MAYHEM_RUNTIME: {
      GameShared: {
        gameplayTuning,
        getSelectableWeaponIds,
        getWeaponFalloffProfile,
        getWeaponPresentation,
        resolveWeaponAimProfile,
        getGameModeCatalog,
        matchRules,
        lmsMode: { rules: lmsRules }
      },
      GameMenuLoadout: {
        getRuntimeSnapshot() {
          return loadoutOverride || {
            weaponSlots: ['machinegun', 'pistol'],
            abilityLoadout: { slot1: 'choke', slot2: 'missile' },
            selectedThrowableId: 'frag'
          };
        }
      }
    }
  };
  sandbox.globalThis = sandbox;

  vm.runInContext(code, vm.createContext(sandbox));
  return sandbox.__MAYHEM_RUNTIME.GameDocs._test;
}

test('briefing page teaches swapping weapons, throwables, and ability slots with current bindings', async () => {
  const docs = await loadDocsHarness();
  const html = docs.buildContent('home');

  assert.match(html, /swap weapons on 1 \/ 2 or the mouse wheel/i);
  assert.match(html, /Use Q for the current throwable, R for ability slot 1, and F for ability slot 2/i);
  assert.match(html, /Machine Gun/i);
  assert.match(html, /Pistol/i);
});

test('pistol weapon profile explains the circle-scan single-winner behavior', async () => {
  const docs = await loadDocsHarness();
  const data = docs.getData();
  const pistol = data.weapons.find((weapon) => weapon.id === 'pistol');

  assert.ok(pistol);
  assert.equal(docs.weaponFireModelLabel(pistol), 'Circle-scan single winner');

  const combatRows = docs.buildWeaponCombatRows(pistol);
  const gateRow = combatRows.find((row) => row.label === 'singleHitFromPellets');
  assert.ok(gateRow);
  assert.equal(gateRow.value, 'Yes');

  docs.setState({ selectedWeaponId: 'pistol' });
  const html = docs.buildContent('weapons');
  assert.match(html, /Circle-scan \/ circle ray trace weapon/i);
  assert.match(html, /singleHitFromPellets/i);
});

test('tunables page calls out the pistol versus shotgun spread-model split', async () => {
  const docs = await loadDocsHarness();
  const html = docs.buildContent('tunables');

  assert.match(html, /pistol is the signature edge case/i);
  assert.match(html, /Shotgun uses the same base family without that gate, so every pellet can land/i);
  assert.match(html, /primitiveType/i);
});
