import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..');

export default defineConfig({
  root: repoRoot,
  publicDir: resolve(repoRoot, 'public'),
  build: {
    rollupOptions: {
      input: {
        v2: resolve(repoRoot, 'v2/index.html')
      }
    }
  }
});

