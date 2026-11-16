import { chromium } from "@playwright/test";
import fs from "node:fs";
import assert from "node:assert/strict";
const [u] = JSON.parse(
  fs.readFileSync(
    process.env.PULSE_TEST_CREDENTIALS ||
      "/tmp/pulse-phase3-test/credentials.json",
  ),
);
assert.match(u.email, /^pulse-test-/);
const browser = await chromium.launch({
  channel: "chromium",
  args: [
    "--ignore-certificate-errors",
    "--no-proxy-server",
    "--host-resolver-rules=MAP pulse.vezzo.vp360web.it 127.0.0.1, MAP apipulse.vezzo.vp360web.it 127.0.0.1",
  ],
});
const state = "/tmp/pulse-phase4-https/state.json";
try {
  for (const width of [360, 390, 1440]) {
    let context = await browser.newContext({
      ignoreHTTPSErrors: true,
      viewport: { width, height: 900 },
    });
    let page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("https://pulse.vezzo.vp360web.it/");
    await page.getByLabel("Email o nome utente").fill(u.email);
    await page.getByLabel("Password", { exact: true }).fill(u.password);
    await page.getByRole("button", { name: "Accedi", exact: true }).click();
    await page.getByRole("heading", { name: "La tua giornata." }).waitFor();
    assert.equal(await page.evaluate(() => isSecureContext), true);
    await page.evaluate(() =>
      Promise.race([
        navigator.serviceWorker.ready,
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error("Service worker non pronto")),
            10000,
          ),
        ),
      ]),
    );
    const cookie = (await context.cookies()).find(
      (c) => c.name === "pulse_session",
    );
    assert.ok(cookie.secure && cookie.httpOnly && cookie.sameSite === "Strict");
    assert.equal(cookie.domain, "pulse.vezzo.vp360web.it");
    await page.getByRole("link", { name: "Allenati", exact: true }).click();
    await page
      .getByTestId("workout-sync")
      .filter({ hasText: "Tutte le modifiche sincronizzate" })
      .waitFor();
    const pending = page
      .locator(".session-set")
      .filter({
        has: page.getByRole("button", {
          name: "Completa senza peso",
          exact: true,
        }),
      })
      .first();
    const id = await pending.getAttribute("data-testid");
    assert.ok(id);
    await context.setOffline(true);
    await page
      .getByTestId(id)
      .getByRole("button", { name: "Completa senza peso", exact: true })
      .click();
    await page
      .getByTestId("workout-sync")
      .filter({ hasText: "invio in attesa" })
      .waitFor();
    await page.reload();
    await page
      .getByTestId(id)
      .filter({ hasText: "Completata · peso non registrato" })
      .waitFor();
    await context.storageState({ path: state, indexedDB: true });
    fs.chmodSync(state, 0o600);
    await context.close();
    context = await browser.newContext({
      ignoreHTTPSErrors: true,
      storageState: state,
      viewport: { width, height: 900 },
    });
    page = await context.newPage();
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("https://pulse.vezzo.vp360web.it/allenati");
    await page
      .getByTestId(id)
      .filter({ hasText: "Completata · peso non registrato" })
      .waitFor();
    await page
      .getByTestId("workout-sync")
      .filter({ hasText: "Tutte le modifiche sincronizzate" })
      .waitFor();
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
    );
    await page.screenshot({
      path: `/tmp/pulse-phase4-https/pulse-${width}.png`,
    });
    assert.deepEqual(errors, []);
    await context.close();
    console.log(
      `PASS HTTPS ${width}px: cookie sicuro/persistente, PWA, offline/reload, chiusura e riapertura, sync, nessun pageerror/overflow.`,
    );
  }
} finally {
  await browser.close();
  fs.rmSync(state, { force: true });
}
