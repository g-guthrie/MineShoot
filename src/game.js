/**
 * game.js - Boots the renderer and world, runs the menu backdrop orbit,
 * and owns the main loop once the player joins a match.
 */
// Shared runtime registrations (order matters: protocol/layout before world).
import '../shared/protocol.js';
import '../shared/world-layout.js';
import '../shared/terrain-sampler.js';
import '../shared/entity-constants.js';
import '../shared/gameplay-tuning.js';
import '../shared/authoritative-movement.js';
// World content. world-collision pulls in every quadrant module so both the
// visual build and the canonical collision build see the same registry.
import '../shared/world-collision.js';
import '../js/world/material-library.js';
import '../js/world/biome-utils.js';
import '../js/world/world.js';
// Weapon visuals (asset offsets shared with the avatar pipeline).
import '../js/domain/weapons/visuals.js';

import { createInput } from './input.js';
import { createLocalPlayer } from './player.js';
import { createBlocks } from './blocks.js';
import { createRemotes } from './remotes.js';
import { createWeapons } from './weapons.js';
import { createViewmodel } from './viewmodel.js';
import { createNet } from './net.js';
import { createHud } from './hud.js';
import { createGunModel } from './gun-models.js';
import { createCharacter } from './character.js';
import { createAnimatedGun } from './animated-guns.js';
import { audio } from './audio.js';
import { sfx } from './sfx.js';
import { PLAYER_MAX_HP, RESPAWN_DELAY_MS, STATE_SEND_HZ } from '../shared/combat.js';

const THREE = globalThis.THREE;
const runtime = globalThis.__MAYHEM_RUNTIME;
const GameWorld = runtime.GameWorld;
const protocol = runtime.GameShared.protocol;
const entityConstants = runtime.GameShared.entityConstants;

const canvas = document.getElementById('game-canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.08, 900);
camera.rotation.order = 'YXZ';

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Build the world once; it doubles as the menu backdrop.
const worldMeta = protocol.buildExpectedWorldMeta(protocol.defaults.roomId);
GameWorld.create(scene, { worldMeta });

const worldCenter = GameWorld.getCenter();
const worldSize = GameWorld.getSize();

const hud = createHud();
const blocks = createBlocks(scene);
const remotes = createRemotes(scene);
const net = createNet();
const viewmodel = createViewmodel(camera);
const player = createLocalPlayer({ blocks });
const weapons = createWeapons({
  camera, scene, player, blocks, remotes, viewmodel, net, hud,
  onFire: (w) => addShake(w.pellets > 1 ? 0.016 : w.cooldownMs > 1000 ? 0.014 : 0.006)
});
const input = createInput({ canvas });
remotes.setLocalEntity(player.entity);

scene.add(camera);

const state = {
  mode: 'menu', // menu | playing | dead
  selfId: null,
  name: '',
  hp: PLAYER_MAX_HP,
  diedAt: 0,
  killerName: '',
  matchFrozen: false,
  menuOrbit: Math.random() * Math.PI * 2,
  lastStateSentAt: 0
};

// Temporary asset-orientation debug: ?gundebug=1 lays the raw weapon GLBs
// out in front of the camera with an axes helper.
if (new URLSearchParams(location.search).get('gundebug')) {
  const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
  const gltfLoader = new GLTFLoader();
  const texLoader = new THREE.TextureLoader();
  const files = ['ak-47', 'shotgun', 'm24', 'm1911'];
  files.forEach((file, index) => {
    gltfLoader.load(`/assets/weapons/low-poly-fps/models/${file}.glb`, (gltf) => {
      const tex = texLoader.load(`/assets/weapons/low-poly-fps/textures/${file}.png`);
      tex.flipY = false;
      tex.colorSpace = THREE.SRGBColorSpace;
      const mat = new THREE.MeshLambertMaterial({ map: tex });
      gltf.scene.traverse((node) => { if (node.isMesh) node.material = mat; });
      const box = new THREE.Box3().setFromObject(gltf.scene);
      const size = new THREE.Vector3();
      box.getSize(size);
      const scale = 1.6 / Math.max(size.x, size.y, size.z);
      gltf.scene.scale.setScalar(scale);
      gltf.scene.position.set(worldCenter - 4.5 + index * 3, 26, worldCenter - 6);
      gltf.scene.add(new THREE.AxesHelper(1.5));
      scene.add(gltf.scene);
      globalThis.__GUNDEBUG_MODELS = globalThis.__GUNDEBUG_MODELS || {};
      globalThis.__GUNDEBUG_MODELS[file] = gltf.scene;
      console.log('gundebug', file, 'size', size.toArray().map((v) => v.toFixed(2)).join(','));
    });
  });
  camera.position.set(worldCenter, 26.5, worldCenter);
  camera.lookAt(worldCenter, 26, worldCenter - 6);
  globalThis.__GUNDEBUG_CAM = () => {
    camera.position.set(worldCenter, 26.5, worldCenter);
    camera.lookAt(worldCenter, 26, worldCenter - 6);
  };
}

// Debug/automation hook used by the e2e smoke test.
globalThis.__MINESHOOT = {
  state,
  player,
  remotes,
  blocks,
  net,
  weapons,
  viewmodel,
  camera,
  scene,
  createGunModel,
  createCharacter,
  createAnimatedGun,
  join: (name) => joinGame(name || 'TestBot')
};

// ---------------------------------------------------------------------------
// Menu wiring
// ---------------------------------------------------------------------------

const menuEl = document.getElementById('menu');
const nameInput = document.getElementById('name-input');
const playBtn = document.getElementById('play-btn');
const menuStatus = document.getElementById('menu-status');

nameInput.value = localStorage.getItem('mineshoot-name') || '';
nameInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') playBtn.click();
  event.stopPropagation();
});
playBtn.addEventListener('click', () => joinGame(nameInput.value.trim() || 'Player'));

function joinGame(name) {
  if (state.mode !== 'menu') return;
  state.name = name;
  localStorage.setItem('mineshoot-name', name);
  menuStatus.textContent = 'Connecting...';
  playBtn.disabled = true;

  net.connect({
    onOpen: () => {
      const spawn = pickSpawn();
      player.spawnAt(spawn);
      net.send({
        t: 'join',
        name,
        x: player.entity.x, y: player.entity.y, z: player.entity.z,
        yaw: player.entity.yaw, pitch: player.pitch
      });
    },
    onError: (detail) => {
      menuStatus.textContent = 'Could not reach the arena server. ' + (detail || '');
      playBtn.disabled = false;
    }
  });
}

function pickSpawn() {
  const avoid = remotes.alivePositions();
  const point = GameWorld.getRandomSpawnPoint(GameWorld.getSpawnPadding(), {
    avoidPoints: avoid,
    minClearance: 10
  }) || { x: worldCenter, z: worldCenter };
  const groundY = GameWorld.getGroundHeightAt(point.x, point.z) || 0;
  return { x: point.x, y: groundY + entityConstants.EYE_HEIGHT, z: point.z };
}

// ---------------------------------------------------------------------------
// Net handlers
// ---------------------------------------------------------------------------

net.on('welcome', (msg) => {
  state.selfId = msg.id;
  state.mode = 'playing';
  state.hp = PLAYER_MAX_HP;
  menuEl.style.display = 'none';
  menuStatus.textContent = '';
  playBtn.disabled = false;
  hud.show();
  hud.setHp(state.hp);
  remotes.reset();
  for (const p of msg.players) {
    if (p.id !== state.selfId) remotes.upsert(p);
  }
  blocks.reset();
  for (const b of msg.blocks) blocks.addBlock(b.k, { silent: true, hp: b.hp });
  hud.setScores(msg.scores, state.selfId);
  input.requestPointerLock();
  audio.unlock();
  sfx.unlock();
  audio.loop('wind', 0.07);
});

net.on('join', (msg) => {
  remotes.upsert(msg.player);
  hud.toast(msg.player.name + ' joined');
});

net.on('leave', (msg) => {
  const name = remotes.nameOf(msg.id);
  remotes.remove(msg.id);
  if (name) hud.toast(name + ' left');
});

net.on('snap', (msg) => {
  for (const p of msg.players) {
    if (p.id === state.selfId) continue;
    remotes.applySnapshot(p);
  }
  if (typeof msg.matchMs === 'number' && !state.matchFrozen) {
    hud.setMatchTimer(msg.matchMs);
  }
});

net.on('match_end', (msg) => {
  state.matchFrozen = true;
  hud.showMatchEnd(msg.scores, state.selfId);
  const winner = msg.scores && msg.scores[0];
  if (winner && winner.id === state.selfId) sfx.kill();
});

net.on('match_start', (msg) => {
  state.matchFrozen = false;
  hud.hideMatchEnd();
  hud.setScores(msg.scores, state.selfId);
  blocks.reset();
  state.hp = PLAYER_MAX_HP;
  hud.setHp(state.hp);
  hud.setBlocks(16);
  if (state.mode === 'dead') {
    hud.hideDeath();
    state.mode = 'playing';
  }
  const spawn = pickSpawn();
  player.spawnAt(spawn);
  hud.toast('New match started!');
});

net.on('fire', (msg) => {
  remotes.onRemoteFire(msg, player.entity);
});

net.on('damage', (msg) => {
  state.hp = msg.hp;
  hud.setHp(state.hp);
  hud.damageFlash();
  sfx.hurt(audio.hurtPitch());
  addShake(0.012 + Math.min(0.02, msg.amount / 2500));
});

net.on('hit_confirm', (msg) => {
  hud.hitmarker(msg.head);
  if (msg.head) sfx.headshot();
  else sfx.hitmarker();
  remotes.setHp(msg.target, msg.hp);
  remotes.damageFeedback(msg.target, player.entity);
  const headPos = remotes.headPosition(msg.target);
  if (headPos) remotes.effects.addDamageNumber(headPos, msg.amount, msg.head);
});

net.on('death', (msg) => {
  const killerName = msg.by === state.selfId ? state.name : remotes.nameOf(msg.by);
  const victimName = msg.id === state.selfId ? state.name : remotes.nameOf(msg.id);
  hud.killFeed(killerName, victimName, msg.weapon, msg.head);
  hud.setScores(msg.scores, state.selfId);

  if (msg.id === state.selfId) {
    state.mode = 'dead';
    state.diedAt = performance.now();
    state.killerName = killerName || 'someone';
    hud.showDeath(state.killerName);
    input.releasePointerLock();
  } else {
    remotes.onDeath(msg.id);
    if (msg.by === state.selfId) {
      sfx.kill();
      hud.toast('You eliminated ' + victimName + '!');
    }
  }
});

net.on('respawn', (msg) => {
  if (msg.id === state.selfId) return;
  remotes.onRespawn(msg);
});

net.on('block_add', (msg) => blocks.addBlock(msg.k, { by: msg.by }));
net.on('block_remove', (msg) => blocks.removeBlock(msg.k, { fx: true }));
net.on('block_damage', (msg) => blocks.damageBlock(msg.k, msg.hp));
net.on('block_count', (msg) => hud.setBlocks(msg.count));

net.on('disconnect', () => {
  if (state.mode === 'menu') return;
  state.mode = 'menu';
  hud.hide();
  menuEl.style.display = 'flex';
  menuStatus.textContent = 'Disconnected from the arena. Hit PLAY to rejoin.';
  input.releasePointerLock();
  remotes.reset();
});

// ---------------------------------------------------------------------------
// Input wiring
// ---------------------------------------------------------------------------

const BASE_FOV = 75;
let scopeShown = false;
let shakeAmp = 0;

function addShake(amount) {
  shakeAmp = Math.min(0.05, shakeAmp + amount);
}

input.onLook((dx, dy) => {
  if (state.mode !== 'playing') return;
  // Scale sensitivity with zoom so scoped aiming stays controllable.
  const zoomScale = camera.fov / BASE_FOV;
  player.look(dx * zoomScale, dy * zoomScale);
  viewmodel.onLook(dx, dy);
});

input.onAds((active) => {
  if (state.mode !== 'playing') {
    weapons.setAds(false);
    viewmodel.setAds(false);
    return;
  }
  weapons.setAds(active);
  viewmodel.setAds(active);
});

function updateAds(dt) {
  const w = weapons.currentWeapon();
  const aiming = weapons.isAds() && state.mode === 'playing';
  const sprintPush = !aiming && player.entity.sprinting ? 6 : 0;
  const targetFov = aiming && w.adsFovDeg ? w.adsFovDeg : BASE_FOV + sprintPush;
  const next = camera.fov + (targetFov - camera.fov) * Math.min(1, dt * 12);
  if (Math.abs(next - camera.fov) > 0.01) {
    camera.fov = next;
    camera.updateProjectionMatrix();
  }
  // Sniper scope overlay kicks in once the zoom is mostly there.
  const wantScope = !!(aiming && w.scope && camera.fov < BASE_FOV * 0.55);
  if (wantScope !== scopeShown) {
    scopeShown = wantScope;
    hud.setScope(wantScope);
    viewmodel.setScoped(wantScope);
  }
}

input.onFireDown(() => {
  if (state.mode !== 'playing' || !input.isLocked() || state.matchFrozen) return;
  weapons.triggerDown();
});
input.onFireUp(() => weapons.triggerUp());

input.onPlaceBlock(() => {
  if (state.mode !== 'playing' || !input.isLocked()) return;
  weapons.placeBlock();
});

input.onWeaponSelect((slot) => {
  if (state.mode !== 'playing') return;
  weapons.selectSlot(slot);
  sfx.click();
});

input.onReload(() => {
  if (state.mode !== 'playing') return;
  weapons.reload();
});

input.onScoreboard((shown) => hud.toggleScoreboard(shown));

// ---------------------------------------------------------------------------
// Main loop
// ---------------------------------------------------------------------------

function respawnSelf() {
  const spawn = pickSpawn();
  player.spawnAt(spawn);
  state.hp = PLAYER_MAX_HP;
  hud.setHp(state.hp);
  hud.hideDeath();
  state.mode = 'playing';
  net.send({
    t: 'respawn',
    x: player.entity.x, y: player.entity.y, z: player.entity.z,
    yaw: player.entity.yaw, pitch: player.pitch
  });
  input.requestPointerLock();
}

// State is sent on a timer rather than from the render loop: browsers
// throttle requestAnimationFrame in background tabs, which would freeze
// this player on everyone else's screen.
setInterval(() => {
  if (state.mode !== 'playing') return;
  net.send({
    t: 'state',
    x: player.entity.x, y: player.entity.y, z: player.entity.z,
    yaw: player.entity.yaw, pitch: player.pitch,
    weapon: weapons.currentId(),
    anim: {
      speedNorm: player.entity.moveSpeedNorm || 0,
      sprinting: !!player.entity.sprinting,
      airborne: !player.entity.isGrounded,
      movingForward: input.movementState().forward,
      movingBackward: input.movementState().backward,
      reloading: weapons.isReloading(),
      ads: weapons.isAds()
    }
  });
}, Math.round(1000 / STATE_SEND_HZ));

let lastFrameAt = performance.now();

function frame(nowMs) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, Math.max(0.0001, (nowMs - lastFrameAt) / 1000));
  lastFrameAt = nowMs;

  GameWorld.update(dt);
  blocks.update(dt);
  remotes.update(dt, nowMs);

  if (state.mode === 'menu') {
    if (globalThis.__GUNDEBUG_CAM) {
      globalThis.__GUNDEBUG_CAM();
      renderer.render(scene, camera);
      return;
    }
    state.menuOrbit += dt * 0.045;
    const radius = worldSize * 0.34;
    camera.position.set(
      worldCenter + Math.cos(state.menuOrbit) * radius,
      26,
      worldCenter + Math.sin(state.menuOrbit) * radius
    );
    camera.lookAt(worldCenter, 6, worldCenter);
  } else {
    if (state.mode === 'playing') {
      player.step(dt, input.movementState());
      weapons.update(dt, input.isFireHeld() && !state.matchFrozen);
      viewmodel.update(dt, player);
      weapons.updateGhost();
      updateAds(dt);
    } else if (state.mode === 'dead') {
      const waited = performance.now() - state.diedAt;
      hud.deathCountdown(Math.max(0, RESPAWN_DELAY_MS - waited));
      if (waited >= RESPAWN_DELAY_MS) respawnSelf();
      weapons.setGhostVisible(false);
    }
    player.syncCamera(camera);
    if (shakeAmp > 0.0005) {
      camera.rotation.x += (Math.random() - 0.5) * shakeAmp;
      camera.rotation.y += (Math.random() - 0.5) * shakeAmp;
      camera.rotation.z += (Math.random() - 0.5) * shakeAmp * 0.5;
      shakeAmp *= Math.max(0, 1 - dt * 9);
    }
  }

  weapons.updateEffects(dt);
  renderer.render(scene, camera);
}

requestAnimationFrame(frame);
