/**
 * blocks.js - Placeable/breakable blocks: the Minecraft layer on top of the
 * static arena. Blocks live on a fixed grid, sync through the room server,
 * and join the movement collision set.
 */
import { BLOCKS, blockBox, parseBlockKey, blockKey } from '../shared/combat.js';

const THREE = globalThis.THREE;
const SIZE = BLOCKS.size;

const HP_COLORS = {
  3: 0x9b7653, // fresh dirt
  2: 0x82603f,
  1: 0x66482c  // about to crumble
};

export function createBlocks(scene) {
  const group = new THREE.Group();
  group.name = 'placed-blocks';
  scene.add(group);

  const geometry = new THREE.BoxGeometry(SIZE, SIZE, SIZE);
  const edgeGeometry = new THREE.EdgesGeometry(geometry);
  const edgeMaterial = new THREE.LineBasicMaterial({ color: 0x3c2c1a, transparent: true, opacity: 0.55 });
  const materials = {};
  for (const hp of Object.keys(HP_COLORS)) {
    materials[hp] = new THREE.MeshLambertMaterial({ color: HP_COLORS[hp] });
  }

  const blocks = new Map(); // key -> { mesh, hp, box }
  let cachedBoxes = [];
  let boxesDirty = true;

  const debris = [];

  function rebuildBoxes() {
    cachedBoxes = [];
    for (const key of blocks.keys()) {
      const { ix, iy, iz } = parseBlockKey(key);
      cachedBoxes.push(blockBox(ix, iy, iz));
    }
    boxesDirty = false;
  }

  function spawnDebris(x, y, z) {
    const pieces = new THREE.Group();
    for (let i = 0; i < 6; i++) {
      const piece = new THREE.Mesh(
        new THREE.BoxGeometry(SIZE * 0.22, SIZE * 0.22, SIZE * 0.22),
        materials[1].clone()
      );
      piece.position.set(
        x + (Math.random() - 0.5) * SIZE * 0.6,
        y + (Math.random() - 0.5) * SIZE * 0.6,
        z + (Math.random() - 0.5) * SIZE * 0.6
      );
      piece.userData.velocity = new THREE.Vector3(
        (Math.random() - 0.5) * 4,
        2 + Math.random() * 3,
        (Math.random() - 0.5) * 4
      );
      pieces.add(piece);
    }
    pieces.userData.age = 0;
    scene.add(pieces);
    debris.push(pieces);
  }

  return {
    keyAt(x, y, z) {
      return blockKey(Math.floor(x / SIZE), Math.floor(y / SIZE), Math.floor(z / SIZE));
    },

    has(key) {
      return blocks.has(key);
    },

    addBlock(key, options = {}) {
      if (blocks.has(key)) return;
      const { ix, iy, iz } = parseBlockKey(key);
      const hp = Math.max(1, Math.min(BLOCKS.hp, Number(options.hp) || BLOCKS.hp));
      const mesh = new THREE.Mesh(geometry, materials[hp]);
      mesh.position.set((ix + 0.5) * SIZE, (iy + 0.5) * SIZE, (iz + 0.5) * SIZE);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.add(new THREE.LineSegments(edgeGeometry, edgeMaterial));
      group.add(mesh);
      blocks.set(key, { mesh, hp });
      boxesDirty = true;
    },

    removeBlock(key, options = {}) {
      const block = blocks.get(key);
      if (!block) return;
      if (options.fx) {
        spawnDebris(block.mesh.position.x, block.mesh.position.y, block.mesh.position.z);
      }
      group.remove(block.mesh);
      blocks.delete(key);
      boxesDirty = true;
    },

    damageBlock(key, hp) {
      const block = blocks.get(key);
      if (!block) return;
      block.hp = hp;
      block.mesh.material = materials[Math.max(1, Math.min(BLOCKS.hp, hp))];
    },

    reset() {
      for (const key of Array.from(blocks.keys())) {
        this.removeBlock(key);
      }
    },

    collisionBoxes() {
      if (boxesDirty) rebuildBoxes();
      return cachedBoxes;
    },

    /**
     * Walks the placement ray through the grid (DDA) and returns the first
     * occupied cell, with the cell in front of the entry face.
     */
    raycast(origin, dir, maxDist) {
      let ix = Math.floor(origin.x / SIZE);
      let iy = Math.floor(origin.y / SIZE);
      let iz = Math.floor(origin.z / SIZE);

      const stepX = dir.x > 0 ? 1 : -1;
      const stepY = dir.y > 0 ? 1 : -1;
      const stepZ = dir.z > 0 ? 1 : -1;

      const tDeltaX = dir.x !== 0 ? Math.abs(SIZE / dir.x) : Infinity;
      const tDeltaY = dir.y !== 0 ? Math.abs(SIZE / dir.y) : Infinity;
      const tDeltaZ = dir.z !== 0 ? Math.abs(SIZE / dir.z) : Infinity;

      const nextBound = (value, index, step) =>
        step > 0 ? (index + 1) * SIZE - value : value - index * SIZE;
      let tMaxX = dir.x !== 0 ? nextBound(origin.x, ix, stepX) / Math.abs(dir.x) : Infinity;
      let tMaxY = dir.y !== 0 ? nextBound(origin.y, iy, stepY) / Math.abs(dir.y) : Infinity;
      let tMaxZ = dir.z !== 0 ? nextBound(origin.z, iz, stepZ) / Math.abs(dir.z) : Infinity;

      let t = 0;
      let prev = { ix, iy, iz };
      while (t <= maxDist) {
        const key = blockKey(ix, iy, iz);
        if (blocks.has(key) && t > 0) {
          return { key, t, prevCell: prev };
        }
        prev = { ix, iy, iz };
        if (tMaxX < tMaxY && tMaxX < tMaxZ) {
          t = tMaxX; tMaxX += tDeltaX; ix += stepX;
        } else if (tMaxY < tMaxZ) {
          t = tMaxY; tMaxY += tDeltaY; iy += stepY;
        } else {
          t = tMaxZ; tMaxZ += tDeltaZ; iz += stepZ;
        }
      }
      return null;
    },

    update(dt) {
      for (let i = debris.length - 1; i >= 0; i--) {
        const pieces = debris[i];
        pieces.userData.age += dt;
        for (const piece of pieces.children) {
          const vel = piece.userData.velocity;
          vel.y -= 12 * dt;
          piece.position.addScaledVector(vel, dt);
          piece.rotation.x += dt * 4;
          piece.rotation.z += dt * 3;
        }
        if (pieces.userData.age > 0.9) {
          scene.remove(pieces);
          for (const piece of pieces.children) {
            piece.geometry.dispose();
            piece.material.dispose();
          }
          debris.splice(i, 1);
        }
      }
    }
  };
}
