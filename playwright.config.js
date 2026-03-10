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
      command: 'npm run dev:e2e:worker',
      port: 8791,
      reuseExistingServer: false,
      timeout: 120_000
    },
    {
      command: 'npm run dev:frontend:test',
      port: 4173,
      reuseExistingServer: false,
      timeout: 120_000
    }
  ]
});
