let runtimeGraphPromise = null;

async function loadRuntimeGraph() {
  if (runtimeGraphPromise) return runtimeGraphPromise;

  runtimeGraphPromise = (async function loadRuntimeGraphOnce() {
    await import('../vendor/three.min.js');

    await import('../../shared/gameplay-tuning.js');
    await import('../../shared/protocol.js');
    await import('../../shared/world-layout.js');
    await import('../../shared/terrain-sampler.js');
    await import('../../shared/entity-constants.js');
    await import('../../shared/damage.js');

    await import('../domain/weapons/registry.js');
    await import('../domain/weapons/behaviors.js');

    await import('../world/biome-utils.js');
    await import('../hitbox-factory.js');
    await import('../avatar-rig.js');
    await import('../actor-visual-factory.js');

    const [
      { GameMaterialLibrary },
      intersectionsModule,
      { buildArcticQuadrant },
      { buildBasinQuadrant },
      { buildCitadelQuadrant },
      { buildDesertQuadrant },
      { buildJungleQuadrant },
      { buildNuclearQuadrant },
      { buildQuarryQuadrant },
      { buildRadarQuadrant },
      { buildUrbanQuadrant },
      { GameAssetFactory },
      { GameWorld },
      mainModule
    ] = await Promise.all([
      import('../world/material-library.js'),
      import('../world/intersection-builder.js'),
      import('../world/quadrant-arctic.js'),
      import('../world/quadrant-basin.js'),
      import('../world/quadrant-citadel.js'),
      import('../world/quadrant-desert.js'),
      import('../world/quadrant-jungle.js'),
      import('../world/quadrant-nuclear.js'),
      import('../world/quadrant-quarry.js'),
      import('../world/quadrant-radar.js'),
      import('../world/quadrant-urban.js'),
      import('../asset-factory.js'),
      import('../world.js'),
      import('../main.js')
    ]);

    GameWorld.configure({
      materialLibrary: GameMaterialLibrary,
      intersections: intersectionsModule,
      quadrants: {
        arctic: buildArcticQuadrant,
        basin: buildBasinQuadrant,
        citadel: buildCitadelQuadrant,
        desert: buildDesertQuadrant,
        jungle: buildJungleQuadrant,
        nuclear: buildNuclearQuadrant,
        quarry: buildQuarryQuadrant,
        radar: buildRadarQuadrant,
        urban: buildUrbanQuadrant
      },
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
