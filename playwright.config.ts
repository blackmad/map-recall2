import { defineConfig, devices } from '@playwright/test';
import { existsSync } from 'node:fs';

const localChrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
// Worktrees each run a dev server, and `reuseExistingServer` will silently test
// whichever checkout already owns the port. Give each session its own:
// `PW_PORT=4388 npx playwright test …`.
// Linux/cloud runs: PW_CHROME=/opt/pw-browsers/chromium/chrome (software GL flags added).
const chrome = process.env.PW_CHROME || (existsSync(localChrome) ? localChrome : undefined);
const port = process.env.PW_PORT || '4173';

export default defineConfig({
  testDir: './tests/e2e',
  // Canal route boots fetch OSM extracts; openRoute alone needs ~60–90s.
  timeout: 120_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: process.env.CI ? 2 : 1,
  forbidOnly: Boolean(process.env.CI),
  // One retry is enough once hidden-select helpers stop burning the job budget.
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['html', { open: 'never' }], ['github']] : 'list',
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions: chrome ? { executablePath: chrome, args: process.env.PW_CHROME ? ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--js-flags=--expose-gc'] : [] } : undefined,
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], browserName: 'chromium', viewport: { width: 1440, height: 900 } } },
    { name: 'iphone', use: { ...devices['iPhone 13'], browserName: 'chromium' } },
  ],
  webServer: {
    command: 'npm run dev',
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: { PORT: port },
  },
});
