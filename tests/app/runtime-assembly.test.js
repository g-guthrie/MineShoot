import test from 'node:test';
import assert from 'node:assert/strict';

import { applyRuntimeAssembly } from '../../js/app/runtime-assembly.js';

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
  assert.equal(runtime.GameThrowablesProjectileRuntimeDeps.getAssetFactory(), runtime.GameAssetFactory);
  assert.equal(runtime.GamePlayerDeps.getHitscanApi(), runtime.GameHitscan);
});

test('gameplay coordinator deps stay live when runtime modules are attached later', () => {
  const runtime = {};
  applyRuntimeAssembly(runtime);

  assert.equal(runtime.GameRuntimeCoordinatorDeps.GameAudio, null);

  const lateAudio = { play() {} };
  runtime.GameAudio = lateAudio;

  assert.equal(runtime.GameRuntimeCoordinatorDeps.GameAudio, lateAudio);
});
