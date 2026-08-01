import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: process.env.CI ? 'github' : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    // channel: 'chromium' erzwingt den vollen Chrome-Build statt des separaten
    // "headless shell"-Downloads (in Sandbox-Umgebungen unzuverlässig/korrupt).
    // --no-sandbox ist in Containern ohne Sandbox-Rechte nötig.
    launchOptions: {
      channel: 'chromium',
      args: ['--no-sandbox', '--disable-dev-shm-usage'],
    },
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 } } },
  ],
  webServer: {
    command: 'npm run serve',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
