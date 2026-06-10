/**
 * gun-models.js - Loads the textured low-poly weapon GLBs and normalizes
 * them into a predictable frame: barrel down -Z, centered on x/y, scaled to
 * a requested length, with the origin placed a configurable fraction along
 * the gun (so first-person and avatar mounts can each pick a grip point).
 *
 * The source models are skinned (bone-posed) and ship without materials, so
 * each is baked once into static geometry with its palette texture applied;
 * instances are then cheap clones of the baked mesh group.
 */
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const THREE = globalThis.THREE;

// rotationDeg orients each baked model so its muzzle faces -Z.
const MODELS = {
  machinegun: {
    model: '/assets/weapons/low-poly-fps/models/ak-47.glb',
    texture: '/assets/weapons/low-poly-fps/textures/ak-47.png',
    rotationDeg: [0, 180, 0]
  },
  shotgun: {
    model: '/assets/weapons/low-poly-fps/models/shotgun.glb',
    texture: '/assets/weapons/low-poly-fps/textures/shotgun.png',
    rotationDeg: [0, 180, 0]
  },
  sniper: {
    model: '/assets/weapons/low-poly-fps/models/m24.glb',
    texture: '/assets/weapons/low-poly-fps/textures/m24.png',
    rotationDeg: [0, 180, 0]
  },
  pistol: {
    model: '/assets/weapons/low-poly-fps/models/m1911.glb',
    texture: '/assets/weapons/low-poly-fps/textures/m1911.png',
    rotationDeg: [0, 180, 0]
  }
};

const loader = new GLTFLoader();
const textureLoader = new THREE.TextureLoader();
const bakedCache = new Map();

function loadTexture(url) {
  const texture = textureLoader.load(url);
  texture.flipY = false; // GLTF UV convention
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  return texture;
}

/** Bakes a (possibly skinned) gltf scene into a flat group of static meshes. */
function bakeToStatic(root, material) {
  root.updateMatrixWorld(true);
  const group = new THREE.Group();
  const vertex = new THREE.Vector3();
  root.traverse((node) => {
    if (!node.isMesh) return;
    const geometry = node.geometry.clone();
    if (node.isSkinnedMesh) {
      const position = geometry.attributes.position;
      for (let i = 0; i < position.count; i++) {
        vertex.fromBufferAttribute(position, i);
        node.applyBoneTransform(i, vertex);
        position.setXYZ(i, vertex.x, vertex.y, vertex.z);
      }
      geometry.deleteAttribute('skinIndex');
      geometry.deleteAttribute('skinWeight');
      geometry.computeVertexNormals();
      geometry.computeBoundingBox();
      geometry.computeBoundingSphere();
    }
    const mesh = new THREE.Mesh(geometry, material);
    mesh.applyMatrix4(node.matrixWorld);
    mesh.castShadow = true;
    group.add(mesh);
  });
  return group;
}

function loadBaked(config) {
  if (!bakedCache.has(config.model)) {
    bakedCache.set(config.model, new Promise((resolve, reject) => {
      loader.load(config.model, (gltf) => {
        // The palettes are near-black and gun sides only receive ambient
        // light, so boost exposure (color multiplier > 1) plus a small
        // emissive floor or they render as silhouettes.
        const material = new THREE.MeshLambertMaterial({
          map: loadTexture(config.texture),
          emissive: 0x303030
        });
        material.color.setRGB(1.9, 1.9, 1.9);
        resolve(bakeToStatic(gltf.scene, material));
      }, undefined, reject);
    }));
  }
  return bakedCache.get(config.model);
}

/**
 * @param {string} weaponId
 * @param {number} targetLength  desired barrel length in world units
 * @param {number} originRatio   fraction of the length in front of the
 *                               origin (1 = rear at origin, 0.75 = grip-ish)
 * @returns {Promise<THREE.Group>}
 */
export function createGunModel(weaponId, targetLength, originRatio = 1) {
  const config = MODELS[weaponId] || MODELS.machinegun;
  return loadBaked(config).then((baked) => {
    const inner = new THREE.Group();
    inner.add(baked.clone(true));
    inner.rotation.set(
      config.rotationDeg[0] * Math.PI / 180,
      config.rotationDeg[1] * Math.PI / 180,
      config.rotationDeg[2] * Math.PI / 180
    );
    const wrap = new THREE.Group();
    wrap.add(inner);
    wrap.updateMatrixWorld(true);

    const box = new THREE.Box3().setFromObject(wrap);
    const sizeZ = Math.max(0.001, box.max.z - box.min.z);
    const scale = targetLength / sizeZ;
    wrap.scale.setScalar(scale);
    inner.position.x -= (box.min.x + box.max.x) / 2;
    inner.position.y -= (box.min.y + box.max.y) / 2;
    inner.position.z -= box.max.z - sizeZ * (1 - originRatio);
    return wrap;
  });
}

export function hasGunModel(weaponId) {
  return !!MODELS[weaponId];
}
