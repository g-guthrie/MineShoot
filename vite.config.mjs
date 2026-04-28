import { defineConfig } from 'vite';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const workerProxyPort = Number(process.env.WORKER_PROXY_PORT || 8787);
const publicCopyRoots = [
  'assets',
  'images/menu_backdrop_6036.jpg',
  'images/pvp-share-wide.jpg',
  'images/pvp-share.jpg'
];

async function copyPublicFile(src, dest) {
  const buffer = await readFile(src);
  await mkdir(path.dirname(dest), { recursive: true });
  await writeFile(dest, buffer);
}

async function copyPublicEntry(srcRoot, destRoot, relativePath) {
  const src = path.join(srcRoot, relativePath);
  const dest = path.join(destRoot, relativePath);
  const entries = await readdir(src, { withFileTypes: true }).catch((err) => {
    if (err && err.code === 'ENOTDIR') return null;
    throw err;
  });
  if (!entries) {
    await copyPublicFile(src, dest);
    return;
  }
  await mkdir(dest, { recursive: true });
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    if (entry.isDirectory()) {
      await copyPublicEntry(srcRoot, destRoot, path.join(relativePath, entry.name));
    } else if (entry.isFile()) {
      await copyPublicFile(path.join(src, entry.name), path.join(dest, entry.name));
    }
  }
}

function copyRuntimePublicAssets() {
  return {
    name: 'copy-runtime-public-assets',
    apply: 'build',
    closeBundle() {
      const srcRoot = path.resolve('public');
      const destRoot = path.resolve('dist');
      return Promise.all(publicCopyRoots.map((entry) => copyPublicEntry(srcRoot, destRoot, entry)));
    }
  };
}

export default defineConfig({
  root: '.',
  publicDir: 'public',
  plugins: [copyRuntimePublicAssets()],
  server: {
    port: 3000,
    open: process.env.VITE_AUTO_OPEN === '1',
    proxy: {
      '/api': {
        target: `http://127.0.0.1:${workerProxyPort}`,
        changeOrigin: true,
        ws: true
      }
    }
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    copyPublicDir: false,
    rollupOptions: {
      input: 'index.html',
      output: {
        manualChunks(id) {
          const path = String(id || '');
          if (path.includes('/node_modules/three/')) return 'vendor-three';
          if (path.includes('/js/world/') || path.includes('/shared/world-layout') || path.includes('/shared/terrain-sampler')) return 'gameplay-world';
          if (path.includes('/js/net/')) return 'gameplay-network';
          if (
            path.includes('/js/actors/player.js') ||
            path.includes('/js/combat/player-combat.js') ||
            path.includes('/js/combat/throwables-projectile-runtime.js') ||
            path.includes('/js/combat/throwables-trajectory.js') ||
            path.includes('/js/combat/throwables-fire-zones.js') ||
            path.includes('/js/combat/throwables.js') ||
            path.includes('/js/combat/hitscan.js') ||
            path.includes('/js/domain/weapons/')
          ) return 'gameplay-combat';
          if (
            path.includes('/js/presentation/audio.js') ||
            path.includes('/js/presentation/ui.js') ||
            path.includes('/js/presentation/overhead.js') ||
            path.includes('/js/actors/avatar-rig.js') ||
            path.includes('/js/presentation/actor-visual-factory.js') ||
            path.includes('/js/presentation/spread-reticle.js') ||
            path.includes('/js/actors/enemy.js') ||
            path.includes('/js/actors/hitbox-factory.js')
          ) return 'gameplay-render';
          if (
            path.includes('/js/core/bootstrap.js') ||
            path.includes('/js/core/event-bus.js') ||
            path.includes('/js/core/mode-flow.js') ||
            path.includes('/js/core/loop.js') ||
            path.includes('/js/core/awareness.js') ||
            path.includes('/js/core/local-match.js') ||
            path.includes('/shared/damage.js') ||
            path.includes('/shared/seek-core.js') ||
            path.includes('/shared/entity-constants.js') ||
            path.includes('/shared/entity-points.js') ||
            path.includes('/shared/protocol.js') ||
            path.includes('/shared/gameplay-tuning.js')
          ) return 'gameplay-core';
        }
      }
    }
  }
});
