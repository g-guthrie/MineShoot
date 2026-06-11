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

import { startServer, PlayerEvent } from 'hytopia';
import worldMap from './assets/maps/terrain.json' with { type: 'json' } ;

import GameManager from './classes/GameManager';

startServer(world => {
  // Load map.
  world.loadMap(worldMap);

  // Setup lighting. The original example uses near-zero light for horror
  // mood (relying on in-map lamps); raised here so the world is readable.
  // Tune back down once lamp placement is verified.
  world.setAmbientLightIntensity(0.85);
  world.setAmbientLightColor({ r: 255, g: 214, b: 214 });
  world.setDirectionalLightIntensity(2.5);

  // Setup game
  GameManager.instance.setupGame(world);

  // Spawn a player entity when a player joins the game. Players who were
  // part of the running round (a disconnect/reconnect) rejoin immediately;
  // genuinely new players wait for the next round.
  world.on(PlayerEvent.JOINED_WORLD, ({ player }) => {
    if (GameManager.instance.isStarted && !GameManager.instance.canRejoin(player)) {
      return world.chatManager.sendPlayerMessage(player, 'This round has already started, you will automatically join when the next round starts. While you wait, you can fly around as a spectator by using W, A, S, D.', 'FF0000');
    }

    GameManager.instance.spawnPlayerEntity(player);
  });

  // Despawn all player entities when a player leaves the game, and re-check
  // end conditions — without this, the last standing player leaving stalls
  // game-over until the next enemy spawn.
  world.on(PlayerEvent.LEFT_WORLD, ({ player }) => {
    world.entityManager.getPlayerEntitiesByPlayer(player).forEach(entity => entity.despawn());
    GameManager.instance.checkEndGame();
  });
});