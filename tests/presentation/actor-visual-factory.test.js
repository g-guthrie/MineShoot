import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import * as THREE from 'three';

async function loadFactory(options = {}) {
  const code = await fs.readFile(new URL('../../js/presentation/actor-visual-factory.js', import.meta.url), 'utf8');
  const eyeWorld = options.eyeWorld || null;
  const sandbox = {
    __MAYHEM_RUNTIME: {
      GameShared: {
        entityConstants: {
          PLAYER_RADIUS: 0.5,
          PLAYER_HEIGHT: 2.8
        },
        entityPoints: {
          entityBodyHitboxYFromFeet(feetY) {
            return Number(feetY || 0) + 0.7625;
          },
          entityHeadHitboxYFromFeet(feetY) {
            return Number(feetY || 0) + 2.0;
          }
        }
      },
      GameBoxmanRig: {
        isReady() {
          return true;
        },
        create() {
          return {
            root: new THREE.Group(),
            rig: null,
            setWeapon() {},
            updateAnimation() {},
            triggerAction() { return true; },
            getCoreWorldPosition(out) {
              return (out || new THREE.Vector3()).set(0, 1, 0);
            },
            getEyeWorldPosition(out) {
              if (!eyeWorld) return null;
              return (out || new THREE.Vector3()).set(eyeWorld.x, eyeWorld.y, eyeWorld.z);
            },
            getThrowableOriginWorldPosition(out) {
              return (out || new THREE.Vector3()).set(0, 1.1, 0);
            },
            getMuzzleWorldPosition(out) {
              return (out || new THREE.Vector3()).set(0, 1.2, -0.5);
            },
            setMuzzleVisible() {},
            getWeaponId() {
              return 'rifle';
            },
            dispose() {}
          };
        }
      },
      GameHitboxFactory: {
        createCombatHitbox(type, ownerType, opts) {
          const mesh = new THREE.Mesh(
            new THREE.BoxGeometry(1, type === 'head' ? 1.15 : 1, 1),
            new THREE.MeshBasicMaterial({
              transparent: true,
              opacity: (typeof opts.opacity === 'number') ? opts.opacity : 0
            })
          );
          mesh.userData = { type, ownerType };
          return mesh;
        }
      }
    },
    globalThis: null,
    console,
    THREE
  };
  sandbox.globalThis = sandbox;
  vm.runInContext(code, vm.createContext(sandbox));
  return sandbox.__MAYHEM_RUNTIME.GameActorVisualFactory;
}

test('actor visual factory creates a green movement collider for player debug view', async () => {
  const factory = await loadFactory();
  const visual = factory.create({
    ownerType: 'player',
    hitboxOpacity: 0.3,
    includeCollisionDebug: true
  });

  assert.ok(visual.movementCollider);
  assert.equal(visual.movementCollider.userData.type, 'movement_collider');
  assert.equal(visual.movementCollider.userData.ownerType, 'player');
  assert.equal(Math.round(visual.movementCollider.userData.height * 10), 28);
  assert.equal(Math.round(visual.movementCollider.userData.radius * 10), 5);
  assert.equal(visual.movementCollider.material.color.getHex(), 0x33ff66);

  visual.syncHitboxes({ x: 4, y: 2, z: 6 });
  assert.equal(visual.movementCollider.position.x, 4);
  assert.equal(visual.movementCollider.position.y, 2 + (2.8 * 0.5));
  assert.equal(visual.movementCollider.position.z, 6);
});

test('actor visual factory hides the movement collider with the hitbox debug toggle', async () => {
  const factory = await loadFactory();
  const visual = factory.create({
    ownerType: 'player',
    hitboxOpacity: 0.3,
    includeCollisionDebug: true
  });

  visual.setHitboxVisibility(false);
  assert.equal(visual.movementCollider.material.opacity, 0);

  visual.setHitboxVisibility(true);
  assert.equal(visual.movementCollider.material.opacity, 0.3);

  visual.setAlive(false);
  assert.equal(visual.movementCollider.visible, false);
});

test('actor visual factory places the head hitbox just above the body while keeping head anchor xz', async () => {
  const factory = await loadFactory({
    eyeWorld: { x: 0.2, y: 1.7, z: -0.1 }
  });
  const visual = factory.create({
    ownerType: 'player',
    hitboxOpacity: 0.3
  });

  visual.syncHitboxes({ x: 10, y: 2, z: -4 });

  assert.equal(visual.bodyHitbox.position.y, 2.7625);
  assert.equal(visual.headHitbox.position.x, 10.2);
  assert.ok(Math.abs(visual.headHitbox.position.y - 3.8375) < 1e-9);
  assert.equal(visual.headHitbox.position.z, -4.1);
});

test('actor visual factory hides the head hitbox and shrinks the body hitbox during a roll', async () => {
  const factory = await loadFactory({
    eyeWorld: { x: 0.2, y: 1.7, z: -0.1 }
  });
  const visual = factory.create({
    ownerType: 'player',
    hitboxOpacity: 0.3
  });

  visual.syncHitboxes({ x: 10, y: 2, z: -4 }, { rolling: true });

  const expectedScale = Math.cbrt(0.0853125);
  assert.equal(visual.headHitbox.visible, false);
  assert.ok(Math.abs(visual.bodyHitbox.scale.x - expectedScale) < 1e-9);
  assert.ok(Math.abs(visual.bodyHitbox.scale.y - expectedScale) < 1e-9);
  assert.ok(Math.abs(visual.bodyHitbox.scale.z - expectedScale) < 1e-9);
  assert.ok(Math.abs(visual.bodyHitbox.position.y - (2.2625 + (0.5 * expectedScale))) < 1e-9);

  visual.syncHitboxes({ x: 10, y: 2, z: -4 }, { rolling: false });

  assert.equal(visual.headHitbox.visible, true);
  assert.equal(visual.bodyHitbox.scale.x, 1);
  assert.equal(visual.bodyHitbox.scale.y, 1);
  assert.equal(visual.bodyHitbox.scale.z, 1);
  assert.equal(visual.bodyHitbox.position.y, 2.7625);
});
