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
} from 'hytopia';

import GameManager from './classes/GameManager';

import worldMap from './assets/map.json' with { type: 'json' } ;
import GamePlayerEntity from './classes/GamePlayerEntity';

startServer(world => {
  // Load the game map
  world.loadMap(worldMap);

  // Set lighting
  world.setAmbientLightIntensity(0.8);
  world.setDirectionalLightIntensity(5);

  GameManager.instance.setupGame(world);

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