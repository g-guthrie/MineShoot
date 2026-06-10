import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  timeout: 120000,
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:3000',
    viewport: { width: 1280, height: 720 },
    launchOptions: {
      // Multi-client tests need every page ticking at full rate; Chrome
      // otherwise throttles timers/rAF in occluded headless pages.
      args: [
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding'
      ]
    }
  },
  webServer: [
    {
      command: 'npx wrangler dev --config wrangler.worker.toml --port 8787',
      url: 'http://127.0.0.1:8787/api/health',
      reuseExistingServer: true,
      timeout: 60000
    },
    {
      command: 'npm run preview',
      url: 'http://127.0.0.1:3000',
      reuseExistingServer: true,
      timeout: 60000
    }
  ]
});
