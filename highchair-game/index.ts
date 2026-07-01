// Game servers should survive stray entity races instead of dying mid
// match; log and continue.
process.on('uncaughtException', (err) => {
  console.error('[keepalive] uncaught exception:', err?.stack || err);
});
process.on('unhandledRejection', (err) => {
  console.error('[keepalive] unhandled rejection:', err);
});

// Some sandboxes (and a few hosts) have no IPv6; the SDK's web server
// calls listen(port) which defaults to "::". Force IPv4 in that case.
// Harmless elsewhere.
import net from 'net';
const originalListen = (net.Server.prototype as any).listen;
(net.Server.prototype as any).listen = function (...args: any[]) {
  if (typeof args[0] === 'number' && typeof args[1] === 'function') {
    return originalListen.call(this, args[0], '0.0.0.0', args[1]);
  }
  return originalListen.apply(this, args);
};

import {
  startServer,
  PlayerEvent,
} from 'highchair';

import GameManager from './classes/GameManager';

import worldMap from './assets/maps/mayhem-arena.json' with { type: 'json' };
import GamePlayerEntity from './classes/GamePlayerEntity';

startServer(world => {
  // Load the game map
  world.loadMap(worldMap);

  // Set lighting: soft sun so terrain steps don't read as black checkering.
  world.setAmbientLightIntensity(1.1);
  world.setDirectionalLightIntensity(2.6);

  GameManager.instance.setupGame(world);

  // Live calibration for step cadence: /stride 1.3 etc.
  world.chatManager.registerCommand('/stride', (player, args) => {
    const value = parseFloat(args?.[0] ?? '');
    if (!Number.isFinite(value) || value <= 0 || value > 4) {
      world.chatManager.sendPlayerMessage(player, 'Usage: /stride 0.5 .. 4 (current cadence multiplier)', 'FFAA00');
      return;
    }
    GamePlayerEntity.setStrideTune(value);
    world.chatManager.sendBroadcastMessage(`Stride cadence multiplier set to ${value}`, '00FF00');
  });

  // Handle player joining the game
  world.on(PlayerEvent.JOINED_WORLD, ({ player }) => {
    GameManager.instance.spawnPlayerEntity(player);
  });

  // Handle player leaving the game
  world.on(PlayerEvent.LEFT_WORLD, ({ player }) => {
    // Clean up player entities
    world.entityManager
      .getPlayerEntitiesByPlayer(player)
      .forEach(entity => entity.despawn());

    GameManager.instance.onPlayerPopulationChanged();
  });

  world.on(PlayerEvent.RECONNECTED_WORLD, ({ player }) => {
    world.entityManager.getPlayerEntitiesByPlayer(player).forEach(entity => {
      if (entity instanceof GamePlayerEntity) {
        entity.setupPlayerUI();
      }
    });
  });
});


/*
- raycasts from weapons need to ignore other items
- Fix players stuck in placed blocks
*/