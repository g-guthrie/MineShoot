import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const CHARACTER_OPTIONS = [
  {
    id: 'soldier',
    label: 'Soldier',
    path: '/assets/characters/toon-shooter/Character_Soldier.gltf'
  },
  {
    id: 'hazmat',
    label: 'Hazmat',
    path: '/assets/characters/toon-shooter/Character_Hazmat.gltf'
  },
  {
    id: 'enemy',
    label: 'Enemy',
    path: '/assets/characters/toon-shooter/Character_Enemy.gltf'
  }
];

const WEAPON_NAMES = [
  'None',
  'AK',
  'SMG',
  'Pistol',
  'Revolver',
  'Revolver_Small',
  'Shotgun',
  'Sniper',
  'Sniper_2',
  'GrenadeLauncher',
  'RocketLauncher',
  'ShortCannon',
  'Knife_1',
  'Knife_2',
  'Shovel'
];

const DEFAULT_CLIP_ORDER = [
  'Idle_Shoot',
  'Run_Gun',
  'Run_Shoot',
  'Walk_Shoot',
  'Jump',
  'Jump_Idle',
  'Jump_Land',
  'Idle',
  'Run',
  'Walk',
  'HitReact',
  'Death'
];

const CAMERA_PRESETS = [
  { id: 'front', label: 'Front', position: [0, 1.35, 4.2], target: [0, 1.05, 0] },
  { id: 'right', label: 'Right', position: [4.2, 1.35, 0], target: [0, 1.05, 0] },
  { id: 'left', label: 'Left', position: [-4.2, 1.35, 0], target: [0, 1.05, 0] },
  { id: 'back', label: 'Back', position: [0, 1.35, -4.2], target: [0, 1.05, 0] },
  { id: 'high', label: 'High 3Q', position: [2.8, 2.35, 3.3], target: [0, 1.05, 0] },
  { id: 'aim', label: 'Aim Line', position: [1.1, 1.45, 2.05], target: [0.2, 1.16, 0.15] }
];

const DEFAULT_AIM = {
  pitchDeg: 0,
  yawDeg: 0,
  distance: 3.2,
  shoulderHeight: 1.28,
  targetX: 0,
  targetY: 1.28,
  targetZ: 3.2
};

const DEFAULT_POSE = {
  torsoPitch: -4,
  torsoYaw: 0,
  upperArmPitch: -10,
  upperArmYaw: -6,
  upperArmRoll: 0,
  lowerArmPitch: 8,
  handPitch: -4,
  handYaw: 0,
  weaponPitch: 0,
  weaponYaw: 0,
  weaponRoll: 0,
  muzzleX: 0.55,
  muzzleY: 0.02,
  muzzleZ: 0
};

const AIM_CONTROLS = [
  { key: 'pitchDeg', label: 'Mouse Pitch', min: -55, max: 55, step: 1, digits: 0 },
  { key: 'yawDeg', label: 'Mouse Yaw', min: -60, max: 60, step: 1, digits: 0 },
  { key: 'distance', label: 'Target Dist', min: 1.2, max: 5, step: 0.05, digits: 2 },
  { key: 'shoulderHeight', label: 'Target Height', min: 0.75, max: 1.9, step: 0.03, digits: 2 }
];

const DEFAULT_LAYERS = {
  aimWeight: 1,
  focusWeight: 0.6,
  bobWeight: 0.2,
  recoilWeight: 0
};

const LAYER_CONTROLS = [
  { key: 'aimWeight', label: 'Aim Weight', min: 0, max: 1, step: 0.01, digits: 2 },
  { key: 'focusWeight', label: 'Focus Gate', min: 0, max: 1, step: 0.01, digits: 2 },
  { key: 'bobWeight', label: 'Move Bob', min: 0, max: 1.5, step: 0.01, digits: 2 },
  { key: 'recoilWeight', label: 'Recoil', min: 0, max: 1.5, step: 0.01, digits: 2 }
];

const COMBAT_STATES = [
  {
    id: 'idle',
    label: 'Idle',
    clipCandidates: ['Idle_Shoot', 'Idle'],
    clipSpeed: 0.58,
    layers: { aimWeight: 1, focusWeight: 0.75, bobWeight: 0.12, recoilWeight: 0 }
  },
  {
    id: 'walk',
    label: 'Walk',
    clipCandidates: ['Walk_Shoot', 'Walk', 'Run_Gun'],
    clipSpeed: 0.82,
    layers: { aimWeight: 0.9, focusWeight: 0.35, bobWeight: 0.95, recoilWeight: 0 }
  },
  {
    id: 'run',
    label: 'Run',
    clipCandidates: ['Run_Gun', 'Run_Shoot', 'Run'],
    clipSpeed: 0.9,
    layers: { aimWeight: 0.82, focusWeight: 0.25, bobWeight: 1.15, recoilWeight: 0 }
  },
  {
    id: 'fire',
    label: 'Fire',
    clipCandidates: ['Idle_Shoot', 'Walk_Shoot', 'Run_Shoot'],
    clipSpeed: 0.75,
    layers: { aimWeight: 1, focusWeight: 1, bobWeight: 0, recoilWeight: 1 }
  },
  {
    id: 'sprint',
    label: 'Sprint',
    clipCandidates: ['Run'],
    clipSpeed: 0.95,
    layers: { aimWeight: 0.12, focusWeight: 0.05, bobWeight: 1.35, recoilWeight: 0 }
  },
  {
    id: 'jump',
    label: 'Jump',
    clipCandidates: ['Jump_Idle', 'Jump', 'Jump_Land'],
    clipSpeed: 0.75,
    layers: { aimWeight: 0.9, focusWeight: 0.45, bobWeight: 0.1, recoilWeight: 0 }
  },
  {
    id: 'jump_fire',
    label: 'Jump Fire',
    clipCandidates: ['Jump_Idle', 'Jump', 'Idle_Shoot'],
    clipSpeed: 0.75,
    layers: { aimWeight: 1, focusWeight: 1, bobWeight: 0, recoilWeight: 0.85 }
  }
];

const POSE_CONTROLS = [
  { key: 'torsoPitch', label: 'Torso Pitch', min: -45, max: 45, step: 1, digits: 0 },
  { key: 'torsoYaw', label: 'Torso Yaw', min: -55, max: 55, step: 1, digits: 0 },
  { key: 'upperArmPitch', label: 'Upper Pitch', min: -90, max: 90, step: 1, digits: 0 },
  { key: 'upperArmYaw', label: 'Upper Yaw', min: -90, max: 90, step: 1, digits: 0 },
  { key: 'upperArmRoll', label: 'Upper Roll', min: -90, max: 90, step: 1, digits: 0 },
  { key: 'lowerArmPitch', label: 'Lower Pitch', min: -90, max: 90, step: 1, digits: 0 },
  { key: 'handPitch', label: 'Hand Pitch', min: -90, max: 90, step: 1, digits: 0 },
  { key: 'handYaw', label: 'Hand Yaw', min: -90, max: 90, step: 1, digits: 0 },
  { key: 'weaponPitch', label: 'Weapon Pitch', min: -90, max: 90, step: 1, digits: 0 },
  { key: 'weaponYaw', label: 'Weapon Yaw', min: -90, max: 90, step: 1, digits: 0 },
  { key: 'weaponRoll', label: 'Weapon Roll', min: -90, max: 90, step: 1, digits: 0 },
  { key: 'muzzleX', label: 'Muzzle X', min: -1.2, max: 1.2, step: 0.01, digits: 2 },
  { key: 'muzzleY', label: 'Muzzle Y', min: -0.7, max: 0.7, step: 0.01, digits: 2 },
  { key: 'muzzleZ', label: 'Muzzle Z', min: -0.7, max: 0.7, step: 0.01, digits: 2 }
];

const BONE_OVERLAYS = [
  { key: 'torsoPitch', node: 'Torso', axis: 'x' },
  { key: 'torsoYaw', node: 'Torso', axis: 'y' },
  { key: 'upperArmPitch', node: 'UpperArm.R', axis: 'x' },
  { key: 'upperArmYaw', node: 'UpperArm.R', axis: 'y' },
  { key: 'upperArmRoll', node: 'UpperArm.R', axis: 'z' },
  { key: 'lowerArmPitch', node: 'LowerArm.R', axis: 'x' },
  { key: 'handPitch', node: 'Index1.R', axis: 'x' },
  { key: 'handYaw', node: 'Index1.R', axis: 'y' }
];

const STORAGE_KEY = 'mineshoot.toonCharacterLab.profile.v1';
const CAPTURE_LIMIT = 128;
const SERIES_VIEW_IDS = ['front', 'right', 'left', 'high', 'aim'];
const SERIES_SAMPLES = [0, 0.33, 0.66, 0.92];
const MATRIX_STATE_IDS = ['idle', 'walk', 'run', 'fire', 'sprint', 'jump_fire'];
const MATRIX_VIEW_IDS = ['front', 'right', 'aim'];
const MATRIX_AIM_PITCHES = [-28, 0, 28];
const ASSET_VIEW_IDS = ['front', 'right', 'back', 'left'];
const PLAYTEST_MOVE_CODES = new Set([
  'KeyW',
  'KeyA',
  'KeyS',
  'KeyD',
  'ShiftLeft',
  'ShiftRight',
  'ControlLeft',
  'ControlRight',
  'Space'
]);

const canvas = document.getElementById('scene-canvas');
const playtestToggle = document.getElementById('playtest-toggle');
const characterButtons = document.getElementById('character-buttons');
const clipSelect = document.getElementById('clip-select');
const weaponSelect = document.getElementById('weapon-select');
const playToggle = document.getElementById('play-toggle');
const shotPulse = document.getElementById('shot-pulse');
const speedRange = document.getElementById('speed-range');
const autoRotateToggle = document.getElementById('auto-rotate');
const showSkeletonToggle = document.getElementById('show-skeleton');
const showAimToggle = document.getElementById('show-aim');
const lockWeaponTargetToggle = document.getElementById('lock-weapon-target');
const combatStateButtons = document.getElementById('combat-state-buttons');
const cameraButtons = document.getElementById('camera-buttons');
const aimControls = document.getElementById('aim-controls');
const layerControls = document.getElementById('layer-controls');
const poseControls = document.getElementById('pose-controls');
const profileJson = document.getElementById('profile-json');
const copyProfile = document.getElementById('copy-profile');
const applyProfileButton = document.getElementById('apply-profile');
const resetPose = document.getElementById('reset-pose');
const captureCurrent = document.getElementById('capture-current');
const captureSeries = document.getElementById('capture-series');
const captureStateMatrix = document.getElementById('capture-state-matrix');
const captureAssetTurnaround = document.getElementById('capture-asset-turnaround');
const clearCaptures = document.getElementById('clear-captures');
const captureGallery = document.getElementById('capture-gallery');
const status = document.getElementById('status');

const storedProfile = readStoredProfile();
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0d1014);
scene.fog = new THREE.Fog(0x0d1014, 7, 16);

const camera = new THREE.PerspectiveCamera(42, 1, 0.05, 60);
camera.position.set(0, 1.35, 4.2);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 1.05, 0);
controls.enableDamping = true;
controls.minDistance = 2.25;
controls.maxDistance = 7;
controls.maxPolarAngle = Math.PI * 0.52;

scene.add(new THREE.HemisphereLight(0xb7dcff, 0x28313f, 2.3));

const keyLight = new THREE.DirectionalLight(0xffffff, 2.4);
keyLight.position.set(3.5, 4.5, 4);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(2048, 2048);
scene.add(keyLight);

const rimLight = new THREE.DirectionalLight(0x8ad5ff, 1.1);
rimLight.position.set(-3, 2.2, -3.5);
scene.add(rimLight);

const ground = new THREE.Mesh(
  new THREE.CircleGeometry(3.7, 64),
  new THREE.MeshStandardMaterial({ color: 0x161d26, roughness: 0.9, metalness: 0.02 })
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

const grid = new THREE.GridHelper(7.4, 16, 0x324150, 0x25313d);
grid.material.transparent = true;
grid.material.opacity = 0.48;
scene.add(grid);

const targetMarker = new THREE.Mesh(
  new THREE.SphereGeometry(0.07, 18, 12),
  new THREE.MeshStandardMaterial({ color: 0xffcf66, emissive: 0x5d3500, emissiveIntensity: 0.8 })
);
scene.add(targetMarker);

const muzzleMarker = new THREE.Mesh(
  new THREE.SphereGeometry(0.045, 16, 10),
  new THREE.MeshStandardMaterial({ color: 0x8ad5ff, emissive: 0x0d6c9c, emissiveIntensity: 1.3 })
);
scene.add(muzzleMarker);

const aimLine = new THREE.Line(
  new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]),
  new THREE.LineBasicMaterial({ color: 0xffcf66, transparent: true, opacity: 0.8 })
);
scene.add(aimLine);

const loader = new GLTFLoader();
const clock = new THREE.Clock();
const state = {
  activeCharacterId: storedProfile.character || 'soldier',
  activeWeaponName: storedProfile.weapon || 'AK',
  activeClipName: storedProfile.clip || '',
  activeCombatStateId: storedProfile.combatState || 'idle',
  activeCameraPresetId: 'front',
  paused: false,
  speed: Number(storedProfile.speed) || 1,
  activeClipSpeedScale: 1,
  runtimeTime: 0,
  lastShotAt: -1000,
  transientFireUntil: -1000,
  modelGroup: null,
  modelRoot: null,
  mixer: null,
  activeAction: null,
  clips: [],
  skeletonHelper: null,
  rigNodes: {},
  weaponNodes: {},
  baseWeaponQuaternions: {},
  captures: [],
  pose: { ...DEFAULT_POSE, ...(storedProfile.pose || {}) },
  aim: { ...DEFAULT_AIM, ...(storedProfile.aim || {}) },
  layers: { ...DEFAULT_LAYERS, ...(storedProfile.layers || {}) },
  playtest: {
    enabled: false,
    pointerLocked: false,
    keys: new Set(),
    yawRad: 0,
    verticalVelocity: 0,
    grounded: true,
    fireHeld: false,
    nextShotAt: 0
  }
};

if (!storedProfile.layers) Object.assign(state.layers, DEFAULT_LAYERS, activeCombatState().layers);
speedRange.value = String(state.speed);

function readStoredProfile() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function disposeMaterial(material) {
  if (!material) return;
  if (Array.isArray(material)) {
    material.forEach(disposeMaterial);
    return;
  }
  material.dispose();
}

function disposeObject(object) {
  object.traverse((child) => {
    if (child.geometry) child.geometry.dispose();
    disposeMaterial(child.material);
  });
}

function degToRad(value) {
  return (Number(value) || 0) * Math.PI / 180;
}

function numberWithDigits(value, digits) {
  return Number(value || 0).toFixed(digits);
}

function vectorFromArray(value) {
  return new THREE.Vector3(value[0], value[1], value[2]);
}

function prepareRenderable(root) {
  root.traverse((child) => {
    child.frustumCulled = false;
    if (!child.isMesh && !child.isSkinnedMesh) return;
    child.castShadow = true;
    child.receiveShadow = true;
    if (child.material) {
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      materials.forEach((material) => {
        material.side = THREE.DoubleSide;
        material.needsUpdate = true;
      });
    }
  });
}

function normalizeModel(root) {
  const firstBox = new THREE.Box3().setFromObject(root);
  const size = firstBox.getSize(new THREE.Vector3());
  const height = Math.max(size.y, 0.001);
  root.scale.multiplyScalar(2.1 / height);

  const box = new THREE.Box3().setFromObject(root);
  const center = box.getCenter(new THREE.Vector3());
  root.position.x -= center.x;
  root.position.z -= center.z;
  root.position.y -= box.min.y;
}

function setStatus(message) {
  status.textContent = message;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function activeCharacter() {
  return CHARACTER_OPTIONS.find((option) => option.id === state.activeCharacterId) || CHARACTER_OPTIONS[0];
}

function activeCombatState() {
  return COMBAT_STATES.find((option) => option.id === state.activeCombatStateId) || COMBAT_STATES[0];
}

function collectRigNodes(root) {
  state.rigNodes = {};
  state.weaponNodes = {};
  state.baseWeaponQuaternions = {};
  root.traverse((child) => {
    if (!state.rigNodes[child.name]) state.rigNodes[child.name] = child;
    if (WEAPON_NAMES.includes(child.name) && child.name !== 'None') {
      state.weaponNodes[child.name] = child;
      state.baseWeaponQuaternions[child.name] = child.quaternion.clone();
    }
  });
}

function activeWeaponNode() {
  return state.weaponNodes[state.activeWeaponName] || null;
}

function weaponNodesInModel() {
  return Object.keys(state.weaponNodes).sort((a, b) => a.localeCompare(b));
}

function buildProfile() {
  return {
    version: 1,
    character: state.activeCharacterId,
    clip: state.activeClipName,
    combatState: state.activeCombatStateId,
    weapon: state.activeWeaponName,
    speed: state.speed,
    aim: { ...state.aim },
    layers: { ...state.layers },
    pose: { ...state.pose }
  };
}

function updateProfileJson() {
  const profile = buildProfile();
  profileJson.value = JSON.stringify(profile, null, 2);
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  } catch {
    // Local storage is optional for this lab.
  }
}

function updateStatus() {
  const clipNames = state.clips.map((clip) => clip.name).join(', ');
  const rigSummary = ['Torso', 'UpperArm.R', 'LowerArm.R', 'Index1.R']
    .map((name) => `${name}:${state.rigNodes[name] ? 'ok' : 'missing'}`)
    .join(' ');
  setStatus(
    [
      `Character: ${activeCharacter().label}`,
      `Animation: ${state.activeClipName || 'none'}`,
      `Combat State: ${activeCombatState().label}`,
      `Weapon: ${state.activeWeaponName}`,
      `Aim pitch/yaw: ${numberWithDigits(state.aim.pitchDeg, 0)} / ${numberWithDigits(state.aim.yawDeg, 0)}`,
      `Layers: aim ${numberWithDigits(state.layers.aimWeight, 2)} focus ${numberWithDigits(state.layers.focusWeight, 2)} bob ${numberWithDigits(state.layers.bobWeight, 2)} recoil ${numberWithDigits(state.layers.recoilWeight, 2)}`,
      `Playback: ${state.paused ? 'paused' : `${state.speed.toFixed(2)}x`}`,
      `Control Mode: ${state.playtest.enabled ? (state.playtest.pointerLocked ? 'locked' : 'on') : 'off'}`,
      `Camera: ${state.activeCameraPresetId}`,
      `Captures: ${state.captures.length}`,
      `Rig: ${rigSummary}`,
      `Clips: ${state.clips.length}`,
      clipNames,
      '',
      `Embedded weapon nodes: ${weaponNodesInModel().join(', ') || 'none'}`,
      '',
      'Console API: window.toonCharacterLab.captureSeries(), captureStateMatrix(), captureAssetTurnaround()'
    ].join('\n')
  );
  updateProfileJson();
}

function setWeaponVisibility(name) {
  state.activeWeaponName = name;
  Object.entries(state.weaponNodes).forEach(([weaponName, node]) => {
    node.visible = name !== 'None' && weaponName === name;
  });
  weaponSelect.value = name;
  updateStatus();
}

function preferredClipName(clips) {
  const available = new Set(clips.map((clip) => clip.name));
  if (state.activeClipName && available.has(state.activeClipName)) return state.activeClipName;
  return DEFAULT_CLIP_ORDER.find((name) => available.has(name)) || (clips[0] && clips[0].name) || '';
}

function preferredClipForCombatState(combatStateId) {
  const combatState = COMBAT_STATES.find((option) => option.id === combatStateId) || activeCombatState();
  const available = new Set(state.clips.map((clip) => clip.name));
  return combatState.clipCandidates.find((name) => available.has(name)) || preferredClipName(state.clips);
}

function setActionSpeed() {
  if (state.activeAction) state.activeAction.timeScale = state.speed * state.activeClipSpeedScale;
}

function playClip(name, options = {}) {
  if (!state.mixer) return null;
  const clip = THREE.AnimationClip.findByName(state.clips, name);
  if (!clip) return null;

  const action = state.mixer.clipAction(clip);
  action.enabled = true;
  action.paused = false;
  action.timeScale = state.speed * state.activeClipSpeedScale;
  action.reset();
  action.setLoop(options.once ? THREE.LoopOnce : THREE.LoopRepeat, options.once ? 1 : Infinity);
  action.clampWhenFinished = !!options.once;
  action.play();

  if (state.activeAction && state.activeAction !== action) {
    state.activeAction.fadeOut(options.fade ?? 0.16);
    action.fadeIn(options.fade ?? 0.16);
  }

  state.activeAction = action;
  state.activeClipName = name;
  clipSelect.value = name;
  updateStatus();
  return action;
}

function setClipSample(sample) {
  if (!state.activeAction) return;
  const clip = state.activeAction.getClip();
  state.activeAction.paused = false;
  state.activeAction.time = Math.max(0, Math.min(0.999, sample)) * clip.duration;
  state.mixer.update(0);
}

function populateClipSelect(clips) {
  clipSelect.replaceChildren();
  clips.forEach((clip) => {
    const option = document.createElement('option');
    option.value = clip.name;
    option.textContent = clip.name;
    clipSelect.append(option);
  });
}

function populateWeaponSelect() {
  weaponSelect.replaceChildren();
  WEAPON_NAMES.forEach((name) => {
    const option = document.createElement('option');
    option.value = name;
    option.textContent = name;
    weaponSelect.append(option);
  });
  weaponSelect.value = state.activeWeaponName;
}

function updateCharacterButtons() {
  Array.from(characterButtons.children).forEach((button) => {
    button.classList.toggle('active', button.dataset.characterId === state.activeCharacterId);
  });
}

function updateCombatStateButtons() {
  Array.from(combatStateButtons.children).forEach((button) => {
    button.classList.toggle('active', button.dataset.combatStateId === state.activeCombatStateId);
  });
}

function updateCameraButtons() {
  Array.from(cameraButtons.children).forEach((button) => {
    button.classList.toggle('active', button.dataset.cameraId === state.activeCameraPresetId);
  });
}

function setCombatState(id, options = {}) {
  const combatState = COMBAT_STATES.find((candidate) => candidate.id === id) || COMBAT_STATES[0];
  state.activeCombatStateId = combatState.id;
  state.activeClipSpeedScale = combatState.clipSpeed || 1;
  Object.assign(state.layers, DEFAULT_LAYERS, combatState.layers, options.layers || {});
  syncSliderValues();
  updateCombatStateButtons();

  const clipName = preferredClipForCombatState(combatState.id);
  if (clipName) playClip(clipName, { fade: options.fade ?? 0.12 });
  if (combatState.id === 'fire' || combatState.id === 'jump_fire') {
    state.lastShotAt = state.runtimeTime;
    state.transientFireUntil = state.runtimeTime + 0.35;
  }
  updateStatus();
}

function setCameraPreset(id) {
  const preset = CAMERA_PRESETS.find((candidate) => candidate.id === id) || CAMERA_PRESETS[0];
  state.activeCameraPresetId = preset.id;
  camera.position.copy(vectorFromArray(preset.position));
  controls.target.copy(vectorFromArray(preset.target));
  controls.update();
  updateCameraButtons();
  updateStatus();
}

function createSlider(container, config, target) {
  const row = document.createElement('label');
  row.className = 'slider-row';

  const text = document.createElement('span');
  text.textContent = config.label;

  const input = document.createElement('input');
  input.type = 'range';
  input.min = String(config.min);
  input.max = String(config.max);
  input.step = String(config.step);
  input.value = String(target[config.key]);
  input.dataset.key = config.key;

  const output = document.createElement('output');
  output.value = numberWithDigits(target[config.key], config.digits);
  output.textContent = numberWithDigits(target[config.key], config.digits);

  input.addEventListener('input', () => {
    target[config.key] = Number(input.value);
    output.value = numberWithDigits(target[config.key], config.digits);
    output.textContent = numberWithDigits(target[config.key], config.digits);
    updateStatus();
  });

  row.append(text, input, output);
  container.append(row);
}

function syncSliderValues() {
  AIM_CONTROLS.forEach((config) => syncSliderValue(aimControls, config, state.aim));
  LAYER_CONTROLS.forEach((config) => syncSliderValue(layerControls, config, state.layers));
  POSE_CONTROLS.forEach((config) => syncSliderValue(poseControls, config, state.pose));
}

function syncSliderValue(container, config, target) {
  const input = container.querySelector(`input[data-key="${config.key}"]`);
  if (!input) return;
  const output = input.parentElement.querySelector('output');
  input.value = String(target[config.key]);
  if (output) {
    output.value = numberWithDigits(target[config.key], config.digits);
    output.textContent = numberWithDigits(target[config.key], config.digits);
  }
}

function aimTargetWorldPosition() {
  const distance = Math.max(0.1, Number(state.aim.distance) || DEFAULT_AIM.distance);
  const yaw = degToRad(state.aim.yawDeg);
  const pitch = degToRad(state.aim.pitchDeg);
  const target = new THREE.Vector3(
    Math.sin(yaw) * Math.cos(pitch) * distance,
    state.aim.shoulderHeight + Math.sin(pitch) * distance,
    Math.cos(yaw) * Math.cos(pitch) * distance
  );
  if (state.modelGroup) target.applyQuaternion(state.modelGroup.quaternion).add(state.modelGroup.position);
  state.aim.targetX = target.x;
  state.aim.targetY = target.y;
  state.aim.targetZ = target.z;
  return target;
}

function muzzleWorldPosition() {
  const weapon = activeWeaponNode();
  if (!weapon) return null;
  return weapon.localToWorld(new THREE.Vector3(state.pose.muzzleX, state.pose.muzzleY, state.pose.muzzleZ));
}

function resetWeaponLocalPose() {
  Object.entries(state.weaponNodes).forEach(([name, node]) => {
    const base = state.baseWeaponQuaternions[name];
    if (base) node.quaternion.copy(base);
  });
}

function rotateRigNode(name, axis, degrees) {
  const node = state.rigNodes[name];
  if (!node) return;
  node.rotation[axis] += degToRad(degrees);
}

function effectiveFocusWeight() {
  const transientFocus = state.runtimeTime < state.transientFireUntil ? 1 : 0;
  return Math.max(state.layers.focusWeight, transientFocus);
}

function effectiveRecoilWeight() {
  const transientRecoil = state.runtimeTime < state.transientFireUntil ? 1 : 0;
  return Math.max(state.layers.recoilWeight, transientRecoil);
}

function recoilKick() {
  const elapsedSinceShot = Math.max(0, state.runtimeTime - state.lastShotAt);
  const oneShotKick = elapsedSinceShot < 0.45
    ? Math.exp(-elapsedSinceShot * 8) * Math.sin(Math.min(1, elapsedSinceShot * 9) * Math.PI)
    : 0;
  const loopCycle = (state.runtimeTime * 7.5) % 1;
  const loopKick = (state.activeCombatStateId === 'fire' || state.activeCombatStateId === 'jump_fire')
    ? Math.pow(1 - loopCycle, 3)
    : 0;
  return Math.max(oneShotKick, loopKick) * effectiveRecoilWeight();
}

function applyAimSolve() {
  const aimWeight = Math.max(state.layers.aimWeight, lockWeaponTargetToggle.checked ? 0.95 : 0);
  if (aimWeight <= 0) return;

  const pitch = Number(state.aim.pitchDeg) || 0;
  const yaw = Number(state.aim.yawDeg) || 0;
  rotateRigNode('Torso', 'x', -pitch * 0.18 * aimWeight);
  rotateRigNode('Torso', 'y', yaw * 0.24 * aimWeight);
  rotateRigNode('UpperArm.R', 'x', -pitch * 0.52 * aimWeight);
  rotateRigNode('UpperArm.R', 'y', yaw * 0.25 * aimWeight);
  rotateRigNode('LowerArm.R', 'x', -pitch * 0.16 * aimWeight);
  rotateRigNode('Index1.R', 'x', -pitch * 0.14 * aimWeight);
  rotateRigNode('Index1.R', 'y', yaw * 0.08 * aimWeight);
}

function applyMovementBob(weapon) {
  const focusSuppression = 1 - Math.min(1, Math.max(0, effectiveFocusWeight())) * 0.95;
  const bobWeight = Math.max(0, state.layers.bobWeight) * focusSuppression;
  if (bobWeight <= 0.001) return;

  const frequency = state.activeCombatStateId === 'walk' ? 7.5 : 10.5;
  const wave = Math.sin(state.runtimeTime * frequency);
  const sideWave = Math.sin(state.runtimeTime * frequency * 0.5 + Math.PI * 0.45);
  rotateRigNode('UpperArm.R', 'x', wave * 1.4 * bobWeight);
  rotateRigNode('LowerArm.R', 'x', -wave * 0.65 * bobWeight);
  rotateRigNode('Index1.R', 'z', sideWave * 1.1 * bobWeight);
  if (!weapon || state.playtest.enabled) return;
  weapon.rotateX(degToRad(wave * 1.9 * bobWeight));
  weapon.rotateY(degToRad(sideWave * 0.85 * bobWeight));
  weapon.rotateZ(degToRad(sideWave * 1.15 * bobWeight));
}

function applyRecoil(weapon) {
  const kick = recoilKick();
  if (kick <= 0.001) return;

  rotateRigNode('UpperArm.R', 'x', -kick * 5.5);
  rotateRigNode('LowerArm.R', 'x', kick * 2.2);
  rotateRigNode('Index1.R', 'x', -kick * 3.2);
  if (!weapon || state.playtest.enabled) return;
  weapon.rotateX(degToRad(-kick * 8.5));
  weapon.rotateY(degToRad(Math.sin(state.runtimeTime * 33) * kick * 1.15));
  weapon.rotateZ(degToRad(kick * 1.8));
}

function applySprintLowering(weapon) {
  if (state.activeCombatStateId !== 'sprint') return;
  rotateRigNode('UpperArm.R', 'x', 11);
  rotateRigNode('LowerArm.R', 'x', -7);
  if (!weapon || state.playtest.enabled) return;
  weapon.rotateX(degToRad(-16));
  weapon.rotateZ(degToRad(6));
}

function applyPoseOverlay() {
  resetWeaponLocalPose();
  BONE_OVERLAYS.forEach((entry) => {
    const node = state.rigNodes[entry.node];
    if (!node) return;
    node.rotation[entry.axis] += degToRad(state.pose[entry.key]);
  });

  const target = aimTargetWorldPosition();
  const weapon = activeWeaponNode();
  applyAimSolve();
  applySprintLowering(weapon);
  applyMovementBob(weapon);
  applyRecoil(weapon);
  if (weapon && !state.playtest.enabled) {
    weapon.rotateX(degToRad(state.pose.weaponPitch));
    weapon.rotateY(degToRad(state.pose.weaponYaw));
    weapon.rotateZ(degToRad(state.pose.weaponRoll));
  }

  if (state.modelRoot) state.modelRoot.updateMatrixWorld(true);
  updateAimHelpers();
}

function updateAimHelpers() {
  const visible = showAimToggle.checked;
  const target = aimTargetWorldPosition();
  const muzzle = muzzleWorldPosition();
  targetMarker.visible = visible;
  muzzleMarker.visible = visible && !!muzzle;
  aimLine.visible = visible && !!muzzle;
  targetMarker.position.copy(target);
  if (!muzzle) return;
  muzzleMarker.position.copy(muzzle);
  aimLine.geometry.setFromPoints([muzzle, target]);
}

async function loadCharacter(characterId) {
  const option = CHARACTER_OPTIONS.find((candidate) => candidate.id === characterId) || CHARACTER_OPTIONS[0];
  state.activeCharacterId = option.id;
  updateCharacterButtons();
  setStatus(`Loading ${option.label}...`);

  if (state.skeletonHelper) {
    scene.remove(state.skeletonHelper);
    state.skeletonHelper = null;
  }

  if (state.modelGroup) {
    scene.remove(state.modelGroup);
    disposeObject(state.modelGroup);
    state.modelGroup = null;
    state.modelRoot = null;
  }

  state.mixer = null;
  state.activeAction = null;
  state.clips = [];
  state.rigNodes = {};
  state.weaponNodes = {};

  const gltf = await loader.loadAsync(option.path);
  const root = gltf.scene;
  prepareRenderable(root);
  normalizeModel(root);
  collectRigNodes(root);

  const group = new THREE.Group();
  group.name = `ToonCharacter_${option.id}`;
  group.add(root);
  scene.add(group);

  state.modelGroup = group;
  state.modelRoot = root;
  state.mixer = new THREE.AnimationMixer(root);
  state.clips = gltf.animations.slice().sort((a, b) => a.name.localeCompare(b.name));

  state.skeletonHelper = new THREE.SkeletonHelper(root);
  state.skeletonHelper.visible = showSkeletonToggle.checked;
  scene.add(state.skeletonHelper);

  populateClipSelect(state.clips);
  setWeaponVisibility(state.activeWeaponName);
  setCombatState(state.activeCombatStateId, { fade: 0, layers: state.layers });
  renderNow();
}

function triggerShotPulse() {
  const previousClip = state.activeClipName;
  const available = new Set(state.clips.map((clip) => clip.name));
  const pulseName = ['Idle_Shoot', 'Walk_Shoot', 'Run_Shoot'].find((name) => available.has(name));
  if (!pulseName) return;

  state.lastShotAt = state.runtimeTime;
  state.transientFireUntil = state.runtimeTime + 0.35;
  const action = playClip(pulseName, { once: true, fade: 0.08 });
  if (!action) return;

  const restore = (event) => {
    if (event.action !== action) return;
    state.mixer.removeEventListener('finished', restore);
    if (previousClip) playClip(previousClip, { fade: 0.12 });
  };
  state.mixer.addEventListener('finished', restore);
}

function resize() {
  const width = canvas.clientWidth || 1;
  const height = canvas.clientHeight || 1;
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

function renderNow() {
  resize();
  if (state.mixer) state.mixer.update(0);
  applyPoseOverlay();
  controls.update();
  renderer.render(scene, camera);
}

function captureFrame(label, extraMetadata = {}) {
  renderNow();
  const dataUrl = renderer.domElement.toDataURL('image/png');
  const metadata = {
    label,
    character: state.activeCharacterId,
    clip: state.activeClipName,
    combatState: state.activeCombatStateId,
    weapon: state.activeWeaponName,
    camera: state.activeCameraPresetId,
    aimPitch: state.aim.pitchDeg,
    aimYaw: state.aim.yawDeg,
    aimWeight: state.layers.aimWeight,
    focusWeight: state.layers.focusWeight,
    bobWeight: state.layers.bobWeight,
    recoilWeight: state.layers.recoilWeight,
    ...extraMetadata
  };
  state.captures.unshift({ dataUrl, metadata });
  state.captures = state.captures.slice(0, CAPTURE_LIMIT);
  renderCaptureGallery();
  updateStatus();
  return { dataUrl, metadata };
}

function renderCaptureGallery() {
  captureGallery.replaceChildren();
  state.captures.forEach((capture, index) => {
    const item = document.createElement('article');
    item.className = 'capture-item';

    const link = document.createElement('a');
    link.href = capture.dataUrl;
    link.download = `toon-lab-${index + 1}.png`;

    const image = document.createElement('img');
    image.src = capture.dataUrl;
    image.alt = capture.metadata.label;
    link.append(image);

    const meta = document.createElement('pre');
    meta.textContent = JSON.stringify(capture.metadata, null, 2);

    item.append(link, meta);
    captureGallery.append(item);
  });
}

function nextFrame() {
  return new Promise((resolve) => requestAnimationFrame(resolve));
}

async function captureEvaluationSeries() {
  const previous = {
    camera: state.activeCameraPresetId,
    paused: state.paused,
    autoRotate: autoRotateToggle.checked,
    rotationY: state.modelGroup ? state.modelGroup.rotation.y : 0,
    runtimeTime: state.runtimeTime,
    transientFireUntil: state.transientFireUntil
  };

  state.paused = true;
  autoRotateToggle.checked = false;
  if (state.modelGroup) state.modelGroup.rotation.y = 0;
  playToggle.textContent = 'Play';

  for (const viewId of SERIES_VIEW_IDS) {
    setCameraPreset(viewId);
    for (const sample of SERIES_SAMPLES) {
      setClipSample(sample);
      renderNow();
      await nextFrame();
      captureFrame(`${viewId} sample ${sample.toFixed(2)}`, { sample });
    }
  }

  setCameraPreset(previous.camera);
  state.paused = previous.paused;
  autoRotateToggle.checked = previous.autoRotate;
  if (state.modelGroup) state.modelGroup.rotation.y = previous.rotationY;
  state.runtimeTime = previous.runtimeTime;
  state.transientFireUntil = previous.transientFireUntil;
  playToggle.textContent = state.paused ? 'Play' : 'Pause';
  updateStatus();
}

async function captureStateMatrixSeries() {
  const previous = {
    camera: state.activeCameraPresetId,
    combatState: state.activeCombatStateId,
    aim: { ...state.aim },
    layers: { ...state.layers },
    paused: state.paused,
    autoRotate: autoRotateToggle.checked,
    rotationY: state.modelGroup ? state.modelGroup.rotation.y : 0,
    runtimeTime: state.runtimeTime,
    transientFireUntil: state.transientFireUntil
  };

  state.paused = true;
  autoRotateToggle.checked = false;
  if (state.modelGroup) state.modelGroup.rotation.y = 0;
  playToggle.textContent = 'Play';

  for (const combatStateId of MATRIX_STATE_IDS) {
    setCombatState(combatStateId, { fade: 0 });
    setClipSample(0.35);
    for (const pitch of MATRIX_AIM_PITCHES) {
      state.aim.pitchDeg = pitch;
      syncSliderValues();
      if (combatStateId === 'fire' || combatStateId === 'jump_fire') {
        state.lastShotAt = state.runtimeTime;
        state.transientFireUntil = state.runtimeTime + 0.35;
      }
      for (const viewId of MATRIX_VIEW_IDS) {
        setCameraPreset(viewId);
        renderNow();
        await nextFrame();
        captureFrame(`${combatStateId} pitch ${pitch} ${viewId}`, { sample: 0.35 });
      }
    }
  }

  Object.assign(state.aim, previous.aim);
  Object.assign(state.layers, previous.layers);
  syncSliderValues();
  setCombatState(previous.combatState, { fade: 0, layers: previous.layers });
  setCameraPreset(previous.camera);
  state.paused = previous.paused;
  autoRotateToggle.checked = previous.autoRotate;
  if (state.modelGroup) state.modelGroup.rotation.y = previous.rotationY;
  state.runtimeTime = previous.runtimeTime;
  state.transientFireUntil = previous.transientFireUntil;
  playToggle.textContent = state.paused ? 'Play' : 'Pause';
  updateStatus();
}

async function captureAssetTurnaroundSeries() {
  const previous = {
    camera: state.activeCameraPresetId,
    paused: state.paused,
    autoRotate: autoRotateToggle.checked,
    showAim: showAimToggle.checked,
    groundVisible: ground.visible,
    gridVisible: grid.visible,
    rotationY: state.modelGroup ? state.modelGroup.rotation.y : 0
  };

  state.paused = true;
  autoRotateToggle.checked = false;
  showAimToggle.checked = false;
  ground.visible = false;
  grid.visible = false;
  if (state.modelGroup) state.modelGroup.rotation.y = 0;
  playToggle.textContent = 'Play';

  for (const viewId of ASSET_VIEW_IDS) {
    setCameraPreset(viewId);
    renderNow();
    await nextFrame();
    captureFrame(`asset-only ${viewId}`, { isolated: true });
  }

  setCameraPreset(previous.camera);
  state.paused = previous.paused;
  autoRotateToggle.checked = previous.autoRotate;
  showAimToggle.checked = previous.showAim;
  ground.visible = previous.groundVisible;
  grid.visible = previous.gridVisible;
  if (state.modelGroup) state.modelGroup.rotation.y = previous.rotationY;
  playToggle.textContent = state.paused ? 'Play' : 'Pause';
  updateStatus();
}

async function copyProfileJson() {
  updateProfileJson();
  try {
    await navigator.clipboard.writeText(profileJson.value);
    setStatus(`${status.textContent}\n\nProfile copied.`);
  } catch {
    profileJson.select();
    setStatus(`${status.textContent}\n\nClipboard blocked. JSON is selected.`);
  }
}

async function applyProfile(rawProfile) {
  const profile = typeof rawProfile === 'string' ? JSON.parse(rawProfile) : rawProfile;
  Object.assign(state.pose, DEFAULT_POSE, profile.pose || {});
  Object.assign(state.aim, DEFAULT_AIM, profile.aim || {});
  Object.assign(state.layers, DEFAULT_LAYERS, profile.layers || {});
  state.speed = Number(profile.speed) || 1;
  state.activeCombatStateId = profile.combatState || state.activeCombatStateId;
  state.activeWeaponName = profile.weapon || state.activeWeaponName;
  state.activeClipName = profile.clip || state.activeClipName;
  speedRange.value = String(state.speed);
  syncSliderValues();
  updateCombatStateButtons();

  if (profile.character && profile.character !== state.activeCharacterId) {
    await loadCharacter(profile.character);
  } else {
    setWeaponVisibility(state.activeWeaponName);
    setCombatState(state.activeCombatStateId, { fade: 0, layers: state.layers });
  }
  renderNow();
  updateStatus();
}

function resetPoseProfile() {
  Object.assign(state.pose, DEFAULT_POSE);
  Object.assign(state.aim, DEFAULT_AIM);
  Object.assign(state.layers, DEFAULT_LAYERS, activeCombatState().layers);
  syncSliderValues();
  renderNow();
  updateStatus();
}

function setPlaytestEnabled(enabled) {
  state.playtest.enabled = !!enabled;
  playtestToggle.classList.toggle('active', state.playtest.enabled);
  playtestToggle.textContent = state.playtest.enabled ? 'Exit' : 'Control';
  controls.enabled = !state.playtest.enabled;
  autoRotateToggle.checked = false;

  if (state.playtest.enabled) {
    state.paused = false;
    playToggle.textContent = 'Pause';
    canvas.focus();
    if (state.modelGroup) {
      state.modelGroup.position.set(0, 0, 0);
      state.modelGroup.rotation.y = state.playtest.yawRad;
    }
    canvas.requestPointerLock?.();
  } else {
    state.playtest.keys.clear();
    state.playtest.fireHeld = false;
    state.playtest.verticalVelocity = 0;
    state.playtest.grounded = true;
    if (document.pointerLockElement === canvas) document.exitPointerLock?.();
  }
  updateStatus();
}

function isEditableTarget(target) {
  return !!target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

function playtestKeyActive(...codes) {
  return codes.some((code) => state.playtest.keys.has(code));
}

function requestPlaytestJump() {
  if (!state.playtest.enabled || !state.playtest.grounded) return;
  state.playtest.grounded = false;
  state.playtest.verticalVelocity = 5.4;
  setCombatState(state.playtest.fireHeld ? 'jump_fire' : 'jump');
}

function requestPlaytestShot() {
  if (!state.playtest.enabled) return;
  state.playtest.fireHeld = true;
  state.playtest.nextShotAt = state.runtimeTime + 0.13;
  state.lastShotAt = state.runtimeTime;
  state.transientFireUntil = state.runtimeTime + 0.35;
  if (!state.playtest.grounded) setCombatState('jump_fire');
}

function releasePlaytestShot() {
  state.playtest.fireHeld = false;
}

function updatePlaytestShotCadence() {
  if (!state.playtest.fireHeld) return;
  if (state.runtimeTime < state.playtest.nextShotAt) return;
  state.playtest.nextShotAt = state.runtimeTime + 0.13;
  state.lastShotAt = state.runtimeTime;
  state.transientFireUntil = state.runtimeTime + 0.35;
}

function updatePlaytestMovement(delta) {
  if (!state.playtest.enabled || !state.modelGroup) return;
  const p = state.playtest;
  const forwardInput = (playtestKeyActive('KeyW') ? 1 : 0) - (playtestKeyActive('KeyS') ? 1 : 0);
  const strafeInput = (playtestKeyActive('KeyD') ? 1 : 0) - (playtestKeyActive('KeyA') ? 1 : 0);
  const moving = Math.abs(forwardInput) + Math.abs(strafeInput) > 0;
  const sprinting = moving && forwardInput > 0 && playtestKeyActive('ShiftLeft', 'ShiftRight') && !p.fireHeld && p.grounded;
  const walking = moving && playtestKeyActive('ControlLeft', 'ControlRight') && p.grounded && !sprinting;
  const speed = sprinting ? 4.4 : (walking ? 1.55 : 2.85);

  if (moving) {
    const forward = new THREE.Vector3(Math.sin(p.yawRad), 0, Math.cos(p.yawRad));
    const right = new THREE.Vector3(Math.cos(p.yawRad), 0, -Math.sin(p.yawRad));
    const move = new THREE.Vector3()
      .addScaledVector(forward, forwardInput)
      .addScaledVector(right, strafeInput);
    if (move.lengthSq() > 0) {
      move.normalize().multiplyScalar(speed * delta);
      state.modelGroup.position.add(move);
    }
  }

  if (!p.grounded) {
    p.verticalVelocity -= 12.2 * delta;
    state.modelGroup.position.y += p.verticalVelocity * delta;
    if (state.modelGroup.position.y <= 0) {
      state.modelGroup.position.y = 0;
      p.grounded = true;
      p.verticalVelocity = 0;
    }
  }

  state.modelGroup.rotation.y = p.yawRad;
  updatePlaytestShotCadence();

  let desiredState = 'idle';
  if (!p.grounded && p.fireHeld) desiredState = 'jump_fire';
  else if (!p.grounded) desiredState = 'jump';
  else if (sprinting) desiredState = 'sprint';
  else if (walking) desiredState = 'walk';
  else if (moving) desiredState = 'run';
  if (desiredState !== state.activeCombatStateId) setCombatState(desiredState);
}

function updatePlaytestCamera(delta) {
  if (!state.playtest.enabled || !state.modelGroup) return;
  const base = state.modelGroup.position;
  const yaw = state.playtest.yawRad;
  const forward = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
  const behind = forward.clone().multiplyScalar(-3.5);
  const desiredPosition = base.clone().add(behind).add(new THREE.Vector3(0, 1.85, 0));
  const desiredTarget = aimTargetWorldPosition();
  const lerp = 1 - Math.pow(0.001, delta);
  camera.position.lerp(desiredPosition, lerp);
  camera.lookAt(desiredTarget);
}

function animate() {
  requestAnimationFrame(animate);
  resize();

  const delta = clock.getDelta();
  if (!state.paused) state.runtimeTime += delta;
  updatePlaytestMovement(delta);
  if (state.mixer) state.mixer.update(state.paused ? 0 : delta);
  if (state.modelGroup && autoRotateToggle.checked) state.modelGroup.rotation.y += delta * 0.32;
  if (state.skeletonHelper) state.skeletonHelper.visible = showSkeletonToggle.checked;
  applyPoseOverlay();

  if (state.playtest.enabled) updatePlaytestCamera(delta);
  else controls.update();
  renderer.render(scene, camera);
}

CHARACTER_OPTIONS.forEach((option) => {
  const button = document.createElement('button');
  button.type = 'button';
  button.dataset.characterId = option.id;
  button.textContent = option.label;
  button.addEventListener('click', () => loadCharacter(option.id).catch((error) => {
    console.error(error);
    setStatus(`Failed to load ${option.label}: ${error.message}`);
  }));
  characterButtons.append(button);
});

COMBAT_STATES.forEach((option) => {
  const button = document.createElement('button');
  button.type = 'button';
  button.dataset.combatStateId = option.id;
  button.textContent = option.label;
  button.addEventListener('click', () => setCombatState(option.id));
  combatStateButtons.append(button);
});

CAMERA_PRESETS.forEach((preset) => {
  const button = document.createElement('button');
  button.type = 'button';
  button.dataset.cameraId = preset.id;
  button.textContent = preset.label;
  button.addEventListener('click', () => setCameraPreset(preset.id));
  cameraButtons.append(button);
});

AIM_CONTROLS.forEach((config) => createSlider(aimControls, config, state.aim));
LAYER_CONTROLS.forEach((config) => createSlider(layerControls, config, state.layers));
POSE_CONTROLS.forEach((config) => createSlider(poseControls, config, state.pose));
populateWeaponSelect();
updateCharacterButtons();
updateCombatStateButtons();
updateCameraButtons();
setCameraPreset('front');

clipSelect.addEventListener('change', () => playClip(clipSelect.value));
weaponSelect.addEventListener('change', () => setWeaponVisibility(weaponSelect.value));
shotPulse.addEventListener('click', triggerShotPulse);
playToggle.addEventListener('click', () => {
  state.paused = !state.paused;
  playToggle.textContent = state.paused ? 'Play' : 'Pause';
  updateStatus();
});
speedRange.addEventListener('input', () => {
  state.speed = Number(speedRange.value) || 1;
  setActionSpeed();
  updateStatus();
});
showAimToggle.addEventListener('change', updateAimHelpers);
lockWeaponTargetToggle.addEventListener('change', updateStatus);
copyProfile.addEventListener('click', copyProfileJson);
applyProfileButton.addEventListener('click', () => {
  applyProfile(profileJson.value).catch((error) => {
    console.error(error);
    setStatus(`Profile apply failed: ${error.message}`);
  });
});
resetPose.addEventListener('click', resetPoseProfile);
captureCurrent.addEventListener('click', () => captureFrame('current'));
captureSeries.addEventListener('click', () => {
  captureEvaluationSeries().catch((error) => {
    console.error(error);
    setStatus(`Capture series failed: ${error.message}`);
  });
});
captureStateMatrix.addEventListener('click', () => {
  captureStateMatrixSeries().catch((error) => {
    console.error(error);
    setStatus(`State matrix failed: ${error.message}`);
  });
});
captureAssetTurnaround.addEventListener('click', () => {
  captureAssetTurnaroundSeries().catch((error) => {
    console.error(error);
    setStatus(`Asset turnaround failed: ${error.message}`);
  });
});
clearCaptures.addEventListener('click', () => {
  state.captures = [];
  renderCaptureGallery();
  updateStatus();
});
playtestToggle.addEventListener('click', () => setPlaytestEnabled(!state.playtest.enabled));
canvas.addEventListener('click', () => {
  if (state.playtest.enabled && document.pointerLockElement !== canvas) canvas.requestPointerLock?.();
});
canvas.addEventListener('mousedown', (event) => {
  if (!state.playtest.enabled || event.button !== 0) return;
  event.preventDefault();
  requestPlaytestShot();
});
window.addEventListener('mouseup', (event) => {
  if (event.button === 0) releasePlaytestShot();
});
canvas.addEventListener('contextmenu', (event) => {
  if (state.playtest.enabled) event.preventDefault();
});
window.addEventListener('keydown', (event) => {
  if (!state.playtest.enabled || isEditableTarget(event.target)) return;
  if (!PLAYTEST_MOVE_CODES.has(event.code)) return;
  event.preventDefault();
  if (event.code === 'Space' && !state.playtest.keys.has('Space')) requestPlaytestJump();
  state.playtest.keys.add(event.code);
});
window.addEventListener('keyup', (event) => {
  if (!state.playtest.enabled) return;
  state.playtest.keys.delete(event.code);
});
window.addEventListener('mousemove', (event) => {
  if (!state.playtest.enabled || document.pointerLockElement !== canvas) return;
  state.playtest.yawRad -= event.movementX * 0.0024;
  state.aim.pitchDeg = clamp(state.aim.pitchDeg - event.movementY * 0.08, -55, 55);
  state.aim.yawDeg = 0;
  syncSliderValues();
});
document.addEventListener('pointerlockchange', () => {
  state.playtest.pointerLocked = document.pointerLockElement === canvas;
  updateStatus();
});

window.addEventListener('resize', resize);
window.toonCharacterLab = {
  captureCurrent: () => captureFrame('console current'),
  captureSeries: captureEvaluationSeries,
  captureStateMatrix: captureStateMatrixSeries,
  captureAssetTurnaround: captureAssetTurnaroundSeries,
  setCamera: setCameraPreset,
  setCombatState,
  setPlaytestEnabled,
  setClipSample,
  profile: buildProfile,
  applyProfile,
  resetPose: resetPoseProfile,
  captures: () => state.captures.map((capture) => capture.metadata)
};

loadCharacter(state.activeCharacterId).catch((error) => {
  console.error(error);
  setStatus(`Failed to load character: ${error.message}`);
});
animate();
