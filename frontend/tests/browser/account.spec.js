import { test, expect } from "@playwright/test";
import fs from "node:fs";
import { randomBytes } from "node:crypto";
const base = "http://127.0.0.1:8081";
const credentials =
  process.env.PULSE_TEST_CREDENTIALS ||
  "/tmp/pulse-phase3-test/credentials.json";
test("account: username, password, ownership e revoca altri accessi", async ({
  page,
  playwright,
}) => {
  const [user, other] = JSON.parse(fs.readFileSync(credentials));
  expect(user.email).toMatch(/^pulse-test-[12]@example.invalid$/);
  const api = await playwright.request.newContext({
    baseURL: base,
    extraHTTPHeaders: { Origin: base },
  });
  const second = await playwright.request.newContext({
    baseURL: base,
    extraHTTPHeaders: { Origin: base },
  });
  const newPassword = randomBytes(20).toString("hex");
  let changed = false;
  let original;
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  try {
    expect(
      (
        await api.post("/api/pulse/login", {
          data: { identifier: user.email, password: user.password },
        })
      ).ok(),
    ).toBeTruthy();
    original = (await (await api.get("/api/pulse/me")).json()).user.username;
    expect(
      (
        await second.post("/api/pulse/login", {
          data: { identifier: user.email, password: user.password },
        })
      ).ok(),
    ).toBeTruthy();
    expect(
      (
        await api.put("/api/pulse/profile", {
          data: { username: original, currentPassword: "wrong-password" },
        })
      ).status(),
    ).toBe(403);
    expect(
      (
        await api.put("/api/pulse/profile", {
          headers: { Origin: "https://hostile.invalid" },
          data: { username: original, currentPassword: user.password },
        })
      ).status(),
    ).toBe(403);
    expect(
      (
        await api.put("/api/pulse/profile", {
          data: { username: "bad email@", currentPassword: user.password },
        })
      ).status(),
    ).toBe(400);
    expect(
      (
        await api.put("/api/pulse/profile", {
          data: {
            username: original,
            currentPassword: user.password,
            newPassword: "short",
          },
        })
      ).status(),
    ).toBe(400);
    // Resolve the second synthetic username to verify uniqueness and ownership.
    const otherApi = await playwright.request.newContext({
      baseURL: base,
      extraHTTPHeaders: { Origin: base },
    });
    expect(
      (
        await otherApi.post("/api/pulse/login", {
          data: { identifier: other.email, password: other.password },
        })
      ).ok(),
    ).toBeTruthy();
    const otherName = (await (await otherApi.get("/api/pulse/me")).json()).user
      .username;
    expect(
      (
        await api.put("/api/pulse/profile", {
          data: { username: otherName, currentPassword: user.password },
        })
      ).status(),
    ).toBe(409);
    await page.goto(base + "/login");
    await page.getByLabel("Email o nome utente").fill(user.email);
    await page.getByLabel("Password", { exact: true }).fill(user.password);
    await page.getByRole("button", { name: "Accedi", exact: true }).click();
    await page.getByRole("link", { name: "Il tuo account" }).click();
    await page.getByRole("link", { name: "Account e password" }).click();
    await expect(
      page.getByRole("heading", { name: "Il tuo account." }),
    ).toBeVisible();
    await expect(page.locator(".demochip")).toHaveCount(0);
    await expect(page.locator(".brand")).toHaveText("PULSE");
    await expect(page.locator("body")).not.toContainText("PULSE 2.1");
    const name = "pulse_profile_" + randomBytes(5).toString("hex");
    await page.getByLabel("Nome utente", { exact: true }).fill(name);
    await page
      .getByLabel("Password attuale", { exact: true })
      .fill(user.password);
    await page.getByRole("button", { name: "Salva modifiche" }).click();
    await expect(page.getByRole("status")).toHaveText("Credenziali aggiornate");
    await page.reload();
    await expect(page.getByLabel("Nome utente", { exact: true })).toHaveValue(
      name,
    );
    expect((await second.get("/api/pulse/me")).status()).toBe(200);
    await page
      .getByLabel("Password attuale", { exact: true })
      .fill(user.password);
    await page.getByLabel("Nuova password", { exact: true }).fill(newPassword);
    await page
      .getByLabel("Conferma nuova password", { exact: true })
      .fill(newPassword);
    await page.getByRole("button", { name: "Salva modifiche" }).click();
    await expect(page.getByRole("status")).toHaveText("Credenziali aggiornate");
    changed = true;
    expect((await second.get("/api/pulse/me")).status()).toBe(401);
    expect(
      (
        await api.post("/api/pulse/login", {
          data: { identifier: user.email, password: user.password },
        })
      ).status(),
    ).toBe(401);
    expect(
      (
        await api.post("/api/pulse/login", {
          data: { identifier: name, password: newPassword },
        })
      ).status(),
    ).toBe(200);
    expect(
      (await (await otherApi.get("/api/pulse/me")).json()).user.username,
    ).toBe(otherName);
    await otherApi.dispose();
    await page.reload();
    await expect(page.getByLabel("Nome utente", { exact: true })).toHaveValue(
      name,
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy();
    await page.screenshot({
      path: `test-results/account-${test.info().project.name}.png`,
      fullPage: true,
    });
    expect(errors).toEqual([]);
  } finally {
    // Always restore only the synthetic fixture, never a personal account.
    if (original) {
      const activePassword = changed ? newPassword : user.password;
      await api.post("/api/pulse/login", {
        data: { identifier: user.email, password: activePassword },
      });
      const restored = await api.put("/api/pulse/profile", {
        data: {
          username: original,
          currentPassword: activePassword,
          ...(changed ? { newPassword: user.password } : {}),
        },
      });
      expect(restored.status()).toBe(200);
    }
    await api.dispose();
    await second.dispose();
  }
});
