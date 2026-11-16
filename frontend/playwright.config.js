import { defineConfig } from "@playwright/test";
export default defineConfig({
  workers: 1,
  testDir: "./tests/browser",
  use: {
    launchOptions: process.env.CHROMIUM_PATH
      ? { executablePath: process.env.CHROMIUM_PATH }
      : {},
    baseURL: "http://127.0.0.1:5173",
  },
  webServer: {
    command: "npm run dev -- --port 5173",
    url: "http://127.0.0.1:5173",
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    {
      name: "mobile-360",
      testIgnore: ["**/concurrency.spec.js", "**/notifications.spec.js"],
      use: { viewport: { width: 360, height: 800 } },
    },
    {
      name: "mobile-390",
      testIgnore: ["**/concurrency.spec.js", "**/notifications.spec.js"],
      use: { viewport: { width: 390, height: 844 } },
    },
    { name: "desktop", use: { viewport: { width: 1440, height: 1000 } } },
  ],
});
