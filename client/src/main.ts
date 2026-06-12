/**
 * Browser client entrypoint: lobby -> WebSocket room -> render loop.
 * The server is authoritative; this file only sends inputs, predicts the
 * local player with shared sim code, and renders interpolated snapshots.
 */
import { createScene } from './render/scene';
import { buildTerrainMesh } from './render/terrain';
import { EntityRenderer } from './render/entities';
import { Net } from './net';
import { InputState } from './input';
import { Prediction } from './prediction';
import { Hud } from './hud';
import { Sfx } from './audio';
import { VoxelMap } from '../../sim/map';
import type { MapData } from '../../sim/map';
import { PLAYER_EYE_HEIGHT, TICK_MS } from '../../sim/constants';
import type { WirePlayer } from '../../protocol/index';

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
const lobby = document.getElementById('lobby')!;
const nameInput = document.getElementById('lobby-name') as HTMLInputElement;
const roomInput = document.getElementById('lobby-room') as HTMLInputElement;
const joinButton = document.getElementById('lobby-join') as HTMLButtonElement;
const lobbyError = document.getElementById('lobby-error')!;

const { renderer, scene, camera } = createScene(canvas);
const input = new InputState(canvas);
const hud = new Hud();
const sfx = new Sfx();
const entities = new EntityRenderer(scene);

// ---- map load (starts immediately; join waits on it) ----
const mapReady: Promise<{ map: VoxelMap; data: MapData }> = fetch('/maps/terrain.json')
  .then(r => {
    if (!r.ok) throw new Error(`map fetch failed: ${r.status}`);
    return r.json() as Promise<MapData>;
  })
  .then(async data => {
    scene.add(await buildTerrainMesh(data));
    return { map: new VoxelMap(data), data };
  });

mapReady.catch(() => {
  lobbyError.textContent = 'Failed to load the map — reload the page.';
});

// ---- lobby ----
nameInput.value = localStorage.getItem('playerName') ?? '';
roomInput.value =
  new URLSearchParams(location.search).get('room')?.toUpperCase() ?? randomRoomCode();

joinButton.addEventListener('click', () => void join());
roomInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') void join();
});
nameInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') void join();
});

let joining = false;

async function join(): Promise<void> {
  if (joining) return;
  const roomCode = roomInput.value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  const name = nameInput.value.trim() || 'Survivor';
  if (!roomCode) {
    lobbyError.textContent = 'Enter a room code.';
    return;
  }

  joining = true;
  joinButton.textContent = 'Joining…';
  lobbyError.textContent = '';
  localStorage.setItem('playerName', name);

  let map: VoxelMap;
  try {
    map = (await mapReady).map;
  } catch {
    joining = false;
    joinButton.textContent = 'Join Room';
    return;
  }

  startGame(map, roomCode, name);
}

// ---- game ----
function startGame(map: VoxelMap, roomCode: string, name: string): void {
  const prediction = new Prediction(map);
  let seq = 0;
  let lastReconciledTick = -1;
  let sendTimer: number | null = null;
  let lastFrameAt = performance.now();
  const spectatorPos = { x: 2, y: 14, z: 19 };

  const net: Net = new Net({
    onWelcome: () => {
      lobby.style.display = 'none';
      document.body.classList.add('playing');
      const url = new URL(location.href);
      url.searchParams.set('room', roomCode);
      history.replaceState(null, '', url);
      canvas.requestPointerLock();

      sendTimer = window.setInterval(() => {
        const me = currentMe();
        if (!me) return;
        if (me.spectator) return; // spectators don't drive a body
        const sampled = input.sample();
        const playerInput = { seq: ++seq, ...sampled };
        net.sendInput(playerInput);
        prediction.predict(playerInput, me.downed);
      }, TICK_MS);
    },
    onEvents: (events, snapshot) => {
      hud.handleEvents(events, net.playerId);
      sfx.handleEvents(events, snapshot, net.playerId);
      const now = performance.now();
      for (const event of events) {
        if (event.type === 'shot') {
          entities.addShotTracer(event, snapshot.players.find(p => p.id === event.playerId), now);
        } else if (event.type === 'enemyHurt') {
          entities.flashEnemy(event.enemyId, now);
        }
      }
    },
    onError: message => {
      lobbyError.textContent = message;
    },
    onClose: () => {
      if (sendTimer !== null) clearInterval(sendTimer);
      document.body.classList.remove('playing');
      lobby.style.display = 'flex';
      joinButton.textContent = 'Join Room';
      joining = false;
      if (!lobbyError.textContent) {
        lobbyError.textContent = 'Disconnected from the room.';
      }
      document.exitPointerLock();
    },
  });

  function currentMe(): WirePlayer | undefined {
    return net.latestSnapshot?.players.find(p => p.id === net.playerId);
  }

  net.connect(roomCode, name);

  function frame(): void {
    requestAnimationFrame(frame);
    const now = performance.now();
    const dt = Math.min(0.1, (now - lastFrameAt) / 1000);
    lastFrameAt = now;

    const latest = net.latestSnapshot;
    if (!latest) {
      renderer.render(scene, camera);
      return;
    }

    // Reconcile prediction whenever a new authoritative snapshot arrived.
    const me = currentMe();
    if (me && latest.tick !== lastReconciledTick) {
      lastReconciledTick = latest.tick;
      if (!me.spectator) prediction.reconcile(me, latest);
    }

    // Remote entities render ~120ms in the past, interpolated.
    const sample = net.sampleAt(now - 120);
    if (sample) {
      entities.update(sample.a, sample.b, sample.t, net.playerId, now, camera.position);
    }

    // Camera: predicted body, or a free-fly spectator camera.
    if (me && !me.spectator) {
      const eye = me.downed ? 0.6 : PLAYER_EYE_HEIGHT;
      camera.position.set(prediction.pos.x, prediction.pos.y + eye, prediction.pos.z);
    } else {
      const fly = input.continuous();
      const speed = fly.sprint ? 24 : 12;
      const sin = Math.sin(input.yaw);
      const cos = Math.cos(input.yaw);
      spectatorPos.x += (fly.moveX * cos + fly.moveZ * -sin) * speed * dt;
      spectatorPos.z += (fly.moveX * -sin + fly.moveZ * -cos) * speed * dt;
      if (fly.jump) spectatorPos.y += speed * dt; // Space to rise
      camera.position.set(spectatorPos.x, spectatorPos.y, spectatorPos.z);
    }
    camera.rotation.y = input.yaw;
    camera.rotation.x = input.pitch;

    hud.update(latest, me);
    renderer.render(scene, camera);
  }

  requestAnimationFrame(frame);
}

function randomRoomCode(): string {
  const letters = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) code += letters[Math.floor(Math.random() * letters.length)];
  return code;
}
