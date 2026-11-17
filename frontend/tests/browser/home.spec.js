import { test, expect } from "@playwright/test";
import fs from "node:fs";
const credentials =
  process.env.PULSE_TEST_CREDENTIALS || "/tmp/pulse-test/credentials.json";
test("accesso privato, Home persistente e navigazione nutrizione", async ({
  page,
}) => {
  const [user] = JSON.parse(fs.readFileSync(credentials));
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Accedi a PULSE" }),
  ).toBeVisible();
  await page.getByLabel("Email o nome utente").fill(user.email);
  await page.getByLabel("Password", { exact: true }).fill(user.password);
  await page.getByRole("button", { name: "Accedi", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "La tua giornata." }),
  ).toBeVisible();
  // Keep this synthetic fixture repeatable across test runs and viewports.
  expect(user.email).toMatch(/^pulse-test-[12]@example.invalid$/);
  await page.evaluate(async () => {
    const date = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Rome",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
    let d = await fetch("/api/pulse/days/" + date).then((r) => r.json());
    for (const m of d.meals.slice(0, 2)) {
      if (m.consumedAt)
        d = await fetch("/api/pulse/days/" + date, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "meal",
            mealId: m.id,
            consumed: false,
            revision: d.revision,
          }),
        }).then((r) => r.json());
    }
  });
  await page.reload();
  const next = page.getByTestId("next-meal");
  await expect(next).toBeVisible();
  await page.screenshot({
    path: "test-results/phase2-" + test.info().project.name + ".png",
    fullPage: true,
  });
  expect((await next.boundingBox()).y).toBeLessThan(
    (await page.getByTestId("meal-list").boundingBox()).y,
  );
  await Promise.all([
    page.waitForResponse(
      (r) =>
        r.request().method() === "PUT" &&
        r.url().includes("/api/pulse/days/") &&
        r.status() === 200,
    ),
    page.getByRole("button", { name: "Mangiato", exact: true }).click(),
  ]);
  await page.reload();
  await expect(
    page
      .getByTestId("meal-list")
      .getByRole("button", { name: /Annulla pasto:/ })
      .first(),
  ).toBeVisible();
  await page.getByRole("button", { name: "Sostituisci", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("link", { name: "Dieta", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Lista della spesa" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Prepara domani", exact: true })
    .click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("link", { name: "Altro", exact: true }).click();
  const weightCard = page.locator("form").filter({
    has: page.getByRole("heading", { name: "Registra peso" }),
  });
  await expect(weightCard.getByLabel("Data della misurazione")).toHaveValue(/^\d{4}-\d{2}-\d{2}$/);
  await weightCard.getByLabel("Peso in kg").fill("72.4");
  await weightCard.getByRole("button", { name: "Salva peso" }).click();
  await expect(weightCard.getByRole("status")).toHaveText("Peso salvato");
  await expect(
    page.getByRole("button", { name: "Esci", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("link", { name: "Il tuo account" }).click();
  await expect(page).toHaveURL(/\/account$/);
  await page.getByRole("button", { name: "Esci", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Accedi a PULSE" }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
