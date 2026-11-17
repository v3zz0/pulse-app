import { test, expect } from "@playwright/test";
import fs from "node:fs";
const [, u] = JSON.parse(
  fs.readFileSync(
    process.env.PULSE_CSV_CREDENTIALS ||
      "/tmp/pulse-csv-test/csv-credentials.json",
  ),
);
test("preferenze: card separate, chip Invio/rimozione e persistenza senza tempo cucina", async ({
  page,
}) => {
  expect(u.email).toBe("pulse-csv-test-2@example.invalid");
  await page.goto("http://127.0.0.1:8081/login");
  await page.getByLabel("Email o nome utente").fill(u.email);
  await page.getByLabel("Password", { exact: true }).fill(u.password);
  await page.getByRole("button", { name: "Accedi", exact: true }).click();
  await page.getByRole("link", { name: "Il tuo account" }).click();
  const form = page.locator("form.account-form"),
    section = page.getByRole("region", {
      name: "Preferenze e obiettivi personali",
    });
  await expect(
    section.getByLabel("Alimenti preferiti", { exact: true }),
  ).toBeVisible();
  const a = await form.boundingBox(),
    b = await section.boundingBox();
  expect(b.y - (a.y + a.height)).toBeGreaterThanOrEqual(24);
  await expect(
    page.getByText("Tempo per cucinare (minuti)", { exact: true }),
  ).toHaveCount(0);
  for (const label of [
    "Allergie dichiarate",
    "Intolleranze dichiarate",
    "Alimenti facili da preparare",
    "Preferenze colazione",
    "Preferenze pranzo",
    "Preferenze cena",
    "Numero di pasti preferito",
    "Vincoli di spesa",
  ])
    await expect(section.getByLabel(label, { exact: true })).toHaveCount(0);
  const before = await page.request
    .get("http://127.0.0.1:8081/api/pulse/personal-settings")
    .then((r) => r.json());
  const favorite = page.getByLabel("Alimenti preferiti", { exact: true });
  await favorite.fill("Riso");
  await favorite.press("Enter");
  await expect(
    page.getByRole("button", {
      name: "Rimuovi Riso da Alimenti preferiti",
      exact: true,
    }),
  ).toBeVisible();
  await favorite.fill("Pasta test");
  await favorite.press("Enter");
  await page
    .getByRole("button", {
      name: "Rimuovi Pasta test da Alimenti preferiti",
      exact: true,
    })
    .click();
  const avoided = page.getByLabel("Alimenti non graditi", { exact: true });
  await avoided.fill("Broccoli");
  await avoided.press("Enter");
  page.once("dialog", (d) => d.accept());
  await page
    .getByRole("button", { name: "Salva preferenze e obiettivi" })
    .click();
  await expect(page.getByRole("status")).toHaveText(
    "Preferenze personali salvate",
  );
  await page.reload();
  await expect(
    page.getByRole("button", {
      name: "Rimuovi Riso da Alimenti preferiti",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "Rimuovi Broccoli da Alimenti non graditi",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "Rimuovi Pasta test da Alimenti preferiti",
      exact: true,
    }),
  ).toHaveCount(0);
  const saved = await page.request
    .get("http://127.0.0.1:8081/api/pulse/personal-settings")
    .then((r) => r.json());
  expect(saved.data.favoriteFoods).toContain("Riso");
  expect(saved.data.avoidedFoods).toContain("Broccoli");
  expect(saved.data.goals).toEqual(before.data.goals);
  expect(Object.keys(saved.data).sort()).toEqual([
    "avoidedFoods",
    "favoriteFoods",
    "goals",
  ]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page.screenshot({
    path: `test-results/profile-chips-${test.info().project.name}.png`,
    fullPage: true,
  });
  await page.goto("http://127.0.0.1:8081/altro/piani");
  await page
    .getByLabel("Includi le mie preferenze private nel testo per l’AI")
    .check();
  await page.getByRole("button", { name: "Copia istruzioni per AI" }).click();
  const prompt = page.getByLabel("Istruzioni per AI");
  await expect(prompt).toHaveValue(/favoriteFoods/);
  expect(await prompt.inputValue()).toContain(JSON.stringify(saved.data));
  expect(await prompt.inputValue()).not.toMatch(
    /allergies|intolerances|easyFoods|mealCount|cookingMinutes|breakfast|lunch|dinner|budget/,
  );
});
