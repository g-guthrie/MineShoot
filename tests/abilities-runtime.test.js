import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import * as THREE from 'three';

import { gameplayTuning, getDefaultAbilityLoadout, normalizeAbilityLoadout } from '../shared/gameplay-tuning.js';

async function loadAbilitiesRuntime(runtimeOverrides = {}, globalOverrides = {}) {
  const code = await fs.readFile(new URL('../js/abilities.js', import.meta.url), 'utf8');
  const runtime = {
    GameShared: {
      gameplayTuning,
      getDefaultAbilityLoadout,
      normalizeAbilityLoadout
    },
    ...runtimeOverrides
  };
  const sandbox = {
    __MAYHEM_RUNTIME: runtime,
    globalThis: null,
    console,
    THREE,
    window: {
      innerHeight: 900
    },
    document: {
      hasFocus() {
        return true;
      }
    },
    Date,
    ...globalOverrides
  };
  sandbox.globalThis = sandbox;

  vm.runInContext(code, vm.createContext(sandbox));
  return sandbox.__MAYHEM_RUNTIME.GameAbilities;
}

test('prepareNetCast shapes choke target selection behind the abilities boundary', async () => {
  let seen = null;
  const abilities = await loadAbilitiesRuntime({
    GameHitscan: {
      selectLockTargetByRect(camera, range, width, height, opts) {
        seen = { camera, range, width, height, opts };
        return {
          targetId: 'net:usr_target',
          worldPos: { x: 10, y: 11, z: 12 }
        };
      }
    }
  });

  const prepared = abilities.prepareNetCast(1, { fov: 60 });

  assert.equal(prepared.ok, true);
  assert.equal(prepared.slot, 1);
  assert.equal(prepared.abilityId, 'choke');
  assert.deepEqual(JSON.parse(JSON.stringify(prepared.castData)), {
    lockTargetId: 'usr_target',
    aimPoint: { x: 10, y: 11, z: 12 }
  });
  assert.equal(seen.opts.ownerType, 'net');
  assert.ok(seen.width > 0);
  assert.ok(seen.height > 0);
});

test('prepareNetCast returns missile local feedback as a commit callback', async () => {
  let fireActions = 0;
  const audioCalls = [];
  const projectileIntent = {
    origin: { x: 1, y: 2, z: 3 },
    direction: { x: 0, y: 0, z: -1 },
    aimPoint: { x: 4, y: 5, z: 6 }
  };
  const abilities = await loadAbilitiesRuntime({
    GameThrowables: {
      fireAbilityMissile(camera, options) {
        assert.ok(camera);
        assert.equal(options.predictLocal, false);
        assert.equal(options.abilityId, 'missile');
        return projectileIntent;
      }
    },
    GamePlayer: {
      triggerAction(action) {
        if (action === 'fire') fireActions += 1;
      }
    },
    GameAudio: {
      play(name, options) {
        audioCalls.push({ name, options });
      }
    }
  });

  const prepared = abilities.prepareNetCast(2, { fov: 60 });

  assert.equal(prepared.ok, true);
  assert.equal(prepared.abilityId, 'missile');
  assert.deepEqual(JSON.parse(JSON.stringify(prepared.castData)), {
    aimPoint: { x: 4, y: 5, z: 6 },
    projectileIntent
  });
  assert.equal(typeof prepared.commit, 'function');

  prepared.commit();

  assert.equal(fireActions, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(audioCalls)), [{ name: 'fire', options: { weapon: 'missile' } }]);
});
