/**
 * Three.js scene setup: renderer, camera, horror-mood lighting and fog.
 * Light levels follow the reference build's raised-visibility tuning.
 */
import * as THREE from 'three';

export interface GameScene {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
}

export function createScene(canvas: HTMLCanvasElement): GameScene {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x12080a);
  scene.fog = new THREE.Fog(0x12080a, 30, 95);

  const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 300);
  camera.rotation.order = 'YXZ';

  const ambient = new THREE.AmbientLight(0xffd6d6, 0.85);
  scene.add(ambient);

  const dir = new THREE.DirectionalLight(0xfff0e0, 1.6);
  dir.position.set(30, 60, 20);
  scene.add(dir);

  const hemi = new THREE.HemisphereLight(0x886666, 0x221111, 0.5);
  scene.add(hemi);

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  return { renderer, scene, camera };
}
