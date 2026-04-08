import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './scripts',
  testMatch: /.*\.spec\.ts/,
  timeout: 60_000,
  reporter: [['list']],
  fullyParallel: false,
  workers: 1,
  use: {
    headless: true,
    launchOptions: {
      executablePath: '/usr/bin/chromium',
      args: ['--disable-dev-shm-usage', '--no-sandbox', '--disable-gpu'],
    },
    viewport: { width: 1440, height: 2200 },
  },
});
