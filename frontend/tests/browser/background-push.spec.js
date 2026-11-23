import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createRequire } from "node:module";
import { createECDH, randomBytes, randomUUID } from "node:crypto";
import { test, expect } from "./pwa-fixture";

const require = createRequire(import.meta.url);
const base = "http://127.0.0.1:8081";
const fixture = process.env.PULSE_WEB_PUSH_FIXTURE;
test.skip(!fixture, "Richiede lo stack locale con il broker Web Push di collaudo");

function users() {
  const result = JSON.parse(readFileSync(join(fixture, "users.json"), "utf8"));
  for (const user of result) expect(user.email).toMatch(/^pulse-bg-[a-f0-9]+-[01]@example\.invalid$/);
  return result;
}
async function api(request, path, method = "GET", data, status = 200) {
  const response = await request.fetch(base + "/api/pulse" + path, {
    method, headers: { Origin: base }, data,
  });
  expect(response.status(), path).toBe(status);
  return status === 204 ? null : response.json();
}
async function login(page, user) {
  await page.goto(base + "/login");
  await page.getByLabel("Email o nome utente").fill(user.email);
  await page.getByLabel("Password", { exact: true }).fill(user.password);
  await page.getByRole("button", { name: "Accedi", exact: true }).click();
  await expect(page.getByRole("link", { name: "Oggi", exact: true })).toBeVisible();
}
const rome = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit" }).format();
const weekdays = [0, 1, 2, 3, 4, 5, 6];

test("Home filtra, salva, riprende offline e aggiorna la giornata", async ({ context, page }) => {
  const [, user] = users();
  await login(page, user);
  const name = "Creatina test " + randomUUID().slice(0, 6);
  const product = await api(context.request, "/supplements", "POST", {
    confirm: true, daily: true, revision: 0, clientId: randomUUID(),
    data: { name, quantity: 2.5, unit: "g", timezone: "Europe/Rome", slots: [
      { id: randomUUID(), at: "20:00" }, { id: randomUUID(), at: "08:00" },
    ] },
  });
  try {
    await page.reload();
    const intake = page.getByRole("article").filter({ has: page.getByRole("heading", { name, exact: true }) });
    await expect(intake).toHaveCount(2);
    await expect(intake.first()).toContainText("08:00");
    await expect(intake.first()).toContainText("2.5 g");
    await intake.first().getByRole("button", { name: /Segna assunto/ }).click();
    await expect(intake).toHaveCount(1);
    await expect(intake.first()).toContainText("20:00");
    await expect.poll(async () => (await api(context.request, "/supplements/history")).filter((r) => r.name === name && r.status === "taken").length).toBe(1);
    await page.evaluate(() => navigator.serviceWorker.ready);
    await context.setOffline(true);
    try {
      await intake.first().getByRole("button", { name: /Segna assunto/ }).click();
      await expect(intake).toHaveCount(0);
      await expect(page.getByText("1 in attesa di sincronizzazione")).toBeVisible();
      await page.reload();
      await expect(page.getByText("1 in attesa di sincronizzazione")).toBeVisible();
    } finally { await context.setOffline(false); }
    await expect(page.getByText("Tutti gli integratori assunti per oggi")).toBeVisible();
    await page.reload();
    await expect(page.getByText("Tutti gli integratori assunti per oggi")).toBeVisible();
    await page.getByRole("link", { name: "Storico assunzioni" }).click();
    const recorded = page.locator("#storico article").filter({ hasText: name });
    await expect(recorded).toHaveCount(2);
    await recorded.first().getByRole("button", { name: "Rettifica quantità" }).click();
    await recorded.first().getByLabel("Quantità assunta").fill("3 g");
    await recorded.first().getByRole("button", { name: "Salva rettifica" }).click();
    await expect(recorded.first()).toContainText("3 g");
    page.once("dialog", (dialog) => dialog.accept());
    await recorded.first().getByRole("button", { name: "Annulla registrazione" }).click();
    await expect(recorded.first()).toContainText("Annullata");
    await page.getByRole("link", { name: "Oggi", exact: true }).click();
    await expect(intake).toHaveCount(1);
    await page.clock.setFixedTime(new Date(Date.now() + 86400000));
    await page.evaluate(() => window.dispatchEvent(new Event("online")));
    await expect(intake).toHaveCount(2);
  } finally {
    await api(context.request, "/supplements/" + product.id, "PUT",
      { action: "delete", confirm: true, revision: product.revision });
  }
});

test("job PostgreSQL → consegna cifrata → Service Worker a pagina chiusa", async ({ context, page, playwright }) => {
  test.setTimeout(150000);
  const ece = require("../../../backend/node_modules/http_ece");
  const [user, other] = users();
  await context.grantPermissions(["notifications"], { origin: base });
  const token = "pulse-test-" + randomUUID();
  const endpoint = "https://fcm.googleapis.com/fcm/send/" + token;
  const receiver = createECDH("prime256v1");
  receiver.generateKeys();
  const authSecret = randomBytes(16);
  const subscription = { endpoint, expirationTime: null, keys: {
    p256dh: receiver.getPublicKey().toString("base64url"), auth: authSecret.toString("base64url"),
  } };
  await page.addInitScript((data) => {
    const sub = { ...data, toJSON: () => data, unsubscribe: async () => {
      localStorage.removeItem("pulse-test-push"); return true;
    } };
    PushManager.prototype.getSubscription = async () => localStorage.getItem("pulse-test-push") ? sub : null;
    PushManager.prototype.subscribe = async () => {
      localStorage.setItem("pulse-test-push", "1"); return sub;
    };
  }, subscription);
  await login(page, user);
  // A cancelled prior test may have left its reminders in the synthetic account.
  for (const row of await api(context.request, "/reminders")) {
    if (row.settings.label === "Promemoria sintetico" || row.settings.label.startsWith("Integratore sintetico pulse-test-"))
      await api(context.request, "/reminders/" + row.id, "PUT", { action: "delete", revision: row.revision }, 204);
  }
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.goto(base + "/altro/promemoria");
  await page.getByRole("button", { name: "Attiva notifiche push" }).click();
  await expect(page.getByText("Notifiche push attive su questo dispositivo.")).toBeVisible();
  expect(await api(context.request, "/push/status")).toEqual({ publicKey: expect.any(String), registered: true });
  const foreign = await playwright.request.newContext();
  await api(foreign, "/login", "POST", { identifier: other.email, password: other.password });
  expect((await api(foreign, "/push/status")).registered).toBe(false);
  await api(foreign, "/push/device", "PUT", subscription, 409);
  await api(context.request, "/push/device", "PUT", { ...subscription, endpoint: "https://127.0.0.1/internal" }, 400);

  function outbound() {
    try {
      return readFileSync(join(fixture, "deliveries.jsonl"), "utf8").trim().split("\n")
        .filter(Boolean).map(JSON.parse).filter((r) => r.path.endsWith(token));
    } catch (e) {
      if (e.code === "ENOENT") return [];
      throw e;
    }
  }
  const decode = (delivery) => {
    expect(delivery).toMatchObject({ code: 201, vapid: true, ttl: 120, encoding: "aes128gcm" });
    const payload = JSON.parse(ece.decrypt(Buffer.from(delivery.payload, "base64"), {
      version: "aes128gcm", privateKey: receiver, authSecret,
    }).toString("utf8"));
    expect(payload).toEqual({ receipt: expect.stringMatching(/^[a-f0-9-]{36}$/) });
    return payload;
  };
  const control = await context.newPage();
  const client = await context.newCDPSession(control);
  let registrationId;
  client.on("ServiceWorker.workerRegistrationUpdated", ({ registrations }) => {
    for (const r of registrations) if (r.scopeURL === base + "/" && !r.isDeleted) registrationId = r.registrationId;
  });
  await client.send("ServiceWorker.enable");
  await expect.poll(() => registrationId).toBeTruthy();
  const deliver = (payload) => client.send("ServiceWorker.deliverPushMessage",
    { origin: base, registrationId, data: JSON.stringify(payload) });
  const notices = (tab) => tab.evaluate(async () => {
    const reg = await navigator.serviceWorker.getRegistration("/");
    return (await reg.getNotifications()).map((n) => ({ tag: n.tag, body: n.body }));
  });
  await page.getByRole("button", { name: "Invia notifica di prova" }).click();
  await expect.poll(() => outbound().length).toBe(1);
  const preview = decode(outbound()[0]);
  await api(foreign, "/push/messages/" + preview.receipt, "POST", {}, 204);
  await deliver(preview);
  await expect.poll(() => notices(page)).toEqual([
    { tag: "pulse-push-test", body: "La notifica di prova è arrivata." },
  ]);
  await page.evaluate(async () => {
    for (const n of await (await navigator.serviceWorker.ready).getNotifications()) n.close();
  });

  const product = await api(context.request, "/supplements", "POST", {
    confirm: true, daily: true, revision: 0, clientId: randomUUID(), data: {
      name: "Integratore sintetico " + token, quantity: 1, unit: "g", timezone: "Europe/Rome",
      slots: [{ id: randomUUID(), at: "00:00" }],
    },
  });
  const active = randomUUID(), suppressed = randomUUID(), disabled = randomUUID();
  const settings = { kind: "custom", label: "Promemoria sintetico", enabled: true, at: "00:00", weekdays, timezone: "Europe/Rome" };
  const save = (id, data) => api(context.request, "/reminders/" + id, "PUT", data);
  try {
    await api(context.request, "/intakes/" + rome(), "PUT", {
      productId: product.id, slot: product.schedule[0].id, revision: 0, confirm: true, status: "taken",
    });
    await save(suppressed, { action: "settings", revision: 0, settings: {
      ...settings, kind: "supplement", target: String(product.id),
    } });
    const off = await save(disabled, { action: "settings", revision: 0, settings: { ...settings, enabled: false } });
    const before = Date.now();
    await save(active, { action: "settings", revision: 0, settings });
    await page.close();
    expect(page.isClosed()).toBe(true);
    expect(context.pages().every((tab) => tab.url() === "about:blank")).toBe(true);
    await expect.poll(() => outbound().length, { timeout: 50000 }).toBe(2);
    const reminder = decode(outbound()[1]);
    const claimed = context.waitForEvent("response", {
      predicate: (response) => response.url().endsWith("/push/messages/" + reminder.receipt)
        && response.status() === 200,
    });
    await deliver(reminder);
    const response = await claimed;
    expect(await response.request().headerValue("origin")).toBe(base);
    expect(context.pages().every((tab) => tab.url() === "about:blank")).toBe(true);
    // The worker reached the authenticated API while all PULSE pages were closed.
    await control.goto(base + "/favicon-16x16.png");
    const tag = "pulse-" + active + "-" + rome();
    await expect.poll(() => notices(control)).toEqual([{ tag, body: "Hai un promemoria da controllare in PULSE." }]);
    await api(context.request, "/push/messages/" + reminder.receipt, "POST", {}, 204);
    await control.goto(base + "/");
    await expect(control.getByRole("region", { name: "Promemoria in scadenza" })).toContainText(settings.label);
    await expect.poll(() => notices(control)).toHaveLength(1);
    let row = (await api(context.request, "/reminders")).find((r) => r.id === active);
    row = await save(active, { action: "snooze", minutes: 15, date: rome(), revision: row.revision });
    expect((await api(context.request, "/reminders/due")).some((r) => [active, suppressed, disabled].includes(r.id))).toBe(false);
    await save(disabled, { action: "toggle", enabled: false, revision: off.revision });
    row = await save(active, { action: "settings", revision: row.revision, settings: { ...settings, enabled: false } });
    await api(context.request, "/reminders/" + active, "PUT", { action: "delete", revision: row.revision }, 204);
    await new Promise((resolve) => setTimeout(resolve, Math.max(0, before + 33000 - Date.now())));
    expect(outbound()).toHaveLength(2);
  } finally {
    for (const row of await api(context.request, "/reminders")) {
      if ([active, suppressed, disabled].includes(row.id))
        await api(context.request, "/reminders/" + row.id, "PUT", { action: "delete", revision: row.revision }, 204);
    }
    await api(context.request, "/supplements/" + product.id, "PUT", { action: "delete", confirm: true, revision: product.revision });
    await foreign.dispose();
    await api(context.request, "/push/device", "DELETE", undefined, 204);
  }
  expect((await api(context.request, "/push/status")).registered).toBe(false);
  await api(context.request, "/push/device", "PUT", { ...subscription, endpoint: endpoint + "-gone" }, 204);
  await api(context.request, "/push/test", "POST", {}, 410);
  expect((await api(context.request, "/push/status")).registered).toBe(false);
  await api(context.request, "/push/device", "PUT", subscription, 204);
  await api(context.request, "/logout", "POST", {}, 204);
  await api(context.request, "/push/status", "GET", undefined, 401);
  await api(context.request, "/login", "POST", { identifier: other.email, password: other.password });
  expect((await api(context.request, "/push/status")).registered).toBe(false);
  await api(context.request, "/push/messages/" + preview.receipt, "POST", {}, 204);
});
