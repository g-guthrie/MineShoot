globalThis.__MAYHEM_RUNTIME = globalThis.__MAYHEM_RUNTIME || {};

const orderedModules = [
  '../../shared/gameplay-tuning.js',
  '../../shared/protocol.js',
  '../../shared/seek-profiles.js',
  '../../shared/seek-core.js',
  '../core/bootstrap.js',
  '../core/mode-flow.js',
  '../core/loop.js',
  '../net/transport.js',
  '../net/snapshots.js',
  '../domain/weapons/primitives/cooldown.js',
  '../domain/weapons/families/hitscan.js',
  '../domain/weapons/families/seeker-projectile.js',
  '../domain/weapons/registry.js',
  '../world.js',
  '../combat-tuning.js',
  '../avatar-rig.js',
  '../ui.js',
  '../enemy.js',
  '../hitscan.js',
  '../throwables.js',
  '../audio.js',
  '../abilities.js',
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
