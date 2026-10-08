import { defineConfig } from "@playwright/test";

// UI regressions use API fixtures and never touch a players database.
export default defineConfig({
  testDir: "tests/mobile-ui",
  timeout: 60000,
  expect: { timeout: 15000 },
  use: { baseURL: "http://127.0.0.1:3100", trace: "retain-on-failure" },
  projects: [
    {
      name: "webkit-mobile",
      use: {
        browserName: "webkit",
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      name: "mobile",
      use: {
        browserName: "chromium",
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      name: "small-mobile",
      use: {
        browserName: "chromium",
        viewport: { width: 320, height: 667 },
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      name: "desktop",
      use: { browserName: "chromium", viewport: { width: 1280, height: 800 } },
    },
  ],
  webServer: {
    command: process.env.CI
      ? "npm run start -w @xnova/web -- --port 3100"
      : "npm run dev -w @xnova/web -- --port 3100",
    port: 3100,
    reuseExistingServer: false,
    timeout: 180000,
  },
});
