import { test, expect } from "@playwright/test";
import fs from "node:fs";
const [user] = JSON.parse(
  fs.readFileSync(
    process.env.PULSE_TEST_CREDENTIALS ||
      "/tmp/pulse-phase3-test/credentials.json",
  ),
);
async function login(page) {
  await page.goto("/");
  await page.getByLabel("Email o nome utente").fill(user.email);
  await page.getByLabel("Password", { exact: true }).fill(user.password);
  await page.getByRole("button", { name: "Accedi", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "La tua giornata." }),
  ).toBeVisible();
}
test("scheda completa, peso temporaneo, timer, offline/reload, sync e storico", async ({
  page,
  context,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await login(page);
  await expect(
    page.getByRole("heading", { name: /Riprendi allenamento/ }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Allenati", exact: true }).click();
  await expect(page.getByTestId("set-A:1:1")).toBeVisible();
  const id = await page
    .locator(".session-set")
    .filter({
      has: page.getByRole("button", {
        name: "Completa senza peso",
        exact: true,
      }),
    })
    .first()
    .getAttribute("data-testid");
  const set = page.getByTestId(id);
  await set.getByLabel("Carico della seduta (kg)").fill("50");
  await set.getByLabel("Carico della seduta (kg)").blur();
  await expect(page.getByTestId("workout-sync")).toHaveText(
    "Tutte le modifiche sincronizzate",
  );
  await context.setOffline(true);
  await set
    .getByRole("button", { name: "Completa senza peso", exact: true })
    .click();
  await expect(set).toContainText("Completata · peso non registrato");
  await expect(page.getByTestId("workout-sync")).toContainText(
    "invio in attesa",
  );
  // Dev server can't serve navigation offline; cache boot is separately tested on production SW.
  await context.setOffline(false);
  await page.reload();
  await expect(set).toContainText("Completata · peso non registrato");
  await expect(page.getByTestId("workout-sync")).toHaveText(
    "Tutte le modifiche sincronizzate",
  );
  await page.getByLabel("Recupero manuale in secondi").fill("60");
  await page
    .getByRole("button", { name: "Avvia recupero", exact: true })
    .click();
  await expect(page.getByRole("timer")).toBeVisible();
  await page.getByRole("button", { name: "Pausa recupero" }).click();
  await expect(page.getByRole("timer")).toContainText("In pausa");
  await page.reload();
  await expect(page.getByRole("timer")).toContainText("In pausa");
  await page.getByRole("button", { name: "Riprendi recupero" }).click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/phase3-" + test.info().project.name + ".png",
    fullPage: false,
  });
  await page.getByRole("link", { name: "Progressi", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Storico allenamenti" }),
  ).toBeVisible();
  await expect(
    page.getByRole("img", { name: "Andamento peso corporeo" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Altro", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Installa PULSE" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Promemoria", exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
