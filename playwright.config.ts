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
    // Navigateur imposé uniquement si fourni (environnements sans `playwright install`) ;
    // en CI, `npx playwright install chromium` installe la version alignée sur le lockfile.
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
      : {},
  },
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
    },
  ],
  // CI : serveurs de production (build déjà fait) ; en local : serveurs de développement,
  // réutilisés s'ils tournent déjà.
  webServer: [
    {
      command: process.env.CI ? 'npm run start' : 'npm run dev',
      cwd: 'apps/api',
      port: 3001,
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
    },
    {
      command: process.env.CI ? 'npm run start' : 'npm run dev',
      cwd: 'apps/web',
      port: 3000,
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
    },
  ],
});
