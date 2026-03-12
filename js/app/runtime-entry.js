let runtimeGraphPromise = null;

async function loadRuntimeGraph() {
  if (runtimeGraphPromise) return runtimeGraphPromise;

  runtimeGraphPromise = (async function loadRuntimeGraphOnce() {
    const threeModule = await import('../vendor/three.min.js');
    if (!globalThis.THREE) {
      globalThis.THREE = threeModule.default || threeModule;
    }

    const [
      { GameMaterialLibrary },
      intersectionsModule,
      { GameWorldQuadrants },
      { GameAssetFactory },
      { GameWorld },
      mainModule
    ] = await Promise.all([
      import('../world/material-library.js'),
      import('../world/intersection-builder.js'),
      import('../world/quadrants.js'),
      import('../asset-factory.js'),
      import('../world.js'),
      import('../main.js')
    ]);

    GameWorld.configure({
      materialLibrary: GameMaterialLibrary,
      intersections: intersectionsModule,
      quadrants: GameWorldQuadrants,
      assetFactory: GameAssetFactory
    });

    return mainModule;
  })();

  return runtimeGraphPromise;
}

export async function startQuickMatch() {
  const mainModule = await loadRuntimeGraph();
  if (!mainModule || typeof mainModule.startQuickMatch !== 'function') {
    throw new Error('Game runtime entry is unavailable.');
  }
  return mainModule.startQuickMatch();
}
