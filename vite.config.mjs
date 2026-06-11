import { defineConfig } from 'vite';

const apiProxy = {
  '/api': {
    target: 'http://127.0.0.1:8787',
    changeOrigin: true,
    ws: true
  }
};

export default defineConfig({
  server: { proxy: apiProxy },
  preview: { proxy: apiProxy },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1600
  }
});
