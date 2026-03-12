globalThis.__MAYHEM_RUNTIME = globalThis.__MAYHEM_RUNTIME || {};

const orderedModules = [
  '../../shared/gameplay-tuning.js',
  '../../shared/protocol.js',
  '../../shared/world-layout.js',
  '../../shared/terrain-sampler.js',
  '../../shared/seek-profiles.js',
  '../../shared/entity-constants.js',
  '../../shared/damage.js',
  '../../shared/seek-core.js',
  '../core/bootstrap.js',
  '../core/event-bus.js',
  '../core/mode-flow.js',
  '../core/runtime-profile.js',
  '../core/loop.js',
  '../core/awareness.js',
  '../net/transport.js',
  '../net/snapshots.js',
  '../net/auth.js',
  '../net/remote-entities.js',
  '../domain/weapons/registry.js',
  '../domain/weapons/behaviors.js',
  '../world/biome-utils.js',
  '../world/material-library.js',
  '../world/intersection-builder.js',
  '../world/quadrant-arctic.js',
  '../world/quadrant-basin.js',
  '../world/quadrant-citadel.js',
  '../world/quadrant-desert.js',
  '../world/quadrant-jungle.js',
  '../world/quadrant-nuclear.js',
  '../world/quadrant-quarry.js',
  '../world/quadrant-radar.js',
  '../world/quadrant-urban.js',
  '../world.js',
  '../combat-tuning.js',
  '../hitbox-factory.js',
  '../avatar-rig.js',
  '../actor-visual-factory.js',
  '../bloom-reticle.js',
  '../ui.js',
  '../enemy.js',
  '../hitscan.js',
  '../throwables.js',
  '../audio.js',
  '../player-combat.js',
  '../player.js',
  '../network.js',
  '../overhead.js',
  '../docs.js',
  '../main.js'
];

(async () => {
  for (const modulePath of orderedModules) {
    await import(modulePath);
  }
})();
