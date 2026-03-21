import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import * as THREE from 'three';

async function loadPlayerWorldApi(collidables) {
  const code = await fs.readFile(new URL('../../js/actors/player-world.js', import.meta.url), 'utf8');
  const sandbox = {
    __MAYHEM_RUNTIME: {
      GameWorld: {
        getBounds() {
          return { minX: 0, maxX: 50, minZ: 0, maxZ: 50, size: 50 };
        },
        getRandomSpawnPoint() {
          return { x: 5, z: 6 };
        },
        getGroundHeightAt() {
          return 0;
        },
        getSpawnPadding() {
          return 8;
        },
        getCollidables() {
          return collidables;
        }
      }
    },
    globalThis: null,
    console,
    THREE
  };
  sandbox.globalThis = sandbox;

  vm.runInContext(code, vm.createContext(sandbox));
  return sandbox.__MAYHEM_RUNTIME.GamePlayerWorld.create({
    playerRadius: 0.35,
    playerHeight: 1.7,
    epsilon: 0.001
  });
}

test('player world reuses collision box arrays and refreshes cached boxes when meshes move', async () => {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(2, 2, 2),
    new THREE.MeshBasicMaterial()
  );
  mesh.position.set(0, 1, 0);
  const api = await loadPlayerWorldApi([mesh]);

  const firstBoxes = api.getCollisionBoxes();
  const firstBox = firstBoxes[0];
  assert.equal(firstBoxes.length, 1);
  assert.equal(firstBox.min.x, -1);
  assert.equal(firstBox.max.x, 1);

  mesh.position.set(5, 1, 0);
  const secondBoxes = api.getCollisionBoxes();

  assert.equal(secondBoxes, firstBoxes);
  assert.equal(secondBoxes[0], firstBox);
  assert.equal(secondBoxes[0].min.x, 4);
  assert.equal(secondBoxes[0].max.x, 6);
});
