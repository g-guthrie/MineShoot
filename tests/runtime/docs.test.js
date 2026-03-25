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

async function loadDocsHarness(loadoutOverride = null, runtimeOverrides = {}) {
  const [inputLabelsCode, code] = await Promise.all([
    fs.readFile(new URL('../../js/core/input-labels.js', import.meta.url), 'utf8'),
    fs.readFile(new URL('../../js/runtime/docs.js', import.meta.url), 'utf8')
  ]);
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
        matchRules
      },
      GameMenuLoadout: {
        getRuntimeSnapshot() {
          return loadoutOverride || {
            weaponSlots: ['machinegun', 'pistol'],
            selectedAbilityId: 'choke',
            selectedThrowableId: 'frag'
          };
        }
      },
      ...runtimeOverrides
    }
  };
  sandbox.globalThis = sandbox;

  const context = vm.createContext(sandbox);
  vm.runInContext(inputLabelsCode, context);
  vm.runInContext(code, context);
  return sandbox.__MAYHEM_RUNTIME.GameDocs._test;
}

test('briefing page teaches swapping weapons, throwables, and the equipped ability with current bindings', async () => {
  const docs = await loadDocsHarness();
  const html = docs.buildContent('home');

  assert.match(html, /reload on R, and swap weapons on 1 \/ 2 or the mouse wheel/i);
  assert.match(html, /Use Q for the current throwable, E to roll in your movement direction, and G for your equipped ability/i);
  assert.match(html, /Machine Gun/i);
  assert.match(html, /Pistol/i);
});

test('pistol weapon profile explains the normal single-ray hand-cannon behavior', async () => {
  const docs = await loadDocsHarness();
  const data = docs.getData();
  const pistol = data.weapons.find((weapon) => weapon.id === 'pistol');

  assert.ok(pistol);
  assert.equal(docs.weaponFireModelLabel(pistol), 'Single-ray hitscan');

  const combatRows = docs.buildWeaponCombatRows(pistol);
  const primitiveRow = combatRows.find((row) => row.label === 'primitiveType');
  assert.ok(primitiveRow);
  assert.equal(primitiveRow.value, 'hitscan_single');

  docs.setState({ selectedWeaponId: 'pistol' });
  const html = docs.buildContent('weapons');
  assert.match(html, /Single-shot hitscan/i);
  assert.match(html, /same spread-driven one-ray shot model/i);
  assert.doesNotMatch(html, /singleHitFromPellets/i);
});

test('tunables page calls out pistol returning to the normal hitscan path', async () => {
  const docs = await loadDocsHarness();
  const html = docs.buildContent('tunables');

  assert.match(html, /Pistol now uses the same single-ray hitscan path/i);
  assert.match(html, /Shotgun remains the dedicated multi-pellet edge case/i);
  assert.match(html, /primitiveType/i);
});

test('throwable detail pages expose the richer projectile and denial tuning knobs', async () => {
  const docs = await loadDocsHarness();
  docs.setState({ selectedThrowableId: 'plasma' });
  const plasmaHtml = docs.buildContent('throwables');
  docs.setState({ selectedThrowableId: 'molotov' });
  const molotovHtml = docs.buildContent('throwables');

  assert.match(plasmaHtml, /catchRadius/i);
  assert.match(plasmaHtml, /stickExplodeDelay/i);
  assert.match(plasmaHtml, /maxLife/i);
  assert.match(molotovHtml, /fireInnerRadius/i);
  assert.match(molotovHtml, /fireLingerDuration/i);
  assert.match(molotovHtml, /fireLingerTickDamage/i);
});

test('docs pages reflect remapped slot, throwable, and manual labels', async () => {
  const docs = await loadDocsHarness(null, {
    GameInputBindings: {
      getDisplayLabel(actionId) {
        const map = {
          weapon_slot_1: 'Z',
          weapon_slot_2: 'X',
          reload: 'T',
          throwable: 'C',
          roll: 'V',
          ability_1: 'G',
          sprint: 'LEFT',
          jump: 'SPACE',
          ads_key: 'ALT',
          open_manual: 'J',
          move_forward: 'I',
          move_left: 'J',
          move_backward: 'K',
          move_right: 'L'
        };
        return map[actionId] || '--';
      },
      getFixedControls() {
        return [];
      }
    }
  });

  const homeHtml = docs.buildContent('home');
  const controlsHtml = docs.buildContent('controls');

  assert.match(homeHtml, /swap with key Z/i);
  assert.match(homeHtml, /reload on T/i);
  assert.match(homeHtml, /Use C for the current throwable, V to roll in your movement direction, and G for your equipped ability/i);
  assert.match(controlsHtml, /I \/ J \/ K \/ L/i);
  assert.match(controlsHtml, /docs-kbd">V<\/span>/i);
  assert.match(controlsHtml, /docs-control-title">Roll<\/span>/i);
  assert.match(controlsHtml, /T reload/i);
  assert.match(controlsHtml, /Sniper auto-scopes when you equip it/i);
  assert.match(controlsHtml, /field manual.*J/i);
});
