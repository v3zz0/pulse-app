import { test, expect } from "@playwright/test";
import fs from "node:fs";
import { ensurePendingWorkout } from "./workout-fixture";
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
  const mobile = test.info().project.name.startsWith("mobile");
  await page.addInitScript((android) => {
    if (android) Object.defineProperty(navigator, "userAgent", {
      get: () => "Mozilla/5.0 (Linux; Android 15) Chrome/131.0 Mobile",
    });
  }, mobile);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await login(page);
  await ensurePendingWorkout(page, user);
  await expect(
    page.getByRole("heading", { name: /Riprendi allenamento/ }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Allenati", exact: true }).click();
  await expect(page.getByTestId("set-A:1:1")).toBeVisible();
  const program = await page.request.get("/api/pulse/training").then((r) => r.json());
  const [bench, , , incline] = program.program.days.A;
  const benchCard = page.getByTestId("block-" + bench.id);
  await benchCard.locator(".compact-ex-head").click();
  await expect(benchCard.locator(".flow-player > img").first()).toBeVisible();
  await expect(benchCard.getByText("Video originale")).toHaveCount(0);
  await benchCard.locator(".compact-ex-head").click();
  const inclineCard = page.getByTestId("block-" + incline.id);
  await inclineCard.locator(".compact-ex-head").click();
  await expect(inclineCard.getByText("Animazione non disponibile", { exact: true })).toBeVisible();
  await expect(inclineCard.getByText("Video originale", { exact: true })).toHaveCount(0);
  await expect(page.locator('a[href*="youtube.com"], a[href*="youtu.be"]')).toHaveCount(0);
  await inclineCard.locator(".compact-ex-head").click();
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
  const reps = set.getByLabel("Ripetizioni effettive");
  if ((await reps.count()) && (await reps.inputValue()) === "") {
    await reps.fill("8");
    await expect(page.getByTestId("workout-sync")).toHaveText(
      "Tutte le modifiche sincronizzate",
    );
  }
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
  await page.locator(".manual-recovery > summary").click();
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
  await page.getByRole("button", { name: "Installa PULSE" }).click();
  const installDialog = page.getByRole("dialog", { name: "Installa PULSE" });
  await expect(installDialog).toContainText(mobile ? "menu ⋮ di Chrome" : "barra degli indirizzi");
  await page.getByRole("button", { name: "Chiudi", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Installa PULSE" })).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "Promemoria", exact: true }),
  ).toBeVisible();
  await page.evaluate(() => {
    const event = new Event("beforeinstallprompt", { cancelable: true });
    event.prompt = () => Promise.resolve();
    event.userChoice = Promise.resolve({ outcome: "accepted" });
    window.dispatchEvent(event);
  });
  await page.getByRole("button", { name: "Installa PULSE" }).click();
  await installDialog.getByRole("button", { name: "Installa sul dispositivo" }).click();
  await expect(installDialog).toContainText("Installazione richiesta.");
  await page.evaluate(() => window.dispatchEvent(new Event("appinstalled")));
  await expect(installDialog).toContainText("già installata");
  await page.keyboard.press("Escape");
  await expect(installDialog).toHaveCount(0);
  expect(errors).toEqual([]);
});
