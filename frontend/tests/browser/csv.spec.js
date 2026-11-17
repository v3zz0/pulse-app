import { test, expect } from "@playwright/test";
import fs from "node:fs";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
const require = createRequire(import.meta.url),
  csv = require("../../../backend/src/pulse/csv"),
  formats = require("../../../backend/src/pulse/plan-formats");
const [first, user] = JSON.parse(
  fs.readFileSync(
    process.env.PULSE_CSV_CREDENTIALS ||
      "/tmp/pulse-csv-test/csv-credentials.json",
  ),
);
const base = "http://127.0.0.1:8081";
test("CSV: esempi, anteprima, conferma, versioni, obiettivi e scheda completa", async ({
  page,
}) => {
  expect(user.email).toMatch(/^pulse-csv-test-2@example.invalid$/);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(base + "/login");
  await page.getByLabel("Email o nome utente").fill(user.email);
  await page.getByLabel("Password", { exact: true }).fill(user.password);
  await page.getByRole("button", { name: "Accedi", exact: true }).click();
  await page.getByRole("link", { name: "Il tuo account" }).click();
  await page
    .getByLabel("Alimenti preferiti", { exact: true })
    .fill("Riso e pollo sintetici");
  const goals = page.getByLabel("Configura i miei obiettivi nutrizionali");
  if (!(await goals.isChecked())) await goals.check();
  await page.getByLabel("Calorie (kcal)", { exact: true }).fill("2500");
  await page.getByLabel("Proteine (g)", { exact: true }).fill("140");
  await page.getByLabel("Carboidrati (g)", { exact: true }).fill("300");
  await page.getByLabel("Grassi (g)", { exact: true }).fill("80");
  page.once("dialog", (d) => d.accept());
  await page
    .getByRole("button", { name: "Salva preferenze e obiettivi" })
    .click();
  await expect(page.getByRole("status")).toHaveText(
    "Preferenze personali salvate",
  );
  await page.reload();
  await expect(page.getByLabel("Calorie (kcal)", { exact: true })).toHaveValue(
    "2500",
  );
  const tag = randomUUID().slice(0, 8);
  async function call(path, body) {
    const r = body
      ? await page.request.put(base + "/api/pulse" + path, { data: body })
      : await page.request.get(base + "/api/pulse" + path);
    expect(r.ok()).toBeTruthy();
    return r.json();
  }
  // Finish only this synthetic user's prior browser fixture, retaining its history.
  let old = (await call("/training")).active;
  if (old) {
    for (const block of old.snapshot.blocks)
      old = await call("/training/sessions/" + old.clientId, {
        action: "skip-block",
        blockId: block.id,
        revision: old.revision,
        opId: randomUUID(),
        occurredAt: new Date().toISOString(),
      });
    for (const action of ["cooldown", "finish"])
      old = await call("/training/sessions/" + old.clientId, {
        action,
        revision: old.revision,
        opId: randomUUID(),
        occurredAt: new Date().toISOString(),
      });
  }
  await page.getByRole("link", { name: "Dieta", exact: true }).click();
  await expect(
    page.getByRole("link", { name: "Gestisci piano", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("link", { name: "Allenati", exact: true }).click();
  await expect(
    page.getByRole("link", { name: "Gestisci scheda", exact: true }),
  ).toHaveCount(0);
  for (const kind of ["nutrition", "training"]) {
    const path = kind === "nutrition" ? "/altro/piani" : "/altro/schede",
      title = `UI ${kind} ${tag}`;
    await page.goto(
      base + (kind === "nutrition" ? "/dieta/piani" : "/allenati/schede"),
    );
    await expect(page).toHaveURL(base + path);
    await page
      .getByRole("link", { name: "Torna ad Altro", exact: true })
      .click();
    await page
      .getByRole("link", {
        name:
          kind === "nutrition"
            ? "Gestisci piano alimentare"
            : "Gestisci scheda allenamento",
        exact: true,
      })
      .click();
    await expect(page).toHaveURL(base + path);
    await expect(
      page.getByRole("link", { name: "Altro", exact: true }),
    ).toHaveClass(/active/);
    await expect(
      page.getByRole("link", { name: "Altro", exact: true }),
    ).toHaveAttribute("aria-current", "page");
    const dl = page.waitForEvent("download");
    await page
      .getByRole("button", {
        name:
          kind === "nutrition"
            ? "Scarica CSV esempio dieta"
            : "Scarica CSV esempio allenamento",
      })
      .click();
    expect((await dl).suggestedFilename()).toBe(
      kind === "nutrition"
        ? "pulse_dieta_esempio.csv"
        : "pulse_allenamento_esempio.csv",
    );
    await page.getByRole("button", { name: "Copia istruzioni per AI" }).click();
    await expect(page.getByLabel("Istruzioni per AI")).toHaveValue(
      /format_version/,
    );
    const before = await call("/plans/" + kind);
    await expect(page.getByLabel("File CSV da controllare")).toBeEnabled();
    await page.getByLabel("File CSV da controllare").setInputFiles({
      name: "bad.csv",
      mimeType: "text/csv",
      buffer: Buffer.from("wrong;header\n1;2"),
    });
    await expect(
      page.getByRole("button", { name: "Conferma importazione" }),
    ).toBeDisabled();
    await expect(page.getByRole("alert")).toContainText("Colonna obbligatoria");
    const rows = formats
      .exampleRows(kind)
      .map((r) => ({ ...r, plan_id: "ui-" + tag, plan_name: title }));
    if (kind === "training") {
      rows[0].standard_kg = "60";
      for (const r of rows) if (r.day === "A") r.day = "D";
    }
    await expect(page.getByLabel("File CSV da controllare")).toBeEnabled();
    await page.getByLabel("File CSV da controllare").setInputFiles({
      name: "valid.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(csv.serialize(kind, rows)),
    });
    await expect(
      page.getByRole("region", { name: "Anteprima del piano" }),
    ).toContainText(title);
    expect((await call("/plans/" + kind)).length).toBe(before.length);
    await page
      .getByLabel(
        "Confermo il salvataggio come bozza, senza attivazione automatica",
      )
      .check();
    await page
      .getByRole("button", { name: "Conferma importazione", exact: true })
      .click();
    const saved = page.getByRole("region", { name: "Versione salvata" });
    await expect(saved).toContainText("Bozza");
    await page.reload();
    await page
      .getByRole("button", { name: "Visualizza " + title, exact: true })
      .click();
    await expect(saved).toContainText("Bozza");
    await page
      .getByLabel(
        "Confermo l’attivazione di questa versione e l’archiviazione del piano precedente",
      )
      .check();
    await page
      .getByRole("button", {
        name: kind === "nutrition" ? "Attiva piano" : "Attiva scheda",
        exact: true,
      })
      .click();
    await expect(saved.locator(".pill").first()).toHaveText("Attivo");
    const exp = page.waitForEvent("download");
    await page
      .getByRole("button", { name: "Esporta " + title, exact: true })
      .click();
    const download = await exp;
    const file = await download.path();
    const exported = csv.validate(
      kind,
      fs.readFileSync(file, "utf8"),
      "round.csv",
    );
    expect(exported.errors).toEqual([]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy();
    await page.screenshot({
      path: `test-results/csv-${kind}-${test.info().project.name}.png`,
      fullPage: true,
    });
  }
  await page.goto(base + "/allenati");
  await page.getByRole("button", { name: "Scheda D", exact: true }).click();
  await page.getByRole("button", { name: "Inizia scheda D completa" }).click();
  const set = page.getByTestId("set-D:press1:1");
  await expect(set).toContainText("60 kg");
  await set.getByLabel("Carico della seduta (kg)").fill("50");
  await set.getByLabel("Carico della seduta (kg)").blur();
  await expect(page.getByTestId("workout-sync")).toHaveText(
    "Tutte le modifiche sincronizzate",
  );
  await set
    .getByRole("button", { name: "Completa senza peso", exact: true })
    .click();
  await expect(set).toContainText("Completata · peso non registrato");
  await expect(page.getByTestId("workout-sync")).toHaveText(
    "Tutte le modifiche sincronizzate",
  );
  const data = await call("/training");
  expect(data.standards["D:press1:1"].kg).toBe(60);
  expect(data.active.snapshot.blocks[0].sets[0].actualKg).toBeNull();
  expect(errors).toEqual([]);
});
