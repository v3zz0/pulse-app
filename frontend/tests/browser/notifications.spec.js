import { test, expect } from "@playwright/test";
import fs from "node:fs";
test.use({ channel: "chromium" });
const [user] = JSON.parse(
  fs.readFileSync(
    process.env.PULSE_TEST_CREDENTIALS ||
      "/tmp/pulse-phase3-test/credentials.json",
  ),
);
test("consenso, notifica reale service worker, rinvio e disattivazione", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["notifications"], {
    origin: "http://127.0.0.1:8081",
  });
  await page.goto("http://127.0.0.1:8081/");
  await page.getByLabel("Email o nome utente").fill(user.email);
  await page.getByLabel("Password", { exact: true }).fill(user.password);
  await page.getByRole("button", { name: "Accedi", exact: true }).click();
  await page.getByRole("link", { name: "Altro", exact: true }).click();
  await page.evaluate(() =>
    Promise.race([
      navigator.serviceWorker.ready,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Service worker non pronto")), 15000),
      ),
    ]),
  );
  const old = await page.request
    .get("http://127.0.0.1:8081/api/pulse/reminders")
    .then((r) => r.json());
  for (const r of old.filter(
    (r) => r.settings.kind === "workout" && r.settings.target === "C",
  ))
    await page.request.put(
      "http://127.0.0.1:8081/api/pulse/reminders/" + r.id,
      {
        data: { action: "delete", revision: r.revision },
      },
    );
  await page.reload();
  await page.getByLabel("Tipo promemoria").selectOption("workout");
  await page.getByRole("combobox", { name: /Attività/ }).selectOption("C");
  await page.getByLabel("Orario promemoria").fill("00:00");
  await page.getByRole("button", { name: "Aggiungi promemoria" }).click();
  await expect(
    page.getByRole("region", { name: "Promemoria in scadenza" }),
  ).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const r = await navigator.serviceWorker.ready;
        return (await r.getNotifications()).length;
      }),
    )
    .toBeGreaterThan(0);
  await page
    .getByRole("button", { name: "Rinvia 15 min", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Promemoria in scadenza" }),
  ).not.toBeVisible();
  await page
    .getByRole("button", { name: "Disattiva", exact: true })
    .last()
    .click();
  await expect(
    page.locator(".reminder-row").filter({ hasText: "Scheda C" }).last(),
  ).toContainText("Disattivato");
});
