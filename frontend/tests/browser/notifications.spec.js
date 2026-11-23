import { test, expect } from "@playwright/test";
import fs from "node:fs";
test.use({ channel: "chromium" });
const [, user] = JSON.parse(
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
  await page.getByRole("link", { name: "Impostazioni", exact: true }).click();
  await page.evaluate(() =>
    Promise.race([
      navigator.serviceWorker.ready,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Service worker non pronto")), 15000),
      ),
    ]),
  );
  await page.getByRole("link", { name: "Promemoria", exact: true }).click();
  const name = "Avviso sintetico " + crypto.randomUUID().slice(0, 8);
  const card = page.locator("article").filter({ has: page.getByRole("heading", { name, exact: true }) });
  const advance = () => page.getByRole("button", { name: "Continua", exact: true }).click();
  await page.getByRole("button", { name: "Nuovo promemoria" }).click();
  await page.getByLabel("Tipo promemoria").selectOption("custom");
  await advance();
  await page.getByLabel("Nome del promemoria").fill(name);
  await advance();
  await page.getByLabel("Orario promemoria").fill("00:00");
  await advance();
  await expect(page.getByRole("dialog")).toContainText("Ogni giorno");
  await page.getByRole("button", { name: "Salva promemoria" }).click();
  await expect(card.getByRole("switch")).toBeChecked();
  const due = page.getByRole("region", { name: "Promemoria in scadenza" })
    .locator(".reminder-row").filter({ hasText: name });
  await expect(due).toBeVisible();
  await expect.poll(() => page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    return (await registration.getNotifications()).some((n) => n.data.pulseReminder);
  })).toBe(true);
  await due.getByRole("button", { name: "Rinvia 15 min" }).click();
  await expect(due).toHaveCount(0);

  await page.reload();
  await card.getByRole("button", { name: "Modifica", exact: true }).click();
  await advance();
  await advance();
  await page.getByLabel("Orario promemoria").fill("23:59");
  await page.getByLabel("Lun", { exact: true }).uncheck();
  await advance();
  await page.getByRole("button", { name: "Salva promemoria" }).click();
  await expect(card).toContainText("23:59");
  await expect(card).not.toContainText("Ogni giorno");
  await expect(card).toHaveCount(1);
  await card.getByRole("switch").click();
  await expect(card).toContainText("Disattivato");
  await page.reload();
  await expect(card.getByRole("switch")).not.toBeChecked();
  await page.screenshot({ path: "test-results/promemoria-desktop.png" });
  page.once("dialog", (dialog) => dialog.accept());
  await card.getByRole("button", { name: "Elimina", exact: true }).click();
  await expect(card).toHaveCount(0);
});
