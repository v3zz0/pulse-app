import { test as base, expect } from "@playwright/test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Installation requires a regular profile. Isolate each test on disk instead
// of opening the private browser context used by other Playwright tests.
export const test = base.extend({
  context: async ({ playwright, launchOptions, viewport }, use) => {
    const directory = await mkdtemp(join(tmpdir(), "pulse-pwa-profile-"));
    try {
      const context = await playwright.chromium.launchPersistentContext(
        directory,
        {
          ...launchOptions,
          viewport,
        },
      );
      try {
        await use(context);
      } finally {
        await context.close();
      }
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  },
});
export { expect };
