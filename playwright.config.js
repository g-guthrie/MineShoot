import { defineConfig } from '@playwright/test';

const frontendPort = Number(process.env.FRONTEND_PORT || process.env.E2E_FRONTEND_PORT || 4173);
const workerPort = Number(process.env.WORKER_PORT || process.env.E2E_WORKER_PORT || 8791);
const reuseExistingServer = /^(1|true|yes)$/i.test(String(process.env.E2E_REUSE_SERVERS || process.env.REUSE_EXISTING_SERVER || ''));
const persistDir = process.env.WRANGLER_PERSIST_DIR || '.wrangler/e2e-state';

export default defineConfig({
  testDir: './e2e',
  timeout: 45_000,
  workers: 1,
  use: {
    baseURL: `http://127.0.0.1:${frontendPort}`,
    launchOptions: {
      args: ['--use-angle=swiftshader', '--use-gl=angle']
    }
  },
  webServer: [
    {
      command: `WORKER_PORT=${workerPort} WRANGLER_PERSIST_DIR=${persistDir} WRANGLER_ENV=e2e REUSE_EXISTING_SERVER=${reuseExistingServer ? '1' : '0'} npm run dev:e2e:worker`,
      url: `http://127.0.0.1:${workerPort}/api/me`,
      reuseExistingServer,
      timeout: 120_000
    },
    {
      command: `FRONTEND_PORT=${frontendPort} WORKER_PROXY_PORT=${workerPort} REUSE_EXISTING_SERVER=${reuseExistingServer ? '1' : '0'} npm run dev:frontend:test`,
      port: frontendPort,
      reuseExistingServer,
      timeout: 120_000
    }
  ]
});
