import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

function createVec3() {
  return {
    x: 0,
    y: 0,
    z: 0,
    set(x, y, z) {
      this.x = x;
      this.y = y;
      this.z = z;
    }
  };
}

async function loadRemoteEntities() {
  const code = await fs.readFile(new URL('../../js/net/remote-entities.js', import.meta.url), 'utf8');
  const scene = {
    added: [],
    add(node) {
      this.added.push(node);
      if (node && typeof node === 'object') node.parent = this;
    }
  };
  const sandbox = {
    __MAYHEM_RUNTIME: {
      GameShared: {
        entityConstants: { EYE_HEIGHT: 1.6 },
        gameplayTuning: null
      },
      GameActorVisualFactory: {
        create() {
          const root = {
            position: createVec3(),
            rotation: { y: 0 },
            visible: true,
            parent: null
          };
          const bodyHitbox = { position: createVec3(), userData: {} };
          const headHitbox = { position: createVec3(), userData: {} };
          return {
            root,
            rigApi: {},
            bodyHitbox,
            headHitbox,
            setWorldTransform(position, yaw) {
              root.position.set(position.x, position.y, position.z);
              root.rotation.y = yaw;
            },
            syncHitboxes(position) {
              bodyHitbox.position.set(position.x, position.y + 0.7625, position.z);
              headHitbox.position.set(position.x, position.y + 2.0, position.z);
            },
            setAlive(alive) {
              root.visible = !!alive;
            },
            setHitboxVisibility() {}
          };
        }
      }
    },
    globalThis: null,
    console,
    Date
  };
  sandbox.globalThis = sandbox;
  vm.runInContext(code, vm.createContext(sandbox));
  const entitiesApi = sandbox.__MAYHEM_RUNTIME.GameNetEntities;
  entitiesApi.init(scene);
  return { entitiesApi, scene };
}

function snapshotEntity(id, overrides = {}) {
  return {
    id,
    kind: 'player',
    username: id,
    classId: 'abilities',
    x: 0,
    y: 1.6,
    z: 0,
    yaw: 0,
    pitch: 0,
    hp: 100,
    hpMax: 100,
    armor: 0,
    armorMax: 0,
    weaponId: 'rifle',
    moveSpeedNorm: 0,
    sprinting: false,
    movingForward: false,
    movingBackward: false,
    velocityY: 0,
    isGrounded: true,
    alive: true,
    spawnShieldUntil: 0,
    wallhackRadius: 90,
    weaponAmmo: {},
    muzzleFlashUntil: 0,
    streamHeat: 0,
    streamOverheatedUntil: 0,
    abilityLoadout: null,
    ...overrides
  };
}

test('remote entities reseed history and snap immediately on large position jumps', async () => {
  const { entitiesApi } = await loadRemoteEntities();
  const entityId = 'usr_remote';

  entitiesApi.updateFromSnapshot(snapshotEntity(entityId, {
    x: 1,
    y: 1.6,
    z: 2
  }), {
    serverTime: 1000,
    receivedAt: 1000
  });

  entitiesApi.updateFromSnapshot(snapshotEntity(entityId, {
    x: 20,
    y: 1.6,
    z: 24,
    yaw: 0.75
  }), {
    serverTime: 1050,
    receivedAt: 1050
  });

  const render = entitiesApi.getRenderMap().get(entityId);
  assert.ok(render);
  assert.equal(render.snapshotHistory.length, 1);
  assert.equal(render.snapshotHistory[0].x, 20);
  assert.equal(render.group.position.x, 20);
  assert.equal(render.group.position.y, 0);
  assert.equal(render.group.position.z, 24);
  assert.equal(render.group.rotation.y, 0.75);
  assert.equal(render.bodyHitbox.position.x, 20);
  assert.equal(render.headHitbox.position.z, 24);
});

test('remote entities reseed history on dead-to-alive transitions', async () => {
  const { entitiesApi } = await loadRemoteEntities();
  const entityId = 'usr_respawn';

  entitiesApi.updateFromSnapshot(snapshotEntity(entityId, {
    alive: false,
    x: 5,
    z: 6
  }), {
    serverTime: 1000,
    receivedAt: 1000
  });

  entitiesApi.updateFromSnapshot(snapshotEntity(entityId, {
    alive: true,
    x: 7,
    z: 9
  }), {
    serverTime: 1060,
    receivedAt: 1060
  });

  const render = entitiesApi.getRenderMap().get(entityId);
  assert.ok(render);
  assert.equal(render.snapshotHistory.length, 1);
  assert.equal(render.snapshotHistory[0].alive, true);
  assert.equal(render.group.position.x, 7);
  assert.equal(render.group.position.z, 9);
  assert.equal(render.group.visible, true);
});
