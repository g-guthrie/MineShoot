import { defineConfig } from 'vite';

const workerProxyPort = Number(process.env.WORKER_PROXY_PORT || 8787);

export default defineConfig({
  root: '.',
  publicDir: 'public',
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
    rollupOptions: {
      input: 'index.html',
      output: {
        manualChunks(id) {
          const path = String(id || '');
          if (path.includes('/node_modules/three/')) return 'vendor-three';
          if (path.includes('/js/world/') || path.includes('/shared/world-layout') || path.includes('/shared/terrain-sampler')) return 'gameplay-world';
          if (path.includes('/js/net/') || path.includes('/js/network.js')) return 'gameplay-network';
          if (
            path.includes('/js/player.js') ||
            path.includes('/js/player-combat.js') ||
            path.includes('/js/abilities.js') ||
            path.includes('/js/throwables.js') ||
            path.includes('/js/hitscan.js') ||
            path.includes('/js/combat-tuning.js') ||
            path.includes('/js/domain/weapons/')
          ) return 'gameplay-combat';
          if (
            path.includes('/js/audio.js') ||
            path.includes('/js/ui.js') ||
            path.includes('/js/overhead.js') ||
            path.includes('/js/avatar-rig.js') ||
            path.includes('/js/actor-visual-factory.js') ||
            path.includes('/js/bloom-reticle.js') ||
            path.includes('/js/enemy.js') ||
            path.includes('/js/hitbox-factory.js')
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
            path.includes('/shared/seek-profiles.js') ||
            path.includes('/shared/entity-constants.js') ||
            path.includes('/shared/entity-points.js') ||
            path.includes('/shared/lms-mode.js') ||
            path.includes('/shared/protocol.js') ||
            path.includes('/shared/gameplay-tuning.js')
          ) return 'gameplay-core';
        }
      }
    }
  }
});
