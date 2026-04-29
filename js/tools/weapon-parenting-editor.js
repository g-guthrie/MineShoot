import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import '../domain/weapons/visuals.js';
import '../actors/boxman-rig.js';

const STORAGE_KEY = 'mineshoot.weaponOffsetEditor.v2';
const WEAPON_IDS = ['pistol', 'rifle', 'machinegun', 'shotgun', 'sniper'];
const WEAPON_LABELS = {
  pistol: 'Pistol',
  rifle: 'Scout Rifle',
  machinegun: 'AK',
  shotgun: 'Shotgun',
  sniper: 'Sniper'
};

const DEFAULT_OFFSET = {
  translation: [0, 0, 0],
  rotationDeg: [0, 0, 0],
  scale: 1
};

const canvas = document.getElementById('scene-canvas');
const weaponSelect = document.getElementById('weapon-select');
const transformControlsEl = document.getElementById('transform-controls');
const fitViewButton = document.getElementById('fit-view');
const saveButton = document.getElementById('save-profile');
const copyButton = document.getElementById('copy-profile');
const resetButton = document.getElementById('reset-profile');
const outputText = document.getElementById('profile-json');
const statusEl = document.getElementById('status');

const runtime = globalThis.__MAYHEM_RUNTIME || {};
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setClearColor(0x101419, 1);
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
if (renderer.outputColorSpace !== undefined) renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x101419);

const camera = new THREE.PerspectiveCamera(52, 1, 0.01, 80);
camera.position.set(5.2, 1.8, 3.2);

const orbit = new OrbitControls(camera, canvas);
orbit.enableDamping = true;
orbit.dampingFactor = 0.08;
orbit.target.set(0, 0.85, 0);
orbit.update();

const sceneRoot = new THREE.Group();
scene.add(sceneRoot);

const grid = new THREE.GridHelper(3.5, 14, 0x3a4654, 0x222b34);
grid.position.y = -0.01;
scene.add(grid);

scene.add(new THREE.HemisphereLight(0xd7edf8, 0x202029, 1.9));
const keyLight = new THREE.DirectionalLight(0xffffff, 2.2);
keyLight.position.set(2.8, 3.8, 2.4);
scene.add(keyLight);
const rimLight = new THREE.DirectionalLight(0x9fc7ff, 1.1);
rimLight.position.set(-2.2, 1.5, -2.4);
scene.add(rimLight);

let boxmanController = null;
let boxmanRig = null;
let activeWeaponId = 'pistol';
let offsets = loadOffsets();
let baselinePosition = new THREE.Vector3();
let baselineQuaternion = new THREE.Quaternion();
let controls = [];

boot();

async function boot() {
  populateWeaponSelect();
  buildControls();
  bindEvents();
  resize();

  const boxmanApi = runtime.GameBoxmanRig;
  if (!boxmanApi || !boxmanApi.preload || !boxmanApi.create) {
    setStatus('Boxman rig API is unavailable.');
    return;
  }

  try {
    setStatus('Loading actual Boxman rig...');
    await boxmanApi.preload();
    boxmanController = boxmanApi.create({ weaponId: activeWeaponId });
    boxmanRig = boxmanController && boxmanController.rig ? boxmanController.rig : null;
    if (!boxmanController || !boxmanController.root || !boxmanRig || !boxmanRig.weaponModel) {
      setStatus('Could not create actual Boxman rig.');
      return;
    }

    sceneRoot.add(boxmanController.root);
    setWeapon(activeWeaponId);
    fitView();
    requestAnimationFrame(render);
  } catch (err) {
    setStatus(`Boxman load failed: ${err && err.message ? err.message : err}`);
  }
}

function populateWeaponSelect() {
  weaponSelect.innerHTML = '';
  for (const weaponId of WEAPON_IDS) {
    const option = document.createElement('option');
    option.value = weaponId;
    option.textContent = WEAPON_LABELS[weaponId] || weaponId;
    weaponSelect.appendChild(option);
  }
  weaponSelect.value = activeWeaponId;
}

function bindEvents() {
  window.addEventListener('resize', resize);
  weaponSelect.addEventListener('change', () => setWeapon(weaponSelect.value));
  fitViewButton.addEventListener('click', fitView);
  saveButton.addEventListener('click', saveOffsets);
  copyButton.addEventListener('click', copyOutput);
  resetButton.addEventListener('click', resetActiveOffset);
}

function buildControls() {
  controls = [];
  transformControlsEl.innerHTML = '';

  addControl({
    label: 'Scale',
    min: 0.35,
    max: 2.5,
    step: 0.01,
    digits: 2,
    get: () => activeOffset().scale,
    set: (value) => {
      activeOffset().scale = Math.max(0.01, Number(value || 1));
    }
  });

  addVecControls('Move', ['X', 'Y', 'Z'], {
    min: -0.75,
    max: 0.75,
    step: 0.005,
    digits: 3,
    get: () => activeOffset().translation,
    set: (index, value) => {
      activeOffset().translation[index] = Number(value || 0);
    }
  });

  addVecControls('Rotate', ['X', 'Y', 'Z'], {
    min: -180,
    max: 180,
    step: 1,
    digits: 0,
    get: () => activeOffset().rotationDeg,
    set: (index, value) => {
      activeOffset().rotationDeg[index] = Number(value || 0);
    }
  });
}

function addVecControls(prefix, labels, config) {
  for (let i = 0; i < 3; i++) {
    addControl({
      label: `${prefix} ${labels[i]}`,
      min: config.min,
      max: config.max,
      step: config.step,
      digits: config.digits,
      get: () => config.get()[i],
      set: (value) => config.set(i, value)
    });
  }
}

function addControl(config) {
  const row = document.createElement('label');
  row.className = 'control-row';

  const label = document.createElement('span');
  label.textContent = config.label;

  const range = document.createElement('input');
  range.type = 'range';
  range.min = String(config.min);
  range.max = String(config.max);
  range.step = String(config.step);

  const number = document.createElement('input');
  number.type = 'number';
  number.min = String(config.min);
  number.max = String(config.max);
  number.step = String(config.step);

  const sync = () => {
    const value = Number(config.get());
    const safe = Number.isFinite(value) ? value : 0;
    range.value = String(Math.max(config.min, Math.min(config.max, safe)));
    number.value = safe.toFixed(config.digits);
  };

  const apply = (rawValue) => {
    const next = Number(rawValue);
    if (!Number.isFinite(next)) return;
    config.set(next);
    normalizeActiveOffset();
    applyOffset();
    syncControls();
  };

  range.addEventListener('input', () => apply(range.value));
  number.addEventListener('change', () => apply(number.value));

  row.append(label, range, number);
  transformControlsEl.appendChild(row);
  controls.push(sync);
}

function setWeapon(weaponId) {
  activeWeaponId = WEAPON_IDS.includes(weaponId) ? weaponId : 'pistol';
  weaponSelect.value = activeWeaponId;
  ensureOffset(activeWeaponId);

  if (boxmanController && boxmanRig) {
    boxmanController.setWeapon(activeWeaponId);
    settleRuntimePose();
    captureBaseline();
    applyOffset();
  } else {
    syncControls();
    updateOutput();
  }
  setStatus(`Showing ${WEAPON_LABELS[activeWeaponId]} on actual Boxman.`);
}

function settleRuntimePose() {
  if (!boxmanController || !boxmanController.updateAnimation) return;
  const runtimeIdleAimState = {
    speedNorm: 0,
    sprinting: false,
    fastBackpedal: false,
    airborne: false,
    footY: null,
    aimPitch: 0,
    horizontalSpeed: 0,
    worldSpeed: 0,
    yaw: 0,
    turnRate: 0,
    movingForward: false,
    movingBackward: false,
    movingLeft: false,
    movingRight: false
  };
  for (let i = 0; i < 40; i++) {
    boxmanController.updateAnimation(1 / 60, runtimeIdleAimState);
  }
}

function captureBaseline() {
  if (!boxmanRig || !boxmanRig.weaponModel) return;
  baselinePosition.copy(boxmanRig.weaponModel.position);
  baselineQuaternion.copy(boxmanRig.weaponModel.quaternion);
}

function applyOffset() {
  if (!boxmanRig || !boxmanRig.weaponModel) {
    updateOutput();
    return;
  }

  const offset = activeOffset();
  const weaponModel = boxmanRig.weaponModel;
  const rotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(
    degToRad(offset.rotationDeg[0]),
    degToRad(offset.rotationDeg[1]),
    degToRad(offset.rotationDeg[2])
  ));

  weaponModel.position.copy(baselinePosition).add(new THREE.Vector3(
    Number(offset.translation[0] || 0),
    Number(offset.translation[1] || 0),
    Number(offset.translation[2] || 0)
  ));
  weaponModel.quaternion.copy(baselineQuaternion).multiply(rotation);
  weaponModel.scale.setScalar(Math.max(0.01, Number(offset.scale || 1)));
  weaponModel.updateMatrixWorld(true);

  syncControls();
  updateOutput();
}

function activeOffset() {
  return ensureOffset(activeWeaponId);
}

function ensureOffset(weaponId) {
  if (!offsets[weaponId]) {
    offsets[weaponId] = cloneOffset(DEFAULT_OFFSET);
  }
  offsets[weaponId] = normalizeOffset(offsets[weaponId]);
  return offsets[weaponId];
}

function normalizeActiveOffset() {
  offsets[activeWeaponId] = normalizeOffset(offsets[activeWeaponId]);
}

function normalizeOffset(value) {
  const source = value || {};
  return {
    translation: normalizeVec3(source.translation, DEFAULT_OFFSET.translation, 4),
    rotationDeg: normalizeVec3(source.rotationDeg, DEFAULT_OFFSET.rotationDeg, 2),
    scale: roundNumber(Math.max(0.01, Number(source.scale || DEFAULT_OFFSET.scale)), 4)
  };
}

function cloneOffset(value) {
  return {
    translation: value.translation.slice(),
    rotationDeg: value.rotationDeg.slice(),
    scale: value.scale
  };
}

function normalizeVec3(value, fallback, digits) {
  const source = Array.isArray(value) ? value : fallback;
  return [
    roundNumber(Number(source[0] || 0), digits),
    roundNumber(Number(source[1] || 0), digits),
    roundNumber(Number(source[2] || 0), digits)
  ];
}

function roundNumber(value, digits) {
  const scale = Math.pow(10, digits);
  return Math.round(Number(value || 0) * scale) / scale;
}

function syncControls() {
  for (const sync of controls) sync();
}

function updateOutput() {
  const offset = activeOffset();
  outputText.value = [
    `// ${WEAPON_LABELS[activeWeaponId]} offset, applied on top of the current in-game Boxman weaponModel mount.`,
    `${activeWeaponId}: {`,
    `  translation: [${formatList(offset.translation, 4)}],`,
    `  rotationDeg: [${formatList(offset.rotationDeg, 2)}],`,
    `  scale: ${formatNumber(offset.scale, 4)}`,
    `}`
  ].join('\n');
}

function formatList(values, digits) {
  return values.map((value) => formatNumber(value, digits)).join(', ');
}

function formatNumber(value, digits) {
  const rounded = roundNumber(value, digits);
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
}

function saveOffsets() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ activeWeaponId, offsets }, null, 2));
    setStatus(`Saved ${WEAPON_LABELS[activeWeaponId]} offset locally.`);
  } catch (err) {
    setStatus(`Save failed: ${err && err.message ? err.message : err}`);
  }
}

async function copyOutput() {
  try {
    await navigator.clipboard.writeText(outputText.value);
    setStatus(`Copied ${WEAPON_LABELS[activeWeaponId]} offset.`);
  } catch (err) {
    outputText.select();
    setStatus('Clipboard blocked; output selected.');
  }
}

function resetActiveOffset() {
  offsets[activeWeaponId] = cloneOffset(DEFAULT_OFFSET);
  applyOffset();
  setStatus(`Reset ${WEAPON_LABELS[activeWeaponId]} offset.`);
}

function loadOffsets() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    if (stored && WEAPON_IDS.includes(stored.activeWeaponId)) {
      activeWeaponId = stored.activeWeaponId;
    }
    const loaded = stored && stored.offsets && typeof stored.offsets === 'object' ? stored.offsets : {};
    const normalized = {};
    for (const weaponId of WEAPON_IDS) {
      normalized[weaponId] = normalizeOffset(loaded[weaponId] || DEFAULT_OFFSET);
    }
    return normalized;
  } catch (err) {
    const normalized = {};
    for (const weaponId of WEAPON_IDS) normalized[weaponId] = cloneOffset(DEFAULT_OFFSET);
    return normalized;
  }
}

function fitView() {
  if (boxmanController && boxmanController.root) {
    const bounds = new THREE.Box3().setFromObject(boxmanController.root);
    const center = new THREE.Vector3();
    const size = new THREE.Vector3();
    bounds.getCenter(center);
    bounds.getSize(size);
    const distance = Math.max(2.2, size.length() * 1.28);
    orbit.target.copy(center).add(new THREE.Vector3(0, 0.35, 0));
    camera.position.copy(orbit.target).add(new THREE.Vector3(distance, distance * 0.34, distance * 0.58));
  } else {
    orbit.target.set(0, 0.85, 0);
    camera.position.set(5.2, 1.8, 3.2);
  }
  orbit.update();
  setStatus(`Showing ${WEAPON_LABELS[activeWeaponId]} on actual Boxman.`);
}

function resize() {
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(1, Math.floor(rect.width));
  const height = Math.max(1, Math.floor(rect.height));
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

function render() {
  orbit.update();
  renderer.render(scene, camera);
  requestAnimationFrame(render);
}

function setStatus(message) {
  statusEl.textContent = String(message || '');
}

function degToRad(value) {
  return Number(value || 0) * Math.PI / 180;
}
