const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './e2e',
  timeout: 45_000,
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:4173'
  },
  webServer: [
    {
      command: 'WORKER_PORT=8791 WRANGLER_PERSIST_DIR=.wrangler/e2e-state npm run dev:e2e:worker',
      url: 'http://127.0.0.1:8791/api/me',
      reuseExistingServer: false,
      timeout: 120_000
    },
    {
      command: 'FRONTEND_PORT=4173 WORKER_PROXY_PORT=8791 npm run dev:frontend:test',
      port: 4173,
      reuseExistingServer: false,
      timeout: 120_000
    }
  ]
});
