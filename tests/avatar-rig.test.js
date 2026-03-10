import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import * as THREE from 'three';

async function loadAvatarRig(runtimeOverrides = {}) {
  const code = await fs.readFile(new URL('../js/avatar-rig.js', import.meta.url), 'utf8');
  const runtime = {
    GameShared: {
      entityConstants: {}
    },
    ...runtimeOverrides
  };
  const sandbox = {
    __MAYHEM_RUNTIME: runtime,
    globalThis: null,
    console,
    THREE
  };
  sandbox.globalThis = sandbox;

  vm.runInContext(code, vm.createContext(sandbox));
  return sandbox.__MAYHEM_RUNTIME.GameAvatarRig;
}

test('sniper support pose drives the left arm across the rifle', async () => {
  const avatarRig = await loadAvatarRig();
  const pose = avatarRig._test.getSupportPoseForWeapon('sniper', 0.1, 0.2, true);

  assert.ok(pose);
  assert.ok(pose.armX > 1);
  assert.ok(pose.armY < -0.3);
  assert.ok(pose.armZ < -0.55);
  assert.ok(pose.palmZ < -0.18);
});

test('reload pose is available for every firearm and includes wiggle offsets', async () => {
  const avatarRig = await loadAvatarRig();
  const weaponIds = ['rifle', 'pistol', 'machinegun', 'shotgun', 'sniper'];

  for (const weaponId of weaponIds) {
    const pose = avatarRig._test.getReloadPoseForWeapon(weaponId, 0.35);
    assert.ok(pose, weaponId + ' should produce a reload pose');
  assert.ok(pose.armX > 0.95, weaponId + ' should lift the left arm across the weapon');
  assert.notEqual(pose.gunRoll, 0, weaponId + ' should add reload wiggle');
  }
});

test('weapon models mount asynchronously and hide procedural fallback geometry', async () => {
  const modelNode = new THREE.Group();
  modelNode.name = 'test-model';
  const avatarRig = await loadAvatarRig({
    GameWeaponRegistry: {
      get(id) {
        if (id !== 'shotgun') return null;
        return {
          visual: {
            classId: 'gun',
            mount: {
              position: [0, 0.02, 0.06],
              rotation: [0, 0, 0]
            },
            model: {
              kind: 'embedded-gltf',
              url: '/assets/models/weapons/shotgun.gltf',
              position: [0.1, 0.2, 0.3],
              rotation: [0.4, 0.5, 0.6],
              scale: [0.7, 0.8, 0.9]
            },
            parts: {
              body: { p: [0, 0, 0], s: [1, 1, 1], c: 0x111111 },
              barrel: { p: [0, 0, -0.2], s: [1, 1, 1], c: 0x222222 },
              stock: { p: [0, 0, 0.2], s: [1, 1, 1], c: 0x333333 },
              grip: { p: [0, -0.1, 0], s: [1, 1, 1], c: 0x444444 },
              pump: true
            },
            anchors: {
              handle: [0, 0, 0],
              barrelTip: [0, 0, -0.5],
              support: [0, -0.01, -0.2]
            },
            effects: {
              muzzleFlash: {
                position: [0, 0, -0.5]
              }
            }
          }
        };
      }
    },
    GameThreeModelLoader: {
      load(spec) {
        assert.equal(spec.url, '/assets/models/weapons/shotgun.gltf');
        return Promise.resolve(modelNode.clone(true));
      }
    }
  });

  const api = avatarRig.create('player', { weaponId: 'shotgun' });
  await Promise.resolve();
  await Promise.resolve();

  assert.equal(api.rig.weaponModelMount.children.length, 1);
  assert.equal(api.rig.weaponModelMount.children[0].name, 'test-model');
  assert.equal(api.rig.weaponModelMount.position.x, 0.1);
  assert.equal(api.rig.weaponModelMount.position.y, 0.2);
  assert.equal(api.rig.weaponModelMount.position.z, 0.3);
  assert.equal(api.rig.weaponModelMount.scale.x, 0.7);
  assert.equal(api.rig.weaponModelMount.scale.y, 0.8);
  assert.equal(api.rig.weaponModelMount.scale.z, 0.9);
  assert.equal(api.rig.gunBody.visible, false);
  assert.equal(api.rig.pump.visible, false);
});

test('setting the same weapon does not re-request the weapon model', async () => {
  let loadCount = 0;
  const avatarRig = await loadAvatarRig({
    GameWeaponRegistry: {
      get(id) {
        if (id !== 'shotgun') return null;
        return {
          visual: {
            classId: 'gun',
            model: {
              kind: 'embedded-gltf',
              url: '/assets/models/weapons/shotgun.gltf'
            }
          }
        };
      }
    },
    GameThreeModelLoader: {
      load() {
        loadCount += 1;
        return Promise.resolve(new THREE.Group());
      }
    }
  });

  const api = avatarRig.create('player', { weaponId: 'shotgun' });
  await Promise.resolve();
  await Promise.resolve();
  api.setWeapon('shotgun');
  await Promise.resolve();

  assert.equal(loadCount, 1);
});

test('jump action trigger layers a takeoff pose on top of airborne animation', async () => {
  const avatarRig = await loadAvatarRig();
  const api = avatarRig.create('player', { weaponId: 'rifle' });

  api.updateAnimation(0.016, {
    speedNorm: 0,
    sprinting: false,
    airborne: true,
    aimPitch: 0
  });
  const baselineLegRotation = api.rig.legL.rotation.x;

  api.triggerAction('jump');
  api.updateAnimation(0.016, {
    speedNorm: 0,
    sprinting: false,
    airborne: true,
    aimPitch: 0
  });

  assert.ok(api.rig.legL.rotation.x < baselineLegRotation);
});
