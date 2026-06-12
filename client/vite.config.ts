import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));
const assetsDir = fileURLToPath(new URL('../assets', import.meta.url));

export default defineConfig({
  root,
  // Game assets (terrain, textures, icons, audio) live at the repo root and
  // are copied verbatim into dist so the Worker serves them statically.
  publicDir: assetsDir,
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,
  },
  server: {
    port: 5173,
    proxy: {
      // During development the client runs on Vite while the Worker +
      // Durable Object run on wrangler dev.
      '/api': {
        target: 'http://localhost:8787',
        ws: true,
      },
    },
  },
});
