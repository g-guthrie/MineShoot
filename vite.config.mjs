import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';

const workerProxyPort = Number(process.env.WORKER_PROXY_PORT || 8787);

export default defineConfig({
  root: '.',
  publicDir: 'public',
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(process.cwd(), './src')
    }
  },
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
          const file = String(id || '');
          if (file.includes('/node_modules/three/')) return 'vendor-three';
          if (file.includes('/js/world/') || file.includes('/shared/world-layout') || file.includes('/shared/terrain-sampler')) return 'gameplay-world';
          if (file.includes('/js/net/')) return 'gameplay-network';
          if (
            file.includes('/js/actors/player.js') ||
            file.includes('/js/combat/player-combat.js') ||
            file.includes('/js/combat/abilities.js') ||
            file.includes('/js/combat/throwables.js') ||
            file.includes('/js/combat/hitscan.js') ||
            file.includes('/js/combat/combat-tuning.js') ||
            file.includes('/js/domain/weapons/')
          ) return 'gameplay-combat';
          if (
            file.includes('/js/presentation/audio.js') ||
            file.includes('/js/presentation/ui.js') ||
            file.includes('/js/presentation/overhead.js') ||
            file.includes('/js/actors/avatar-rig.js') ||
            file.includes('/js/presentation/actor-visual-factory.js') ||
            file.includes('/js/presentation/spread-reticle.js') ||
            file.includes('/js/actors/enemy.js') ||
            file.includes('/js/actors/hitbox-factory.js')
          ) return 'gameplay-render';
          if (
            file.includes('/js/core/bootstrap.js') ||
            file.includes('/js/core/event-bus.js') ||
            file.includes('/js/core/mode-flow.js') ||
            file.includes('/js/core/loop.js') ||
            file.includes('/js/core/awareness.js') ||
            file.includes('/js/core/local-match.js') ||
            file.includes('/shared/damage.js') ||
            file.includes('/shared/seek-core.js') ||
            file.includes('/shared/seek-profiles.js') ||
            file.includes('/shared/entity-constants.js') ||
            file.includes('/shared/entity-points.js') ||
            file.includes('/shared/lms-mode.js') ||
            file.includes('/shared/protocol.js') ||
            file.includes('/shared/gameplay-tuning.js')
          ) return 'gameplay-core';
        }
      }
    }
  }
});
