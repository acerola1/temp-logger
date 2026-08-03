import { defineConfig, devices } from '@playwright/test'

const baseURL = 'http://127.0.0.1:4173'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  // Az emulator adatbázis közös; a CRUD tesztek nem izoláltak egymástól.
  workers: 1,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  expect: {
    toHaveScreenshot: {
      // A fejlesztői gép és a GitHub runner Chromiumja máshogy simítja az
      // ékezetes betűk éleit: a CI-ben eddig 20-90 szórt pixel bukott el
      // változatlan elrendezés mellett. Ez a küszöb elnyeli a betűzaj-eltérést,
      // de a valódi elrendezés- vagy szövegváltozás (ezres pixelszám) továbbra
      // is elhasal rajta.
      maxDiffPixels: 400,
    },
  },
  use: {
    baseURL,
    timezoneId: 'Europe/Budapest',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run dev:e2e',
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    {
      name: 'chromium',
      testIgnore: /zz-vine-mutation\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'chromium-mutation',
      testMatch: /zz-vine-mutation\.spec\.ts/,
      dependencies: ['chromium'],
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
