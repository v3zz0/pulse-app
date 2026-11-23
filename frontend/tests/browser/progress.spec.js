import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
const [user] = JSON.parse(
  readFileSync(
    process.env.PULSE_CSV_CREDENTIALS ||
      "/tmp/pulse-csv-test/csv-credentials.json",
  ),
);
const base = "http://127.0.0.1:8081";
test.use({ timezoneId: "Europe/Rome" });

test("Progressi con dati reali, intervalli, storico e layout", async ({
  page,
}) => {
  expect(user.email).toBe("pulse-csv-test-1@example.invalid");
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(base + "/login");
  await page.getByLabel("Email o nome utente").fill(user.email);
  await page.getByLabel("Password", { exact: true }).fill(user.password);
  await page.getByRole("button", { name: "Accedi", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "La tua giornata", exact: true }),
  ).toBeVisible();
  async function api(path, data) {
    const result = await page.request.fetch(base + "/api/pulse" + path, {
      method: data ? "PUT" : "GET",
      headers: { Origin: base },
      ...(data ? { data } : {}),
    });
    expect(result.ok()).toBeTruthy();
    return result.json();
  }
  const today = new Date();
  const iso = (offset) => {
    const date = new Date(today);
    date.setDate(date.getDate() + offset);
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Rome",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(date);
  };
  for (const [day, kg] of [
    [iso(-365 * 2), 76],
    [iso(-45), 74],
    [iso(-2), 72],
    [iso(-1), 71],
  ])
    await api("/weights/" + day, { kg });
  const weights = await api("/weights");
  const { history } = await api("/training");
  expect(
    history.some((session) =>
      session.snapshot.blocks.some((block) =>
        block.sets.some((set) => set.status === "recorded"),
      ),
    ),
  ).toBeTruthy();

  await page.getByRole("link", { name: "Progressi", exact: true }).click();
  const weight = page.getByRole("region", { name: "Peso corporeo" });
  await expect(weight).toContainText("Ultima misurazione");
  const graph = weight.getByRole("img", { name: "Andamento peso corporeo" });
  await expect(graph).toBeVisible();
  await page.getByRole("button", { name: "30 giorni" }).click();
  const recent = await graph.locator("circle").count();
  expect(recent).toBe(weights.filter((row) => row.day >= iso(-29)).length);
  await page.getByRole("button", { name: "90 giorni" }).click();
  await expect(graph.locator("circle")).toHaveCount(
    weights.filter((row) => row.day >= iso(-89)).length,
  );
  await page.getByRole("button", { name: "Un anno" }).click();
  const yearly = await graph.locator("circle").count();
  await page.getByRole("button", { name: "Tutto" }).click();
  expect(await graph.locator("circle").count()).toBeGreaterThan(yearly);
  const loads = page.getByRole("region", { name: "Carichi registrati" });
  await expect(
    loads.getByRole("img", { name: "Carico massimo registrato per seduta" }),
  ).toBeVisible();
  await expect(loads).toContainText("Miglior carico del periodo");
  await loads.getByText("Dati del grafico", { exact: true }).click();
  await expect(loads.locator("dd").first()).toContainText("kg");
  const completed = new Set(
    history
      .filter((row) => row.status === "completed")
      .map((row) => row.clientId),
  ).size;
  await expect(
    page
      .getByRole("region", { name: "Storico allenamenti" })
      .locator("details"),
  ).toHaveCount(completed);
  await expect(
    page
      .getByRole("region", { name: "Calendario allenamenti" })
      .locator(".is-completed")
      .first(),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - innerWidth,
    ),
  ).toBe(0);
  expect(errors).toEqual([]);
});
