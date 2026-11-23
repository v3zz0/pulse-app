// Usa il Playwright già installato in frontend/node_modules:
//   ../frontend/node_modules/.bin/playwright test -c prototype/tests/playwright.config.cjs
const { defineConfig } = require("../../frontend/node_modules/@playwright/test");
const sizes = { mobile: { width: 375, height: 740 }, desktop: { width: 1280, height: 850 } };
module.exports = defineConfig({
  testDir: __dirname,
  outputDir: __dirname + "/results",
  fullyParallel: true,
  reporter: [["list"]],
  use: { timezoneId: "Europe/Rome", locale: "it-IT" },
  projects: Object.entries(sizes).flatMap(([n, viewport]) => ["light", "dark"].map((colorScheme) => ({
    name: `${n}-${colorScheme}`, use: { viewport, colorScheme, hasTouch: n === "mobile" },
  }))),
});
