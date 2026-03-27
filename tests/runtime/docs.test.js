import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

import {
  gameplayTuning,
  getMovementTuning,
  getSelectableWeaponIds,
  getSurvivabilityTuning,
  getWeaponFalloffProfile,
  getWeaponPresentation,
  resolveWeaponAimProfile
} from '../../shared/gameplay-tuning.js';
import { PLAYER_SPAWN_SHIELD_MS, RESPAWN_DELAY_MS } from '../../shared/combat-timings.js';
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
        getMovementTuning,
        getSelectableWeaponIds,
        getSurvivabilityTuning,
        getCombatTimings() {
          return {
            PLAYER_SPAWN_SHIELD_MS,
            RESPAWN_DELAY_MS
          };
        },
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

test('briefing page teaches swapping weapons, throwables, and rolls with current bindings', async () => {
  const docs = await loadDocsHarness();
  const html = docs.buildContent('home');

  assert.match(html, /reload on R, and swap weapons on 1 \/ 2 or the mouse wheel/i);
  assert.match(html, /Use Q for the current throwable and E to roll in your movement direction/i);
  assert.match(html, /400 damage = 1 life/i);
  assert.match(html, /Auto Rifle/i);
  assert.match(html, /Hand Cannon/i);
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
  assert.match(html, /single-ray hitscan/i);
  assert.match(html, /very wide spread/i);
  assert.match(html, /Fresh Down/i);
  assert.doesNotMatch(html, /singleHitFromPellets/i);
});

test('combat math page explains the live comparison rules for the current build', async () => {
  const docs = await loadDocsHarness();
  const html = docs.buildContent('tunables');

  assert.match(html, /Only sniper uses a live scoped view right now/i);
  assert.match(html, /Fresh Down counts assume a fresh 500-durability target/i);
  assert.match(html, /Live Cross-Weapon Snapshot/i);
  assert.match(html, /Hand Cannon/i);
});

test('throwable detail pages expose the corrected projectile and denial behavior', async () => {
  const docs = await loadDocsHarness();
  docs.setState({ selectedThrowableId: 'plasma' });
  const plasmaHtml = docs.buildContent('throwables');
  docs.setState({ selectedThrowableId: 'molotov' });
  const molotovHtml = docs.buildContent('throwables');

  assert.match(plasmaHtml, /snaps the last short distance/i);
  assert.doesNotMatch(plasmaHtml, /Acquires enemies in a cone and sticks on contact/i);
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
  assert.match(homeHtml, /Use C for the current throwable and V to roll in your movement direction/i);
  assert.match(controlsHtml, /I \/ J \/ K \/ L/i);
  assert.match(controlsHtml, /docs-kbd">V<\/span>/i);
  assert.match(controlsHtml, /docs-control-title">Roll<\/span>/i);
  assert.match(controlsHtml, /T reload/i);
  assert.match(controlsHtml, /Throwables/i);
  assert.match(controlsHtml, /only sniper uses a live scoped view/i);
  assert.match(controlsHtml, /field manual.*J/i);
});
