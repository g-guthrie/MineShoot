import test from 'node:test';
import assert from 'node:assert/strict';

import {
  applyRuntimeAssembly,
  gameNetRuntimeScriptUrls
} from '../../js/app/runtime-assembly.js';

test('applyRuntimeAssembly wires explicit dependency bags onto the runtime registry', () => {
  const runtime = {
    GameMenuState: { createStore() {} },
    GameLobbyActions: { create() {} },
    GameLobbyRenderer: { create() {} },
    GameLobbyApi: {},
    GameNetAuth: {},
    GameRuntimeModeUi: {},
    GameNet: {},
    GamePlayer: {},
    GameEnemy: {},
    GameHitscan: {},
    GameAudio: {},
    GameThrowables: {},
    GameWorld: {},
    GameRuntimeMatchActions: { create() {} },
    GameRuntimeMatchHost: { create() {} },
    GamePlayerStatus: {},
    GamePlayerWorld: {},
    GamePlayerView: {},
    GameActorVisualFactory: {},
    GameAssetFactory: {},
    GameNetEntities: {},
    GameNetEffects: { create() {} },
    GameNetFacade: { create() {} },
    GameShared: { protocol: {} }
  };

  const applied = applyRuntimeAssembly(runtime);

  assert.equal(applied, runtime);
  assert.equal(runtime.GameLobbyControllerDeps.actionFactory, runtime.GameLobbyActions);
  assert.equal(runtime.GameLobbyControllerDeps.rendererFactory, runtime.GameLobbyRenderer);
  assert.equal(runtime.GameLobbyControllerDeps.storeFactory, runtime.GameMenuState);
  assert.equal(runtime.GameRuntimeCoordinatorDeps.GameRuntimeMatchActions, runtime.GameRuntimeMatchActions);
  assert.equal(runtime.GameRuntimeCoordinatorDeps.GameRuntimeMatchHost, runtime.GameRuntimeMatchHost);
  assert.equal(runtime.GameRuntimeCoordinatorDeps.GameNet, runtime.GameNet);
  assert.equal(runtime.GameNetAssemblyDeps.GameNetAuth, runtime.GameNetAuth);
  assert.equal(runtime.GameNetAssemblyDeps.GameNetEffects, runtime.GameNetEffects);
  assert.equal(runtime.GameNetAssemblyDeps.GameNetFacade, runtime.GameNetFacade);
  assert.equal(runtime.GameThrowablesProjectileRuntimeDeps.getAssetFactory(), runtime.GameAssetFactory);
  assert.equal(runtime.GamePlayerDeps.getHitscanApi(), runtime.GameHitscan);
});

test('gameNet runtime script list keeps join-state and timing ahead of network entry', () => {
  const hrefs = gameNetRuntimeScriptUrls.map((url) => String(url));
  const joinIndex = hrefs.findIndex((value) => value.endsWith('/js/net/join-state.js'));
  const timingIndex = hrefs.findIndex((value) => value.endsWith('/js/net/connection-timing.js'));
  const effectsIndex = hrefs.findIndex((value) => value.endsWith('/js/net/effects.js'));
  const facadeIndex = hrefs.findIndex((value) => value.endsWith('/js/net/facade.js'));
  const networkIndex = hrefs.findIndex((value) => value.endsWith('/js/net/network.js'));

  assert.notEqual(joinIndex, -1);
  assert.notEqual(timingIndex, -1);
  assert.notEqual(effectsIndex, -1);
  assert.notEqual(facadeIndex, -1);
  assert.notEqual(networkIndex, -1);
  assert.ok(joinIndex < networkIndex);
  assert.ok(timingIndex < networkIndex);
  assert.ok(effectsIndex < networkIndex);
  assert.ok(facadeIndex < networkIndex);
});
