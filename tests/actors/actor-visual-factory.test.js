import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import * as THREE from 'three';

const SHARED_HITBOX_GEOMETRY = new THREE.BoxGeometry(1, 1, 1);
SHARED_HITBOX_GEOMETRY.userData = { sharedHitboxGeometry: true };

function createHitbox(type, ownerType, options) {
  const mesh = new THREE.Mesh(
    SHARED_HITBOX_GEOMETRY,
    new THREE.MeshBasicMaterial({ transparent: true, opacity: Number(options && options.opacity || 0) })
  );
  mesh.userData = {
    type,
    ownerType,
    targetId: options && options.targetId ? options.targetId : '',
    netEntityId: options && options.netEntityId ? options.netEntityId : ''
  };
  return mesh;
}

async function loadActorVisualFactory(runtimeOverrides = {}) {
  const visualsCode = await fs.readFile(new URL('../../js/domain/weapons/visuals.js', import.meta.url), 'utf8');
  const weaponPresentationCode = await fs.readFile(new URL('../../js/presentation/weapon-presentation.js', import.meta.url), 'utf8');
  const rigCode = await fs.readFile(new URL('../../js/actors/avatar-rig.js', import.meta.url), 'utf8');
  const factoryCode = await fs.readFile(new URL('../../js/presentation/actor-visual-factory.js', import.meta.url), 'utf8');
  const runtime = {
    GameShared: {
      entityConstants: {},
      entityPoints: {}
    },
    GameHitboxFactory: {
      createCombatHitbox: createHitbox
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

  const context = vm.createContext(sandbox);
  vm.runInContext(visualsCode, context);
  vm.runInContext(weaponPresentationCode, context);
  vm.runInContext(rigCode, context);
  vm.runInContext(factoryCode, context);
  return sandbox.__MAYHEM_RUNTIME.GameActorVisualFactory;
}

function firstBodyPart(actorVisual) {
  return actorVisual.visual.userData.bodyParts[0];
}

test('actor visual boundary keeps damage flash and spawn shield scoped to one actor and restores state', async () => {
  const factory = await loadActorVisualFactory();
  const actorA = factory.create({ ownerType: 'player', targetId: 'self-a', weaponId: 'rifle' });
  const actorB = factory.create({ ownerType: 'player', targetId: 'self-b', weaponId: 'rifle' });

  const bodyA = firstBodyPart(actorA);
  const bodyB = firstBodyPart(actorB);
  const originalAColor = bodyA.material.color.getHex();
  const originalBColor = bodyB.material.color.getHex();
  const originalAOpacity = bodyA.material.opacity;
  const originalATransparent = bodyA.material.transparent;
  const originalBOpacity = bodyB.material.opacity;

  actorA.setDamageFlash(true);
  assert.equal(bodyA.material.color.getHex(), 0xff0000);
  assert.equal(bodyB.material.color.getHex(), originalBColor);

  actorA.setDamageFlash(false);
  assert.equal(bodyA.material.color.getHex(), originalAColor);

  actorA.setSpawnShield(true);
  assert.equal(bodyA.material.transparent, true);
  assert.equal(bodyA.material.opacity, Math.min(originalAOpacity, 0.42));
  assert.equal(bodyB.material.opacity, originalBOpacity);

  actorA.setSpawnShield(false);
  assert.equal(bodyA.material.opacity, originalAOpacity);
  assert.equal(bodyA.material.transparent, originalATransparent);
  assert.equal(bodyB.material.color.getHex(), originalBColor);
});

test('actor visual boundary owns a root wrapper, syncs transform, and cleans it up', async () => {
  const factory = await loadActorVisualFactory({
    GameShared: {
      entityConstants: {},
      entityPoints: {
        entityBodyHitboxYFromFeet(feetY) {
          return Number(feetY) + 0.75;
        },
        entityHeadHitboxYFromFeet(feetY) {
          return Number(feetY) + 2.0;
        }
      }
    }
  });
  const scene = new THREE.Group();
  const actor = factory.create({ ownerType: 'net', targetId: 'remote-a', weaponId: 'rifle', includeRevealGhost: true });

  scene.add(actor.root);
  scene.add(actor.bodyHitbox);
  scene.add(actor.headHitbox);

  actor.setWorldTransform({ x: 4, y: 1.25, z: -2 }, Math.PI * 0.5);

  assert.equal(actor.root.position.x, 4);
  assert.equal(actor.root.position.y, 1.25);
  assert.equal(actor.root.position.z, -2);
  assert.equal(actor.root.rotation.y, Math.PI * 0.5);
  assert.equal(actor.bodyHitbox.position.y, 2.0);
  assert.equal(actor.headHitbox.position.y, 3.25);
  assert.equal(actor.revealGhost.parent, actor.root);

  actor.destroy();

  assert.equal(actor.root.parent, null);
  assert.equal(actor.bodyHitbox.parent, null);
  assert.equal(actor.headHitbox.parent, null);
});

test('actor visual destroy keeps shared hitbox geometry alive while disposing per-actor resources', async () => {
  const factory = await loadActorVisualFactory();
  const actor = factory.create({ ownerType: 'net', targetId: 'remote-cleanup', weaponId: 'rifle', includeRevealGhost: true });
  const secondActor = factory.create({ ownerType: 'net', targetId: 'remote-cleanup-b', weaponId: 'rifle', includeRevealGhost: true });
  let rigDisposed = 0;
  let revealDisposed = 0;
  let chokeDisposed = 0;
  let hitboxMaterialDisposed = 0;
  let hitboxGeometryDisposed = 0;

  const originalRigDispose = actor.rigApi.dispose.bind(actor.rigApi);
  actor.rigApi.dispose = function () {
    rigDisposed += 1;
    return originalRigDispose();
  };
  const originalRevealDispose = actor.revealGhost.userData.revealMaterials[0].dispose.bind(actor.revealGhost.userData.revealMaterials[0]);
  actor.revealGhost.userData.revealMaterials[0].dispose = function () {
    revealDisposed += 1;
    return originalRevealDispose();
  };
  const originalChokeDispose = actor.chokeFx.userData.parts.neckGrip.geometry.dispose.bind(actor.chokeFx.userData.parts.neckGrip.geometry);
  actor.chokeFx.userData.parts.neckGrip.geometry.dispose = function () {
    chokeDisposed += 1;
    return originalChokeDispose();
  };
  const originalHitboxMaterialDispose = actor.bodyHitbox.material.dispose.bind(actor.bodyHitbox.material);
  actor.bodyHitbox.material.dispose = function () {
    hitboxMaterialDisposed += 1;
    return originalHitboxMaterialDispose();
  };
  const originalHitboxGeometryDispose = actor.bodyHitbox.geometry.dispose.bind(actor.bodyHitbox.geometry);
  actor.bodyHitbox.geometry.dispose = function () {
    hitboxGeometryDisposed += 1;
    return originalHitboxGeometryDispose();
  };

  assert.equal(actor.bodyHitbox.geometry, secondActor.bodyHitbox.geometry);

  actor.destroy();
  secondActor.destroy();
  actor.destroy();

  assert.equal(rigDisposed, 1);
  assert.equal(revealDisposed, 1);
  assert.equal(chokeDisposed, 1);
  assert.equal(hitboxMaterialDisposed, 1);
  assert.equal(hitboxGeometryDisposed, 0);
});

test('reveal ghost can be tinted per ability state without affecting the base actor materials', async () => {
  const factory = await loadActorVisualFactory();
  const actor = factory.create({ ownerType: 'enemy', targetId: 'enemy-a', weaponId: 'rifle', includeRevealGhost: true });

  actor.setRevealGhostState(true, 0.4, 0xff6a7a);

  const revealMaterials = actor.revealGhost.userData.revealMaterials;
  assert.ok(revealMaterials.length > 0);
  assert.equal(revealMaterials[0].color.getHex(), 0xff6a7a);
  assert.equal(revealMaterials[0].opacity, 0.4);
  assert.notEqual(firstBodyPart(actor).material.color.getHex(), 0xff6a7a);
});

test('choke FX stays localized to the real body instead of requiring a duplicate silhouette', async () => {
  const factory = await loadActorVisualFactory();
  const actor = factory.create({ ownerType: 'enemy', targetId: 'enemy-b', weaponId: 'rifle', includeRevealGhost: true });

  actor.updateAnimation(0.016, {
    speedNorm: 0,
    sprinting: false,
    airborne: false,
    aimPitch: 0,
    choked: true,
    startedAt: 1000
  });

  assert.equal(actor.chokeFx.visible, true);
  assert.equal(actor.revealGhost.visible, false);
  assert.ok(actor.chokeFx.userData.parts.neckGrip.position.y > 1.6);
  assert.equal(actor.chokeFx.userData.parts.tendrils.length, 4);
  assert.equal(actor.chokeFx.userData.parts.tendrils[0].geometry.type, 'TubeGeometry');
  actor.chokeFx.userData.parts.tendrils[0].geometry.computeBoundingBox();
  assert.ok(actor.chokeFx.userData.parts.tendrils[0].geometry.boundingBox.min.y > 1.7);
  assert.ok(actor.chokeFx.userData.parts.tendrils[0].geometry.boundingBox.max.y > 2.3);
  assert.ok(actor.chokeFx.userData.parts.tendrils[0].material.opacity > 0);
});

test('combat hitbox visuals follow debug visibility toggles', async () => {
  const factory = await loadActorVisualFactory();
  const actor = factory.create({ ownerType: 'net', targetId: 'remote-d', weaponId: 'rifle', hitboxOpacity: 0.3 });

  assert.equal(actor.bodyHitbox.material.opacity, 0.3);
  assert.equal(actor.headHitbox.material.opacity, 0.3);

  actor.setHitboxVisibility(false);
  assert.equal(actor.bodyHitbox.material.opacity, 0);
  assert.equal(actor.headHitbox.material.opacity, 0);

  actor.setHitboxVisibility(true);
  assert.equal(actor.bodyHitbox.material.opacity, 0.3);
  assert.equal(actor.headHitbox.material.opacity, 0.3);
});

test('actor visual factory only opts into Boxman when the caller explicitly requests it', async () => {
  const boxmanMesh = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshBasicMaterial({ color: 0xffffff })
  );
  const boxmanRoot = new THREE.Group();
  boxmanRoot.userData.bodyParts = [boxmanMesh];
  boxmanRoot.userData.originalPartColors = [0xffffff];
  boxmanRoot.add(boxmanMesh);

  const calls = [];
  const factory = await loadActorVisualFactory({
    GameBoxmanRig: {
      isReady() { return true; },
      create(opts) {
        calls.push(opts);
        return {
          root: boxmanRoot,
          rig: { bodyMesh: boxmanMesh },
          updateAnimation() {},
          setWeapon() {},
          triggerAction() { return true; },
          dispose() {}
        };
      }
    }
  });

  factory.create({
    ownerType: 'player',
    targetId: 'self-boxman',
    weaponId: 'rifle',
    preferBoxman: true
  });
  factory.create({
    ownerType: 'enemy',
    targetId: 'enemy-default',
    weaponId: 'rifle'
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].tintColor, 0xffffff);
});
