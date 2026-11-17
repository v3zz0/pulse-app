import { test, expect } from "@playwright/test";
import fs from "node:fs";
const [user] = JSON.parse(
  fs.readFileSync(
    process.env.PULSE_CSV_CREDENTIALS ||
      "/tmp/pulse-csv-test/csv-credentials.json",
  ),
);
const fixture = JSON.parse(
  fs.readFileSync("/tmp/pulse-csv-test/restyle-supplements-state.json"),
);
const base = "http://127.0.0.1:8081";
test.use({ timezoneId: "Europe/Rome" });
async function call(page, path, data, method = "PUT") {
  const r = await page.request.fetch(base + "/api/pulse" + path, {
    method: data ? method : "GET",
    headers: { Origin: base },
    ...(data ? { data } : {}),
  });
  expect(r.status()).toBe(200);
  return r.json();
}
async function login(page) {
  expect(user.email).toBe("pulse-csv-test-1@example.invalid");
  await page.goto(base + "/login");
  await page.getByLabel("Email o nome utente").fill(user.email);
  await page.getByLabel("Password", { exact: true }).fill(user.password);
  await page.getByRole("button", { name: "Accedi", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "La tua giornata." }),
  ).toBeVisible();
}
async function cancelServer(page) {
  const { active } = await call(page, "/training");
  if (active)
    await call(page, "/training/sessions/" + active.clientId, {
      action: "cancel",
      confirm: true,
      revision: active.revision,
      opId: crypto.randomUUID(),
      occurredAt: new Date().toISOString(),
    });
}
async function activate(page, id) {
  const r = await call(page, "/plans/training/" + id);
  await call(page, "/plans/training/" + id, {
    action: "activate",
    confirm: true,
    activationToken: r.activation.token,
    transferLoads: false,
  });
}
const synced = (page) =>
  expect(page.getByTestId("workout-sync")).toHaveText(
    "Tutte le modifiche sincronizzate",
    { timeout: 20000 },
  );
async function cancel(page) {
  await page.getByRole("button", { name: "Menu allenamento" }).click();
  await page.getByRole("menuitem", { name: "Annulla allenamento" }).click();
  await page.getByRole("button", { name: "Annulla definitivamente" }).click();
}
test("Allenati: card compatte, CSV, nomi e calendario, Flow verificato offline e annullamento", async ({
  page,
  context,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await login(page);
  const previous = (await call(page, "/training")).program?.id;
  await cancelServer(page);
  if (previous !== fixture.program.id) await activate(page, fixture.program.id);
  try {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(base + "/allenati");
    await synced(page);
    await expect(
      page.getByRole("heading", { name: "Le mie schede" }),
    ).toBeVisible();
    const before = (
      await call(page, "/plans/training/" + fixture.program.id + "/export")
    ).csv;
    await page.getByRole("button", { name: "Modifica programma" }).click();
    for (const [d, name] of Object.entries({
      A: "Lunedì",
      B: "Mercoledì",
      C: "Venerdì",
    }))
      await page.getByLabel("Nome scheda " + d).fill(name);
    await page
      .getByRole("checkbox", { name: "Scheda A: Lun", exact: true })
      .check();
    await page
      .getByRole("checkbox", { name: "Scheda A: Mer", exact: true })
      .check();
    await page.getByRole("button", { name: "Salva organizzazione" }).click();
    await expect(
      page.getByRole("dialog", { name: "Organizza schede" }),
    ).toHaveCount(0);
    await expect(
      page.getByTestId("training-day-A").getByRole("heading", { name: "Lunedì", exact: true }),
    ).toBeVisible();
    expect(
      (await call(page, "/training")).program.displaySettings.days.A.weekdays,
    ).toContain(3);
    expect(
      (await call(page, "/plans/training/" + fixture.program.id + "/export"))
        .csv,
    ).toBe(before);
    const card = page.getByTestId("training-day-A");
    await expect(card).toContainText("Lunedì · Mercoledì");
    expect((await card.boundingBox()).y).toBeLessThan((await page.getByTestId("training-day-B").boundingBox()).y);
    await page.screenshot({ path: `test-results/schede-${test.info().project.name}.png` });
    await card.getByRole("button", { name: "Visualizza scheda" }).click();
    const block = page.getByTestId("block-A:press1");
    await expect(block).toContainText("60 kg");
    await block.locator("details").first().locator("summary").click();
    const player = block.locator(".flow-player").first(),
      img = player.locator(":scope > img");
    await expect(img).toBeVisible();
    await expect(
      player.getByRole("button", { name: "Riprendi animazione" }),
    ).toBeVisible();
    await player.getByRole("button", { name: "Riprendi animazione" }).click();
    const first = await img.getAttribute("src");
    await expect.poll(() => img.getAttribute("src")).not.toBe(first);
    await player.getByRole("button", { name: "Pausa animazione" }).click();
    await player.getByRole("button", { name: "Ingrandisci" }).click();
    await page.getByRole("button", { name: "Chiudi animazione" }).click();
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.reload();
    await synced(page);
    await card.getByRole("button", { name: "Visualizza scheda" }).click();
    await page.locator(".media-download > summary").click();
    await page
      .getByRole("button", { name: "Scarica animazioni offline" })
      .click();
    await expect(
      page.getByText(/Animazioni disponibili offline/),
    ).toBeVisible();
    await page.locator(".media-download > summary").click();
    const cached = await page.evaluate(async () => {
      const keys = (await caches.keys()).filter(
        (k) => k.startsWith("pulse-flow-") && !k.includes("stage"),
      );
      return (
        await Promise.all(
          keys.map(async (k) =>
            (await (await caches.open(k)).keys()).map((r) => r.url),
          ),
        )
      ).flat();
    });
    expect(cached).toHaveLength(3);
    expect(cached.every((u) => u.includes("/0025/frame-0"))).toBeTruthy();
    await page
      .getByRole("button", { name: "Inizia scheda A completa" })
      .click();
    const set = page.getByTestId("set-A:press1:1");
    await expect(set.getByLabel("Carico della seduta (kg)")).toHaveValue("60");
    await expect(set.getByLabel("Ripetizioni effettive")).toHaveValue("5");
    await page.screenshot({
      path: `test-results/allenati-compact-${test.info().project.name}.png`,
      fullPage: false,
    });
    await set.getByLabel("Carico della seduta (kg)").fill("50");
    await set.getByLabel("Ripetizioni effettive").fill("4");
    await set
      .getByRole("button", { name: "Completa senza peso", exact: true })
      .click();
    await synced(page);
    let active = (await call(page, "/training")).active;
    expect(active.snapshot.blocks[0].sets[0].actualKg).toBeNull();
    expect(active.snapshot.blocks[0].sets[0].actualReps).toBe(4);
    await context.setOffline(true);
    const pending = page.getByTestId("set-A:press1:2");
    await pending.getByLabel("Carico della seduta (kg)").fill("12");
    await pending.getByLabel("Ripetizioni effettive").fill("7");
    await expect(page.getByTestId("workout-sync")).toContainText(
      "invio in attesa",
    );
    await page.reload();
    await expect(pending.getByLabel("Carico della seduta (kg)")).toHaveValue(
      "12",
    );
    await expect(pending.getByLabel("Ripetizioni effettive")).toHaveValue("7");
    await block.locator("details").first().locator("summary").click();
    await expect(player.locator(":scope > img")).toBeVisible();
    expect(
      await player
        .locator(":scope > img")
        .evaluate((i) => i.complete && i.naturalWidth > 0),
    ).toBeTruthy();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy();
    await page.screenshot({
      path: `test-results/allenati-restyle-${test.info().project.name}.png`,
      fullPage: true,
    });
    await cancel(page);
    await expect(
      page.getByText(/Allenamento annullato sul dispositivo/),
    ).toBeVisible();
    await context.setOffline(false);
    await synced(page);
    expect((await call(page, "/training")).active).toBeNull();
    await page
      .getByRole("button", { name: "Inizia scheda A completa" })
      .click();
    await expect(set.getByLabel("Carico della seduta (kg)")).toHaveValue("60");
    await cancel(page);
    await synced(page);
    await page
      .getByRole("button", { name: "Inizia scheda C completa" })
      .click();
    await expect(page.locator(".session-progress")).toContainText("Venerdì");
    await synced(page);
    expect((await call(page, "/training")).active.day).toBe("C");
    await cancel(page);
    await synced(page);
    expect(errors).toEqual([]);
  } finally {
    await context.setOffline(false);
    await cancelServer(page);
    if (previous && previous !== fixture.program.id)
      await activate(page, previous);
  }
});
test("Integratori quotidiani in Oggi: gestione separata, assunzioni indipendenti e ripresa offline", async ({ page, context }) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await login(page);
  const name = "Prodotto UI " + crypto.randomUUID().slice(0, 8);
  const beforeReminders = await call(page, "/reminders");
  await page.getByRole("link", { name: "Altro", exact: true }).click();
  await page.getByRole("link", { name: "Gestisci i miei integratori" }).click();
  await page.getByRole("button", { name: "Aggiungi integratore" }).click();
  await page.getByLabel("Nome integratore").fill(name);
  await page.getByLabel("Quantità per assunzione").fill("2.5");
  await page.getByRole("combobox", { name: "Unità", exact: true }).selectOption("g");
  await page.getByLabel("Assunzioni al giorno").selectOption("3");
  await page.getByLabel("Orario assunzione 2").fill("14:00");
  await page.getByLabel("Orario assunzione 3").fill("20:00");
  await page.getByRole("button", { name: "Salva integratore" }).click();
  const productCard = page.locator("article").filter({ has: page.getByRole("heading", { name, exact: true }) });
  await expect(productCard).toContainText("Da lunedì a domenica");
  await expect(page.getByText("Storico assunzioni", { exact: true })).toHaveCount(0);
  expect(await call(page, "/reminders")).toEqual(beforeReminders);
  await page.screenshot({ path: `test-results/integratori-config-${test.info().project.name}.png` });

  await page.getByRole("link", { name: "Oggi", exact: true }).click();
  const slots = productCard.locator(".intake-slot");
  await expect(slots).toHaveCount(3);
  await slots.nth(1).getByRole("button", { name: "Segna assunto" }).click();
  await expect(slots.nth(1).locator(".intake-state")).toHaveText("Assunto");
  await expect(slots.first().locator(".intake-state")).toHaveText("Da assumere");
  await slots.nth(1).getByRole("button", { name: "Annulla registrazione" }).click();
  await expect(slots.nth(1).locator(".intake-state")).toHaveText("Da assumere");

  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await expect(slots).toHaveCount(3);
  await context.setOffline(true);
  try {
    await slots.last().getByRole("button", { name: "Segna assunto" }).click();
    await expect(slots.last().locator(".intake-state")).toHaveText("Da sincronizzare");
    await page.reload();
    await expect(slots.last().locator(".intake-state")).toHaveText("Da sincronizzare");
  } finally { await context.setOffline(false); }
  await expect(slots.last().locator(".intake-state")).toHaveText("Assunto");
  await expect(slots.first().locator(".intake-state")).toHaveText("Da assumere");
  await page.screenshot({ path: `test-results/oggi-integratori-${test.info().project.name}.png` });
  await page.getByRole("link", { name: "Altro", exact: true }).click();
  await page.getByRole("link", { name: "Gestisci i miei integratori" }).click();
  await page.getByRole("button", { name: "Modifica " + name }).click();
  await page.getByLabel("Quantità per assunzione").fill("3");
  await page.getByRole("button", { name: "Salva integratore" }).click();
  await expect(productCard).toContainText("3 g");
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Elimina " + name }).click();
  await expect(productCard).toHaveCount(0);
  const history = await call(page, "/supplements/history");
  expect(history.find((r) => r.name === name && r.status === "taken").plannedSnapshot.dose).toBe("2.5 g");
  expect(await call(page, "/reminders")).toEqual(beforeReminders);
  expect(errors).toEqual([]);
});
