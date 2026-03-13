import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import * as THREE from 'three';

import { gameplayTuning, getDefaultAbilityLoadout, normalizeAbilityLoadout } from '../../shared/gameplay-tuning.js';

async function loadAbilitiesRuntime(runtimeOverrides = {}, globalOverrides = {}) {
  const boundaryCode = await fs.readFile(new URL('../../js/combat/ability-boundary.js', import.meta.url), 'utf8');
  const localSimCode = await fs.readFile(new URL('../../js/combat/ability-local-sim.js', import.meta.url), 'utf8');
  const code = await fs.readFile(new URL('../../js/combat/abilities.js', import.meta.url), 'utf8');
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

  const context = vm.createContext(sandbox);
  vm.runInContext(boundaryCode, context);
  vm.runInContext(localSimCode, context);
  vm.runInContext(code, context);
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

test('prepareNetCast uses a plain aim point for multiplayer hook casts', async () => {
  let seenCamera = null;
  const abilities = await loadAbilitiesRuntime({
    GameHitscan: {
      peekCenterTarget(camera, range) {
        seenCamera = { camera, range };
        return {
          point: { x: 4, y: 5, z: 6 }
        };
      }
    }
  });

  abilities.setLoadout('hook', 'missile');
  const prepared = abilities.prepareNetCast(1, { fov: 60 });

  assert.equal(prepared.ok, true);
  assert.equal(prepared.abilityId, 'hook');
  assert.deepEqual(JSON.parse(JSON.stringify(prepared.castData)), {
    aimPoint: { x: 4, y: 5, z: 6 }
  });
  assert.equal(seenCamera.range, 90);
});

test('local hook cast does not depend on hitscan helpers', async () => {
  const camera = {
    position: new THREE.Vector3(0, 1.6, 0),
    getWorldDirection(out) {
      return out.set(0, 0, -1);
    }
  };
  const abilities = await loadAbilitiesRuntime({
    GamePlayer: {
      getThrowableOriginWorldPosition() {
        return new THREE.Vector3(0, 1.2, 0);
      }
    }
  });

  abilities.setLoadout('hook', 'missile');
  const result = abilities.triggerAbility(
    1,
    camera,
    { x: 0, y: 0, z: 0 },
    { yaw: 0 },
    null,
    null
  );

  assert.equal(result.ok, true);
  assert.equal(result.kind, 'hook_start');
  assert.equal(abilities.getHookState().phase, 'travel');
});

test('local hook uses the center-target world point when available', async () => {
  const camera = {
    position: new THREE.Vector3(0, 1.6, 0),
    getWorldDirection(out) {
      return out.set(0, 0, -1);
    }
  };
  const abilities = await loadAbilitiesRuntime({
    GameHitscan: {
      peekCenterTarget() {
        return {
          point: new THREE.Vector3(2, 3, -8)
        };
      }
    },
    GamePlayer: {
      getThrowableOriginWorldPosition() {
        return new THREE.Vector3(0, 1.2, 0);
      }
    }
  });

  abilities.setLoadout('hook', 'missile');
  const result = abilities.triggerAbility(
    1,
    camera,
    { x: 0, y: 0, z: 0 },
    { yaw: 0 },
    null,
    null
  );

  assert.equal(result.ok, true);
  assert.deepEqual(JSON.parse(JSON.stringify(abilities.getHookState().endPos)), {
    x: 2,
    y: 3,
    z: -8
  });
});

test('local missed hook retracts toward the current player origin instead of disappearing', async () => {
  const timeState = { now: 1000 };
  const hookOrigin = new THREE.Vector3(0, 1.2, 0);
  const camera = {
    position: new THREE.Vector3(0, 1.6, 0),
    getWorldDirection(out) {
      return out.set(0, 0, -1);
    }
  };
  const abilities = await loadAbilitiesRuntime({
    GameHitscan: {
      peekCenterTarget() {
        return {
          point: new THREE.Vector3(0, 1.2, -3)
        };
      }
    },
    GamePlayer: {
      getThrowableOriginWorldPosition() {
        return hookOrigin.clone();
      }
    },
    GameEnemy: {
      getLockTargets() {
        return [];
      }
    }
  }, {
    Date: {
      now() {
        return timeState.now;
      }
    }
  });

  abilities.setLoadout('hook', 'missile');
  const result = abilities.triggerAbility(
    1,
    camera,
    { x: 0, y: 0, z: 0 },
    { yaw: 0 },
    null,
    null
  );

  assert.equal(result.ok, true);
  assert.equal(abilities.getHookState().phase, 'travel');

  timeState.now = 1125;
  abilities.update(0.016, camera, null, null, null, null);
  assert.equal(abilities.getHookState().phase, 'retract');

  hookOrigin.z = 2;
  timeState.now = 1180;
  abilities.update(0.016, camera, null, null, null, null);
  assert.ok(abilities.getHookState().headPos.z > -1);
  assert.ok(abilities.getHookState().headPos.z < 0);

  timeState.now = 1250;
  abilities.update(0.016, camera, null, null, null, null);
  assert.equal(abilities.getHookState(), null);
});

test('local landed hook keeps the attachment point on the victim before retracting', async () => {
  const timeState = { now: 1000 };
  const targetPos = new THREE.Vector3(0, 1.2, -3);
  const camera = {
    position: new THREE.Vector3(0, 1.6, 0),
    getWorldDirection(out) {
      return out.set(0, 0, -1);
    }
  };
  const abilities = await loadAbilitiesRuntime({
    GameHitscan: {
      peekCenterTarget() {
        return {
          point: new THREE.Vector3(0, 1.2, -3)
        };
      }
    },
    GamePlayer: {
      getThrowableOriginWorldPosition() {
        return new THREE.Vector3(0, 1.2, 0);
      }
    },
    GameEnemy: {
      getLockTargets() {
        return [{
          targetId: 'enemy:1',
          worldPos: targetPos.clone(),
          hitbox: {},
          enemyRef: {}
        }];
      },
      damage() {
        return { killed: false };
      },
      pullTarget() {}
    },
    GameWorld: {
      getCollidables() {
        return [];
      }
    }
  }, {
    Date: {
      now() {
        return timeState.now;
      }
    }
  });

  abilities.setLoadout('hook', 'missile');
  const result = abilities.triggerAbility(
    1,
    camera,
    { x: 0, y: 0, z: 0 },
    { yaw: 0 },
    null,
    null
  );

  assert.equal(result.ok, true);

  timeState.now = 1100;
  abilities.update(0.016, camera, null, null, null, null);
  assert.equal(abilities.getHookState().phase, 'latched');
  assert.deepEqual(JSON.parse(JSON.stringify(abilities.getHookState().attachPos)), {
    x: 0,
    y: 1.2,
    z: -3
  });

  targetPos.z = -2;
  timeState.now = 1270;
  abilities.update(0.016, camera, null, null, null, null);
  assert.equal(abilities.getHookState().phase, 'retract');

  timeState.now = 1320;
  abilities.update(0.016, camera, null, null, null, null);
  assert.ok(abilities.getHookState().headPos.z > -2);
  assert.ok(abilities.getHookState().headPos.z < 0);
});

test('clearTransientState drops local heal effects', async () => {
  const abilities = await loadAbilitiesRuntime({});

  abilities.setLoadout('heal', 'missile');
  const result = abilities.triggerAbility(1, {}, null, null, null, null);

  assert.equal(result.ok, true);
  assert.ok(abilities.getHealState());
  abilities.clearTransientState();
  assert.equal(abilities.getHealState(), null);
});

test('deadeye starts cooldown when primed, not only when released', async () => {
  const timeState = { now: 1000 };
  const fakeDate = {
    now() {
      return timeState.now;
    }
  };
  const camera = {
    position: new THREE.Vector3(0, 1.6, 0),
    getWorldDirection(out) {
      return out.set(0, 0, -1);
    }
  };
  const abilities = await loadAbilitiesRuntime({
    GameEnemy: {
      getLockTargets() {
        return [{
          targetId: 'enemy:1',
          worldPos: new THREE.Vector3(0, 1.6, -10),
          hitbox: {}
        }];
      },
      damage() {
        return { killed: false };
      }
    },
    GameWorld: {
      getCollidables() {
        return [];
      }
    }
  }, {
    Date: fakeDate
  });

  abilities.setLoadout('deadeye', 'missile');
  const start = abilities.triggerAbility(1, camera, null, null, null, null);

  assert.equal(start.ok, true);
  assert.equal(start.kind, 'deadeye_start');
  assert.ok(abilities.getHudState().slot1Cooldown > 14);
});

test('deadeye candidate acquisition uses the player eye origin instead of raw camera position', async () => {
  const camera = {
    position: new THREE.Vector3(0, 1.6, 80),
    getWorldDirection(out) {
      return out.set(0, 0, -1);
    }
  };
  const abilities = await loadAbilitiesRuntime({
    GameEnemy: {
      getLockTargets() {
        return [{
          targetId: 'enemy:1',
          worldPos: new THREE.Vector3(0, 1.6, -10),
          hitbox: {}
        }];
      }
    },
    GameWorld: {
      getCollidables() {
        return [];
      }
    },
    GamePlayer: {
      getEyeWorldPosition() {
        return new THREE.Vector3(0, 1.6, 0);
      }
    }
  });

  abilities.setLoadout('deadeye', 'missile');
  const start = abilities.triggerAbility(1, camera, null, null, null, null);

  assert.equal(start.ok, true);
  assert.equal(start.kind, 'deadeye_start');
});

test('deadeye candidate order prefers the target nearest the crosshair over the closest body', async () => {
  const camera = {
    position: new THREE.Vector3(0, 1.6, 0),
    getWorldDirection(out) {
      return out.set(0, 0, -1);
    }
  };
  const abilities = await loadAbilitiesRuntime({
    GameEnemy: {
      getLockTargets() {
        return [{
          targetId: 'enemy:near',
          worldPos: new THREE.Vector3(3, 1.6, -5),
          hitbox: {}
        }, {
          targetId: 'enemy:center',
          worldPos: new THREE.Vector3(0, 1.6, -10),
          hitbox: {}
        }];
      }
    },
    GameWorld: {
      getCollidables() {
        return [];
      }
    }
  });

  abilities.setLoadout('deadeye', 'missile');
  const start = abilities.triggerAbility(1, camera, null, null, null, null);

  assert.equal(start.ok, true);
  assert.equal(abilities.getDeadeyeState().targets[0].targetId, 'enemy:center');
  assert.equal(abilities.getDeadeyeState().targets[1].targetId, 'enemy:near');
});

test('local choke only applies the lifted state to the victim', async () => {
  const restrictionCalls = [];
  const audioCalls = [];
  const enemyRef = {};
  const abilities = await loadAbilitiesRuntime({
    GameHitscan: {
      selectLockTargetByRect() {
        return {
          hitbox: {},
          worldPos: { x: 1, y: 2, z: 3 },
          enemyRef
        };
      }
    },
    GameEnemy: {
      applyStun() {}
    },
    GamePlayer: {
      setActionRestrictions(state) {
        restrictionCalls.push(JSON.parse(JSON.stringify(state)));
      },
      triggerAction() {}
    },
    GameAudio: {
      play(name) {
        audioCalls.push(name);
      }
    }
  });

  abilities.setLoadout('choke', 'missile');
  const result = abilities.triggerAbility(1, { fov: 60 }, null, null, null, null);

  assert.equal(result.ok, true);
  assert.equal(restrictionCalls.length, 0);
  assert.equal(enemyRef.chokeVictimState.sourceId, 'player');
  assert.ok(enemyRef.chokeVictimState.endsAt > enemyRef.chokeVictimState.startedAt);
  assert.deepEqual(audioCalls, ['chokeCast']);
});
