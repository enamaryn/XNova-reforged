import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 180_000,
  expect: {
    timeout: 15_000,
  },
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000',
    trace: 'retain-on-failure',
    navigationTimeout: 120_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
    },
  ],
  webServer: [
    {
      command: 'npm run dev',
      cwd: 'apps/api',
      port: 3001,
      reuseExistingServer: true,
      timeout: 180_000,
    },
    {
      command: 'npm run dev',
      cwd: 'apps/web',
      port: 3000,
      reuseExistingServer: true,
      timeout: 180_000,
    },
  ],
});
