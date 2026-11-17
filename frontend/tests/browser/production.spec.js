import { test, expect } from "./pwa-fixture";
import fs from "node:fs";
import { ensurePendingWorkout } from "./workout-fixture";
const [user] = JSON.parse(
  fs.readFileSync(
    process.env.PULSE_TEST_CREDENTIALS ||
      "/tmp/pulse-phase3-test/credentials.json",
  ),
);
test("PWA produzione: installabilità, cache solo shell e ripresa offline dopo riapertura", async ({
  page,
  context,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("http://127.0.0.1:8081/");
  await page.getByLabel("Email o nome utente").fill(user.email);
  await page.getByLabel("Password", { exact: true }).fill(user.password);
  await page.getByRole("button", { name: "Accedi", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "La tua giornata." }),
  ).toBeVisible();
  await ensurePendingWorkout(page, user);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  const cdp = await context.newCDPSession(page);
  await cdp.send("Page.enable");
  const install = await cdp.send("Page.getInstallabilityErrors");
  expect(install.installabilityErrors).toEqual([]);
  const manifest = await page.evaluate(async () =>
    fetch("/manifest.webmanifest").then((r) => r.json()),
  );
  expect(manifest.display).toBe("standalone");
  expect(manifest.icons).toHaveLength(4);
  await page.getByRole("link", { name: "Allenati", exact: true }).click();
  await expect(page.getByTestId("workout-sync")).toHaveText(
    "Tutte le modifiche sincronizzate",
  );
  const pendingSet = page
    .locator(".session-set")
    .filter({
      has: page.getByRole("button", {
        name: "Completa senza peso",
        exact: true,
      }),
    })
    .first();
  const id = await pendingSet.getAttribute("data-testid");
  expect(id).toBeTruthy();
  const first = page.getByTestId(id);
  const reps = first.getByLabel("Ripetizioni effettive");
  if ((await reps.count()) && (await reps.inputValue()) === "") {
    await reps.fill("8");
    await expect(page.getByTestId("workout-sync")).toHaveText(
      "Tutte le modifiche sincronizzate",
    );
  }
  await context.setOffline(true);
  await first
    .getByRole("button", { name: "Completa senza peso", exact: true })
    .click();
  await expect(first).toContainText("Completata · peso non registrato");
  await expect(page.getByTestId("workout-sync")).toContainText(
    "invio in attesa",
  );
  await page.reload();
  await expect(page.getByTestId(id)).toContainText(
    "Completata · peso non registrato",
  );
  await expect(page.getByTestId("workout-sync")).toContainText(
    "invio in attesa",
  );
  await context.setOffline(false);
  await expect(page.getByTestId("workout-sync")).toHaveText(
    "Tutte le modifiche sincronizzate",
    { timeout: 15000 },
  );
  const cached = await page.evaluate(async () => {
    const keys = await caches.keys();
    return (
      await Promise.all(
        keys.map(async (k) =>
          (await (await caches.open(k)).keys()).map((r) => r.url),
        ),
      )
    ).flat();
  });
  expect(cached.length).toBeGreaterThan(4);
  expect(
    cached.every(
      (u) => !u.includes("/api/") && !u.toLowerCase().includes(".pdf"),
    ),
  ).toBe(true);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});
