import { existsSync } from 'node:fs'
import { defineConfig } from '@playwright/test'
import { E2E_DATABASE_URL, E2E_PORT } from './tests/e2e/env'

/*
 * End-to-end flows run against a production build of Folio, backed by the folio_test
 * database (migrated and re-seeded with the demo homeschool before every run).
 *
 *   npm run test:e2e
 *
 * PLAYWRIGHT_CHROMIUM lets you point at a preinstalled Chromium; otherwise Playwright's
 * own browser is used (npx playwright install chromium).
 */

const PORT = E2E_PORT
const chromium = process.env.PLAYWRIGHT_CHROMIUM ?? (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined)

export default defineConfig({
  testDir: './tests/e2e',
  // The flows share one seeded household, so they run in order, one at a time.
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: Boolean(process.env.CI),
  reporter: process.env.CI ? 'github' : 'list',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  globalSetup: './tests/e2e/global-setup.ts',
  outputDir: './test-results',
  use: {
    // localhost (not 127.0.0.1) so the browser accepts the Secure session cookie over http.
    baseURL: `http://localhost:${PORT}`,
    browserName: 'chromium',
    viewport: { width: 1440, height: 900 },
    launchOptions: chromium ? { executablePath: chromium } : {},
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure'
  },
  webServer: {
    command: `npm run build && npm run start -- --port ${PORT}`,
    url: `http://localhost:${PORT}/sign-in`,
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
    stdout: 'ignore',
    stderr: 'pipe',
    env: {
      DATABASE_URL: E2E_DATABASE_URL,
      // Exercise the deterministic parser so runs are repeatable without network access.
      OPENAI_API_KEY: '',
      FOLIO_DEMO_LOGIN: '1'
    }
  }
})
