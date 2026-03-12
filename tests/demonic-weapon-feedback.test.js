import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

async function loadWeaponFeedbackRuntime() {
  const code = await fs.readFile(new URL('../demonic/gameplay/combat/weapon-feedback-runtime.js', import.meta.url), 'utf8');
  const sandbox = {
    __MAYHEM_RUNTIME: {
      GameShared: {
        getWeaponPresentation(weaponId) {
          return {
            machinegun: {
              recoil: { z: -0.024, x: -0.045, pitch: 0.009, yaw: 0.006, roll: 0.004, armR: 0.14, armL: 0.06, muzzleMs: 55 }
            },
            shotgun: {
              recoil: { z: -0.09, x: -0.16, pitch: 0.03, yaw: 0.012, roll: 0.008, armR: 0.26, armL: 0.12, muzzleMs: 70 }
            }
          }[weaponId] || {
            recoil: { z: -0.05, x: -0.09, pitch: 0.018, yaw: 0.009, roll: 0.006, armR: 0.22, armL: 0.1, muzzleMs: 60 }
          };
        }
      }
    },
    __DEMONIC_RUNTIME: {},
    globalThis: null,
    console,
    Date,
    Math
  };
  sandbox.globalThis = sandbox;
  vm.runInContext(code, vm.createContext(sandbox));
  return sandbox.__DEMONIC_RUNTIME.GameWeaponFeedbackRuntime;
}

test('demonic weapon feedback runtime mirrors Mayhem-style weapon presentation recoil data', async () => {
  const api = await loadWeaponFeedbackRuntime();
  const runtime = api.create();

  runtime.setWeapon('shotgun');
  runtime.triggerFire(0);
  const snapshot = runtime.getSnapshot();

  assert.equal(snapshot.weaponId, 'shotgun');
  assert.equal(snapshot.gunKick < 0, true);
  assert.equal(snapshot.cameraPitchKick > 0, true);
  assert.equal(snapshot.muzzleVisible, true);
});
