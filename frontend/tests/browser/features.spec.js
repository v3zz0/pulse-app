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
      page.getByRole("heading", { name: "Test Allenati e Integratori" }),
    ).toBeVisible();
    const before = (
      await call(page, "/plans/training/" + fixture.program.id + "/export")
    ).csv;
    await page.getByRole("button", { name: "Organizza schede" }).click();
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
      page.getByRole("button", { name: "Lunedì", exact: true }),
    ).toBeVisible();
    expect(
      (await call(page, "/training")).program.displaySettings.days.A.weekdays,
    ).toContain(3);
    expect(
      (await call(page, "/plans/training/" + fixture.program.id + "/export"))
        .csv,
    ).toBe(before);
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
    await page.getByRole("button", { name: "Venerdì", exact: true }).click();
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
test("Integratori: crea, pianifica due orari ON, registra e rettifica, sovrapposizioni e archiviazione", async ({
  page,
}) => {
  await login(page);
  await page.getByRole("link", { name: "Altro", exact: true }).click();
  await page
    .getByRole("link", { name: "I miei integratori", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "I miei integratori." }),
  ).toBeVisible();
  const tag = test.info().project.name + " " + crypto.randomUUID().slice(0, 6),
    name = "Test UI " + tag,
    second = "Secondo UI " + tag;
  const ids = [];
  try {
    await page
      .getByRole("button", { name: "Aggiungi integratore", exact: true })
      .click();
    const dialog = page.getByRole("dialog", { name: "Aggiungi integratore" });
    await dialog.getByLabel("Nome commerciale").fill(name);
    await dialog
      .getByLabel("Ingredienti dichiarati")
      .fill("Creatina dichiarata in fixture sintetica");
    await dialog
      .getByRole("button", { name: "Aggiungi principio attivo" })
      .click();
    await dialog
      .getByLabel("Principio attivo 1", { exact: true })
      .fill("Creatina");
    await dialog.getByLabel("Quantità dichiarata 1").fill("3");
    await dialog.getByLabel("Unità ingrediente 1").fill("g");
    for (let i = 1; i <= 2; i++) {
      await dialog
        .getByRole("button", { name: "Aggiungi orario", exact: true })
        .click();
      await dialog
        .getByLabel("Ora prevista " + i, { exact: true })
        .fill(i === 1 ? "00:01" : "00:02");
      const dose = dialog.getByLabel(
        "Dose pianificata " + i + " (facoltativa)",
        { exact: true },
      );
      await expect(dose).toHaveValue("");
      await dose.fill("1 g sintetico");
      await dialog
        .getByLabel("Confermo personalmente questa dose " + i, { exact: true })
        .check();
      await dialog.getByLabel("Tipo di giornata " + i).selectOption("ON");
      await dialog
        .getByLabel("Promemoria per orario " + i, { exact: true })
        .check();
    }
    await dialog.getByRole("button", { name: "Salva integratore" }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole("status")).toContainText(
      "Integratore e programmazione salvati",
    );
    let p = (await call(page, "/supplements")).find((p) => p.name === name);
    ids.push(p.id);
    expect(p.schedule).toHaveLength(2);
    const reminderIds = (await call(page, "/reminders"))
      .filter((r) => r.settings.target === String(p.id))
      .map((r) => r.id)
      .sort();
    expect(reminderIds).toHaveLength(2);
    await page.getByRole("button", { name: "ON", exact: true }).click();
    const one = page.getByTestId("supplement-slot-" + p.schedule[0].id),
      two = page.getByTestId("supplement-slot-" + p.schedule[1].id);
    await expect(one).toContainText("Da assumere");
    await one
      .getByLabel("Dose effettiva (facoltativa)")
      .fill("Dose effettiva sintetica diversa");
    await one
      .getByRole("button", { name: "Segna assunto", exact: true })
      .click();
    await expect(one).toContainText("Assunto");
    expect(
      (await call(page, "/reminders/due")).some(
        (r) => r.settings.scheduleId === p.schedule[1].id,
      ),
    ).toBeTruthy();
    await two.getByRole("button", { name: "Salta", exact: true }).click();
    await expect(two).toContainText("Saltato");
    page.once("dialog", (d) => d.accept());
    await two.getByRole("button", { name: "Annulla registrazione" }).click();
    await expect(two).toContainText("Da assumere");
    await one.getByRole("button", { name: "Correggi registrazione" }).click();
    const record = page.getByRole("dialog", { name: "Rettifica assunzione" });
    await record
      .getByLabel("Dose effettivamente assunta (includi unità)")
      .fill("Dose rettificata sintetica");
    await record
      .getByRole("button", { name: "Segna assunto", exact: true })
      .click();
    await expect(record).toHaveCount(0);
    await expect(one).toContainText("Dose rettificata sintetica");
    await page
      .getByRole("button", { name: "Modifica " + name, exact: true })
      .click();
    const edit = page.getByRole("dialog", { name: "Modifica integratore" });
    await edit.getByLabel("Nome commerciale").fill(name + " aggiornato");
    await edit.getByLabel("Ora prevista 1", { exact: true }).fill("00:05");
    await edit.getByRole("button", { name: "Salva integratore" }).click();
    await expect(edit).toHaveCount(0);
    expect(
      (await call(page, "/reminders"))
        .filter((r) => r.settings.target === String(p.id))
        .map((r) => r.id)
        .sort(),
    ).toEqual(reminderIds);
    let rows = await call(page, "/supplements/history"),
      taken = rows.find((r) => r.productId === p.id && r.status === "taken");
    expect(taken.name).toBe(name);
    expect(taken.plannedSnapshot.dose).toBe("1 g sintetico");
    expect(taken.corrections).toHaveLength(1);
    await page
      .getByRole("button", { name: "Aggiungi integratore", exact: true })
      .click();
    const add = page.getByRole("dialog", { name: "Aggiungi integratore" });
    await add.getByLabel("Nome commerciale").fill(second);
    await add.getByLabel("Ingredienti dichiarati").fill("Creatine");
    await add.getByRole("button", { name: "Salva integratore" }).click();
    await expect(add).toHaveCount(0);
    ids.push(
      (await call(page, "/supplements")).find((p) => p.name === second).id,
    );
    await expect(
      page.getByRole("heading", { name: "Possibili sovrapposizioni" }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy();
    await page.screenshot({
      path: `test-results/integratori-${test.info().project.name}.png`,
      fullPage: true,
    });
    page.once("dialog", (d) => d.accept());
    await page
      .getByRole("button", {
        name: "Archivia " + name + " aggiornato",
        exact: true,
      })
      .click();
    await expect(page.getByTestId("supplement-product-" + p.id)).toHaveCount(0);
    await page.getByLabel("Mostra archiviati").check();
    await expect(page.getByTestId("supplement-product-" + p.id)).toContainText(
      "Archiviato",
    );
    rows = await call(page, "/supplements/history");
    expect(rows.some((r) => r.id === taken.id && r.name === name)).toBeTruthy();
  } finally {
    for (const id of ids) {
      const p = (await call(page, "/supplements?includeArchived=1")).find(
        (p) => p.id === id,
      );
      if (p?.active)
        await call(page, "/supplements/" + id, {
          action: "archive",
          revision: p.revision,
          confirm: true,
        });
    }
  }
});
