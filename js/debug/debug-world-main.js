/**
 * debug-world-main.js
 * Standalone world viewer with orbit camera.
 * Loads world-building modules and renders the full map.
 */

/* --- World module imports (order matches gameplay-modules.js) --- */
import '../../shared/world-layout.js';
import '../../shared/terrain-sampler.js';
import '../world/material-library.js';
import '../world/quadrant-arctic.js';
import '../world/quadrant-wall-street.js';
import '../world/quadrant-citadel.js';
import '../world/quadrant-desert.js';
import '../world/quadrant-jungle.js';
import '../world/quadrant-nuclear.js';
import '../world/prefab-fuel-spheres.js';
import '../world/prefab-reactor-tank.js';
import '../world/quadrant-nuclear-simpsons.js';
import '../world/quadrant-quarry.js';
import '../world/quadrant-pirate-cove.js';
import '../world/quadrant-volcano.js';
import '../world/quadrant-urban.js';
import '../world/world.js';

import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

import {
    WORLD_SIZE,
    WORLD_CENTER,
    DEFAULT_QUADRANT_MAP,
    DEFAULT_BIOME_CELL_LABELS,
    BIOME_GRID_LINE_X,
    BIOME_GRID_LINE_Z,
    BIOME_GRID_COLS,
    BIOME_GRID_ROWS,
    WORLD_MIN,
    cellBounds
} from '../../shared/world-layout.js';

var runtime = globalThis.__MAYHEM_RUNTIME;
var GameWorld = runtime.GameWorld;

/* ----------------------------------------------------------------
   Renderer, camera, scene
   ---------------------------------------------------------------- */
var renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.shadowMap.enabled = true;
if (THREE.PCFSoftShadowMap !== undefined) {
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
}
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x87ceeb);
document.body.appendChild(renderer.domElement);

var camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 500);
camera.position.set(WORLD_CENTER, WORLD_SIZE * 0.45, WORLD_CENTER + WORLD_SIZE * 0.35);

var scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);

window.addEventListener('resize', function () {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

/* ----------------------------------------------------------------
   Build world
   ---------------------------------------------------------------- */
GameWorld.create(scene, {});

/* ----------------------------------------------------------------
   Orbit controls
   ---------------------------------------------------------------- */
/* Expose for console/eval access */
window.__DEBUG = { camera: camera, scene: scene, renderer: renderer };
var controls = new OrbitControls(camera, renderer.domElement);
window.__DEBUG.controls = controls;
controls.target.set(WORLD_CENTER, 0, WORLD_CENTER);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.maxPolarAngle = Math.PI * 0.48;
controls.update();

/* ----------------------------------------------------------------
   Collision box helpers (created once, toggled)
   ---------------------------------------------------------------- */
var collisionGroup = new THREE.Group();
collisionGroup.visible = false;
scene.add(collisionGroup);

var collidables = GameWorld.getCollidables ? GameWorld.getCollidables() : [];
for (var i = 0; i < collidables.length; i++) {
    var mesh = collidables[i];
    if (mesh && mesh.userData && mesh.userData.collisionBox) {
        var helper = new THREE.Box3Helper(mesh.userData.collisionBox, 0x00ff00);
        collisionGroup.add(helper);
    }
}

/* ----------------------------------------------------------------
   Grid line helpers
   ---------------------------------------------------------------- */
var gridGroup = new THREE.Group();
gridGroup.visible = false;
scene.add(gridGroup);

var gridMat = new THREE.LineBasicMaterial({ color: 0xffff00, transparent: true, opacity: 0.5 });
var gridY = 0.5;

for (var gx = 0; gx < BIOME_GRID_LINE_X.length; gx++) {
    var x = BIOME_GRID_LINE_X[gx];
    var geo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(x, gridY, WORLD_MIN),
        new THREE.Vector3(x, gridY, WORLD_SIZE - WORLD_MIN)
    ]);
    gridGroup.add(new THREE.Line(geo, gridMat));
}
for (var gz = 0; gz < BIOME_GRID_LINE_Z.length; gz++) {
    var z = BIOME_GRID_LINE_Z[gz];
    var geo2 = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(WORLD_MIN, gridY, z),
        new THREE.Vector3(WORLD_SIZE - WORLD_MIN, gridY, z)
    ]);
    gridGroup.add(new THREE.Line(geo2, gridMat));
}

/* ----------------------------------------------------------------
   UI toolbar
   ---------------------------------------------------------------- */
var toolbar = document.getElementById('debug-toolbar');
if (toolbar) {
    /* Biome selector */
    var biomeSelect = document.createElement('select');
    biomeSelect.id = 'biome-select';
    var defaultOpt = document.createElement('option');
    defaultOpt.value = '';
    defaultOpt.textContent = 'Fly to biome...';
    biomeSelect.appendChild(defaultOpt);

    for (var bi = 0; bi < DEFAULT_QUADRANT_MAP.length; bi++) {
        var entry = DEFAULT_QUADRANT_MAP[bi];
        if (!entry) continue;
        var opt = document.createElement('option');
        opt.value = String(bi);
        var row = Math.floor(bi / BIOME_GRID_COLS);
        var col = bi % BIOME_GRID_COLS;
        opt.textContent = (DEFAULT_BIOME_CELL_LABELS[bi] || entry.biome || 'cell-' + bi)
            + ' (' + row + ',' + col + ')';
        biomeSelect.appendChild(opt);
    }

    biomeSelect.addEventListener('change', function () {
        var idx = parseInt(biomeSelect.value, 10);
        if (isNaN(idx)) return;
        var entry = DEFAULT_QUADRANT_MAP[idx];
        if (!entry) return;
        var row = Math.floor(idx / BIOME_GRID_COLS);
        var col = idx % BIOME_GRID_COLS;
        var bounds = cellBounds({ row: row, col: col });
        var cx = (bounds.minX + bounds.maxX) * 0.5;
        var cz = (bounds.minZ + bounds.maxZ) * 0.5;
        var span = Math.max(bounds.maxX - bounds.minX, bounds.maxZ - bounds.minZ);
        controls.target.set(cx, 0, cz);
        camera.position.set(cx + span * 0.3, span * 0.6, cz + span * 0.5);
        controls.update();
    });

    var label = document.createElement('label');
    label.textContent = 'Biome: ';
    label.appendChild(biomeSelect);
    toolbar.appendChild(label);

    /* Toggle helpers */
    function addToggle(name, initialState, callback) {
        var btn = document.createElement('button');
        var state = initialState;
        btn.textContent = name + ': ' + (state ? 'ON' : 'OFF');
        btn.addEventListener('click', function () {
            state = !state;
            btn.textContent = name + ': ' + (state ? 'ON' : 'OFF');
            callback(state);
        });
        toolbar.appendChild(btn);
        return btn;
    }

    addToggle('Wireframe', false, function (on) {
        scene.traverse(function (obj) {
            if (obj.isMesh && obj.material) {
                if (Array.isArray(obj.material)) {
                    obj.material.forEach(function (m) { m.wireframe = on; });
                } else {
                    obj.material.wireframe = on;
                }
            }
        });
    });

    addToggle('Collisions', false, function (on) {
        collisionGroup.visible = on;
    });

    addToggle('Grid', false, function (on) {
        gridGroup.visible = on;
    });

    /* Coordinate readout */
    var coordsDiv = document.createElement('div');
    coordsDiv.id = 'coords-readout';
    toolbar.appendChild(coordsDiv);
}

/* ----------------------------------------------------------------
   Render loop
   ---------------------------------------------------------------- */
var clock = new THREE.Clock();
var coordsEl = document.getElementById('coords-readout');

function animate() {
    requestAnimationFrame(animate);
    var dt = Math.min(clock.getDelta(), 0.1);
    controls.update();
    if (GameWorld.update) GameWorld.update(dt);
    renderer.render(scene, camera);

    if (coordsEl) {
        var p = camera.position;
        coordsEl.textContent = 'x:' + p.x.toFixed(1) + ' y:' + p.y.toFixed(1) + ' z:' + p.z.toFixed(1);
    }
}

animate();
