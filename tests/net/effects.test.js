import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

async function loadEffectsFactory() {
  const sandbox = {
    console,
    THREE: {
      Vector3: class Vector3 {
        constructor(x = 0, y = 0, z = 0) {
          this.x = x;
          this.y = y;
          this.z = z;
        }

        set(x, y, z) {
          this.x = x;
          this.y = y;
          this.z = z;
          return this;
        }

        copy(other) {
          return this.set(other.x, other.y, other.z);
        }
      }
    },
    globalThis: {
      __MAYHEM_RUNTIME: {}
    }
  };
  const context = vm.createContext(sandbox);
  const code = await fs.readFile(new URL('../../js/net/effects.js', import.meta.url), 'utf8');
  vm.runInContext(code, context);
  return sandbox.globalThis.__MAYHEM_RUNTIME.GameNetEffects;
}

test('GameNetEffects uses the same point resolution rules for damage and marker lookups', async () => {
  const GameNetEffects = await loadEffectsFactory();
  const renderMap = new Map([
    ['remote-1', { group: { position: { x: 1, y: 2, z: 3 } } }]
  ]);
  const effects = GameNetEffects.create({
    getNetState() {
      return {
        getSelfId() {
          return 'self-1';
        }
      };
    },
    getPlayerApi() {
      return {
        getPosition(outVec3) {
          return outVec3.set(10, 20, 30);
        }
      };
    },
    damagePointY(y) {
      return y + 0.5;
    },
    markerPointY(y) {
      return y + 1.5;
    },
    getEntitiesApi() {
      return {
        getRenderMap() {
          return renderMap;
        }
      };
    }
  });

  assert.deepEqual(JSON.parse(JSON.stringify(effects.damagePointForEntityId('self-1'))), { x: 10, y: 20.5, z: 30 });
  assert.deepEqual(JSON.parse(JSON.stringify(effects.markerPointForEntityId('remote-1'))), { x: 1, y: 3.5, z: 3 });
  assert.equal(effects.damagePointForEntityId('missing-entity'), null);
});

test('GameNetEffects can copy marker and damage points into provided outputs', async () => {
  const GameNetEffects = await loadEffectsFactory();
  const renderMap = new Map([
    ['remote-1', { group: { position: { x: 7, y: 8, z: 9 } } }]
  ]);
  const effects = GameNetEffects.create({
    getNetState() {
      return {
        getSelfId() {
          return 'self-1';
        }
      };
    },
    getPlayerApi() {
      return {
        getPosition(outVec3) {
          return outVec3.set(1, 2, 3);
        }
      };
    },
    damagePointY(y) {
      return y + 0.25;
    },
    markerPointY(y) {
      return y + 1.25;
    },
    getEntitiesApi() {
      return {
        getRenderMap() {
          return renderMap;
        }
      };
    }
  });

  const damageOut = { x: 0, y: 0, z: 0 };
  const markerOut = { x: 0, y: 0, z: 0, set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; } };

  effects.damagePointForEntityId('self-1', damageOut);
  effects.markerPointForEntityId('remote-1', markerOut);
  assert.deepEqual(damageOut, { x: 1, y: 2.25, z: 3 });
  assert.deepEqual({ x: markerOut.x, y: markerOut.y, z: markerOut.z }, { x: 7, y: 9.25, z: 9 });
});
