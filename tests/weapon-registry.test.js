import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

async function loadWeaponRegistry() {
  const code = await fs.readFile(new URL('../js/domain/weapons/registry.js', import.meta.url), 'utf8');
  const sandbox = {
    globalThis: {
      __MAYHEM_RUNTIME: {
        GameShared: {
          gameplayTuning: {
            weaponStats: {
              rifle: { id: 'rifle' },
              pistol: { id: 'pistol' },
              machinegun: { id: 'machinegun' },
              shotgun: { id: 'shotgun' },
              sniper: { id: 'sniper' },
              seekergun: { id: 'seekergun' }
            }
          }
        }
      }
    },
    console
  };
  vm.runInContext(code, vm.createContext(sandbox));
  return sandbox.globalThis.__MAYHEM_RUNTIME.GameWeaponRegistry;
}

test('machinegun registry entry points at the embedded AK model', async () => {
  const registry = await loadWeaponRegistry();
  const entry = registry.get('machinegun');

  assert.equal(entry.family, 'hitscan');
  assert.equal(entry.visual.model.kind, 'embedded-gltf');
  assert.equal(entry.visual.model.url, '/assets/models/weapons/ak-47.gltf');
  assert.equal(Array.isArray(entry.visual.model.scale), true);
  assert.equal(entry.visual.model.scale.length, 3);
});

test('pistol registry entry points at the embedded Desert Eagle model', async () => {
  const registry = await loadWeaponRegistry();
  const entry = registry.get('pistol');

  assert.equal(entry.family, 'hitscan');
  assert.equal(entry.visual.model.kind, 'embedded-gltf');
  assert.equal(entry.visual.model.url, '/assets/models/weapons/desert-eagle.gltf');
  assert.equal(Array.isArray(entry.visual.model.scale), true);
  assert.equal(entry.visual.model.scale.length, 3);
});
