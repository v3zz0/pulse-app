import { test, expect } from "@playwright/test";
import fs from "node:fs";
const [user] = JSON.parse(
  fs.readFileSync(
    process.env.PULSE_TEST_CREDENTIALS ||
      "/tmp/pulse-phase3-test/credentials.json",
  ),
);
test("due tab e conflitto con un altro dispositivo senza perdita silenziosa", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await page.getByLabel("Email o nome utente").fill(user.email);
  await page.getByLabel("Password", { exact: true }).fill(user.password);
  await page.getByRole("button", { name: "Accedi", exact: true }).click();
  await page.getByRole("link", { name: "Allenamenti", exact: true }).click();
  await expect(page.getByTestId("workout-sync")).toHaveText(
    "Tutte le modifiche sincronizzate",
  );
  let tab = await context.newPage();
  await tab.goto("/allenati");
  await expect(tab.getByTestId("workout-sync")).toHaveText(
    "Tutte le modifiche sincronizzate",
  );
  await page.locator(".manual-recovery > summary").click();
  await tab.locator(".manual-recovery > summary").click();
  await Promise.all([
    page.getByRole("button", { name: "Avvia recupero", exact: true }).click(),
    tab.getByRole("button", { name: "Avvia recupero", exact: true }).click(),
  ]);
  await expect(page.getByTestId("workout-sync")).toHaveText(
    "Tutte le modifiche sincronizzate",
  );
  await expect(tab.getByTestId("workout-sync")).toHaveText(
    "Tutte le modifiche sincronizzate",
  );
  await tab.close();
  await page.reload();
  await page.locator(".manual-recovery > summary").click();
  await expect(page.getByTestId("workout-sync")).toHaveText(
    "Tutte le modifiche sincronizzate",
  );
  await page.evaluate(() => navigator.locks.request("pulse-workout", () => {}));
  await page.evaluate(() => {
    window.originalPulsePut = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function () {
      throw new DOMException("Quota test", "QuotaExceededError");
    };
  });
  await page
    .getByRole("button", { name: "Avvia recupero", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "Memoria locale non disponibile: modifica non salvata",
  );
  await page.evaluate(() => {
    IDBObjectStore.prototype.put = window.originalPulsePut;
  });
  const initial = await page.request
    .get("/api/pulse/training")
    .then((r) => r.json());
  await page.route(
    "**/api/pulse/training/sessions/*",
    async (route) => {
      await route.fetch();
      await route.abort("failed");
    },
    { times: 1 },
  );
  await page
    .getByRole("button", { name: "Avvia recupero", exact: true })
    .click();
  await expect(page.getByTestId("workout-sync")).toContainText(
    "invio in attesa",
  );
  await page.getByRole("button", { name: "Riprova sincronizzazione" }).click();
  await expect(page.getByTestId("workout-sync")).toHaveText(
    "Tutte le modifiche sincronizzate",
  );
  const retried = await page.request
    .get("/api/pulse/training")
    .then((r) => r.json());
  expect(retried.active.revision).toBe(initial.active.revision + 1);
  await context.setOffline(true);
  await page
    .getByRole("button", { name: "Avvia recupero", exact: true })
    .click();
  await expect(page.getByTestId("workout-sync")).toContainText(
    "invio in attesa",
  );
  const data = await page.request
    .get("/api/pulse/training")
    .then((r) => r.json());
  const body = {
    action: "timer",
    command: "start",
    seconds: 90,
    revision: data.active.revision,
    opId: crypto.randomUUID(),
    occurredAt: new Date().toISOString(),
  };
  expect(
    (
      await page.request.put(
        "/api/pulse/training/sessions/" + data.active.clientId,
        { data: body },
      )
    ).status(),
  ).toBe(200);
  await context.setOffline(false);
  await expect(
    page.getByRole("button", { name: "Scarica bozza e usa versione server" }),
  ).toBeVisible();
  page.once("dialog", (d) => d.accept());
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Scarica bozza e usa versione server" })
    .click();
  await download;
  await expect(page.getByTestId("workout-sync")).toHaveText(
    "Tutte le modifiche sincronizzate",
  );
  tab = await context.newPage();
  await tab.goto("/allenati");
  await expect(tab.getByTestId("workout-sync")).toHaveText(
    "Tutte le modifiche sincronizzate",
  );
  // Esci è sempre nella barra in alto, accanto al profilo.
  await page.getByRole("button", { name: "Esci", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Accedi a PULSE" }),
  ).toBeVisible();
  await expect(
    tab.getByRole("heading", { name: "Accedi a PULSE" }),
  ).toBeVisible();
  const entries = await page.evaluate(async () => {
    const db = await new Promise((resolve) => {
      const r = indexedDB.open("pulse-private-v1", 1);
      r.onsuccess = () => resolve(r.result);
    });
    return new Promise((resolve) => {
      const r = db.transaction("entries").objectStore("entries").getAll();
      r.onsuccess = () => resolve(r.result);
    });
  });
  expect(entries.filter((v) => v?.queue || v?.active)).toEqual([]);
});

test("ciclo completo UI: standard 60, temporaneo 50, senza peso, nuova scheda ancora 60", async ({
  page,
}) => {
  const [, u] = JSON.parse(
    fs.readFileSync(
      process.env.PULSE_TEST_CREDENTIALS ||
        "/tmp/pulse-phase3-test/credentials.json",
    ),
  );
  expect(u.email).toMatch(/^pulse-test-2@example.invalid$/);
  await page.goto("/");
  await page.getByLabel("Email o nome utente").fill(u.email);
  await page.getByLabel("Password", { exact: true }).fill(u.password);
  await page.getByRole("button", { name: "Accedi", exact: true }).click();
  await page.getByRole("link", { name: "Allenamenti", exact: true }).click();
  async function finish() {
    await page.getByRole("button", { name: /Mostra tutti/ }).click();
    const buttons = page.getByRole("button", {
      name: "Salta esercizio",
      exact: true,
    });
    const n = await buttons.count();
    for (let i = 0; i < n; i++) {
      await buttons.nth(i).click();
      await expect(page.getByTestId("workout-sync")).toHaveText(
        "Tutte le modifiche sincronizzate",
      );
    }
    const cooldown = page.getByRole("button", {
      name: "Defaticamento fatto",
      exact: true,
    });
    if (await cooldown.count()) await cooldown.click();
    await page
      .getByRole("button", { name: "Concludi allenamento", exact: true })
      .click();
    await expect(
      page.getByRole("button", {
        name: "Inizia scheda A completa",
        exact: true,
      }),
    ).toBeVisible();
  }
  await expect(page.getByTestId("workout-sync")).toHaveText("Tutte le modifiche sincronizzate");
  if (await page.locator(".session-progress").count()) await finish();
  await page.getByTestId("training-day-A").getByRole("button", { name: "Vedi", exact: true }).click();
  await page.locator(".training-preview").first().locator("summary").click();
  page.on("dialog", (d) => d.accept(d.type() === "prompt" ? "60" : undefined));
  await page
    .getByRole("button", { name: "Aggiorna standard A:1:1", exact: true })
    .click();
  await expect(page.locator(".training-preview").first()).toContainText(
    "Standard: 60",
  );
  await page
    .getByRole("button", { name: "Inizia scheda A completa", exact: true })
    .click();
  const set = page.getByTestId("set-A:1:1");
  await expect(set.getByLabel("Carico della seduta (kg)")).toHaveValue("60");
  await set.getByLabel("Carico della seduta (kg)").fill("50");
  await set.getByLabel("Carico della seduta (kg)").blur();
  await expect(page.getByTestId("workout-sync")).toHaveText(
    "Tutte le modifiche sincronizzate",
  );
  await set
    .getByRole("button", { name: "Completa senza peso", exact: true })
    .click();
  await expect(set).toContainText("Completata · peso non registrato");
  await expect(set).toContainText("Peso non registrato");
  await finish();
  await page
    .getByRole("button", { name: "Inizia scheda A completa", exact: true })
    .click();
  await expect(set.getByLabel("Carico della seduta (kg)")).toHaveValue("60");
  await finish();
  await page.getByRole("link", { name: "Progressi", exact: true }).first().click();
  await expect(
    page.getByRole("heading", { name: "Storico allenamenti" }),
  ).toBeVisible();
});
