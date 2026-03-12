import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

async function loadReticleRuntime() {
  const previewCode = await fs.readFile(new URL('../demonic/gameplay/abilities/preview-runtime.js', import.meta.url), 'utf8');
  const code = await fs.readFile(new URL('../demonic/gameplay/presentation/reticle-runtime.js', import.meta.url), 'utf8');
  const sandbox = {
    __DEMONIC_RUNTIME: {},
    globalThis: null,
    console,
    window: {
      innerWidth: 1280,
      innerHeight: 720
    }
  };
  sandbox.globalThis = sandbox;
  const context = vm.createContext(sandbox);
  vm.runInContext(previewCode, context);
  vm.runInContext(code, context);
  return sandbox.__DEMONIC_RUNTIME.GameReticleRuntime;
}

test('demonic reticle runtime mirrors Mayhem-inspired scope, circle, and ability reticle rules', async () => {
  const api = await loadReticleRuntime();
  const reticle = api.create();

  const shotgun = reticle.resolve({ selectedWeaponId: 'shotgun' }, { adsActive: false }, {});
  assert.equal(shotgun.type, 'circle');
  assert.equal(shotgun.width, 280);

  const sniperScope = reticle.resolve({ selectedWeaponId: 'sniper' }, { adsActive: true }, {});
  assert.equal(sniperScope.type, 'scope');

  const deadeye = reticle.resolve(
    { selectedWeaponId: 'rifle' },
    { adsActive: false },
    {
      activeStates: {
        slot1: {
          abilityId: 'deadeye',
          meta: { lockCount: 1, maxLocks: 2, minDot: 0.22 }
        }
      }
    },
    { fov: 60, aspect: 16 / 9 }
  );
  assert.equal(deadeye.type, 'deadeye_rect');
  assert.equal(deadeye.label, 'DEADEYE 1/2');
  assert.equal(deadeye.width > 60, true);

  const choke = reticle.resolve(
    { selectedWeaponId: 'rifle' },
    { adsActive: false },
    {
      activeStates: {
        slot1: {
          abilityId: 'choke',
          meta: { lockBoxPx: 315, deadeyeMinDot: 0.22 }
        }
      }
    },
    { fov: 60, aspect: 16 / 9 }
  );
  assert.equal(choke.type, 'choke_rect');
  assert.equal(choke.width, 378);
});
