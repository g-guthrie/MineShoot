import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { PLAYER, WEAPONS } from '../shared/constants.js';

function makeFallbackActor(color = 0x7ad7ff) {
  const group = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.38, 1.05, 4, 8),
    new THREE.MeshStandardMaterial({ color, roughness: 0.55 })
  );
  body.position.y = 0.8;
  const head = new THREE.Mesh(
    new THREE.BoxGeometry(0.48, 0.36, 0.42),
    new THREE.MeshStandardMaterial({ color: 0xf2d6b3, roughness: 0.7 })
  );
  head.position.y = 1.58;
  const weapon = new THREE.Mesh(
    new THREE.BoxGeometry(0.12, 0.12, 0.8),
    new THREE.MeshStandardMaterial({ color: 0x20242a, roughness: 0.45 })
  );
  weapon.position.set(0.34, 1.2, -0.34);
  group.add(body, head, weapon);
  return group;
}

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xa9c4df);
    this.scene.fog = new THREE.Fog(0xa9c4df, 50, 130);
    this.camera = new THREE.PerspectiveCamera(74, 1, 0.05, 260);
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.entities = new Map();
    this.loader = new GLTFLoader();
    this.actorTemplate = null;
    this.weaponView = null;
    this.clock = new THREE.Clock();
    this.resize();
    this.buildScene();
    this.loadAssets();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const width = Math.max(1, window.innerWidth);
    const height = Math.max(1, window.innerHeight);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  buildScene() {
    const hemi = new THREE.HemisphereLight(0xffffff, 0x46566b, 1.8);
    this.scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xffffff, 2.6);
    sun.position.set(-20, 40, 18);
    this.scene.add(sun);
    this.scene.add(this.camera);

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(120, 120),
      new THREE.MeshStandardMaterial({ color: 0x63766a, roughness: 0.9 })
    );
    ground.rotation.x = -Math.PI / 2;
    this.scene.add(ground);

    const grid = new THREE.GridHelper(96, 32, 0x2c3840, 0x4a5a60);
    grid.position.y = 0.01;
    this.scene.add(grid);

    this.weaponView = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, 0.12, 0.85),
      new THREE.MeshStandardMaterial({ color: 0x1f2329, roughness: 0.45 })
    );
    this.weaponView.position.set(0.32, -0.22, -0.7);
    this.camera.add(this.weaponView);
  }

  loadAssets() {
    this.loader.load('/assets/models/boxman.glb', (gltf) => {
      this.actorTemplate = gltf.scene;
      this.actorTemplate.scale.setScalar(0.9);
    }, undefined, () => {});
    this.loader.load(WEAPONS.rifle.model, (gltf) => {
      if (this.weaponView) this.camera.remove(this.weaponView);
      this.weaponView = gltf.scene;
      this.weaponView.scale.setScalar(0.72);
      this.weaponView.position.set(0.34, -0.34, -0.72);
      this.weaponView.rotation.set(0.05, Math.PI, 0);
      this.camera.add(this.weaponView);
    }, undefined, () => {
      // The constructor already installed a deterministic fallback viewmodel.
    });
  }

  buildWorld(world) {
    if (!world || !Array.isArray(world.obstacles)) return;
    for (const box of world.obstacles) {
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(box.w, box.h, box.d),
        new THREE.MeshStandardMaterial({ color: 0x596977, roughness: 0.8 })
      );
      mesh.position.set(box.x, box.h * 0.5, box.z);
      this.scene.add(mesh);
    }
  }

  ensureEntity(entity) {
    let record = this.entities.get(entity.id);
    if (record) return record;
    const model = this.actorTemplate ? this.actorTemplate.clone(true) : makeFallbackActor(entity.kind === 'bot' ? 0xff8f70 : 0x7ad7ff);
    this.scene.add(model);
    record = {
      id: entity.id,
      model,
      target: new THREE.Vector3(entity.x, entity.y - PLAYER.eyeHeight, entity.z)
    };
    this.entities.set(entity.id, record);
    return record;
  }

  applySnapshot(snapshot, selfId) {
    if (!snapshot || !Array.isArray(snapshot.entities)) return;
    const aliveIds = new Set();
    for (const entity of snapshot.entities) {
      aliveIds.add(entity.id);
      if (entity.id === selfId) continue;
      const record = this.ensureEntity(entity);
      record.target.set(entity.x, entity.alive ? 0 : -1.2, entity.z);
      record.model.visible = true;
      record.model.rotation.y = entity.yaw;
      record.model.traverse((child) => {
        if (child.material && child.material.color && entity.kind === 'bot') {
          child.material = child.material.clone();
          child.material.color.lerp(new THREE.Color(0xff6f4a), 0.35);
        }
      });
    }
    for (const [id, record] of this.entities.entries()) {
      if (!aliveIds.has(id)) {
        this.scene.remove(record.model);
        this.entities.delete(id);
      }
    }
  }

  updateCamera(player) {
    if (!player) return;
    this.camera.position.set(player.x, player.y, player.z);
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = player.yaw;
    this.camera.rotation.x = -player.pitch;
  }

  update(dtSec, predictedSelf) {
    this.updateCamera(predictedSelf);
    const alpha = Math.min(1, dtSec * 14);
    for (const record of this.entities.values()) {
      record.model.position.lerp(record.target, alpha);
    }
    this.renderer.render(this.scene, this.camera);
  }
}
