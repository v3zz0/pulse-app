import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";

const [, user] = JSON.parse(
  readFileSync(
    process.env.PULSE_CSV_CREDENTIALS ||
      "/tmp/pulse-csv-test/csv-credentials.json",
  ),
);
const base = "http://127.0.0.1:8081";
async function call(page, path, data, method = data ? "PUT" : "GET") {
  const response = await page.request.fetch(base + "/api/pulse" + path, {
    method,
    headers: { Origin: base },
    ...(data ? { data } : {}),
  });
  expect(response.ok(), path).toBeTruthy();
  return response.status() === 204 ? null : response.json();
}
async function login(page) {
  expect(user.email).toBe("pulse-csv-test-2@example.invalid");
  await page.goto(base + "/login");
  await page.getByLabel("Email o nome utente").fill(user.email);
  await page.getByLabel("Password", { exact: true }).fill(user.password);
  await page.getByRole("button", { name: "Accedi", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "La tua giornata", exact: true }),
  ).toBeVisible();
}
async function spacing(page) {
  const sizes = await page.locator(".editor-shell").evaluate((shell) => {
    const first = shell.querySelector(".editor-card");
    const second = shell.querySelectorAll(".editor-card")[1];
    const button = shell.querySelector(".editor-save .btn");
    return {
      gap:
        second.getBoundingClientRect().top -
        first.getBoundingClientRect().bottom,
      button: button.getBoundingClientRect().height,
      overflow: document.documentElement.scrollWidth - innerWidth,
    };
  });
  expect(sizes.gap).toBeGreaterThanOrEqual(12);
  expect(sizes.button).toBeGreaterThanOrEqual(44);
  expect(sizes.overflow).toBe(0);
}
async function restore(page, kind, id) {
  if (!id) return;
  const path = "/plans/" + kind + "/" + id;
  const { activation } = await call(page, path);
  await call(page, path, {
    action: "activate",
    confirm: true,
    activationToken: activation.token,
  });
}

test("editor Allenati, libreria, ordinamento, Flow e allenamento", async ({
  page,
}, info) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await login(page);
  const { active } = await call(page, "/training");
  if (active)
    await call(page, "/training/sessions/" + active.clientId, {
      action: "cancel",
      confirm: true,
      revision: active.revision,
      opId: crypto.randomUUID(),
      occurredAt: new Date().toISOString(),
    });
  const plans = await call(page, "/plans/training");
  const previous = plans.find((p) => p.status === "active")?.id;
  await page.getByRole("link", { name: "Allena", exact: true }).click();
  await page.getByRole("link", { name: "Crea nuova scheda" }).click();
  await expect(
    page.getByRole("heading", { name: "Crea allenamento" }),
  ).toBeVisible();
  await spacing(page);
  const title = "Editor e2e " + crypto.randomUUID().slice(0, 8);
  await page.getByLabel("Nome scheda").fill(title);
  await page.getByRole("button", { name: /Lun/ }).click();
  await page.getByRole("button", { name: "Aggiungi esercizio" }).click();
  const library = page.getByRole("dialog", { name: "Libreria esercizi" });
  await library.getByLabel("Cerca esercizio").fill("barbell bench press");
  await library.getByRole("button", { name: "Cerca", exact: true }).click();
  await library.getByLabel("Attrezzatura").selectOption("barbell");
  await library
    .getByRole("button", { name: /barbell bench press.*barbell/i })
    .first()
    .click();
  await expect(
    library.getByRole("img", { name: /animazione dimostrativa/ }),
  ).toBeVisible();
  await library.getByRole("button", { name: "Aggiungi alla scheda" }).click();
  const exercises = page.getByRole("region", {
    name: "Esercizi della giornata",
  });
  const first = exercises.locator("article").first();
  await first.getByLabel("Recupero (secondi)").fill("90");
  await first.getByLabel("Ripetizioni previste").fill("5");
  await first.getByLabel("Peso standard (kg)").fill("60");
  await first.getByRole("button", { name: "Aggiungi serie" }).click();
  await first.getByLabel("Tipo di serie").nth(1).selectOption("back-off");
  await first.getByLabel("Ripetizioni previste").nth(1).fill("8-10");
  await first.getByLabel("Peso standard (kg)").nth(1).fill("50");

  await page.getByRole("button", { name: "Aggiungi esercizio" }).click();
  await library.getByRole("button", { name: "Crea personalizzato" }).click();
  await library
    .getByLabel("Nome esercizio")
    .fill("Pressa di prova " + title.slice(-8));
  await library.getByLabel("Gruppo muscolare").fill("Gambe");
  await library.getByLabel("Attrezzatura").fill("Macchina");
  await library.getByRole("button", { name: "Salva e aggiungi" }).click();
  const second = exercises.locator("article").nth(1);
  await second.getByLabel("Ripetizioni previste").fill("CED");
  await second
    .getByRole("button", { name: /Sposta su Pressa di prova/ })
    .click();
  await expect(first.getByRole("heading")).toContainText("Pressa di prova");
  // Collapsed cards fit together in the touch viewport while dragging.
  for (const details of await exercises
    .locator("details[open] > summary")
    .all())
    await details.click();
  const firstGrip = first.locator(".editor-grip");
  const secondGrip = second.locator(".editor-grip");
  await firstGrip.scrollIntoViewIfNeeded();
  await secondGrip.scrollIntoViewIfNeeded();
  const from = await firstGrip.boundingBox(),
    to = await secondGrip.boundingBox();
  const start = { x: from.x + 16, y: from.y + 20 };
  const end = { x: to.x + 16, y: to.y + 20 };
  if (info.project.name.startsWith("mobile")) {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [start],
    });
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [end],
    });
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    await cdp.detach();
  } else {
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(end.x, end.y, { steps: 10 });
    await page.mouse.up();
  }
  await expect(first.getByRole("heading")).toContainText(
    /barbell bench press/i,
  );
  await page.getByRole("button", { name: "Salva scheda" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: /^Salvato\.$/ }),
  ).toBeVisible();
  const id = Number(page.url().split("/").at(-1));
  await page.reload();
  await expect(page.getByLabel("Nome scheda")).toHaveValue(title);
  await expect(first.getByLabel("Peso standard (kg)").first()).toHaveValue(
    "60",
  );
  const row = (await call(page, "/plans/training/" + id + "/editor")).days[0];
  page.once("dialog", (dialog) => dialog.accept());
  try {
    await page.getByRole("button", { name: "Attiva scheda" }).click();
    await page
      .getByRole("button", { name: "Inizia scheda " + row.id + " completa" })
      .click();
    const series = page.getByTestId("set-" + row.blocks[0].sets[0].id);
    await expect(series.getByLabel("Carico della seduta (kg)")).toHaveValue(
      "60",
    );
    await expect(series.getByLabel("Ripetizioni effettive")).toHaveValue("5");
    expect(errors).toEqual([]);
  } finally {
    const { active } = await call(page, "/training");
    if (active?.programId === id)
      await call(page, "/training/sessions/" + active.clientId, {
        action: "cancel",
        confirm: true,
        revision: active.revision,
        opId: crypto.randomUUID(),
        occurredAt: new Date().toISOString(),
      });
    await restore(page, "training", previous);
    await call(
      page,
      "/plans/training/" + id + "/remove",
      { confirm: true },
      "POST",
    );
  }
});

test("editor Dieta, calendario, alternative, copia ed eliminazione", async ({
  page,
}) => {
  await login(page);
  const plans = await call(page, "/plans/nutrition");
  const previous = plans.find((p) => p.status === "active")?.id;
  await page.getByRole("link", { name: "Dieta", exact: true }).click();
  await page.getByRole("link", { name: "Crea nuova dieta" }).click();
  await expect(
    page.getByRole("heading", { name: "Crea piano alimentare" }),
  ).toBeVisible();
  await spacing(page);
  const title = "Dieta e2e " + crypto.randomUUID().slice(0, 8);
  await page.getByLabel("Nome piano").fill(title);
  page.once("dialog", (dialog) => dialog.dismiss());
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "Oggi" })
    .click();
  await expect(page.getByLabel("Nome piano")).toHaveValue(title);
  await page.getByLabel("Tipo di piano").selectOption("weekly");
  await page.getByRole("button", { name: /^Lun/ }).click();
  await page.getByRole("button", { name: "Aggiungi pasto" }).click();
  await page.getByLabel("Nome pasto").fill("Colazione");
  await page.getByLabel("Nome alimento").fill("Fiocchi di avena");
  await page.getByLabel("Quantità").fill("80");
  await page.getByRole("button", { name: "Aggiungi sostituzione" }).click();
  await page.getByLabel("Sostituzione 1").fill("Pane");
  await page.getByLabel("Quantità").nth(1).fill("100");
  await page
    .getByRole("button", { name: "Aggiungi alternativa al pasto" })
    .click();
  await page.getByLabel("Nome alimento", { exact: true }).nth(1).fill("Yogurt");
  await page.getByLabel("Quantità").nth(2).fill("125");
  await expect(page.locator(".editor-shell")).not.toContainText(
    /kcal|macronutrienti/,
  );
  await page.getByRole("button", { name: "Salva piano" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: /^Salvato\.$/ }),
  ).toBeVisible();
  const id = Number(page.url().split("/").at(-1));
  let copyId;
  try {
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Attiva piano" }).click();
    await expect(
      page.getByRole("heading", { name: "La tua dieta." }),
    ).toBeVisible();
    await page.getByRole("link", { name: "Gestisci piani" }).click();
    await page
      .getByRole("button", { name: "Duplica " + title, exact: true })
      .click();
    await expect(page.getByLabel("Nome piano")).toHaveValue(title + " — Copia");
    copyId = Number(page.url().split("/").at(-1));
    await page.getByLabel("Quantità").first().fill("75");
    await page.getByRole("button", { name: "Salva piano" }).click();
    await expect(
      page.getByRole("status").filter({ hasText: /^Salvato\.$/ }),
    ).toBeVisible();
    const original = await call(page, "/plans/nutrition/" + id + "/editor");
    expect(original.meals[1][0].menus[0].groups[0].options[0].quantity).toBe(
      80,
    );
    await page.goto(base + "/altro/piani");
    const remove = page.getByRole("button", {
      name: "Elimina " + title + " — Copia",
    });
    page.once("dialog", (dialog) => dialog.dismiss());
    await remove.click();
    await expect(remove).toBeVisible();
    page.once("dialog", (dialog) => dialog.accept());
    await remove.click();
    await expect(remove).toHaveCount(0);
  } finally {
    await restore(page, "nutrition", previous);
    await call(
      page,
      "/plans/nutrition/" + id + "/remove",
      { confirm: true },
      "POST",
    );
    if (copyId)
      await call(
        page,
        "/plans/nutrition/" + copyId + "/remove",
        { confirm: true },
        "POST",
      );
  }
});
