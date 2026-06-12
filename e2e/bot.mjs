#!/usr/bin/env node
/**
 * Minimal bot for manual/visual testing: joins a room, walks forward
 * briefly, then idles. Usage: node e2e/bot.mjs [ROOM] [seconds] [port]
 */
const room = (process.argv[2] ?? 'DEMO').toUpperCase();
const lifetimeS = Number(process.argv[3] ?? 60);
const port = Number(process.argv[4] ?? 8787);

const ws = new WebSocket(`ws://127.0.0.1:${port}/api/room/${room}/ws`);
let seq = 0;

function send(input) {
  ws.send(
    JSON.stringify({
      type: 'input',
      seq: ++seq,
      moveX: 0,
      moveZ: 0,
      yaw: Math.PI, // face south, toward the player spawn
      pitch: 0,
      jump: false,
      sprint: false,
      fire: false,
      reload: false,
      interact: false,
      ...input,
    }),
  );
}

ws.addEventListener('open', () => {
  ws.send(JSON.stringify({ type: 'join', protocol: 1, name: 'Bot', clientId: `bot-${Date.now()}` }));
  console.log(`[bot] joined room ${room}`);

  // Walk north for 1.2s so the bot stands a few meters in front of spawn.
  const walk = setInterval(() => send({ moveZ: -1 }), 50);
  setTimeout(() => {
    clearInterval(walk);
    const idle = setInterval(() => send({}), 100);
    setTimeout(() => {
      clearInterval(idle);
      ws.close();
      console.log('[bot] done');
      process.exit(0);
    }, lifetimeS * 1000);
  }, 1_200);
});

ws.addEventListener('error', () => {
  console.error('[bot] socket error');
  process.exit(1);
});
