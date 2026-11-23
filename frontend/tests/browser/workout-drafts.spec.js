import { test, expect } from "@playwright/test";
import fs from "node:fs";
const [u] = JSON.parse(
  fs.readFileSync(
    process.env.PULSE_CSV_CREDENTIALS ||
      "/tmp/pulse-csv-test/csv-credentials.json",
  ),
);
const base = "http://127.0.0.1:8081";
async function call(page, path, data, method = "PUT") {
  const r = await page.request.fetch(base + "/api/pulse" + path, {
    method: data ? method : "GET",
    headers: { Origin: base },
    ...(data ? { data } : {}),
  });
  expect(r.status()).toBe(200);
  return r.json();
}
const operation = (s, data) => ({
  ...data,
  revision: s.revision,
  opId: crypto.randomUUID(),
  occurredAt: new Date().toISOString(),
});
async function synced(page) {
  await expect(page.getByTestId("workout-sync")).toHaveText(
    "Tutte le modifiche sincronizzate",
    { timeout: 20000 },
  );
}
async function cancel(page) {
  await page.getByRole("button", { name: "Menu allenamento" }).click();
  await page.getByRole("menuitem", { name: "Annulla allenamento" }).click();
  await page.getByRole("button", { name: "Annulla definitivamente" }).click();
}
test("proposte, bozza persistente PWA, annullamento offline e terminalità multi-dispositivo", async ({
  page,
  context,
}) => {
  expect(u.email).toBe("pulse-csv-test-1@example.invalid");
  const errors = [];
  context.on("page", (p) => p.on("pageerror", (e) => errors.push(e.message)));
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(base + "/login");
  await page.getByLabel("Email o nome utente").fill(u.email);
  await page.getByLabel("Password", { exact: true }).fill(u.password);
  await page.getByRole("button", { name: "Accedi", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "La tua giornata", exact: true }),
  ).toBeVisible();
  let data = await call(page, "/training");
  expect(data.program.title).toBe("Test sintetico proposte e annullamento");
  if (data.active)
    await call(
      page,
      "/training/sessions/" + data.active.clientId,
      operation(data.active, { action: "cancel", confirm: true }),
    );
  const history = data.history;
  await page.getByRole("link", { name: "Allena", exact: true }).click();
  await page.getByRole("button", { name: "Inizia scheda A completa" }).click();
  const exact = page.getByTestId("set-A:exact:1"),
    range = page.getByTestId("set-A:range:1"),
    ced = page.getByTestId("set-A:ced:1");
  await expect(exact.getByLabel("Carico della seduta (kg)")).toHaveValue("60");
  await expect(exact.getByLabel("Ripetizioni effettive")).toHaveValue("5");
  await expect(
    page.getByTestId("set-A:zero:1").getByLabel("Carico della seduta (kg)"),
  ).toHaveValue("0");
  await expect(range.getByLabel("Carico della seduta (kg)")).toHaveValue("");
  await expect(range.getByLabel("Ripetizioni effettive")).toHaveValue("");
  const wide = page.getByTestId("set-A:wide:1");
  const picker = wide.getByLabel("Scelta rapida ripetizioni previste");
  await expect(picker).toHaveValue("");
  await expect(picker.locator("option")).toHaveCount(19);
  await picker.selectOption("12");
  await expect(wide.getByLabel("Ripetizioni effettive")).toHaveValue("12");
  await synced(page);
  await expect(ced.getByLabel("Ripetizioni effettive")).toHaveValue("");
  await ced
    .getByRole("button", { name: "Completa senza peso", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "Inserisci le ripetizioni effettivamente",
  );
  await exact.getByLabel("Carico della seduta (kg)").fill("50");
  await exact.getByLabel("Ripetizioni effettive").fill("4");
  await exact
    .getByRole("button", { name: "Completa e registra peso", exact: true })
    .click();
  await expect(exact).toContainText("50 kg");
  await expect(exact).toContainText("4 ripetizioni");
  await synced(page);
  let session = (await call(page, "/training")).active;
  expect(session.snapshot.blocks[0].sets[0].actualKg).toBe(50);
  expect(session.snapshot.blocks[0].sets[0].actualReps).toBe(4);
  await range.getByRole("button", { name: "Proponi 9 ripetizioni" }).click();
  await expect(range.getByLabel("Ripetizioni effettive")).toHaveValue("9");
  await synced(page);
  // A deliberately stalled request must not hold the IndexedDB write lock.
  let release, intercepted;
  const gate = new Promise((resolve) => (release = resolve)),
    hit = new Promise((resolve) => (intercepted = resolve));
  await page.route("**/api/pulse/me", async (route) => {
    intercepted();
    await gate;
    await route.continue();
  });
  await range.getByLabel("Carico della seduta (kg)").fill("12");
  await hit;
  await range.getByLabel("Ripetizioni effettive").fill("6");
  const localReps = () =>
    page.evaluate(
      () =>
        new Promise((resolve, reject) => {
          const open = indexedDB.open("pulse-private-v1", 1);
          open.onsuccess = () => {
            const db = open.result,
              tx = db.transaction("entries"),
              cursor = tx.objectStore("entries").openCursor();
            cursor.onsuccess = () => {
              const c = cursor.result;
              if (!c) return resolve(null);
              if (String(c.key).startsWith("workout:")) {
                const set = c.value.active?.snapshot.blocks
                  .flatMap((b) => b.sets)
                  .find((s) => s.id === "A:range:1");
                if (set) {
                  resolve(set.draftReps);
                  db.close();
                  return;
                }
              }
              c.continue();
            };
            tx.onerror = () => reject(tx.error);
          };
        }),
    );
  await expect.poll(localReps).toBe(6);
  release();
  await synced(page);
  await page.unroute("**/api/pulse/me");
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await synced(page);
  await context.setOffline(true);
  await range.getByLabel("Carico della seduta (kg)").fill("15");
  await range.getByLabel("Ripetizioni effettive").fill("7");
  await expect(page.getByTestId("workout-sync")).toContainText(
    "invio in attesa",
  );
  await page.close();
  page = await context.newPage();
  await page.goto(base + "/allenati");
  const restored = page.getByTestId("set-A:range:1");
  await expect(restored.getByLabel("Carico della seduta (kg)")).toHaveValue(
    "15",
  );
  await expect(restored.getByLabel("Ripetizioni effettive")).toHaveValue("7");
  await expect(restored).toContainText("Da fare");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await restored.scrollIntoViewIfNeeded();
  await page.screenshot({
    path: `test-results/workout-drafts-${test.info().project.name}.png`,
    fullPage: false,
  });
  await page.getByRole("button", { name: "Menu allenamento" }).click();
  await page.getByRole("menuitem", { name: "Annulla allenamento" }).click();
  await expect(page.getByRole("alertdialog")).toContainText(
    "Hai già completato 1 serie",
  );
  await page.screenshot({
    path: `test-results/workout-cancel-${test.info().project.name}.png`,
  });
  await page.getByRole("button", { name: "Torna all’allenamento" }).click();
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
  await expect(page.getByRole("timer")).toBeVisible();
  await cancel(page);
  await expect(
    page.getByText("Allenamento annullato sul dispositivo.", { exact: false }),
  ).toBeVisible();
  await expect(page.getByRole("timer")).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Inizia scheda A completa" }),
  ).toBeDisabled();
  // Another device advances the server while the terminal intent is offline.
  session = (await call(page, "/training")).active;
  const cancelledId = session.clientId;
  await call(
    page,
    "/training/sessions/" + session.clientId,
    operation(session, { action: "timer", command: "start", seconds: 30 }),
  );
  await context.setOffline(false);
  await synced(page);
  data = await call(page, "/training");
  expect(data.active).toBeNull();
  expect(data.history).toEqual(history);
  expect((await call(page, "/training/sessions/" + cancelledId)).status).toBe(
    "cancelled",
  );
  await page.getByRole("button", { name: "Inizia scheda A completa" }).click();
  const fresh = page.getByTestId("set-A:exact:1");
  await expect(fresh.getByLabel("Carico della seduta (kg)")).toHaveValue("60");
  await expect(fresh.getByLabel("Ripetizioni effettive")).toHaveValue("5");
  await fresh
    .getByRole("button", { name: "Completa senza peso", exact: true })
    .click();
  await synced(page);
  session = (await call(page, "/training")).active;
  expect(session.snapshot.blocks[0].sets[0].actualKg).toBeNull();
  await page
    .getByTestId("set-A:zero:1")
    .getByRole("button", { name: "Salta serie", exact: true })
    .click();
  await synced(page);
  session = (await call(page, "/training")).active;
  expect(session.snapshot.blocks[1].sets[0].actualKg).toBeNull();
  expect(session.snapshot.blocks[1].sets[0].actualReps).toBeNull();
  // Remote cancellation must retire only the old session's local operations.
  await context.setOffline(true);
  await page
    .getByTestId("set-A:range:1")
    .getByLabel("Carico della seduta (kg)")
    .fill("25");
  await expect(page.getByTestId("workout-sync")).toContainText(
    "invio in attesa",
  );
  session = (await call(page, "/training")).active;
  await call(
    page,
    "/training/sessions/" + session.clientId,
    operation(session, { action: "cancel", confirm: true }),
  );
  const remote = await call(
    page,
    "/training/sessions",
    { clientId: crypto.randomUUID(), programId: data.program.id, day: "A" },
    "POST",
  );
  await context.setOffline(false);
  await synced(page);
  expect((await call(page, "/training")).active.clientId).toBe(remote.clientId);
  await expect(
    page.getByTestId("set-A:exact:1").getByLabel("Carico della seduta (kg)"),
  ).toHaveValue("60");
  await cancel(page);
  await synced(page);
  expect((await call(page, "/training")).active).toBeNull();
  expect(errors).toEqual([]);
});
