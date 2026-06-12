/**
 * Builds the voxel world mesh from terrain.json: a runtime texture atlas of
 * the block textures plus one merged BufferGeometry with per-face culling.
 */
import * as THREE from 'three';
import type { MapData } from '../../../sim/map';

const ATLAS_TILE = 64;

interface Atlas {
  texture: THREE.Texture;
  /** block type id -> [u0, v0] tile origin in atlas UV space */
  uv: Map<number, [number, number]>;
  tileUvSize: number;
}

async function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

async function buildAtlas(data: MapData): Promise<Atlas> {
  const types = data.blockTypes;
  const grid = Math.ceil(Math.sqrt(types.length));
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = grid * ATLAS_TILE;
  const ctx = canvas.getContext('2d')!;

  const images = await Promise.all(
    types.map(async t => {
      // Multi-face block textures are folders; use the top face for all faces.
      const base = `/${t.textureUri.replace(/\.png$/, '')}`;
      return (
        (await loadImage(`${base}.png`)) ??
        (await loadImage(`${base}/+y.png`)) ??
        (await loadImage(`${base}/+x.png`))
      );
    }),
  );

  const uv = new Map<number, [number, number]>();
  types.forEach((type, i) => {
    const gx = i % grid;
    const gy = Math.floor(i / grid);
    const img = images[i];
    if (img) {
      ctx.drawImage(img, gx * ATLAS_TILE, gy * ATLAS_TILE, ATLAS_TILE, ATLAS_TILE);
    } else {
      ctx.fillStyle = '#aa00aa';
      ctx.fillRect(gx * ATLAS_TILE, gy * ATLAS_TILE, ATLAS_TILE, ATLAS_TILE);
    }
    // UV origin: atlas canvas y is down, UV v is up.
    uv.set(type.id, [gx / grid, 1 - (gy + 1) / grid]);
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.colorSpace = THREE.SRGBColorSpace;

  return { texture, uv, tileUvSize: 1 / grid };
}

// face: [normal, 4 corner offsets (CCW from outside)]
const FACES: Array<{ n: [number, number, number]; c: [number, number, number][] }> = [
  { n: [1, 0, 0], c: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]] },
  { n: [-1, 0, 0], c: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]] },
  { n: [0, 1, 0], c: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]] },
  { n: [0, -1, 0], c: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]] },
  { n: [0, 0, 1], c: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]] },
  { n: [0, 0, -1], c: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]] },
];

export async function buildTerrainMesh(data: MapData): Promise<THREE.Mesh> {
  const atlas = await buildAtlas(data);

  const solid = new Map<string, number>();
  for (const [key, id] of Object.entries(data.blocks)) solid.set(key, id);

  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (const [key, typeId] of solid) {
    const [x, y, z] = key.split(',').map(Number) as [number, number, number];
    const tile = atlas.uv.get(typeId) ?? [0, 0];

    for (const face of FACES) {
      const nx = x + face.n[0];
      const ny = y + face.n[1];
      const nz = z + face.n[2];
      if (solid.has(`${nx},${ny},${nz}`)) continue; // interior face

      const base = positions.length / 3;
      for (let i = 0; i < 4; i++) {
        const corner = face.c[i]!;
        positions.push(x + corner[0], y + corner[1], z + corner[2]);
        normals.push(face.n[0], face.n[1], face.n[2]);
      }
      const s = atlas.tileUvSize;
      // Inset UVs slightly to avoid atlas bleeding.
      const e = s * 0.02;
      uvs.push(
        tile[0] + e, tile[1] + e,
        tile[0] + s - e, tile[1] + e,
        tile[0] + s - e, tile[1] + s - e,
        tile[0] + e, tile[1] + s - e,
      );
      indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);

  const material = new THREE.MeshLambertMaterial({ map: atlas.texture });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false; // one world-sized mesh; always visible anyway
  return mesh;
}
