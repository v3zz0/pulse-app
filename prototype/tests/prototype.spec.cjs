const { test, expect } = require("../../frontend/node_modules/@playwright/test");
const path = require("path");
const URL = "file://" + path.resolve(__dirname, "../index.html");
const SHOTS = path.join(__dirname, "screenshots");
const MONDAY = new Date("2026-11-23T13:30:00+01:00"); // lunedì: giorno di allenamento nei dati demo

let errors;
test.beforeEach(async ({ page }) => {
  errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await page.clock.setFixedTime(MONDAY);
  await page.goto(URL);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.fill("#login-id", "atleta.demo");
  await page.fill("#login-pw", "demo-pulse-2026");
  await page.click("#login-btn");
  await expect(page.locator("h1")).toContainText("Un passo alla volta");
});
test.afterEach(() => expect(errors, "errori in console").toEqual([]));

/** Overflow orizzontale, aree di tocco ≥ 44px, screenshot. */
async function audit(page, name, info) {
  await page.waitForTimeout(400);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  expect(overflow, `overflow orizzontale in ${name}`).toBeLessThanOrEqual(0);
  const small = await page.evaluate(() => {
    const out = [];
    const root = document.querySelector("dialog[open]") || document;
    for (const el of root.querySelectorAll("button, a, select, input:not([type=checkbox]):not([type=hidden]), [role=switch], label:has(> input[type=checkbox]), summary")) {
      if (el.closest(".toast:not(.show)") || el.classList.contains("skip") || el.closest("p, li") && el.tagName === "A") continue;
      if (el.matches("label:has(> input[type=checkbox])") === false && el.closest("label.checks, .checks label")) continue;
      const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
      if (!r.width || !r.height || cs.visibility === "hidden" || el.closest("[hidden], details:not([open]) > :not(summary)")) continue;
      if (r.width < 44 - 0.5 || r.height < 44 - 0.5) out.push(`${el.tagName}.${el.className} "${(el.textContent || el.getAttribute("aria-label") || "").trim().slice(0, 30)}" ${Math.round(r.width)}×${Math.round(r.height)}`);
    }
    return out;
  });
  expect(small, `aree di tocco < 44px in ${name}`).toEqual([]);
  await page.screenshot({ path: `${SHOTS}/${info.project.name}/${name}.png`, fullPage: true });
}
const go = (page, hash) => page.evaluate((h) => (location.hash = h), hash);
const state = (page) => page.evaluate(() => window.__pulse.state());

test("Oggi: prossimo pasto, Annulla nel toast, integratori, persistenza al reload", async ({ page }, info) => {
  await audit(page, "01-oggi", info);
  await expect(page.locator("[data-testid=next-meal] h2")).toHaveText("Colazione");
  await page.click("#next-eat");
  await expect(page.locator("#toast")).toContainText("Colazione segnato");
  await expect(page.locator("[data-testid=next-meal] h2")).toHaveText("Spuntino");
  await page.click("#toast-undo");
  await expect(page.locator("[data-testid=next-meal] h2")).toHaveText("Colazione");
  await page.click("#next-eat");
  await page.click("#int-sl-d3");
  await expect(page.locator("#int-sl-d3")).toHaveAttribute("aria-pressed", "true");
  await page.reload();
  await expect(page.locator("#chk-2026-11-23-colazione")).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#int-sl-d3")).toHaveAttribute("aria-pressed", "true");
  // annullamento di un pasto consumato dalla lista
  await page.click("#chk-2026-11-23-colazione");
  await expect(page.locator("#chk-2026-11-23-colazione")).toHaveAttribute("aria-pressed", "false");
  // ripresa allenamento e domani
  await expect(page.locator("#start-today")).toBeVisible();
  await page.click("#prep-tomorrow");
  await expect(page.locator(".daybtn[aria-pressed=true]")).toContainText("24");
});

test("ON/OFF automatico per ogni giorno della settimana, override e ritorno all'automatico", async ({ page }) => {
  const expected = { 0: "OFF", 1: "ON", 2: "OFF", 3: "ON", 4: "OFF", 5: "ON", 6: "OFF" }; // demo: Lun/Mer/Ven
  for (let i = 0; i < 7; i++) {
    const t = new Date(MONDAY.getTime() + i * 86400000);
    await page.clock.setFixedTime(t);
    await page.reload();
    const wd = await page.evaluate(() => new Date().getDay());
    await expect(page.locator(".pill[data-act=modeSheet]").first()).toContainText(`Giorno ${expected[wd]} · automatico`);
  }
  await page.clock.setFixedTime(MONDAY); await page.reload();
  await page.click("#mode-2026-11-23");
  await page.click("#setmode-OFF");
  await expect(page.locator("#mode-2026-11-23")).toContainText("Giorno OFF · manuale");
  expect((await state(page)).days["2026-11-23"].override).toBe("OFF");
  await page.click("#mode-2026-11-23");
  await page.click("#setmode-auto");
  await expect(page.locator("#mode-2026-11-23")).toContainText("Giorno ON · automatico");
  // cambiando i giorni di allenamento cambia l'automatico
  await go(page, "#/tu/preferenze");
  await page.locator("[data-testid=td-1]").uncheck({ force: true });
  await page.click("#prefs-save");
  await go(page, "#/oggi");
  await expect(page.locator("#mode-2026-11-23")).toContainText("Giorno OFF · automatico");
});

test("Dieta: date, alternative, blocco se consumato, preferiti, spesa, nutrienti sconosciuti", async ({ page }, info) => {
  await go(page, "#/dieta");
  await audit(page, "02-dieta", info);
  await page.click("[data-act=mealSheet][data-key=pranzo] >> nth=0");
  await audit(page, "03-dieta-pasto", info);
  await page.click("[data-act=pickOption][data-g='0'][data-o='1']");
  expect((await state(page)).days["2026-11-23"].meals.pranzo.selections[0]).toBe(1);
  await page.click("[data-act=fav][data-oid=o-pasta]");
  await expect(page.locator("[data-act=fav][data-oid=o-pasta]")).toHaveAttribute("aria-pressed", "true");
  await page.click("#sheet-eat");
  await expect(page.locator("[data-act=pickOption]").first()).toBeDisabled();
  await page.click("#sheet [data-act=closeSheet]");
  // verdure senza valori: somme note, non zero
  await expect(page.locator(".macro .v").first()).not.toHaveText(/^0 /);
  await expect(page.locator("text=non totali completi")).toBeVisible();
  await page.click("#tab-spesa");
  await audit(page, "04-dieta-spesa", info);
  await page.locator(".grocery input").first().check();
  await page.reload();
  await page.click("#tab-spesa");
  await expect(page.locator(".grocery input").first()).toBeChecked();
  await page.click("a[aria-label='Settimana successiva']");
  await expect(page.locator(".daybtn[aria-pressed=true]")).toContainText("30");
  await expect(page.locator("details.card summary")).toContainText("Note del piano");
});

test("Allenamento: standard ≠ peso sollevato, timer, salti, ripresa dopo reload, conclusione", async ({ page }, info) => {
  await go(page, "#/allena");
  await audit(page, "05-allena", info);
  await go(page, "#/allena/A");
  await audit(page, "06-allena-scheda", info);
  await page.click("#start-detail");
  await audit(page, "07-sessione", info);
  await page.fill("#kg-A1-1", "62.5");
  await page.click("#done-set");
  let s = await state(page);
  expect(s.session.snapshot.blocks[0].sets[0].actualKg).toBe(62.5);
  expect(s.session.snapshot.blocks[0].sets[0].standardAtStart).toBe(30);
  expect(s.standardLoads["tp-1:A1-1"]).toBe(30);
  await expect(page.locator("#rest-clock")).toHaveText("1:30");
  await page.click("#rest-add");
  await expect(page.locator("#rest-clock")).toHaveText("1:45");
  await audit(page, "08-sessione-recupero", info);
  await page.reload(); // ripresa: sessione e timer persistiti
  await expect(page.locator("#rest-clock")).toHaveText("1:45");
  await expect(page.locator("[data-testid=session-count]")).toContainText("1 di");
  await page.click("#rest-skip");
  await page.click("[data-act=skipSet]");
  await page.click("#skip-block");
  await page.click("[data-act=goBlock][data-i='1']");
  await page.fill("#manual-rest", "3");
  await page.click("text=Avvia recupero");
  await expect(page.locator("#toast")).toContainText("tra 5 e 900");
  await page.fill("#manual-rest", "45");
  await page.click("text=Avvia recupero");
  await expect(page.locator("#rest-clock")).toHaveText("0:45");
  await go(page, "#/oggi");
  await expect(page.locator("#resume-btn")).toBeVisible();
  await page.click("#resume-btn");
  // aggiornamento esplicito dello standard, con conferma
  await page.click("[data-act=sessionStandard]");
  await page.fill("[name='A2-1']", "16");
  await page.click("#std-save");
  await expect(page.locator(".errbox")).toContainText("Conferma");
  await page.check("#sheet [name=ok]");
  await page.click("#std-save");
  s = await state(page);
  expect(s.standardLoads["tp-1:A2-1"]).toBe(16);
  expect(s.standardLoads["tp-1:A1-1"]).toBe(30);
  await page.click("#finish-workout");
  await page.click("#confirm-ok");
  s = await state(page);
  expect(s.session).toBeNull();
  expect(s.history.at(-1).snapshot.blocks[0].sets[0].actualKg).toBe(62.5);
  expect(s.standardLoads["tp-1:A1-1"]).toBe(30);
});

test("Allenamento: annullamento con conferma non entra nello storico", async ({ page }) => {
  await page.click("#start-today");
  await page.click("#done-set");
  const before = (await state(page)).history.length;
  await page.click("#cancel-workout");
  await expect(page.locator("#sheet")).toContainText("Hai già completato 1 serie");
  await page.click("#confirm-ok");
  const s = await state(page);
  expect(s.session).toBeNull();
  expect(s.history.length).toBe(before);
});

test("Progressi: intervalli, calendario, carichi, storico", async ({ page }, info) => {
  await go(page, "#/progressi");
  await audit(page, "09-progressi", info);
  await page.click("[data-act=period][data-v='30']");
  await page.locator("select[data-act-change=loadEx]").selectOption("Squat");
  await page.click("[aria-label='Mese precedente']");
  await expect(page.locator(".cal .d.done").first()).toBeVisible();
  await page.locator("[data-testid^=history-]").first().locator("summary").click();
  await expect(page.locator("text=standard all'avvio").first()).toBeVisible();
});

test("Promemoria: non notifica azioni già fatte, rinvio, chiusura, procedura guidata", async ({ page }, info) => {
  // 13:30 di lunedì: pranzo (12:50) e creatina (13:00) in scadenza
  let due = await page.evaluate(() => window.__pulse.dueReminders());
  expect(due).toEqual(expect.arrayContaining(["r-pranzo", "r-crea"]));
  await page.click("#chk-2026-11-23-pranzo");
  await page.evaluate(() => { const s = window.__pulse.state(); s.reminderState = {}; s.notifyLog = []; });
  const sent = await page.evaluate(() => window.__pulse.tick());
  expect(sent).not.toContain("r-pranzo");
  expect(sent).toContain("r-crea");
  const log = (await state(page)).notifyLog.map((n) => n.title);
  expect(log.some((t) => t.includes("Pranzo"))).toBe(false);
  await expect(page.locator("[data-testid=due-r-crea]")).toBeVisible();
  await page.click("[data-testid=due-r-crea] [data-min='30']");
  due = await page.evaluate(() => window.__pulse.dueReminders());
  expect(due).not.toContain("r-crea");
  await go(page, "#/tu/promemoria");
  await audit(page, "10-promemoria", info);
  await page.click("#test-notif");
  await expect(page.locator("#toast")).toContainText("Notifica di prova");
  await page.click("#rem-add");
  await page.locator("#wiz-kind").selectOption("custom");
  await page.click("#wiz-next");
  await expect(page.locator(".errbox").first()).toBeVisible();
  await page.fill("#wiz-label", "Stretching serale");
  await page.click("#wiz-next");
  await page.click("#wiz-next");
  await audit(page, "11-promemoria-orario", info);
  await page.click("#wiz-next");
  await page.click("#wiz-next");
  await expect(page.locator("text=Stretching serale").first()).toBeVisible();
  await page.click("[data-act=remToggle][data-id=r-gym]");
  expect((await state(page)).reminders.find((r) => r.id === "r-gym").settings.enabled).toBe(false);
});

test("Integratori: crea, modifica, elimina, storico con rettifica", async ({ page }, info) => {
  await go(page, "#/tu/integratori");
  await audit(page, "12-integratori", info);
  await page.click("#supp-add");
  await page.click("#supp-save");
  await expect(page.locator(".errbox")).toContainText("obbligatorio");
  await page.fill("#supp-name", "Omega 3");
  await page.fill("#supp-qty", "2");
  await page.locator("#supp-unit").selectOption("capsula");
  await page.locator("#supp-freq").selectOption("2");
  await audit(page, "13-integratore-form", info);
  await page.click("#supp-save");
  await expect(page.locator("h2", { hasText: "Omega 3" })).toBeVisible();
  await page.click("[aria-label='Modifica Omega 3']");
  await page.fill("#supp-qty", "3");
  await page.click("#supp-save");
  await expect(page.locator("text=3 capsula")).toBeVisible();
  await page.click("[aria-label='Elimina Omega 3']");
  await page.click("#confirm-ok");
  await expect(page.locator("h2", { hasText: "Omega 3" })).toHaveCount(0);
  await page.locator("[data-act=intakeFix]").first().click();
  await page.fill("#sheet [name=dose]", "2");
  await page.click("#sheet button.p");
  expect((await state(page)).intakes.some((i) => i.dose === 2 && i.audit)).toBe(true);
  await page.locator("[data-act=intakeCancel]").first().click();
  await expect(page.locator(".tag", { hasText: "Annullato" }).first()).toBeVisible();
});

test("Piani: CSV con anteprima e controllo, import, attivazione, export, testo AI, editor", async ({ page }, info) => {
  await go(page, "#/tu/piani/nutrition");
  await audit(page, "14-piani", info);
  await page.click("[data-act=csvPrompt]");
  await expect(page.locator("#ai-text")).toHaveValue(/giorno;pasto/);
  await page.locator("[data-act-change=csvPrivate]").check();
  await expect(page.locator("#ai-text")).toHaveValue(/Preferenze/);
  await page.setInputFiles("#csv-file-nutrition", { name: "rotto.csv", mimeType: "text/csv", buffer: Buffer.from("giorno;pasto;orario;menu;componente;alimento;quantita;unita;kcal;proteine_g;carboidrati_g;grassi_g\nXX;Pranzo;13:00;1;1;Riso;80;g;;;;\nON;Cena;25:00;1;1;=HYPERLINK();1;g;;;;") });
  await expect(page.locator("[data-testid=csv-preview]")).toContainText("Importazione bloccata");
  await expect(page.locator("#csv-import")).toBeDisabled();
  await page.click("#csv-try-nutrition");
  await expect(page.locator("[data-testid=csv-preview]")).toContainText("Nessun errore");
  await audit(page, "15-csv-anteprima", info);
  await expect(page.locator("#csv-import")).toBeDisabled();
  await page.check("#csv-consent");
  await page.click("#csv-import");
  const imported = (await state(page)).nutritionPlans.find((p) => p.status === "draft");
  expect(imported.days.ON.find((m) => m.name === "Pranzo").menus[0].groups[0].options[1].nutrition).toBeNull();
  const dl = page.waitForEvent("download");
  await page.click(`[data-act=planExport][data-id=${imported.id}]`);
  expect((await dl).suggestedFilename()).toMatch(/\.csv$/);
  await page.click(`[data-act=planActivate][data-id=${imported.id}]`);
  await page.click("#act-save");
  await expect(page.locator(".errbox").first()).toBeVisible();
  await page.check("#act-ok");
  await page.click("#act-save");
  expect((await state(page)).nutritionPlans.find((p) => p.id === imported.id).status).toBe("active");
  // editor visuale dieta
  await page.goto(URL + "#/tu/editor/nutrition");
  await page.click("#ed-save");
  await expect(page.locator(".errbox").first()).toBeVisible();
  await page.fill("#ed-title", "Piano editor");
  await page.fill("[data-bind='days.ON.0.name']", "Colazione");
  await page.fill("[data-bind='days.ON.0.menus.0.groups.0.options.0.text']", "Kefir");
  await page.click("#ed-adv");
  await audit(page, "16-editor-dieta", info);
  await page.click("#ed-save");
  expect((await state(page)).nutritionPlans.some((p) => p.title === "Piano editor" && p.status === "draft")).toBe(true);
});

test("Schede: editor semplice, salva e attiva con trasferimento carichi esatti", async ({ page }, info) => {
  await go(page, "#/tu/editor/training/tp-1");
  await audit(page, "17-editor-scheda", info);
  await page.fill("#ed-title", "Scheda v2");
  await page.click("#ed-activate");
  await expect(page.locator("#sheet")).toContainText("Carichi con corrispondenza esatta");
  await page.check("#act-ok");
  await page.click("#act-save");
  const s = await state(page);
  const p = s.trainingPrograms.find((x) => x.status === "active");
  expect(p.title).toBe("Scheda v2");
  expect(s.standardLoads[`${p.id}:A1-2`]).toBe(50);
  await go(page, "#/allena");
  await page.click("#organize");
  await audit(page, "18-organizza", info);
});

test("Tu, account, peso, tema, installa, azzera e login", async ({ page }, info) => {
  await go(page, "#/tu");
  await audit(page, "19-tu", info);
  await go(page, "#/tu/peso");
  await page.fill("#w-kg", "25");
  await page.click("text=Salva peso");
  await expect(page.locator(".errbox")).toContainText("30 e 300");
  await page.fill("#w-kg", "80.4");
  await page.click("text=Salva peso");
  expect((await state(page)).weights.at(-1)).toEqual({ day: "2026-11-23", kg: 80.4 });
  await go(page, "#/tu/account");
  await audit(page, "20-account", info);
  await page.fill("#acc-current", "demo-pulse-2026");
  await page.fill("#acc-new", "corta");
  await page.fill("#acc-confirm", "corta");
  await page.click("#acc-save");
  await expect(page.locator(".errbox")).toContainText("12 caratteri");
  await page.fill("#acc-new", "nuova-password-sicura");
  await page.fill("#acc-confirm", "nuova-password-sicura");
  await page.click("#acc-save");
  expect((await state(page)).auth.password).toBe("nuova-password-sicura");
  await go(page, "#/tu");
  await page.click("[data-act=installSheet]");
  await expect(page.locator("#sheet")).toContainText("Installa PULSE");
  await page.click("#sheet [data-act=closeSheet]");
  await page.click("#theme-dark");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.click("#reset-demo");
  await page.click("#confirm-ok");
  expect((await state(page)).auth.password).toBe("demo-pulse-2026");
  await go(page, "#/tu");
  await page.click("#logout");
  await audit(page, "00-login", info);
  await page.fill("#login-id", "atleta.demo");
  await page.fill("#login-pw", "sbagliata");
  await page.click("#login-btn");
  await expect(page.locator(".errbox")).toContainText("Credenziali non valide");
});

test("Tastiera: navigazione e segna pasto senza mouse", async ({ page }) => {
  await page.reload();
  await page.keyboard.press("Tab");
  await expect(page.locator(".skip")).toBeFocused();
  await page.locator("#next-eat").focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#chk-2026-11-23-colazione")).toHaveAttribute("aria-pressed", "true");
  await page.locator("#chk-2026-11-23-spuntino").focus();
  await page.keyboard.press("Space");
  await expect(page.locator("#chk-2026-11-23-spuntino")).toHaveAttribute("aria-pressed", "true");
  await page.locator("[data-act=mealSheet][data-key=pranzo]").first().focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#sheet")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator("#sheet")).toBeHidden();
});
