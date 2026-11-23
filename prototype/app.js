/* PULSE · prototipo UX (HTML/CSS/JS puri, nessuna dipendenza).
   Stato in localStorage; forma dati allineata alle API reali (vedi data.js).
   ponytail: render completo via innerHTML a ogni azione; basta per un prototipo, nell'app Vue lo fa la reattività. */
"use strict";

/* ---------- Utilità ---------- */
const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const pad = (n) => String(n).padStart(2, "0");
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return iso(d); };
const today = () => iso(new Date());
const wd = (s) => parse(s).getDay();
const hm = (d = new Date()) => pad(d.getHours()) + ":" + pad(d.getMinutes());
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const clone = (o) => JSON.parse(JSON.stringify(o));
const num = new Intl.NumberFormat("it-IT", { maximumFractionDigits: 1 });
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const fmtDate = (s) => cap(parse(s).toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" }));
const fmtShort = (s) => parse(s).toLocaleDateString("it-IT", { day: "numeric", month: "short" });
const DAYS = ["Dom", "Lun", "Mar", "Mer", "Gio", "Ven", "Sab"];
const WEEK = [1, 2, 3, 4, 5, 6, 0];
const daysLabel = (arr) => arr.length === 7 ? "Tutti i giorni" : WEEK.filter((d) => arr.includes(d)).map((d) => DAYS[d]).join(" · ") || "Nessun giorno";
const qty = (o) => o.quantity != null ? ` ${num.format(o.quantity)} ${o.unit || ""}`.trimEnd() : "";
const localOf = (isoTs) => iso(new Date(isoTs));

const P = {
  home: "M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z", food: "M7 3v8M5 3v5a2 2 0 0 0 4 0V3M7 11v10M17 21V3c-2 0-3 3-3 6s1 4 3 4",
  gym: "M6 7v10M3 9v6M18 7v10M21 9v6M6 12h12", chart: "M4 20V10M10 20V4M16 20v-7M22 20H2", user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c1-4 4-6 8-6s7 2 8 6",
  check: "M5 12l5 5 9-10", plus: "M12 5v14M5 12h14", x: "M6 6l12 12M18 6L6 18", right: "M9 6l6 6-6 6", left: "M15 6l-6 6 6 6", up: "M6 15l6-6 6 6", down: "M6 9l6 6 6-6",
  bell: "M6 16v-5a6 6 0 0 1 12 0v5l2 2H4zM10 21h4", pill: "M8.5 15.5l7-7a3.5 3.5 0 0 0-5-5l-7 7a3.5 3.5 0 0 0 5 5zM7 7l5 5",
  star: "M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z", edit: "M4 20h4L19 9l-4-4L4 16zM14 6l4 4", trash: "M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13",
  play: "M7 4l13 8-13 8z", pause: "M8 5v14M16 5v14", scale: "M4 4h16v16H4zM8 10a4 4 0 0 1 8 0M12 10l2-2", cal: "M4 6h16v14H4zM4 10h16M8 3v4M16 3v4",
  download: "M12 4v12M6 10l6 6 6-6M4 20h16", pulse: "M2 12h5l3-7 4 14 3-7h5", logout: "M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10", file: "M6 3h8l4 4v14H6zM14 3v4h4",
  sun: "M12 4V2M12 22v-2M4 12H2M22 12h-2M6 6L5 5M19 19l-1-1M6 18l-1 1M19 5l-1 1M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z", copy: "M8 8h12v12H8zM4 16V4h12",
};
const icon = (n) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${P[n]}"/></svg>`;

/* ---------- Stato ---------- */
const KEY = "pulse-demo-v1";
let S = loadState();
function loadState() {
  try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && s.v === 1) return s; } catch { /* stato corrotto: riparte dal seed */ }
  return window.PULSE_SEED(new Date());
}
const save = () => localStorage.setItem(KEY, JSON.stringify(S));
const ui = { dietTab: "pasti", period: 90, loadEx: null, calMonth: null, editor: null, editorKey: "", form: {}, wiz: null, csv: {}, errors: [] };

/* ---------- Dominio: giornata, pasti, ON/OFF ---------- */
const activePlan = () => S.nutritionPlans.find((p) => p.status === "active");
const activeProgram = () => S.trainingPrograms.find((p) => p.status === "active");
const autoMode = (d) => (S.settings.trainingDays.includes(wd(d)) ? "ON" : "OFF");
const modeOf = (d) => S.days[d]?.override || autoMode(d);
const isAuto = (d) => !S.days[d]?.override;
const planOf = (d) => S.nutritionPlans.find((p) => p.id === S.days[d]?.planId) || activePlan();
function ensureDay(d) {
  return (S.days[d] ||= { planId: activePlan()?.id || null, revision: 0, override: null, meals: {}, shopping: {} });
}
function mealsOf(d) {
  const p = planOf(d); if (!p) return [];
  const rec = S.days[d];
  return (p.days[modeOf(d)] || []).map((m) => ({ ...m, st: rec?.meals[m.key] || {} }));
}
const anyConsumed = (d) => mealsOf(d).some((m) => m.st.consumedAt);
function choice(m) {
  const menu = m.menus[m.st.menuIndex || 0] || m.menus[0];
  return menu.groups.map((g, i) => g.options[m.st.selections?.[i] || 0] || g.options[0]);
}
const mealText = (m) => choice(m).map((o) => (o ? o.text + qty(o) : "Da verificare")).join(" · ");
const NUTR = [["kcal", "Energia", "kcal"], ["protein_g", "Proteine", "g"], ["carbs_g", "Carboidrati", "g"], ["fat_g", "Grassi", "g"]];
function nutrients(d) {
  // Valori sconosciuti restano null: mai sostituiti da zero.
  const values = {}, unknown = {};
  for (const m of mealsOf(d)) for (const o of choice(m)) for (const [k] of NUTR) {
    const v = o?.nutrition?.[k];
    if (v == null) unknown[k] = true; else values[k] = (values[k] || 0) + v;
  }
  return { values, unknown };
}
function shopping(d) {
  const map = new Map();
  for (const m of mealsOf(d)) for (const o of choice(m)) {
    if (!o) continue;
    const id = `${o.text}|${o.quantity ?? ""}|${o.unit ?? ""}`;
    const it = map.get(id) || { id, label: o.text + qty(o), servings: 0 };
    it.servings++; map.set(id, it);
  }
  return [...map.values()].map((i) => ({ ...i, checked: !!S.days[d]?.shopping[i.id] }));
}

/* Integratori */
function suppDue(d) {
  const mode = modeOf(d), out = [];
  for (const p of S.supplements) {
    if (!p.active || !p.weekdays.includes(wd(d)) || (p.mode !== "always" && p.mode !== mode)) continue;
    for (const slot of p.schedule) out.push({ p, slot, intake: S.intakes.find((i) => i.productId === p.id && i.slotId === slot.id && i.day === d && i.status === "taken") });
  }
  return out.sort((a, b) => (a.slot.at || "99").localeCompare(b.slot.at || "99"));
}

/* Allenamento */
const dayName = (prog, k) => prog?.displaySettings?.days?.[k]?.name || "Scheda " + k;
const suggestedDay = (d) => { const p = activeProgram(); return p ? Object.keys(p.days).find((k) => p.displaySettings?.days?.[k]?.weekdays?.includes(wd(d))) : null; };
const workoutDoneOn = (d) => S.history.some((h) => h.status === "completed" && localOf(h.completedAt) === d);
const stdKey = (progId, setId) => progId + ":" + setId;
function lastResult(setId) {
  for (let i = S.history.length - 1; i >= 0; i--) for (const b of S.history[i].snapshot.blocks) for (const s of b.sets)
    if (s.id === setId && s.status === "recorded") return s;
  return null;
}
const sessionSets = () => (S.session ? S.session.snapshot.blocks.flatMap((b) => b.sets) : []);

/* ---------- Promemoria ---------- */
const KINDS = { meal: ["Pasto", "food"], supplement: ["Integratore", "pill"], workout: ["Allenamento", "gym"], weight: ["Peso", "scale"], custom: ["Personalizzato", "bell"] };
function reminderLabel(r) {
  const s = r.settings;
  if (s.label) return s.label;
  if (s.kind === "meal") return [...(activePlan()?.days.ON || []), ...(activePlan()?.days.OFF || [])].find((m) => m.key === s.target)?.name || "Pasto";
  if (s.kind === "supplement") { const [pid] = s.target.split(":"); return S.supplements.find((p) => p.id === pid)?.name || "Integratore"; }
  return { workout: "Allenamento", weight: "Registra il peso" }[s.kind] || "Promemoria";
}
function reminderDone(r, d) {
  const s = r.settings;
  if (s.kind === "meal") { const m = mealsOf(d).find((x) => x.key === s.target); return !m || !!m.st.consumedAt; }
  if (s.kind === "supplement") { const [pid, sid] = s.target.split(":"); const x = suppDue(d).find((y) => y.p.id === pid && y.slot.id === sid); return !x || !!x.intake; }
  if (s.kind === "workout") return modeOf(d) !== "ON" || workoutDoneOn(d) || !!S.session;
  if (s.kind === "weight") return S.weights.some((w) => w.day === d);
  return false;
}
function dueReminders(now = new Date()) {
  const d = iso(now), t = hm(now);
  return S.reminders.filter((r) => {
    const s = r.settings, st = S.reminderState[r.id] || {};
    if (!s.enabled || !s.weekdays.includes(now.getDay()) || s.at > t || st.ackDay === d) return false;
    if (st.snoozedUntil && new Date(st.snoozedUntil) > now) return false;
    return !reminderDone(r, d); // Non notificare un'azione già fatta.
  });
}
function reminderBody(r) {
  const s = r.settings, d = today();
  if (s.kind === "meal") { const m = mealsOf(d).find((x) => x.key === s.target); return m ? `${m.name} delle ${m.time}: ${mealText(m)}` : ""; }
  if (s.kind === "supplement") { const [pid] = s.target.split(":"); const p = S.supplements.find((x) => x.id === pid); return p ? `${p.name} · ${num.format(p.quantity)} ${p.unit}` : ""; }
  if (s.kind === "workout") { const k = suggestedDay(d); return k ? "Oggi: " + dayName(activeProgram(), k) : "È un giorno di allenamento"; }
  if (s.kind === "weight") return "Non hai ancora registrato il peso di oggi.";
  return s.label;
}
function notify(title, body) {
  /* Aggancio app reale: qui l'app Vue usa il web push (frontend/src/web-push.js:
     iscrizione PushManager + POST /api/pulse/push/subscribe; il server invia via VAPID anche a pagina chiusa).
     Nel prototipo: Notification API a pagina aperta, con fallback a toast. */
  (S.notifyLog ||= []).push({ at: new Date().toISOString(), title, body });
  S.notifyLog = S.notifyLog.slice(-30); save();
  if ("Notification" in window && Notification.permission === "granted") {
    try { new Notification(title, { body, tag: title }); return "system"; } catch { /* alcuni browser mobili richiedono il service worker */ }
  }
  toast(`${title}: ${body}`);
  return "toast";
}
function tick(now = new Date()) {
  if (!S.auth.loggedIn) return [];
  const sent = [];
  for (const r of dueReminders(now)) {
    const st = (S.reminderState[r.id] ||= {});
    const key = iso(now) + "|" + (st.snoozedUntil || "");
    if (st.notified === key) continue;
    st.notified = key; sent.push(r.id);
    notify(reminderLabel(r), reminderBody(r));
  }
  if (sent.length) { save(); if ((location.hash || "#/oggi").startsWith("#/oggi")) render(); }
  return sent;
}

/* ---------- Infrastruttura UI ---------- */
let sheetRender = null, sheetClose = null, pendingOk = null, lastRoute = "", toastTimer = 0, toastUndo = null, installPrompt = null;
const SCREENS = {}, A = {}, SUBMIT = {};

function applyTheme() {
  const t = S.settings.theme === "auto" ? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : S.settings.theme;
  document.documentElement.dataset.theme = t;
  $('meta[name="theme-color"]').content = t === "dark" ? "#1b1715" : "#f6f1e8";
}
function render() {
  const app = $("#app"); app.removeAttribute("aria-busy"); applyTheme();
  const focusId = document.activeElement?.id;
  if (!S.auth.loggedIn) { app.innerHTML = screenLogin(); return; }
  const parts = (location.hash.slice(2) || "oggi").split("/");
  const name = SCREENS[parts[0]] ? parts[0] : "oggi";
  const routeKey = parts.join("/"), changed = routeKey !== lastRoute; lastRoute = routeKey;
  const body = SCREENS[name](...parts.slice(1));
  const resume = S.session && name !== "sessione";
  app.className = resume ? "has-resume" : "";
  app.innerHTML = name === "sessione"
    ? `<main id="main" tabindex="-1"><div class="wrap ${changed ? "fadein" : ""}">${body}</div></main>`
    : `<div class="shell">${nav(name)}<main id="main" tabindex="-1"><div class="wrap ${changed ? "fadein" : ""}">${body}</div></main></div>${resume ? resumeBar() : ""}`;
  if (sheetRender && $("#sheet").open) $("#sheet-body").innerHTML = sheetRender();
  if (focusId) document.getElementById(focusId)?.focus({ preventScroll: true });
}
const TABS = [["oggi", "Oggi", "home"], ["dieta", "Dieta", "food"], ["allena", "Allena", "gym"], ["progressi", "Progressi", "chart"], ["tu", "Tu", "user"]];
function nav(name) {
  const cur = name === "sessione" ? "allena" : name;
  return `<nav class="nav" aria-label="Navigazione principale"><div class="brand">${icon("pulse")}PULSE</div>${TABS.map(([k, l, i]) =>
    `<a class="navitem" href="#/${k}" ${cur === k ? 'aria-current="page"' : ""}>${icon(i)}<span>${l}</span></a>`).join("")}</nav>`;
}
function resumeBar() {
  const sets = sessionSets(), done = sets.filter((s) => s.status !== "pending").length;
  return `<div class="resume" role="region" aria-label="Allenamento in corso"><span style="flex:1"><b>Allenamento in corso</b><br><small>${esc(S.session.snapshot.title)} · ${done}/${sets.length} serie</small></span><a class="btn sm" href="#/sessione" id="resume-btn">Riprendi</a></div>`;
}
function openSheet(fn, onClose) {
  sheetRender = fn; sheetClose = onClose || null;
  const d = $("#sheet"); $("#sheet-body").innerHTML = fn();
  if (!d.open) d.showModal();
  ($("#sheet [autofocus]") || $("#sheet .sheet-head button"))?.focus();
}
const closeSheet = () => { const d = $("#sheet"); if (d.open) d.close(); };
const sheet = (title, inner) => `<div class="sheet-in"><div class="grab" aria-hidden="true"></div><div class="sheet-head"><h2 id="sheet-title">${title}</h2><button type="button" class="iconbtn" data-act="closeSheet" aria-label="Chiudi">${icon("x")}</button></div>${inner}</div>`;
function confirmSheet({ title, text, ok = "Conferma", danger = false, onOk }) {
  pendingOk = onOk;
  openSheet(() => sheet(title, `<p>${text}</p><div class="sheet-actions"><button type="button" class="btn" data-act="closeSheet" autofocus>Indietro</button><button type="button" class="btn ${danger ? "danger" : "p"}" data-act="confirmOk" id="confirm-ok">${ok}</button></div>`));
}
function toast(msg, undo) {
  $("#toast-msg").textContent = msg;
  const b = $("#toast-undo"); b.hidden = !undo; toastUndo = undo || null;
  const t = $("#toast"); t.classList.add("show");
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove("show"), undo ? 5000 : 3500);
}
/** Muta lo stato, salva, ridisegna; opzionale toast con Annulla che ripristina lo stato precedente. */
function commit(mutate, msg, undoable = true) {
  const before = clone(S);
  const res = mutate(); if (res === false) return;
  save(); render();
  if (msg) toast(msg, undoable ? () => { S = before; save(); render(); toast("Annullato"); } : null);
}
const go = (h) => { location.hash = h; };
const errBox = () => ui.errors.length ? `<div class="errbox" role="alert">${ui.errors.map(esc).join("<br>")}</div>` : "";

/* ---------- Schermata: Login ---------- */
function screenLogin() {
  return `<main id="main" class="login"><form class="card" data-submit="login" novalidate>
    <p class="kicker">${icon("pulse").replace("<svg", '<svg width="22" height="22" style="vertical-align:-5px;color:var(--acc)"')} PULSE · il tuo spazio privato</p>
    <h1 class="hero-title">Bentornato<em>.</em></h1>
    <label class="f" for="login-id">Email o nome utente<input id="login-id" name="id" class="field" autocomplete="username" required></label>
    <label class="f" for="login-pw">Password<input id="login-pw" name="pw" type="password" class="field" autocomplete="current-password" required></label>
    ${errBox()}
    <button class="btn p wide" style="margin-top:16px" id="login-btn">Accedi</button>
    <p class="note">Prototipo con dati sintetici. Accesso demo: <b>atleta.demo</b> · <b>demo-pulse-2026</b></p>
  </form></main>`;
}
SUBMIT.login = (f, fd) => {
  const id = fd.get("id").trim(), pw = fd.get("pw");
  ui.errors = [];
  if (!id || !pw) ui.errors.push("Inserisci nome utente e password.");
  else if ((id !== S.auth.username && id !== S.auth.email) || pw !== S.auth.password) ui.errors.push("Credenziali non valide.");
  if (ui.errors.length) { render(); $("#login-id")?.focus(); return; }
  S.auth.loggedIn = true; save(); go("#/oggi"); render(); tick();
};

/* ---------- Schermata: Oggi ---------- */
const modeChip = (d) => `<button type="button" class="pill" data-act="modeSheet" data-date="${d}" id="mode-${d}">Giorno <b class="${modeOf(d)}">${modeOf(d)}</b> · ${isAuto(d) ? "automatico" : "manuale"}</button>`;
function mealRow(d, m) {
  const done = !!m.st.consumedAt, future = d > today();
  return `<div class="item ${done ? "done" : ""}" data-swipe="meal" data-date="${d}" data-key="${m.key}" data-testid="meal-${m.key}">
    <button type="button" class="check" aria-pressed="${done}" aria-label="${done ? "Annulla pasto" : "Segna mangiato"}: ${esc(m.name)}" data-act="toggleMeal" data-date="${d}" data-key="${m.key}" id="chk-${d}-${m.key}" ${future ? "disabled" : ""}>${icon(done ? "check" : "plus")}</button>
    <button type="button" class="linkrow" data-act="mealSheet" data-date="${d}" data-key="${m.key}" aria-label="Alternative e dettagli: ${esc(m.name)}"><span class="t">${esc(m.name)}</span><small>${esc(mealText(m))}</small></button>
    <span class="side">${m.time || ""}</span></div>`;
}
function provenanceNote(p) {
  if (!p || p.provenance === "manual") return "";
  return `<p class="note">${p.provenance === "csv" ? "Piano importato: verifica fonti e revisione con il professionista." : "Piano storico: da rivedere con il professionista."}</p>`;
}
SCREENS.oggi = () => {
  const d = today(), meals = mealsOf(d), mode = modeOf(d), next = meals.find((m) => !m.st.consumedAt);
  const supps = suppDue(d), prog = activeProgram(), key = suggestedDay(d), wDone = workoutDoneOn(d);
  const train = mode === "ON" && !!key;
  const mealsDone = meals.filter((m) => m.st.consumedAt).length, suppDone = supps.filter((s) => s.intake).length;
  const total = meals.length + supps.length + (train ? 1 : 0), done = mealsDone + suppDone + (train && wDone ? 1 : 0);
  const pct = total ? Math.round((100 * done) / total) : 0;
  const h = new Date().getHours(), greet = h < 13 ? "Buongiorno" : h < 18 ? "Buon pomeriggio" : "Buonasera";
  const due = dueReminders();
  const tom = addDays(d, 1), tomPrepared = (S.days[tom]?.revision || 0) > 0;
  const lastW = S.weights.at(-1);
  let workoutCard;
  if (S.session) workoutCard = `<h2>Allenamento in corso</h2><p>${esc(S.session.snapshot.title)}</p><a class="btn p wide" href="#/sessione">Riprendi allenamento</a>`;
  else if (train && wDone) workoutCard = `<h2>Allenamento fatto</h2><p>${esc(dayName(prog, key))} completato oggi. Ottimo lavoro.</p><a class="btn wide" href="#/progressi">Vedi progressi</a>`;
  else if (train) workoutCard = `<p class="kicker">Allenamento di oggi</p><h2>${esc(dayName(prog, key))}</h2><p>${esc(prog.displaySettings.days[key].description || "")} · ${prog.days[key].length} esercizi</p>
    <div class="row"><button type="button" class="btn p" style="flex:1" data-act="startWorkout" data-day="${key}" id="start-today">${icon("play")} Inizia</button><a class="btn" href="#/allena/${key}">Vedi scheda</a></div>`;
  else workoutCard = `<h2>Giorno di riposo</h2><p>Recupera bene. Se vuoi allenarti comunque, scegli una scheda.</p><a class="btn wide" href="#/allena">Scegli scheda</a>`;
  return `
  <div class="top"><span class="kicker">${fmtDate(d)}</span><a class="iconbtn" href="#/tu/account" aria-label="Il tuo account" style="font-family:var(--serif);font-size:18px">${esc(S.auth.username[0].toUpperCase())}</a></div>
  <h1 class="hero-title">${greet}.<br><em>Un passo alla volta.</em></h1>
  ${modeChip(d)}
  <div class="cols">
    <div>
      <section class="card ringwrap" aria-label="Progresso della giornata">
        <div class="ring" style="--p:${pct}" role="img" aria-label="Giornata completata al ${pct}%"><span>${pct}%</span></div>
        <div><h2>La tua giornata</h2><p class="muted small">${mealsDone} di ${meals.length} pasti · ${supps.length - suppDone} integratori da prendere${train ? " · allenamento " + (wDone ? "fatto" : "da fare") : ""}</p></div>
      </section>
      ${!meals.length ? `<section class="card empty"><p class="big">Nessun piano attivo</p><p>Crea o importa un piano alimentare per vedere i pasti di oggi.</p><a class="btn p" href="#/tu/piani/nutrition">Vai ai piani</a></section>`
      : next ? `<section class="card soft next" data-testid="next-meal"><p class="kicker">Prossimo pasto · ${next.time}</p><h2>${esc(next.name)}</h2><p>${esc(mealText(next))}</p>
        <div class="row"><button type="button" class="btn p" style="flex:1" data-act="toggleMeal" data-date="${d}" data-key="${next.key}" id="next-eat">${icon("check")} Mangiato</button><button type="button" class="btn" style="flex:1" data-act="mealSheet" data-date="${d}" data-key="${next.key}" id="next-swap">Sostituisci</button></div></section>`
      : `<section class="card soft empty"><p class="big">Tutti i pasti segnati</p><p>Giornata alimentare completa. Puoi annullare un pasto dalla lista.</p></section>`}
      ${meals.length ? `<section class="card"><div class="top"><h2>Pasti di oggi</h2><span class="tag">Scorri per segnare</span></div><div class="list">${meals.map((m) => mealRow(d, m)).join("")}</div>${provenanceNote(planOf(d))}</section>` : ""}
    </div>
    <div>
      ${due.length ? `<section class="card" aria-label="Promemoria in scadenza" style="border-color:var(--acc)"><h2>Da fare adesso</h2>${due.map((r) => `<div style="margin-top:12px" data-testid="due-${r.id}"><p><b>${esc(reminderLabel(r))}</b> · ${KINDS[r.settings.kind][0]} · ${r.settings.at}</p>
        <div class="row">${[15, 30, 60].map((m) => `<button type="button" class="btn sm" data-act="snooze" data-id="${r.id}" data-min="${m}" aria-label="Rinvia di ${m} minuti">+${m} min</button>`).join("")}<button type="button" class="btn sm" data-act="ack" data-id="${r.id}">Chiudi per oggi</button></div></div>`).join("")}</section>` : ""}
      <section class="card" aria-labelledby="supp-h"><div class="top"><h2 id="supp-h">Integratori di oggi</h2><a class="chev" href="#/tu/integratori">Gestisci</a></div>
        ${supps.length ? `<div class="list">${supps.map((x) => `<div class="item ${x.intake ? "done" : ""}" data-testid="supp-${x.slot.id}"><button type="button" class="check" aria-pressed="${!!x.intake}" aria-label="${x.intake ? "Annulla assunzione" : "Segna assunto"}: ${esc(x.p.name)}" data-act="toggleIntake" data-pid="${x.p.id}" data-sid="${x.slot.id}" data-date="${d}" id="int-${x.slot.id}">${icon(x.intake ? "check" : "plus")}</button><div><span class="t">${esc(x.p.name)}</span><small>${num.format(x.p.quantity)} ${esc(x.p.unit)}</small></div><span class="side">${x.slot.at || "Senza orario"}</span></div>`).join("")}</div>`
        : `<p class="muted">Nessuna assunzione programmata oggi.</p>`}
      </section>
      <section class="card">${workoutCard}</section>
      <section class="card"><div class="top"><div><h2>Peso</h2><p class="muted small">${lastW ? `Ultimo: ${num.format(lastW.kg)} kg · ${fmtShort(lastW.day)}` : "Nessuna misurazione"}</p></div><button type="button" class="btn sm" data-act="weightSheet" id="weight-quick">${icon("scale")} Registra</button></div></section>
      <section class="card"><div class="top"><div><p class="kicker">Domani · ${fmtShort(tom)}</p><h2>Prepara domani</h2></div><span class="tag ${tomPrepared ? "ok" : ""}">${tomPrepared ? "Preparato" : "Da preparare"} · ${modeOf(tom)}</span></div>
        <p class="muted small">Controlla ON/OFF e scegli le sostituzioni: le modifiche si salvano subito.</p><a class="btn wide" href="#/dieta/${tom}" id="prep-tomorrow">${icon("cal")} Organizza domani</a></section>
    </div>
  </div>`;
};

/* ---------- Schermata: Dieta ---------- */
SCREENS.dieta = (date) => {
  const d = /^\d{4}-\d{2}-\d{2}$/.test(date || "") ? date : today();
  const plan = planOf(d), meals = mealsOf(d), rec = S.days[d], act = activePlan();
  const start = addDays(d, -((wd(d) + 6) % 7));
  const outdated = rec && act && rec.planId !== act.id;
  const n = nutrients(d), goals = S.settings.goals;
  return `
  <div class="top"><div><p class="kicker">Alimentazione</p><h1>La tua dieta<em>.</em></h1></div><a class="btn sm" href="#/tu/piani/nutrition">Piani</a></div>
  <div class="top" style="margin-top:12px"><a class="iconbtn" href="#/dieta/${addDays(start, -7)}" aria-label="Settimana precedente">${icon("left")}</a><b>${cap(parse(d).toLocaleDateString("it-IT", { month: "long", year: "numeric" }))}</b><a class="iconbtn" href="#/dieta/${addDays(start, 7)}" aria-label="Settimana successiva">${icon("right")}</a></div>
  <div class="week" role="group" aria-label="Settimana">
    ${[0, 1, 2, 3, 4, 5, 6].map((i) => { const x = addDays(start, i); return `<a class="daybtn ${x === today() ? "today" : ""}" href="#/dieta/${x}" aria-pressed="${x === d}" aria-label="${fmtDate(x)}, giorno ${modeOf(x)}" style="text-decoration:none"><span>${DAYS[wd(x)]}</span><b>${parse(x).getDate()}</b><i class="${modeOf(x)}"></i></a>`; }).join("")}
  </div>
  <div class="row" style="margin-top:12px">${modeChip(d)}<label class="sr" for="diet-date">Vai alla data</label><input id="diet-date" type="date" class="field" style="width:auto;margin:0" value="${d}" data-act-change="dietDate">${d !== today() ? `<a class="btn sm" href="#/dieta">Oggi</a>` : ""}</div>
  ${plan ? `<p class="small muted" style="margin-top:10px">${esc(plan.title)} · v${plan.version}</p>` : ""}
  ${outdated ? `<div class="warnbox">Questa giornata conserva il piano con cui è stata preparata (${esc(plan?.title)}). Il piano attivo non modifica i pasti già registrati.
    ${!anyConsumed(d) ? `<br><button type="button" class="btn sm" style="margin-top:8px" data-act="applyActive" data-date="${d}">Usa il piano attivo in questa giornata</button>` : ""}</div>` : ""}
  <div class="cols">
    <div>
      <div class="seg" role="group" aria-label="Sezione" style="margin-top:14px">
        <button type="button" aria-pressed="${ui.dietTab === "pasti"}" data-act="dietTab" data-tab="pasti" id="tab-pasti">Pasti</button>
        <button type="button" aria-pressed="${ui.dietTab === "spesa"}" data-act="dietTab" data-tab="spesa" id="tab-spesa">Lista della spesa</button>
      </div>
      ${ui.dietTab === "pasti"
        ? (meals.length ? `<section class="card"><div class="list">${meals.map((m) => mealRow(d, m)).join("")}</div>${d > today() ? `<p class="note">Giornata futura: puoi scegliere le sostituzioni, i pasti si segnano dal giorno stesso.</p>` : ""}</section>`
          : `<section class="card empty"><p class="big">Nessun pasto programmato</p><p>Attiva un piano alimentare per questa giornata.</p><a class="btn p" href="#/tu/piani/nutrition">Gestisci piani</a></section>`)
        : `<section class="card" aria-label="Lista della spesa"><p class="muted small">Dalle alternative scelte per ${fmtShort(d)}. Le quantità restano per porzione: alimenti alternativi e unità diverse non vengono sommati.</p>
          ${shopping(d).map((i) => `<label class="grocery"><input type="checkbox" data-act-change="shop" data-date="${d}" data-id="${esc(i.id)}" ${i.checked ? "checked" : ""}><span>${esc(i.label)}${i.servings > 1 ? ` <small class="muted">· ${i.servings} porzioni</small>` : ""}</span></label>`).join("") || `<p class="empty">Niente da comprare.</p>`}</section>`}
    </div>
    <div>
      <section class="card" aria-labelledby="nut-h"><h2 id="nut-h">Nutrienti della giornata</h2>
        ${NUTR.map(([k, label, u]) => { const v = n.values[k], g = goals[k];
          return `<div class="macro"><span>${label}</span><div class="bar" role="img" aria-label="${label}: ${v == null ? "non disponibile" : num.format(v) + " " + u}${g ? " su " + g : ""}"><i style="width:${v != null && g ? Math.min(100, (100 * v) / g) : 0}%"></i></div><span class="v">${v == null ? "—" : num.format(v)}${g ? ` / ${g}` : ""} ${u}</span></div>`; }).join("")}
        ${Object.keys(n.unknown).length ? `<p class="note">Alcuni alimenti non hanno valori nutrizionali: le cifre sono somme dei valori noti, non totali completi. "—" = sconosciuto.</p>` : ""}
      </section>
      ${plan?.notes ? `<details class="card"><summary><h3>Note del piano</h3></summary><p style="white-space:pre-line">${esc(plan.notes)}</p></details>` : ""}
      ${provenanceNote(plan)}
    </div>
  </div>`;
};
function mealSheetHtml(d, key) {
  const m = mealsOf(d).find((x) => x.key === key);
  if (!m) return sheet("Pasto", "<p>Pasto non trovato.</p>");
  const consumed = !!m.st.consumedAt, mi = m.st.menuIndex || 0, menu = m.menus[mi] || m.menus[0], sel = choice(m);
  return sheet(`${esc(m.name)} · ${m.time}`, `
    <p class="muted small">${fmtDate(d)} · giorno ${modeOf(d)}</p>
    ${consumed ? `<div class="warnbox">Pasto già segnato come mangiato: annulla il consumo per cambiare alternativa.</div>` : ""}
    ${m.menus.length > 1 ? `<div class="seg" role="group" aria-label="Menu del pasto" style="margin-top:12px">${m.menus.map((x, i) => `<button type="button" aria-pressed="${i === mi}" data-act="pickMenu" data-date="${d}" data-key="${key}" data-i="${i}" ${consumed ? "disabled" : ""}>${esc(x.title)}</button>`).join("")}</div>` : ""}
    ${menu.groups.map((g, gi) => `<fieldset class="grp"><legend>${menu.groups.length > 1 ? "Componente " + (gi + 1) : "Scegli"}</legend>
      ${g.options.map((o, oi) => `${oi ? `<p class="or">oppure</p>` : ""}<div class="optpick"><button type="button" class="pickbtn" role="radio" aria-checked="${sel[gi] === o}" data-act="pickOption" data-date="${d}" data-key="${key}" data-g="${gi}" data-o="${oi}" ${consumed ? "disabled" : ""}>
        <span><b>${esc(o.text)}</b>${qty(o)}</span><small>${o.nutrition ? `${num.format(o.nutrition.kcal)} kcal · P ${num.format(o.nutrition.protein_g)} · C ${num.format(o.nutrition.carbs_g)} · G ${num.format(o.nutrition.fat_g)}` : "Valori nutrizionali non disponibili"}</small></button>
        <button type="button" class="iconbtn star" aria-pressed="${!!S.favorites[o.id]}" aria-label="Preferito: ${esc(o.text)}" data-act="fav" data-oid="${o.id}">${icon("star")}</button></div>`).join("")}</fieldset>`).join("")}
    ${menu.notes ? `<p class="note">${esc(menu.notes)}</p>` : ""}
    ${m.sourceText ? `<details style="margin-top:10px"><summary class="small" style="min-height:44px;display:flex;align-items:center;cursor:pointer">Testo originale del pasto</summary><p class="muted">${esc(m.sourceText)}</p></details>` : ""}
    <div class="sheet-actions"><button type="button" class="btn ${consumed ? "" : "p"}" data-act="toggleMeal" data-date="${d}" data-key="${key}" id="sheet-eat" ${d > today() ? "disabled" : ""}>${consumed ? "Annulla consumo" : icon("check") + " Mangiato"}</button></div>`);
}
function modeSheetHtml(d) {
  const blocked = anyConsumed(d), m = modeOf(d);
  return sheet(`Giorno ${fmtShort(d)}`, `
    <p>In automatico il giorno è <b>ON</b> nei tuoi giorni di allenamento (${daysLabel(S.settings.trainingDays)}) e <b>OFF</b> negli altri. Oggi in automatico: <b>${autoMode(d)}</b>.</p>
    ${blocked ? `<div class="warnbox">Ci sono pasti già consumati in questa giornata: annullali prima di cambiare ON/OFF.</div>` : ""}
    <div class="seg" role="group" aria-label="Tipo di giorno" style="margin-top:12px">${["ON", "OFF"].map((x) => `<button type="button" aria-pressed="${m === x}" data-act="setMode" data-date="${d}" data-mode="${x}" id="setmode-${x}" ${blocked ? "disabled" : ""}>Giorno ${x}</button>`).join("")}</div>
    <p class="muted small" style="margin-top:10px">${isAuto(d) ? "Stato: automatico." : "Stato: scelto a mano solo per questa data."}</p>
    <div class="sheet-actions">${!isAuto(d) ? `<button type="button" class="btn" data-act="setMode" data-date="${d}" data-mode="auto" id="setmode-auto" ${blocked ? "disabled" : ""}>Torna all'automatico</button>` : ""}<a class="btn" href="#/tu/preferenze" data-act="closeSheet">Giorni di allenamento</a></div>`);
}

/* ---------- Schermata: Allena ---------- */
const ANIMS = { press: "Spinta", row: "Tirata", squat: "Accosciata", curl: "Isolamento" };
function animSvg(type, id) {
  const bar = type === "press" || type === "squat" ? '<path d="M50 52h100" stroke="currentColor" stroke-width="5"/><rect x="40" y="42" width="10" height="20" rx="2" fill="currentColor"/><rect x="150" y="42" width="10" height="20" rx="2" fill="currentColor"/>' : '<rect x="60" y="56" width="16" height="10" rx="2" fill="currentColor"/>';
  return `<div style="position:relative"><svg class="anim ${type}" id="anim-${id}" viewBox="0 0 200 120" role="img" aria-label="Animazione dimostrativa: ${ANIMS[type] || "esercizio"}"><line x1="20" y1="114" x2="180" y2="114" stroke="currentColor" opacity=".3" stroke-width="3"/><g class="mv"><circle cx="100" cy="28" r="10" fill="currentColor"/><path d="M100 40v34M100 48l-26 10M100 48l26 10M100 74l-14 34M100 74l14 34" stroke="currentColor" stroke-width="6" stroke-linecap="round" fill="none"/>${bar}</g></svg>
    <button type="button" class="iconbtn" style="position:absolute;right:0;bottom:0" data-act="animPause" data-id="${id}" aria-pressed="false" aria-label="Pausa animazione">${icon("pause")}</button></div>`;
}
SCREENS.allena = (key) => {
  const prog = activeProgram();
  if (!prog) return `<h1>Allenati<em>.</em></h1><section class="card empty"><p class="big">Nessuna scheda attiva</p><p>Crea una scheda o importa un CSV.</p><a class="btn p" href="#/tu/editor/training">Crea scheda</a></section>`;
  if (key && prog.days[key]) return allenaDetail(prog, key);
  const sug = suggestedDay(today());
  return `
  <div class="top"><div><p class="kicker">${esc(prog.title)} · v${prog.version}</p><h1>Allenati<em>.</em></h1></div><button type="button" class="btn sm" data-act="organizeSheet" id="organize">${icon("cal")} Organizza</button></div>
  <div class="cols cols3">${Object.keys(prog.days).map((k) => { const ds = prog.displaySettings?.days?.[k] || {}, blocks = prog.days[k];
    return `<section class="card" data-testid="training-day-${k}" ${k === sug ? 'style="border-color:var(--acc)"' : ""}>
      <div class="top"><span class="kicker">${daysLabel(ds.weekdays || [])}</span>${k === sug ? `<span class="tag ok">Oggi</span>` : ""}</div>
      <h2>${esc(dayName(prog, k))}</h2><p class="muted small">${esc(ds.description || "")}</p><p class="small">${blocks.length} esercizi · ${blocks.reduce((n, b) => n + b.sets.length, 0)} serie</p>
      <div class="row"><a class="btn" style="flex:1" href="#/allena/${k}">Vedi</a>${S.session ? `<a class="btn p" style="flex:1" href="#/sessione">Riprendi</a>` : `<button type="button" class="btn p" style="flex:1" data-act="startWorkout" data-day="${k}" aria-label="Inizia ${esc(dayName(prog, k))}">${icon("play")} Inizia</button>`}</div></section>`; }).join("")}</div>
  <div class="row" style="margin-top:16px"><a class="btn" href="#/tu/piani/training">Gestisci schede</a><a class="btn" href="#/tu/editor/training/${prog.id}">${icon("edit")} Modifica scheda</a><a class="btn" href="#/tu/editor/training">${icon("plus")} Nuova scheda</a></div>`;
};
function allenaDetail(prog, k) {
  return `<a class="back" href="#/allena">${icon("left")} Tutte le schede</a>
  <div class="top"><h1>${esc(dayName(prog, k))}</h1>${S.session ? `<a class="btn p" href="#/sessione">Riprendi</a>` : `<button type="button" class="btn p" data-act="startWorkout" data-day="${k}" id="start-detail">${icon("play")} Inizia</button>`}</div>
  <p class="muted">${esc(prog.displaySettings?.days?.[k]?.description || "")}</p>
  <div class="cols">${prog.days[k].map((b) => `<section class="card" data-testid="block-${b.id}">${animSvg(b.anim, b.id)}
    <h2>${esc(b.name)}</h2><p class="muted small">${b.sets.length} serie · recupero ${b.restSeconds != null ? b.restSeconds + " s" : esc(b.restRaw || "non indicato")}</p>${b.notes ? `<p class="note">${esc(b.notes)}</p>` : ""}
    <table class="sets"><thead><tr><th>Serie</th><th>Rip.</th><th>Standard</th><th>Ultima volta</th></tr></thead><tbody>${b.sets.map((s, i) => { const std = S.standardLoads[stdKey(prog.id, s.id)], last = lastResult(s.id);
      return `<tr><td>${i + 1}${s.kind === "warmup" ? " <small class='muted'>risc.</small>" : ""}</td><td>${esc(s.reps)}${s.perLeg ? " <small>/gamba</small>" : ""}</td><td data-testid="std-${s.id}">${std == null ? "<span class='muted'>da impostare</span>" : num.format(std) + " kg"}</td><td>${last ? num.format(last.actualKg) + " × " + (last.actualReps ?? "—") : "—"}</td></tr>`; }).join("")}</tbody></table>
    <button type="button" class="btn sm" style="margin-top:10px" data-act="standardSheet" data-day="${k}" data-block="${b.id}">${icon("edit")} Aggiorna standard</button></section>`).join("")}</div>
  ${prog.cooldown ? `<section class="card soft"><h3>${esc(prog.cooldown.name)}</h3><p>${esc(prog.cooldown.sourceText)}</p></section>` : ""}`;
}
function standardSheetHtml(k, blockId) {
  const prog = activeProgram(), b = prog.days[k].find((x) => x.id === blockId);
  return sheet("Aggiorna carico standard", `<form data-submit="standard" data-day="${k}" data-block="${blockId}" novalidate>
    <p><b>${esc(b.name)}</b></p><p class="muted small">Lo standard è il riferimento della scheda. Non è il peso sollevato: i kg registrati in seduta non lo modificano mai.</p>
    <div class="frow">${b.sets.map((s, i) => `<label class="f">Serie ${i + 1} (kg)<input class="field" type="number" inputmode="decimal" min="0" max="500" step="0.5" name="${s.id}" value="${S.standardLoads[stdKey(prog.id, s.id)] ?? ""}" placeholder="da impostare"></label>`).join("")}</div>
    <label class="checkline"><input type="checkbox" name="ok" required> Confermo l'aggiornamento permanente del carico standard</label>
    ${errBox()}<div class="sheet-actions"><button type="button" class="btn" data-act="closeSheet">Annulla</button><button class="btn p" id="std-save">Aggiorna standard</button></div></form>`);
}
function organizeSheetHtml() {
  const prog = activeProgram(), f = ui.form;
  return sheet("Organizza schede", `<form data-submit="organize" novalidate>
    ${Object.keys(prog.days).map((k) => `<fieldset class="ed-block" style="border-style:solid"><legend class="small"><b>Scheda ${k}</b></legend>
      <label class="f">Nome<input class="field" data-scope="form" data-bind="days.${k}.name" value="${esc(f.days[k].name)}" required maxlength="80"></label>
      <label class="f">Descrizione<input class="field" data-scope="form" data-bind="days.${k}.description" value="${esc(f.days[k].description || "")}" maxlength="200"></label>
      <fieldset class="checks"><legend>Giorni in calendario</legend>${WEEK.map((d) => `<label><input type="checkbox" data-scope="form" data-bind-arr="days.${k}.weekdays" value="${d}" ${f.days[k].weekdays.includes(d) ? "checked" : ""}>${DAYS[d]}</label>`).join("")}</fieldset></fieldset>`).join("")}
    <label class="checkline"><input type="checkbox" data-scope="form" data-bind="syncDays" ${f.syncDays ? "checked" : ""}> Usa questi giorni anche come giorni ON della dieta</label>
    ${errBox()}<div class="sheet-actions"><button type="button" class="btn" data-act="closeSheet">Annulla</button><button class="btn p">Salva</button></div></form>`);
}

/* ---------- Sessione guidata ---------- */
SCREENS.sessione = () => {
  const s = S.session;
  if (!s) return `<section class="card empty"><p class="big">Nessun allenamento in corso</p><a class="btn p" href="#/allena">Scegli una scheda</a></section>`;
  const blocks = s.snapshot.blocks, sets = sessionSets(), done = sets.filter((x) => x.status !== "pending").length;
  const b = blocks[s.cur] || blocks[0], cur = b.sets.find((x) => x.status === "pending");
  const remaining = s.timer ? Math.max(0, Math.ceil((s.timer.endAt - Date.now()) / 1000)) : 0;
  const allDone = done === sets.length;
  return `
  <div class="session-top"><div class="top"><a class="back" href="#/allena">${icon("left")} Esci <span class="sr">(la sessione resta salvata)</span></a>
    <div class="row"><button type="button" class="btn sm danger" data-act="cancelWorkout" id="cancel-workout">Annulla</button><button type="button" class="btn sm p" data-act="finishWorkout" id="finish-workout">Concludi</button></div></div>
    <h1 style="font-size:26px">${esc(s.snapshot.title)}</h1>
    <div class="progressbar" role="progressbar" aria-valuemin="0" aria-valuemax="${sets.length}" aria-valuenow="${done}" aria-label="Serie completate"><i style="width:${(100 * done) / sets.length}%"></i></div>
    <p class="small muted" data-testid="session-count">${done} di ${sets.length} serie · salvato sul dispositivo</p></div>
  ${s.timer ? `<section class="card soft timer" aria-label="Timer di recupero"><p class="kicker">Recupero</p><div class="clock" id="rest-clock" role="timer" aria-live="off">${fmtClock(remaining)}</div>
    <div class="row" style="justify-content:center;margin-top:10px"><button type="button" class="btn" data-act="restAdd" id="rest-add">+15 s</button><button type="button" class="btn p" data-act="restSkip" id="rest-skip">Salta recupero</button></div></section>`
  : `<form class="row" data-submit="manualRest" style="margin-top:8px" novalidate><label class="sr" for="manual-rest">Recupero manuale in secondi</label><input id="manual-rest" name="sec" class="field" style="flex:1;margin:0" type="number" min="5" max="900" step="5" inputmode="numeric" placeholder="Secondi"><button class="btn">Avvia recupero</button><span class="small muted" style="flex-basis:100%">Recupero manuale</span></form>`}
  <div class="row chiprow" role="group" aria-label="Esercizi" style="margin-top:12px">${blocks.map((x, i) => { const left = x.sets.filter((y) => y.status === "pending").length;
    return `<button type="button" class="btn sm ${i === s.cur ? "p" : ""}" data-act="goBlock" data-i="${i}" ${i === s.cur ? 'aria-current="step"' : ""}>${i + 1}. ${esc(x.name)}${left ? "" : " ✓"}</button>`; }).join("")}</div>
  <section class="card" data-testid="session-block">
    ${animSvg(b.anim, "s-" + b.id)}
    <h2>${esc(b.name)}</h2><p class="muted small">Recupero ${b.restSeconds != null ? b.restSeconds + " s" : "non indicato"}${b.notes ? " · " + esc(b.notes) : ""}</p>
    ${b.sets.map((x, i) => setCard(b, x, i, x === cur)).join("")}
    <div class="row" style="margin-top:12px">
      <button type="button" class="btn sm" data-act="goBlock" data-i="${Math.max(0, s.cur - 1)}" ${s.cur === 0 ? "disabled" : ""} aria-label="Esercizio precedente">${icon("left")}</button>
      ${cur ? `<button type="button" class="btn sm" data-act="skipBlock" id="skip-block">Salta esercizio</button>` : ""}
      <button type="button" class="btn sm" data-act="sessionStandard" data-block="${b.id}">Aggiorna standard</button>
      <button type="button" class="btn sm" data-act="goBlock" data-i="${Math.min(blocks.length - 1, s.cur + 1)}" ${s.cur === blocks.length - 1 ? "disabled" : ""} aria-label="Esercizio successivo">${icon("right")}</button>
    </div>
  </section>
  ${allDone ? `<section class="card soft"><h2>${esc(s.snapshot.cooldown?.name || "Fine")}</h2><p>${esc(s.snapshot.cooldown?.sourceText || "")}</p><button type="button" class="btn p wide" data-act="finishWorkout">Concludi allenamento</button></section>` : ""}`;
};
const fmtClock = (sec) => `${Math.floor(sec / 60)}:${pad(sec % 60)}`;
function setCard(b, x, i, isCur) {
  const head = `<div class="top"><b>Serie ${i + 1}${x.kind === "warmup" ? " · riscaldamento" : ""}${x.perLeg ? " · per gamba" : ""}</b><span class="small muted" data-testid="std-start-${x.id}">Standard ${x.standardAtStart == null ? "da impostare" : num.format(x.standardAtStart) + " kg"}</span></div>`;
  if (x.status !== "pending") {
    const res = x.status === "skipped" ? "Saltata" : `${x.status === "recorded" ? num.format(x.actualKg) + " kg" : "Senza peso"} × ${x.actualReps ?? "—"} rip.`;
    return `<div class="setcard ${x.status}" data-testid="set-${x.id}">${head}<p>${res}</p></div>`;
  }
  if (!isCur) return `<div class="setcard">${head}<p class="muted small">${esc(x.reps)} ripetizioni</p></div>`;
  const kg = x.draftKg ?? x.standardAtStart ?? "", reps = x.draftReps ?? x.repMin ?? (parseInt(x.reps, 10) || "");
  const range = x.repMin != null ? Array.from({ length: x.repMax - x.repMin + 1 }, (_, n) => x.repMin + n) : [];
  return `<div class="setcard current" data-testid="set-${x.id}">${head}<p class="small">Obiettivo: ${esc(x.reps)} ripetizioni</p>
    <div class="setgrid"><label class="f">Kg di oggi<input id="kg-${x.id}" class="field" type="number" inputmode="decimal" min="0" max="500" step="0.5" value="${kg}" data-draft="kg" data-set="${x.id}" aria-describedby="kg-help"></label>
    <label class="f">Ripetizioni<input id="reps-${x.id}" class="field" type="number" inputmode="numeric" min="0" max="100" step="1" value="${reps}" data-draft="reps" data-set="${x.id}"></label></div>
    <p class="small muted" id="kg-help">I kg di oggi non cambiano lo standard.</p>
    ${range.length ? `<div class="chips" role="group" aria-label="Scelta rapida ripetizioni">${range.map((n) => `<button type="button" aria-pressed="${Number(reps) === n}" data-act="repChip" data-set="${x.id}" data-n="${n}" aria-label="${n} ripetizioni">${n}</button>`).join("")}</div>` : ""}
    <button type="button" class="btn p wide" style="margin-top:10px" data-act="doneSet" data-set="${x.id}" data-mode="recorded" id="done-set">${icon("check")} Fatta</button>
    <div class="row" style="margin-top:8px"><button type="button" class="btn" style="flex:1" data-act="doneSet" data-set="${x.id}" data-mode="unlogged">Senza peso</button><button type="button" class="btn" style="flex:1" data-act="skipSet" data-set="${x.id}">Salta serie</button></div></div>`;
}

/* ---------- Grafici ---------- */
function chart(points, { label, unit, empty }) {
  if (!points.length) return `<p class="empty">${empty}</p>`;
  const W = 320, H = 150, L = 34, B = 20;
  const ys = points.map((p) => p.y), min = Math.min(...ys), max = Math.max(...ys), span = max - min || 1;
  const t0 = parse(points[0].x).getTime(), t1 = parse(points.at(-1).x).getTime() || t0 + 1, tspan = t1 - t0 || 1;
  const X = (p) => L + ((parse(p.x).getTime() - t0) / tspan) * (W - L - 8), Y = (v) => 8 + (1 - (v - min) / span) * (H - B - 8);
  const line = points.map((p, i) => `${i ? "L" : "M"}${X(p).toFixed(1)},${Y(p.y).toFixed(1)}`).join("");
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${label}: da ${num.format(points[0].y)} a ${num.format(points.at(-1).y)} ${unit}">
    <line class="ax" x1="${L}" x2="${W}" y1="${H - B}" y2="${H - B}"/><text x="0" y="12">${num.format(max)}</text><text x="0" y="${H - B}">${num.format(min)}</text>
    <path class="area" d="${line}L${X(points.at(-1)).toFixed(1)},${H - B}L${X(points[0]).toFixed(1)},${H - B}Z"/><path class="ln" d="${line}"/>
    ${points.length <= 40 ? points.map((p) => `<circle class="pt" cx="${X(p).toFixed(1)}" cy="${Y(p.y).toFixed(1)}" r="3.5"/>`).join("") : ""}
    <text x="${L}" y="${H - 4}">${fmtShort(points[0].x)}</text><text x="${W}" y="${H - 4}" text-anchor="end">${fmtShort(points.at(-1).x)}</text></svg>
    <details><summary class="small muted" style="min-height:44px;display:flex;align-items:center;cursor:pointer">Dati del grafico</summary><table class="sets"><tbody>${points.map((p) => `<tr><td>${fmtShort(p.x)}</td><td>${num.format(p.y)} ${unit}${p.extra ? " · " + p.extra : ""}</td></tr>`).join("")}</tbody></table></details>`;
}

/* ---------- Schermata: Progressi ---------- */
SCREENS.progressi = () => {
  const t = today(), from = ui.period ? addDays(t, -ui.period) : "0000-00-00";
  const hist = S.history.filter((h) => h.status === "completed" && localOf(h.completedAt) >= from);
  const ws = S.weights.filter((w) => w.day >= from), lastW = S.weights.at(-1), prevW = S.weights.at(-2);
  const monday = addDays(t, -((wd(t) + 6) % 7));
  const weeks = [5, 4, 3, 2, 1, 0].map((i) => { const s = addDays(monday, -7 * i), e = addDays(s, 7); return { s, n: S.history.filter((h) => h.status === "completed" && localOf(h.completedAt) >= s && localOf(h.completedAt) < e).length }; });
  const maxW = Math.max(1, ...weeks.map((w) => w.n));
  const month = t.slice(0, 7), thisMonth = S.history.filter((h) => h.status === "completed" && h.completedAt && localOf(h.completedAt).startsWith(month)).length;
  const exercises = [...new Set(S.history.flatMap((h) => h.snapshot.blocks.filter((b) => b.sets.some((s) => s.status === "recorded")).map((b) => b.name)))];
  if (!exercises.includes(ui.loadEx)) ui.loadEx = exercises[0] || null;
  const loadPts = hist.map((h) => { const sets = h.snapshot.blocks.filter((b) => b.name === ui.loadEx).flatMap((b) => b.sets).filter((s) => s.status === "recorded");
    if (!sets.length) return null; const best = sets.reduce((a, s) => (s.actualKg > a.actualKg ? s : a)); return { x: localOf(h.completedAt), y: best.actualKg, extra: (best.actualReps ?? "—") + " rip." }; }).filter(Boolean);
  const volume = (h) => { let v = 0, partial = false; for (const s of h.snapshot.blocks.flatMap((b) => b.sets)) { if (s.status === "recorded" && s.actualReps != null) v += s.actualKg * s.actualReps; else if (s.status !== "skipped") partial = true; } return { v, partial }; };
  const volPts = hist.map((h) => { const { v, partial } = volume(h); return v ? { x: localOf(h.completedAt), y: v, extra: partial ? "parziale" : "" } : null; }).filter(Boolean);
  const cm = ui.calMonth || month, [cy, cmo] = cm.split("-").map(Number), first = new Date(cy, cmo - 1, 1), daysIn = new Date(cy, cmo, 0).getDate();
  const doneDays = new Set(S.history.filter((h) => h.status === "completed").map((h) => localOf(h.completedAt)));
  const lead = (first.getDay() + 6) % 7;
  let planned = 0, consumed = 0;
  for (let i = 1; i <= 7; i++) { const d = addDays(t, -i); if (!S.days[d]) continue; const ms = mealsOf(d); planned += ms.length; consumed += ms.filter((m) => m.st.consumedAt).length; }
  return `
  <p class="kicker">Andamento</p><h1>I tuoi progressi<em>.</em></h1>
  <div class="seg" role="group" aria-label="Intervallo dei grafici" style="margin-top:14px">${[[30, "30 giorni"], [90, "3 mesi"], [365, "1 anno"], [0, "Tutto"]].map(([v, l]) => `<button type="button" aria-pressed="${ui.period === v}" data-act="period" data-v="${v}">${l}</button>`).join("")}</div>
  <div class="cols">
    <section class="card" aria-labelledby="pw"><div class="top"><h2 id="pw">Peso corporeo</h2><button type="button" class="btn sm" data-act="weightSheet">${icon("plus")} Registra</button></div>
      ${lastW ? `<div class="kpis"><div><span>Ultima</span><b class="big-num">${num.format(lastW.kg)} kg</b></div>${prevW ? `<div><span>Rispetto alla precedente</span><b class="big-num">${lastW.kg - prevW.kg > 0 ? "+" : ""}${num.format(lastW.kg - prevW.kg)}</b></div>` : ""}</div>` : ""}
      ${chart(ws.map((w) => ({ x: w.day, y: w.kg })), { label: "Andamento peso corporeo", unit: "kg", empty: "Nessuna misurazione in questo periodo." })}
      <p class="small muted">Il peso non misura direttamente la massa muscolare.</p></section>
    <section class="card" aria-labelledby="pf"><h2 id="pf">Frequenza allenamenti</h2>
      <div class="kpis"><div><span>Questa settimana</span><b class="big-num" data-testid="progress-week">${weeks.at(-1).n}</b></div><div><span>Questo mese</span><b class="big-num">${thisMonth}</b></div></div>
      <div class="bars" aria-label="Allenamenti nelle ultime sei settimane">${weeks.map((w) => `<div><b style="color:var(--ink)">${w.n}</b><i style="height:${(80 * w.n) / maxW}%" aria-hidden="true"></i><span>${fmtShort(w.s)}</span></div>`).join("")}</div></section>
    <section class="card" aria-labelledby="pl"><h2 id="pl">Carichi registrati</h2>
      ${exercises.length ? `<label class="f">Esercizio<select class="field" data-act-change="loadEx">${exercises.map((e) => `<option ${e === ui.loadEx ? "selected" : ""}>${esc(e)}</option>`).join("")}</select></label>` : ""}
      ${loadPts.length ? `<div class="kpis"><div><span>Miglior carico del periodo</span><b class="big-num">${num.format(Math.max(...loadPts.map((p) => p.y)))} kg</b></div></div>` : ""}
      ${chart(loadPts, { label: "Carico massimo per seduta", unit: "kg", empty: "Nessun carico registrato nel periodo." })}</section>
    <section class="card" aria-labelledby="pc"><h2 id="pc">Calendario allenamenti</h2>
      <div class="top" style="margin-top:8px"><button type="button" class="iconbtn" data-act="calMonth" data-d="-1" aria-label="Mese precedente">${icon("left")}</button><b aria-live="polite">${cap(first.toLocaleDateString("it-IT", { month: "long", year: "numeric" }))}</b><button type="button" class="iconbtn" data-act="calMonth" data-d="1" aria-label="Mese successivo" ${cm >= month ? "disabled" : ""}>${icon("right")}</button></div>
      <div class="cal">${WEEK.map((d) => `<span class="wd">${DAYS[d]}</span>`).join("")}${"<span></span>".repeat(lead)}${Array.from({ length: daysIn }, (_, i) => { const d = `${cm}-${pad(i + 1)}`; return `<span class="d ${doneDays.has(d) ? "done" : ""} ${d === t ? "today" : ""}" ${doneDays.has(d) ? `aria-label="${i + 1}: allenamento completato"` : ""}>${i + 1}</span>`; }).join("")}</div></section>
    <section class="card" aria-labelledby="pv"><h2 id="pv">Volume registrato</h2>${chart(volPts, { label: "Volume per seduta", unit: "kg × rip.", empty: "Nessun volume registrato nel periodo." })}
      ${volPts.length ? `<p class="small muted">Somma di kg × ripetizioni delle serie con peso. "Parziale" se mancano dati.</p>` : ""}</section>
    <section class="card" aria-labelledby="pn"><h2 id="pn">Ultimi 7 giorni</h2>${planned ? `<p><b class="big-num">${consumed}</b> pasti consumati su ${planned} nelle giornate pianificate.</p><div class="progressbar"><i style="width:${(100 * consumed) / planned}%"></i></div>` : `<p class="muted">Nessuna giornata pianificata.</p>`}</section>
  </div>
  <h2 style="margin-top:26px">Storico allenamenti</h2>
  ${hist.length ? hist.slice().reverse().slice(0, ui.histAll ? undefined : 10).map((h) => { const { v, partial } = volume(h); const sets = h.snapshot.blocks.flatMap((b) => b.sets);
    return `<details class="card" data-testid="history-${h.clientId}"><summary><span><b>${esc(h.snapshot.title)}</b><br><small class="muted">${fmtDate(localOf(h.completedAt))} · ${v ? num.format(v) + " kg × rip." + (partial ? " (parziale)" : "") : "volume non registrato"}</small></span></summary>
      <p class="small muted">${sets.filter((s) => s.status === "recorded").length} serie con peso · ${sets.filter((s) => s.status === "unlogged").length} senza peso · ${sets.filter((s) => s.status === "skipped").length} saltate</p>
      ${h.snapshot.blocks.map((b) => `<h3 style="margin-top:10px">${esc(b.name)}</h3>${b.sets.map((s, i) => `<p class="small">Serie ${i + 1} · ${s.status === "skipped" ? "saltata" : (s.status === "recorded" ? num.format(s.actualKg) + " kg" : "senza peso") + " × " + (s.actualReps ?? "—")} · <span class="muted">standard all'avvio ${s.standardAtStart == null ? "da impostare" : num.format(s.standardAtStart) + " kg"}</span></p>`).join("")}`).join("")}</details>`; }).join("")
  + (hist.length > 10 && !ui.histAll ? `<button type="button" class="btn wide" style="margin-top:14px" data-act="histAll">Mostra tutti (${hist.length})</button>` : "")
  : `<section class="card empty"><p class="big">Nessun allenamento concluso</p><p>Completa una seduta per vederla qui.</p></section>`}`;
};

/* ---------- Schermata: Tu ---------- */
const backTu = `<a class="back" href="#/tu">${icon("left")} Tu</a>`;
SCREENS.tu = (sub, a, b) => {
  const fn = { peso: tuPeso, integratori: tuSupp, promemoria: tuRem, piani: tuPlans, editor: tuEditor, preferenze: tuPrefs, account: tuAccount }[sub];
  if (fn) return fn(a, b);
  const item = (href, ic, t, s, attrs = "") => `${href ? `<a href="${href}" ${attrs}>` : `<button type="button" ${attrs}>`}<span class="ic">${icon(ic)}</span><span class="grow">${t}${s ? `<small>${s}</small>` : ""}</span>${icon("right")}${href ? "</a>" : "</button>"}`;
  return `
  <p class="kicker">Il tuo spazio</p><h1>Ciao, ${esc(S.auth.username)}<em>.</em></h1>
  <div class="cols">
    <div>
      <section class="card menu-list" aria-label="Ogni giorno">
        ${item("#/tu/peso", "scale", "Peso", S.weights.at(-1) ? num.format(S.weights.at(-1).kg) + " kg" : "")}
        ${item("#/tu/integratori", "pill", "Integratori", S.supplements.length + " configurati")}
        ${item("#/tu/promemoria", "bell", "Promemoria e notifiche", S.reminders.filter((r) => r.settings.enabled).length + " attivi")}
      </section>
      <section class="card menu-list" aria-label="Piani">
        ${item("#/tu/piani/nutrition", "food", "Piani alimentari", activePlan()?.title || "Nessuno attivo")}
        ${item("#/tu/piani/training", "gym", "Schede di allenamento", activeProgram()?.title || "Nessuna attiva")}
        ${item("#/tu/preferenze", "cal", "Giorni di allenamento, preferenze e obiettivi", daysLabel(S.settings.trainingDays))}
      </section>
    </div>
    <div>
      <section class="card menu-list" aria-label="App">
        ${item("#/tu/account", "user", "Account e password", "")}
        ${item("", "download", "Installa PULSE", "", 'data-act="installSheet"')}
      </section>
      <section class="card"><h3>Aspetto</h3><div class="seg" role="group" aria-label="Tema" style="margin-top:10px">${[["auto", "Automatico"], ["light", "Chiaro"], ["dark", "Scuro"]].map(([v, l]) => `<button type="button" aria-pressed="${S.settings.theme === v}" data-act="theme" data-v="${v}" id="theme-${v}">${l}</button>`).join("")}</div></section>
      <section class="card"><h3>Dati demo</h3><p class="muted small">Il prototipo salva tutto nel browser.</p><div class="row"><button type="button" class="btn danger" data-act="resetDemo" id="reset-demo">Azzera dati demo</button><button type="button" class="btn" data-act="logout" id="logout">${icon("logout")} Esci</button></div></section>
    </div>
  </div>`;
};
function weightForm(inSheet) {
  return `<form data-submit="weight" novalidate ${inSheet ? 'data-sheet="1"' : ""}><div class="frow"><label class="f">Peso (kg)<input class="field" name="kg" id="w-kg${inSheet ? "-s" : ""}" type="number" inputmode="decimal" min="30" max="300" step="0.1" required ${inSheet ? "autofocus" : ""}></label>
    <label class="f">Data<input class="field" name="day" type="date" max="${today()}" value="${today()}" required></label></div>${errBox()}
    <button class="btn p wide" style="margin-top:14px">Salva peso</button></form>`;
}
function tuPeso() {
  return `${backTu}<h1>Peso<em>.</em></h1><div class="cols"><section class="card">${weightForm(false)}</section>
  <section class="card"><h2>Ultime misurazioni</h2>${S.weights.slice(-14).reverse().map((w) => `<div class="top" style="min-height:44px;border-top:1px dashed var(--line)"><span>${fmtDate(w.day)}</span><b>${num.format(w.kg)} kg</b></div>`).join("") || `<p class="empty">Nessuna misurazione.</p>`}</section></div>`;
}
const MODES = { always: "Sempre", ON: "Solo giorni ON", OFF: "Solo giorni OFF" };
function tuSupp() {
  const hist = S.intakes.filter((i) => i.day >= addDays(today(), -30)).sort((a, b) => (b.day + (b.takenAt || "")).localeCompare(a.day + (a.takenAt || "")));
  return `${backTu}<div class="top"><h1>Integratori<em>.</em></h1><button type="button" class="btn p" data-act="suppSheet" id="supp-add">${icon("plus")} Aggiungi</button></div>
  <div class="cols"><div>${S.supplements.length ? S.supplements.map((p) => `<section class="card" data-testid="product-${p.id}"><div class="top"><h2>${esc(p.name)}</h2><div class="row">
      <button type="button" class="iconbtn" data-act="suppSheet" data-id="${p.id}" aria-label="Modifica ${esc(p.name)}">${icon("edit")}</button><button type="button" class="iconbtn danger" data-act="suppDelete" data-id="${p.id}" aria-label="Elimina ${esc(p.name)}">${icon("trash")}</button></div></div>
      <p>${num.format(p.quantity)} ${esc(p.unit)} · ${p.schedule.length} al giorno · ${MODES[p.mode]}${p.active ? "" : ' · <span class="tag warn">In pausa</span>'}</p><p class="muted small">${daysLabel(p.weekdays)} · ${p.schedule.map((s) => s.at || "senza orario").join(", ")}</p></section>`).join("")
    : `<section class="card empty"><p class="big">Nessun integratore</p><p>Aggiungi il primo per vederlo in Oggi.</p></section>`}</div>
  <section class="card" aria-labelledby="hist-h"><h2 id="hist-h">Storico assunzioni</h2><p class="muted small">Ultimi 30 giorni.</p>
    ${hist.map((i) => { const p = S.supplements.find((x) => x.id === i.productId); const slot = p?.schedule.find((s) => s.id === i.slotId);
      return `<div style="border-top:1px dashed var(--line);padding:8px 0" data-testid="intake-${i.id}"><div class="top"><span><b>${esc(p?.name || "Integratore eliminato")}</b><br><small class="muted">${fmtShort(i.day)} · ${slot?.at || "senza orario"} · ${num.format(i.dose)} ${esc(i.unit)}</small></span><span class="tag ${i.status === "taken" ? "ok" : ""}">${i.status === "taken" ? "Assunto" : "Annullato"}</span></div>
      ${i.status === "taken" ? `<div class="row"><button type="button" class="btn sm" data-act="intakeFix" data-id="${i.id}">Rettifica quantità</button><button type="button" class="btn sm ghost danger" data-act="intakeCancel" data-id="${i.id}">Annulla registrazione</button></div>` : ""}</div>`; }).join("") || `<p class="empty">Nessuna assunzione registrata.</p>`}
  </section></div>`;
}
const UNITS = ["capsula", "compressa", "g", "mg", "mcg", "ml", "gocce", "bustina", "misurino", "UI"];
function suppSheetHtml() {
  const f = ui.form;
  return sheet(f.id ? "Modifica integratore" : "Nuovo integratore", `<form data-submit="supp" novalidate>
    <label class="f">Nome<input class="field" data-scope="form" data-bind="name" value="${esc(f.name)}" required maxlength="160" autofocus id="supp-name"></label>
    <div class="frow"><label class="f">Quantità per assunzione<input class="field" type="number" inputmode="decimal" min="0" step="any" data-scope="form" data-bind="quantity" value="${f.quantity ?? ""}" required id="supp-qty"></label>
      <label class="f">Unità<select class="field" data-scope="form" data-bind="unit" required id="supp-unit"><option value="">Scegli</option>${UNITS.map((u) => `<option ${u === f.unit ? "selected" : ""}>${u}</option>`).join("")}</select></label></div>
    <div class="frow"><label class="f">Assunzioni al giorno<select class="field" data-scope="form" data-bind="frequency" data-rerender="1" id="supp-freq">${[1, 2, 3, 4, 5, 6, 7, 8].map((n) => `<option ${n === f.frequency ? "selected" : ""}>${n}</option>`).join("")}</select></label>
      <label class="f">Quando<select class="field" data-scope="form" data-bind="mode">${Object.entries(MODES).map(([k, l]) => `<option value="${k}" ${k === f.mode ? "selected" : ""}>${l}</option>`).join("")}</select></label></div>
    <div class="frow">${f.times.slice(0, f.frequency).map((t, i) => `<label class="f">Orario ${i + 1} <small>(facoltativo)</small><input class="field" type="time" data-scope="form" data-bind="times.${i}" value="${t || ""}"></label>`).join("")}</div>
    <fieldset class="checks"><legend>Giorni</legend>${WEEK.map((d) => `<label><input type="checkbox" data-scope="form" data-bind-arr="weekdays" value="${d}" ${f.weekdays.includes(d) ? "checked" : ""}>${DAYS[d]}</label>`).join("")}</fieldset>
    <label class="checkline"><input type="checkbox" data-scope="form" data-bind="active" ${f.active ? "checked" : ""}> Attivo</label>
    ${errBox()}<div class="sheet-actions"><button type="button" class="btn" data-act="closeSheet">Annulla</button><button class="btn p" id="supp-save">Salva</button></div></form>`);
}
function tuRem() {
  const perm = "Notification" in window ? Notification.permission : "unsupported";
  return `${backTu}<div class="top"><h1>Promemoria<em>.</em></h1><button type="button" class="btn p" data-act="remWizard" id="rem-add">${icon("plus")} Nuovo</button></div>
  <div class="cols"><section class="card" aria-labelledby="notif-h"><div class="top"><h2 id="notif-h">Notifiche</h2><span class="tag ${perm === "granted" ? "ok" : "warn"}">${{ granted: "Autorizzate", denied: "Bloccate", default: "Da autorizzare", unsupported: "Non supportate" }[perm]}</span></div>
    <p class="muted small">Nel prototipo le notifiche arrivano con PULSE aperta. Senza permesso compaiono come avviso in pagina. Non arrivano per azioni già fatte.</p>
    <div class="row">${perm === "default" ? `<button type="button" class="btn p" data-act="askPerm">Consenti notifiche</button>` : ""}<button type="button" class="btn" data-act="testNotif" id="test-notif">Invia notifica di prova</button></div>
    ${perm === "denied" ? `<p class="note">Puoi riabilitarle nelle impostazioni del sito nel browser.</p>` : ""}</section>
  <div>${S.reminders.length ? S.reminders.map((r) => `<section class="card" data-testid="rem-${r.id}"><div class="top"><span class="row"><span class="ic" style="color:var(--acc)">${icon(KINDS[r.settings.kind][1])}</span><span><b>${esc(reminderLabel(r))}</b><br><small class="muted">${KINDS[r.settings.kind][0]} · ${r.settings.at} · ${daysLabel(r.settings.weekdays)}</small></span></span>
      <button type="button" class="switch" role="switch" aria-checked="${r.settings.enabled}" aria-label="Attiva ${esc(reminderLabel(r))}" data-act="remToggle" data-id="${r.id}"></button></div>
      <div class="row" style="margin-top:8px"><button type="button" class="btn sm" data-act="remWizard" data-id="${r.id}">${icon("edit")} Modifica</button><button type="button" class="btn sm ghost danger" data-act="remDelete" data-id="${r.id}">${icon("trash")} Elimina</button></div></section>`).join("")
    : `<section class="card empty"><p class="big">Nessun promemoria</p><p>Creane uno per pasti, integratori, allenamento o peso.</p></section>`}</div></div>`;
}
function remTargets(kind) {
  if (kind === "meal") { const seen = new Map(); for (const m of [...(activePlan()?.days.ON || []), ...(activePlan()?.days.OFF || [])]) if (!seen.has(m.key)) seen.set(m.key, m.name + " · " + m.time); return [...seen]; }
  if (kind === "supplement") return S.supplements.flatMap((p) => p.schedule.map((s, i) => [p.id + ":" + s.id, p.name + (p.schedule.length > 1 ? " · assunzione " + (i + 1) : "") + (s.at ? " · " + s.at : "")]));
  return [];
}
function wizardHtml() {
  const w = ui.wiz, f = w.data, needsTarget = f.kind === "meal" || f.kind === "supplement", targets = remTargets(f.kind);
  const titles = ["Tipo di promemoria", "Cosa ricordare", "Quando", "Riepilogo"];
  const step = {
    1: `<label class="f">Tipo<select class="field" data-scope="wiz" data-bind="kind" data-rerender="1" id="wiz-kind" autofocus>${Object.entries(KINDS).map(([k, [l]]) => `<option value="${k}" ${k === f.kind ? "selected" : ""}>${l}</option>`).join("")}</select></label>
        <label class="f">Nome ${f.kind === "custom" ? "" : "<small>(facoltativo)</small>"}<input class="field" data-scope="wiz" data-bind="label" value="${esc(f.label)}" maxlength="80" id="wiz-label"></label>`,
    2: needsTarget ? (targets.length ? `<label class="f">Attività collegata<select class="field" data-scope="wiz" data-bind="target" id="wiz-target"><option value="">Scegli</option>${targets.map(([v, l]) => `<option value="${esc(v)}" ${v === f.target ? "selected" : ""}>${esc(l)}</option>`).join("")}</select></label>
        ${f.kind === "meal" ? `<p class="note">La notifica mostrerà il contenuto del pasto scelto per quel giorno.</p>` : ""}` : `<p class="warnbox">Non ci sono attività da collegare a questo tipo.</p>`)
      : `<p>Questo tipo non richiede un'attività collegata.</p>`,
    3: `<div class="frow"><label class="f">Orario<input class="field" type="time" data-scope="wiz" data-bind="at" value="${f.at}" required id="wiz-at"></label><label class="f">Fuso orario<input class="field" data-scope="wiz" data-bind="timezone" value="${esc(f.timezone)}"></label></div>
        <fieldset class="checks"><legend>Giorni della settimana</legend>${WEEK.map((d) => `<label><input type="checkbox" data-scope="wiz" data-bind-arr="weekdays" value="${d}" ${f.weekdays.includes(d) ? "checked" : ""}>${DAYS[d]}</label>`).join("")}</fieldset>`,
    4: `<dl class="small"><dt class="muted">Nome</dt><dd>${esc(reminderLabel({ settings: f }))}</dd><dt class="muted">Tipo</dt><dd>${KINDS[f.kind][0]}</dd><dt class="muted">Orario</dt><dd>${f.at} · ${esc(f.timezone)}</dd><dt class="muted">Giorni</dt><dd>${daysLabel(f.weekdays)}</dd></dl>`,
  }[w.step];
  return sheet(titles[w.step - 1], `<form data-submit="wizard" novalidate><p class="kicker">${w.id ? "Modifica" : "Nuovo"} promemoria · passo ${w.step} di 4</p>${step}${errBox()}
    <div class="sheet-actions"><button type="button" class="btn" data-act="${w.step === 1 ? "closeSheet" : "wizBack"}">${w.step === 1 ? "Annulla" : "Indietro"}</button><button class="btn p" id="wiz-next">${w.step === 4 ? "Salva promemoria" : "Continua"}</button></div></form>`);
}
function tuPrefs() {
  const f = ui.form._prefs ? ui.form : (ui.form = { _prefs: true, trainingDays: [...S.settings.trainingDays], liked: S.settings.preferences.liked.join(", "), disliked: S.settings.preferences.disliked.join(", "), goals: { ...S.settings.goals } });
  return `${backTu}<h1>Preferenze<em>.</em></h1><form data-submit="prefs" novalidate class="cols">
    <section class="card"><h2>Giorni di allenamento</h2><p class="muted small">Decidono in automatico se un giorno è ON o OFF. Puoi sempre cambiarlo a mano per una singola data.</p>
      <fieldset class="checks"><legend class="sr">Giorni ON</legend>${WEEK.map((d) => `<label><input type="checkbox" data-scope="form" data-bind-arr="trainingDays" value="${d}" ${f.trainingDays.includes(d) ? "checked" : ""} data-testid="td-${d}">${DAYS[d]}</label>`).join("")}</fieldset></section>
    <section class="card"><h2>Preferenze alimentari</h2><label class="f">Alimenti preferiti <small>(separati da virgola)</small><input class="field" data-scope="form" data-bind="liked" value="${esc(f.liked)}"></label>
      <label class="f">Alimenti non graditi<input class="field" data-scope="form" data-bind="disliked" value="${esc(f.disliked)}"></label></section>
    <section class="card"><h2>Obiettivi indicativi</h2><p class="muted small">Non sono prescrizioni: lasciali vuoti se non li conosci.</p>
      <div class="frow">${NUTR.map(([k, l, u]) => `<label class="f">${l} (${u})<input class="field" type="number" min="0" step="1" inputmode="numeric" data-scope="form" data-bind="goals.${k}" value="${f.goals[k] ?? ""}"></label>`).join("")}</div></section>
    <div>${errBox()}<button class="btn p wide" style="margin-top:14px" id="prefs-save">Salva preferenze</button></div></form>`;
}
function tuAccount() {
  return `${backTu}<h1>Account<em>.</em></h1><div class="cols"><form class="card" data-submit="account" novalidate><h2>Le tue credenziali</h2>
    <label class="f">Nome utente<input class="field" name="username" value="${esc(S.auth.username)}" autocomplete="username" required minlength="3" maxlength="64" pattern="[a-zA-Z0-9_.\\-]{3,64}"></label>
    <p class="small muted">Da 3 a 64 tra lettere, numeri, punti, trattini o underscore.</p>
    <label class="f">Password attuale<input class="field" name="current" type="password" autocomplete="current-password" required id="acc-current"></label>
    <h3 style="margin-top:18px">Cambia password</h3><p class="small muted">Lascia vuoto per mantenere quella attuale. Minimo 12 caratteri.</p>
    <label class="f">Nuova password<input class="field" name="next" type="password" autocomplete="new-password" minlength="12" maxlength="72" id="acc-new"></label>
    <label class="f">Conferma nuova password<input class="field" name="confirm" type="password" autocomplete="new-password" maxlength="72" id="acc-confirm"></label>
    ${errBox()}<button class="btn p wide" style="margin-top:14px" id="acc-save">Salva modifiche</button></form>
    <section class="card"><h2>Sessione</h2><p class="muted small">Esci da PULSE su questo dispositivo.</p><button type="button" class="btn wide" data-act="logout">${icon("logout")} Esci</button></section></div>`;
}

/* ---------- Piani e schede ---------- */
const STATES = { active: ["Attivo", "ok"], draft: ["Bozza", "warn"], archived: ["Archiviato", ""] };
const listOf = (kind) => (kind === "training" ? S.trainingPrograms : S.nutritionPlans);
function tuPlans(kind = "nutrition") {
  const nut = kind === "nutrition", rows = listOf(kind).slice().sort((a, b) => b.version - a.version), c = (ui.csv[kind] ||= {});
  return `${backTu}<h1>${nut ? "Piani alimentari" : "Schede di allenamento"}<em>.</em></h1>
  <div class="row" style="margin-top:12px"><a class="btn p" href="#/tu/editor/${kind}">${icon("plus")} ${nut ? "Crea nuova dieta" : "Crea nuova scheda"}</a></div>
  <div class="cols"><section class="card" aria-labelledby="saved-h"><h2 id="saved-h">Versioni salvate</h2>
    ${rows.map((p) => `<div style="border-top:1px dashed var(--line);padding:10px 0" data-testid="plan-${p.id}"><div class="top"><b>${esc(p.title)}</b><span class="tag ${STATES[p.status][1]}">${STATES[p.status][0]}</span></div>
      <p class="small muted">v${p.version} · ${p.provenance === "csv" ? "da CSV" : p.provenance === "manual" ? "editor" : esc(p.provenance)} · ${fmtShort(p.createdAt)}</p>
      <div class="row"><a class="btn sm" href="#/tu/editor/${kind}/${p.id}" aria-label="Modifica ${esc(p.title)}">Modifica</a><button type="button" class="btn sm" data-act="planDup" data-kind="${kind}" data-id="${p.id}" aria-label="Duplica ${esc(p.title)}">Duplica</button>
      <button type="button" class="btn sm" data-act="planExport" data-kind="${kind}" data-id="${p.id}" aria-label="Esporta CSV ${esc(p.title)}">${icon("download")} CSV</button>
      ${p.status !== "active" ? `<button type="button" class="btn sm p" data-act="planActivate" data-kind="${kind}" data-id="${p.id}" aria-label="Attiva ${esc(p.title)}">Attiva</button><button type="button" class="btn sm ghost danger" data-act="planDelete" data-kind="${kind}" data-id="${p.id}" aria-label="Elimina ${esc(p.title)}">Elimina</button>` : ""}</div></div>`).join("") || `<p class="empty">Nessuna versione salvata.</p>`}
  </section>
  <section class="card" aria-labelledby="imp-h"><h2 id="imp-h">Importa da CSV</h2>
    <p class="muted small">UTF-8, separatore ; (accettati anche virgola e tab), decimali 12,5 o 12.5. Nulla viene salvato prima della tua conferma.</p>
    <div class="row"><button type="button" class="btn sm" data-act="csvTemplate" data-kind="${kind}">${icon("download")} CSV di esempio</button><button type="button" class="btn sm" data-act="csvPrompt" data-kind="${kind}">${icon("copy")} Testo per l'AI</button></div>
    <label class="checkline"><input type="checkbox" data-act-change="csvPrivate" data-kind="${kind}" ${c.private ? "checked" : ""}> Includi preferenze alimentari e obiettivi nel testo per l'AI</label>
    ${c.private ? `<p class="note">Il testo includerà dati personali: condividilo solo se vuoi farli trattare dall'AI scelta.</p>` : ""}
    ${c.prompt ? `<label class="f">Testo per l'AI<textarea class="field textarea-ai" rows="8" readonly id="ai-text">${esc(c.prompt)}</textarea></label>` : ""}
    <label class="f">File CSV da controllare<input class="field" type="file" accept=".csv,text/csv" data-act-change="csvFile" data-kind="${kind}" id="csv-file-${kind}"></label>
    <button type="button" class="btn sm" style="margin-top:8px" data-act="csvTry" data-kind="${kind}" id="csv-try-${kind}">Prova con il CSV di esempio</button>
    ${nut ? `<p class="small" style="margin-top:8px"><a href="#/tu/preferenze">Modifica preferenze e obiettivi</a></p>` : ""}
  </section></div>
  ${c.preview ? csvPreviewHtml(kind, c) : ""}`;
}
function csvPreviewHtml(kind, c) {
  const p = c.preview, act = kind === "training" ? activeProgram() : activePlan(), diff = act ? planDiff(kind, act, p.plan) : null;
  return `<section class="card" aria-label="Verifica importazione CSV" data-testid="csv-preview"><h2>Controllo del file · ${esc(c.filename)}</h2>
    ${p.errors.length ? `<div class="warnbox" role="alert"><b>Importazione bloccata.</b> Correggi le righe e ricarica il file.<ul>${p.errors.map((e) => `<li>Riga ${e.line}: ${esc(e.message)}</li>`).join("")}</ul></div>` : `<p class="tag ok">Nessun errore</p>`}
    ${p.warnings.length ? `<details><summary class="small" style="min-height:44px;display:flex;align-items:center;cursor:pointer">${p.warnings.length} avvisi da verificare</summary><ul class="small">${p.warnings.map((e) => `<li>Riga ${e.line}: ${esc(e.message)}</li>`).join("")}</ul></details>` : ""}
    ${!p.errors.length ? planSummary(kind, p.plan) : ""}
    ${diff && !p.errors.length ? `<p class="note">Rispetto a "${esc(act.title)}": aggiunti ${esc(diff.added.join(", ") || "nessuno")} · rimossi ${esc(diff.removed.join(", ") || "nessuno")} · modificati ${esc(diff.changed.join(", ") || "nessuno")}</p>` : ""}
    ${!p.errors.length ? `<label class="checkline"><input type="checkbox" data-act-change="csvConsent" data-kind="${kind}" ${c.consent ? "checked" : ""} id="csv-consent"> Confermo il salvataggio come bozza, senza attivazione automatica</label>` : ""}
    <div class="row" style="margin-top:12px"><button type="button" class="btn p" data-act="csvImport" data-kind="${kind}" ${p.errors.length || !c.consent ? "disabled" : ""} id="csv-import">Conferma importazione</button><button type="button" class="btn ghost" data-act="csvCancel" data-kind="${kind}">Annulla</button></div></section>`;
}
function planSummary(kind, plan) {
  if (kind === "training") return `<div class="small">${Object.keys(plan.days).map((k) => `<p><b>${esc(dayName(plan, k))}</b>: ${plan.days[k].map((b) => `${esc(b.name)} ${b.sets.length}×${esc(b.sets[0]?.reps || "")}`).join(" · ")}</p>`).join("")}</div>`;
  return `<div class="small">${["ON", "OFF"].map((m) => `<p><b>Giorno ${m}</b>: ${(plan.days[m] || []).map((x) => `${esc(x.name)} (${x.menus[0].groups.reduce((n, g) => n + g.options.length, 0)} alimenti)`).join(" · ") || "nessun pasto"}</p>`).join("")}</div>`;
}
function planDiff(kind, a, b) {
  const items = (p) => { const m = new Map(); if (kind === "training") for (const k of Object.keys(p.days)) for (const x of p.days[k]) m.set(k + " · " + x.name, JSON.stringify(x.sets.map((s) => s.reps)));
    else for (const md of ["ON", "OFF"]) for (const x of p.days[md] || []) m.set(md + " · " + x.name, JSON.stringify(x.menus)); return m; };
  const A2 = items(a), B2 = items(b);
  return { added: [...B2.keys()].filter((k) => !A2.has(k)), removed: [...A2.keys()].filter((k) => !B2.has(k)), changed: [...B2.keys()].filter((k) => A2.has(k) && A2.get(k) !== B2.get(k)) };
}
function activationSheetHtml(kind, id) {
  const p = listOf(kind).find((x) => x.id === id), act = kind === "training" ? activeProgram() : activePlan(), diff = act ? planDiff(kind, act, p) : null, f = ui.form;
  let matches = [];
  if (kind === "training" && act) for (const k of Object.keys(p.days)) for (const b of p.days[k]) { const ob = act.days[k]?.find((x) => x.name.toLowerCase() === b.name.toLowerCase()); if (ob) b.sets.forEach((s, i) => { const os = ob.sets[i], kg = os && S.standardLoads[stdKey(act.id, os.id)]; if (kg != null) matches.push({ day: k, name: b.name, i, kg, to: s.id }); }); }
  f.matches = matches;
  return sheet(`Attiva "${esc(p.title)}"`, `<form data-submit="activate" data-kind="${kind}" data-id="${id}" novalidate>
    ${diff ? `<p>Il piano attivo "${esc(act.title)}" verrà archiviato. Le giornate già registrate restano invariate.</p><p class="note">Aggiunti ${diff.added.length} · rimossi ${diff.removed.length} · modificati ${diff.changed.length}</p>` : `<p>Nessun piano attivo da archiviare.</p>`}
    ${kind === "training" ? `<h3 style="margin-top:12px">Carichi con corrispondenza esatta</h3><p class="small muted">Solo stesso giorno, stesso nome esercizio e stessa posizione della serie.</p>
      ${matches.length ? `<ul class="small">${matches.map((m) => `<li>${m.day} · ${esc(m.name)} · serie ${m.i + 1}: ${num.format(m.kg)} kg</li>`).join("")}</ul><label class="checkline"><input type="checkbox" data-scope="form" data-bind="transfer" ${f.transfer ? "checked" : ""}> Trasferisci questi carichi standard alla nuova scheda</label>` : `<p class="muted small">Nessuna corrispondenza: i carichi partiranno "da impostare".</p>`}` : ""}
    <label class="checkline"><input type="checkbox" name="ok" id="act-ok"> Confermo l'attivazione di questa versione</label>
    ${errBox()}<div class="sheet-actions"><button type="button" class="btn" data-act="closeSheet">Annulla</button><button class="btn p" id="act-save">${kind === "training" ? "Attiva scheda" : "Attiva piano"}</button></div></form>`);
}

/* CSV */
const CSV_HEAD = { nutrition: ["giorno", "pasto", "orario", "menu", "componente", "alimento", "quantita", "unita", "kcal", "proteine_g", "carboidrati_g", "grassi_g"], training: ["giorno", "nome_giorno", "esercizio", "serie", "ripetizioni", "recupero_s", "tipo", "per_gamba", "note"] };
const csvCell = (v) => { const s = String(v ?? ""); return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
function toCsv(kind, p) {
  const rows = [CSV_HEAD[kind]];
  if (kind === "nutrition") for (const md of ["ON", "OFF"]) for (const m of p.days[md] || []) m.menus.forEach((menu, mi) => menu.groups.forEach((g, gi) => g.options.forEach((o) =>
    rows.push([md, m.name, m.time, mi + 1, gi + 1, o.text, o.quantity ?? "", o.unit ?? "", ...["kcal", "protein_g", "carbs_g", "fat_g"].map((k) => o.nutrition?.[k] ?? "")].map((v) => String(v).replace(/^(\d+)\.(\d+)$/, "$1,$2"))))));
  else for (const k of Object.keys(p.days)) for (const b of p.days[k]) rows.push([k, dayName(p, k), b.name, b.sets.length, b.sets[0]?.reps || "", b.restSeconds ?? "", b.sets[0]?.kind === "warmup" ? "riscaldamento" : "lavoro", b.sets[0]?.perLeg ? "si" : "no", b.notes || ""]);
  return rows.map((r) => r.map(csvCell).join(";")).join("\n");
}
function splitCsv(text) {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/), sep = [";", "\t", ","].find((s) => lines[0].includes(s)) || ";";
  return lines.map((line) => { const out = []; let cur = "", q = false;
    for (let i = 0; i < line.length; i++) { const ch = line[i]; if (q) { if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') q = false; else cur += ch; } else if (ch === '"') q = true; else if (ch === sep) { out.push(cur.trim()); cur = ""; } else cur += ch; }
    out.push(cur.trim()); return out; });
}
const dec = (s) => (s === "" || s == null ? null : /^-?\d+([.,]\d+)?$/.test(s) ? Number(s.replace(",", ".")) : NaN);
function parseCsv(kind, text, filename) {
  const errors = [], warnings = [];
  if (text.length > 512 * 1024) return { errors: [{ line: 0, message: "File oltre 512 KiB." }], warnings, plan: null };
  const rows = splitCsv(text), head = rows[0].map((h) => h.toLowerCase());
  const miss = CSV_HEAD[kind].filter((h) => !head.includes(h));
  if (miss.length) return { errors: [{ line: 1, message: "Colonne mancanti: " + miss.join(", ") }], warnings, plan: null };
  const col = (r, h) => r[head.indexOf(h)] ?? "";
  const body = rows.slice(1).map((r, i) => ({ r, line: i + 2 })).filter((x) => x.r.some((c) => c));
  if (body.length > 1000) errors.push({ line: 0, message: "Oltre 1.000 righe." });
  for (const { r, line } of body) if (r.some((c) => /^[=+@]/.test(c) || /^-[^\d]/.test(c))) errors.push({ line, message: "Formule non ammesse." });
  const title = filename.replace(/\.csv$/i, "").replace(/[-_]/g, " ") || "Import CSV";
  if (kind === "nutrition") {
    const plan = { title, description: "", notes: "", days: { ON: [], OFF: [] } };
    for (const { r, line } of body) {
      const g = col(r, "giorno").toUpperCase(), name = col(r, "pasto"), time = col(r, "orario"), food = col(r, "alimento"), q = dec(col(r, "quantita"));
      if (g !== "ON" && g !== "OFF") { errors.push({ line, message: "giorno deve essere ON o OFF" }); continue; }
      if (!name) { errors.push({ line, message: "pasto obbligatorio" }); continue; }
      if (!food) { errors.push({ line, message: "alimento obbligatorio" }); continue; }
      if (time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) errors.push({ line, message: "orario non valido (HH:MM)" });
      if (Number.isNaN(q) || q < 0) errors.push({ line, message: "quantità non valida" });
      const nutr = {}; let known = 0;
      for (const [h, k] of [["kcal", "kcal"], ["proteine_g", "protein_g"], ["carboidrati_g", "carbs_g"], ["grassi_g", "fat_g"]]) { const v = dec(col(r, h)); if (Number.isNaN(v) || v < 0) errors.push({ line, message: h + " non valido" }); else if (v != null) { nutr[k] = v; known++; } }
      if (known && known < 4) warnings.push({ line, message: "valori nutrizionali incompleti: quelli mancanti restano sconosciuti" });
      if (!known) warnings.push({ line, message: "valori nutrizionali non indicati" });
      const key = name.toLowerCase().normalize("NFD").replace(/[^\w]+/g, "-");
      let meal = plan.days[g].find((m) => m.key === key);
      if (!meal) plan.days[g].push((meal = { key, name, time: time || "", sourceText: "", menus: [] }));
      const mi = Math.max(0, (parseInt(col(r, "menu"), 10) || 1) - 1), gi = Math.max(0, (parseInt(col(r, "componente"), 10) || 1) - 1);
      while (meal.menus.length <= mi) meal.menus.push({ title: meal.menus.length ? "Alternativa " + meal.menus.length : "Pasto principale", notes: "", groups: [] });
      const menu = meal.menus[mi]; while (menu.groups.length <= gi) menu.groups.push({ options: [] });
      menu.groups[gi].options.push({ id: "o-" + uid(), text: food, quantity: q ?? null, unit: col(r, "unita"), nutrition: known === 4 ? nutr : known ? { kcal: nutr.kcal ?? null, protein_g: nutr.protein_g ?? null, carbs_g: nutr.carbs_g ?? null, fat_g: nutr.fat_g ?? null } : null });
    }
    for (const md of ["ON", "OFF"]) for (const m of plan.days[md]) m.menus = m.menus.filter((x) => x.groups.length && x.groups.every((g) => g.options.length));
    if (!plan.days.ON.length && !plan.days.OFF.length && !errors.length) errors.push({ line: 2, message: "nessun pasto trovato" });
    return { errors, warnings, plan };
  }
  const plan = { title, displaySettings: { days: {} }, days: {}, cooldown: { name: "Defaticamento", seconds: 300, sourceText: "" } };
  for (const { r, line } of body) {
    const k = col(r, "giorno").toUpperCase(), name = col(r, "esercizio"), n = dec(col(r, "serie")), reps = col(r, "ripetizioni"), rest = dec(col(r, "recupero_s"));
    if (!/^[A-Z]$/.test(k)) { errors.push({ line, message: "giorno deve essere una lettera (A, B, C…)" }); continue; }
    if (!name) { errors.push({ line, message: "esercizio obbligatorio" }); continue; }
    if (!Number.isInteger(n) || n < 1 || n > 20) { errors.push({ line, message: "serie deve essere un intero tra 1 e 20" }); continue; }
    if (!reps) errors.push({ line, message: "ripetizioni obbligatorie" });
    if (Number.isNaN(rest) || rest < 0) errors.push({ line, message: "recupero non valido" });
    if (rest == null) warnings.push({ line, message: "recupero non indicato" });
    plan.days[k] ||= []; plan.displaySettings.days[k] ||= { name: col(r, "nome_giorno") || "Scheda " + k, description: "", weekdays: [] };
    const range = /^(\d+)-(\d+)$/.exec(reps), bid = k + (plan.days[k].length + 1) + "-" + uid().slice(-4);
    plan.days[k].push({ id: bid, name, anim: "press", phase: "main", restSeconds: rest, restRaw: rest != null ? rest + " s" : "", notes: col(r, "note"),
      sets: Array.from({ length: n }, (_, i) => ({ id: bid + "-" + (i + 1), reps, kind: col(r, "tipo") === "riscaldamento" ? "warmup" : "work", perLeg: col(r, "per_gamba") === "si", ...(range ? { repMin: +range[1], repMax: +range[2] } : {}) })) });
  }
  if (!Object.keys(plan.days).length && !errors.length) errors.push({ line: 2, message: "nessun esercizio trovato" });
  return { errors, warnings, plan };
}
function download(name, text) {
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob(["\uFEFF" + text], { type: "text/csv;charset=utf-8" })); a.download = name;
  document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
function aiPrompt(kind, priv) {
  const nut = kind === "nutrition";
  let t = `Compila un file CSV per PULSE (${nut ? "piano alimentare" : "scheda di allenamento"}).\nSeparatore ;  · decimali con virgola · una riga di intestazione:\n${CSV_HEAD[kind].join(";")}\n\n`;
  t += nut ? "Regole: giorno = ON o OFF. Righe con stesso pasto, menu e componente sono alternative (\"oppure\"); componenti diversi si sommano (\"+\"). Orario HH:MM. Lascia vuoti i valori nutrizionali che non conosci: non scrivere 0.\n"
    : "Regole: giorno = lettera A, B, C… · serie = numero intero · ripetizioni es. 8 oppure 10-12 · recupero in secondi · tipo = lavoro o riscaldamento · per_gamba = si/no. Non indicare carichi: si impostano nell'app.\n";
  if (priv) { const s = S.settings; t += `\nPreferenze: graditi ${s.preferences.liked.join(", ") || "—"}; non graditi ${s.preferences.disliked.join(", ") || "—"}.\nObiettivi indicativi: ${NUTR.map(([k, l, u]) => `${l} ${s.goals[k] ?? "—"} ${u}`).join(", ")}.\nGiorni di allenamento: ${daysLabel(s.trainingDays)}.\n`; }
  return t + "\nRispondi solo con il CSV.";
}

/* Editor visuale */
function newMeal(n) { return { key: "pasto-" + uid(), name: "", time: "", sourceText: "", menus: [{ title: "Pasto principale", notes: "", groups: [{ options: [{ id: "o-" + uid(), text: "", quantity: null, unit: "g", nutrition: null }] }] }] }; }
function newBlock(k) { const id = k + "-" + uid(); return { id, name: "", anim: "press", phase: "main", restSeconds: 90, restRaw: "90 s", notes: "", sets: [1, 2, 3].map((i) => ({ id: id + "-" + i, reps: "10", kind: "work", perLeg: false })) }; }
function tuEditor(kind = "nutrition", id) {
  const key = kind + "/" + (id || "new");
  if (ui.editorKey !== key || !ui.editor) {
    const src = id && listOf(kind).find((p) => p.id === id);
    const draft = src ? clone(src) : kind === "training"
      ? { title: "", description: "", notes: "", displaySettings: { days: { A: { name: "Scheda A", description: "", weekdays: [] } } }, days: { A: [newBlock("A")] }, cooldown: { name: "Defaticamento", seconds: 300, sourceText: "" } }
      : { title: "", description: "", notes: "", days: { ON: [newMeal()], OFF: [] } };
    ui.editor = { kind, id: src?.id || null, srcStatus: src?.status, draft, simple: true, tab: kind === "training" ? Object.keys(draft.days)[0] : "ON" };
    ui.editorKey = key; ui.errors = [];
  }
  const e = ui.editor, d = e.draft, tr = kind === "training";
  return `<a class="back" href="#/tu/piani/${kind}">${icon("left")} ${tr ? "Schede" : "Piani alimentari"}</a>
  <h1>${e.id ? (tr ? "Modifica scheda" : "Modifica piano") : tr ? "Nuova scheda" : "Nuovo piano alimentare"}<em>.</em></h1>
  ${e.id && e.srcStatus !== "draft" ? `<p class="note">Salvando crei una nuova versione in bozza: la versione attuale e lo storico restano invariati.</p>` : ""}
  <form data-submit="editor" novalidate>
  <section class="card"><label class="f">${tr ? "Nome scheda" : "Nome piano"}<input class="field" data-bind="title" value="${esc(d.title)}" required maxlength="160" id="ed-title"></label>
    <label class="f">Descrizione<input class="field" data-bind="description" value="${esc(d.description || "")}" maxlength="300"></label>
    <label class="f">Note generali<textarea class="field" data-bind="notes" maxlength="6000" rows="2">${esc(d.notes || "")}</textarea></label></section>
  <div class="row" style="margin-top:14px;justify-content:space-between"><div class="seg" role="group" aria-label="${tr ? "Giornata" : "Tipo di giorno"}" style="flex:1">${(tr ? Object.keys(d.days) : ["ON", "OFF"]).map((t) => `<button type="button" aria-pressed="${e.tab === t}" data-act="edTab" data-t="${t}">${tr ? t : "Giorno " + t}</button>`).join("")}${tr ? `<button type="button" data-act="edAddDay" aria-label="Aggiungi giornata">+</button>` : ""}</div>
    <div class="seg" role="group" aria-label="Interfaccia"><button type="button" aria-pressed="${e.simple}" data-act="edSimple" data-v="1" id="ed-simple">Semplice</button><button type="button" aria-pressed="${!e.simple}" data-act="edSimple" data-v="0" id="ed-adv">Avanzata</button></div></div>
  ${tr ? trainingEditor(e) : dietEditor(e)}
  ${errBox()}
  <div class="row" style="margin-top:16px"><button class="btn" name="mode" value="save" id="ed-save">Salva bozza</button><button class="btn p" name="mode" value="activate" id="ed-activate">Salva e attiva</button><a class="btn ghost" href="#/tu/piani/${kind}">Annulla</a></div></form>`;
}
const mv = (path, i, len) => `<button type="button" class="iconbtn" data-act="edMove" data-path="${path}" data-i="${i}" data-d="-1" ${i === 0 ? "disabled" : ""} aria-label="Sposta su">${icon("up")}</button><button type="button" class="iconbtn" data-act="edMove" data-path="${path}" data-i="${i}" data-d="1" ${i === len - 1 ? "disabled" : ""} aria-label="Sposta giù">${icon("down")}</button><button type="button" class="iconbtn danger" data-act="edDel" data-path="${path}" data-i="${i}" aria-label="Elimina">${icon("trash")}</button>`;
function dietEditor(e) {
  const meals = e.draft.days[e.tab] ||= [], base = `days.${e.tab}`;
  return `${meals.map((m, i) => `<section class="ed-block" style="background:var(--card)"><div class="ed-head"><label class="f grow">Pasto<input class="field" data-bind="${base}.${i}.name" value="${esc(m.name)}" required placeholder="Es. Pranzo"></label><label class="f" style="width:110px">Orario<input class="field" type="time" data-bind="${base}.${i}.time" value="${m.time || ""}"></label></div>
    <div class="row" style="justify-content:flex-end">${mv(base, i, meals.length)}</div>
    ${(e.simple ? m.menus.slice(0, 1) : m.menus).map((menu, mi) => `<div class="ed-block">${!e.simple ? `<div class="ed-head"><label class="f grow">Menu<input class="field" data-bind="${base}.${i}.menus.${mi}.title" value="${esc(menu.title)}"></label>${m.menus.length > 1 ? `<button type="button" class="iconbtn danger" data-act="edDel" data-path="${base}.${i}.menus" data-i="${mi}" aria-label="Elimina menu">${icon("trash")}</button>` : ""}</div>` : ""}
      ${menu.groups.map((g, gi) => `<div style="margin-top:8px"><p class="small"><b>${menu.groups.length > 1 || !e.simple ? "Componente " + (gi + 1) : "Alimenti"}</b>${!e.simple && menu.groups.length > 1 ? ` <button type="button" class="btn sm ghost danger" data-act="edDel" data-path="${base}.${i}.menus.${mi}.groups" data-i="${gi}">Rimuovi componente</button>` : ""}</p>
        ${g.options.map((o, oi) => `${oi ? `<p class="or">oppure</p>` : ""}<div class="optrow ${e.simple ? "" : "adv"}"><label class="f" style="margin:0">Alimento<input class="field" data-bind="${base}.${i}.menus.${mi}.groups.${gi}.options.${oi}.text" value="${esc(o.text)}" required></label>
          <label class="f" style="margin:0">Qtà<input class="field" type="number" min="0" step="any" data-bind="${base}.${i}.menus.${mi}.groups.${gi}.options.${oi}.quantity" value="${o.quantity ?? ""}"></label>
          <label class="f" style="margin:0">Unità<input class="field" data-bind="${base}.${i}.menus.${mi}.groups.${gi}.options.${oi}.unit" value="${esc(o.unit || "")}"></label>
          ${!e.simple ? `<label class="f" style="margin:0">kcal<input class="field" type="number" min="0" step="any" data-bind="${base}.${i}.menus.${mi}.groups.${gi}.options.${oi}.nutrition.kcal" value="${o.nutrition?.kcal ?? ""}"></label>` : ""}
          <button type="button" class="iconbtn danger" data-act="edDel" data-path="${base}.${i}.menus.${mi}.groups.${gi}.options" data-i="${oi}" aria-label="Elimina alimento" ${g.options.length === 1 ? "disabled" : ""}>${icon("x")}</button></div>`).join("")}
        <button type="button" class="btn sm ghost" data-act="edAdd" data-what="option" data-path="${base}.${i}.menus.${mi}.groups.${gi}.options">${icon("plus")} Alternativa (oppure)</button></div>`).join("")}
      <button type="button" class="btn sm" data-act="edAdd" data-what="group" data-path="${base}.${i}.menus.${mi}.groups">${icon("plus")} ${e.simple ? "Altro alimento (+)" : "Componente"}</button></div>`).join("")}
    ${!e.simple ? `<button type="button" class="btn sm" style="margin-top:8px" data-act="edAdd" data-what="menu" data-path="${base}.${i}.menus">${icon("plus")} Menu alternativo</button>` : ""}</section>`).join("")}
  ${!meals.length ? `<p class="empty">Nessun pasto nel giorno ${e.tab}.${e.tab === "OFF" ? ` <button type="button" class="btn sm" data-act="edCopyOn">Copia dal giorno ON</button>` : ""}</p>` : ""}
  <button type="button" class="btn wide" style="margin-top:12px" data-act="edAdd" data-what="meal" data-path="${base}" id="ed-add-meal">${icon("plus")} Aggiungi pasto</button>`;
}
function trainingEditor(e) {
  const d = e.draft, k = e.tab, blocks = d.days[k] ||= [], ds = (d.displaySettings ||= { days: {} }).days[k] ||= { name: "Scheda " + k, description: "", weekdays: [] }, base = `days.${k}`;
  return `<section class="card"><div class="frow"><label class="f">Nome giornata<input class="field" data-bind="displaySettings.days.${k}.name" value="${esc(ds.name)}"></label><label class="f">Descrizione<input class="field" data-bind="displaySettings.days.${k}.description" value="${esc(ds.description || "")}"></label></div>
    ${Object.keys(d.days).length > 1 ? `<button type="button" class="btn sm ghost danger" data-act="edDelDay">Rimuovi giornata ${k}</button>` : ""}</section>
  ${blocks.map((b, i) => `<section class="ed-block" style="background:var(--card)"><div class="ed-head"><label class="f grow">Esercizio<input class="field" data-bind="${base}.${i}.name" value="${esc(b.name)}" required placeholder="Es. Squat"></label><label class="f" style="width:110px">Recupero (s)<input class="field" type="number" min="0" max="900" data-bind="${base}.${i}.restSeconds" value="${b.restSeconds ?? ""}"></label></div>
    <div class="frow"><label class="f">Animazione<select class="field" data-bind="${base}.${i}.anim">${Object.entries(ANIMS).map(([v, l]) => `<option value="${v}" ${v === b.anim ? "selected" : ""}>${l}</option>`).join("")}</select></label><label class="f">Note<input class="field" data-bind="${base}.${i}.notes" value="${esc(b.notes || "")}"></label></div>
    ${e.simple ? `<div class="frow"><label class="f">Serie<input class="field" type="number" min="1" max="20" value="${b.sets.length}" data-act-change="edSets" data-i="${i}"></label><label class="f">Ripetizioni<input class="field" value="${esc(b.sets[0]?.reps || "")}" data-act-change="edReps" data-i="${i}" placeholder="8 o 10-12"></label></div>`
    : b.sets.map((s, j) => `<div class="optrow adv"><label class="f" style="margin:0">Serie ${j + 1} · rip.<input class="field" data-bind="${base}.${i}.sets.${j}.reps" value="${esc(s.reps)}" required></label><label class="f" style="margin:0">Tipo<select class="field" data-bind="${base}.${i}.sets.${j}.kind"><option value="work" ${s.kind === "work" ? "selected" : ""}>Lavoro</option><option value="warmup" ${s.kind === "warmup" ? "selected" : ""}>Riscald.</option></select></label>
        <label class="checkline" style="padding:0;align-items:center"><input type="checkbox" data-bind="${base}.${i}.sets.${j}.perLeg" ${s.perLeg ? "checked" : ""}> gamba</label><span></span><button type="button" class="iconbtn danger" data-act="edDel" data-path="${base}.${i}.sets" data-i="${j}" aria-label="Elimina serie ${j + 1}" ${b.sets.length === 1 ? "disabled" : ""}>${icon("x")}</button></div>`).join("") + `<button type="button" class="btn sm ghost" data-act="edAdd" data-what="set" data-path="${base}.${i}.sets">${icon("plus")} Serie</button>`}
    <div class="row" style="justify-content:flex-end">${mv(base, i, blocks.length)}</div></section>`).join("")}
  <button type="button" class="btn wide" style="margin-top:12px" data-act="edAdd" data-what="block" data-path="${base}" id="ed-add-block">${icon("plus")} Aggiungi esercizio</button>
  <section class="card"><h3>Defaticamento</h3><div class="frow"><label class="f">Nome<input class="field" data-bind="cooldown.name" value="${esc(d.cooldown?.name || "")}"></label><label class="f">Durata (s)<input class="field" type="number" min="0" data-bind="cooldown.seconds" value="${d.cooldown?.seconds ?? ""}"></label></div><label class="f">Note<input class="field" data-bind="cooldown.sourceText" value="${esc(d.cooldown?.sourceText || "")}"></label></section>`;
}
const getPath = (o, p) => p.split(".").reduce((a, k) => a?.[k], o);
function setPath(o, p, v) { const ks = p.split("."), last = ks.pop(); let cur = o; for (const k of ks) cur = cur[k] ??= {}; cur[last] = v; }

/* ---------- Azioni (click) ---------- */
A.closeSheet = () => closeSheet();
A.confirmOk = () => { const f = pendingOk; pendingOk = null; closeSheet(); f?.(); };
A.toggleMeal = (el) => {
  const d = el.dataset.date, k = el.dataset.key, m = mealsOf(d).find((x) => x.key === k);
  if (d > today()) return toast("Non puoi segnare un pasto di una giornata futura.");
  const was = !!m.st.consumedAt;
  commit(() => { const r = ensureDay(d); r.meals[k] = { ...(r.meals[k] || {}), consumedAt: was ? null : new Date().toISOString() }; r.revision++; }, was ? `${m.name}: consumo annullato` : `${m.name} segnato come mangiato`);
};
A.mealSheet = (el) => { const d = el.dataset.date, k = el.dataset.key; openSheet(() => mealSheetHtml(d, k)); };
A.pickOption = (el) => {
  const { date: d, key: k, g, o } = el.dataset, m = mealsOf(d).find((x) => x.key === k);
  if (m.st.consumedAt) return toast("Pasto già consumato: sostituzione bloccata.");
  commit(() => { const r = ensureDay(d), st = (r.meals[k] ||= {}); st.selections ||= []; st.selections[+g] = +o; r.revision++; }, "Sostituzione salvata");
};
A.pickMenu = (el) => {
  const { date: d, key: k, i } = el.dataset, m = mealsOf(d).find((x) => x.key === k);
  if (m.st.consumedAt) return;
  commit(() => { const r = ensureDay(d), st = (r.meals[k] ||= {}); st.menuIndex = +i; st.selections = []; r.revision++; }, "Menu cambiato");
};
A.fav = (el) => commit(() => { const id = el.dataset.oid; if (S.favorites[id]) delete S.favorites[id]; else S.favorites[id] = true; }, S.favorites[el.dataset.oid] ? "Tolto dai preferiti" : "Aggiunto ai preferiti");
A.modeSheet = (el) => { const d = el.dataset.date; openSheet(() => modeSheetHtml(d)); };
A.setMode = (el) => {
  const { date: d, mode } = el.dataset;
  if (anyConsumed(d)) return toast("Annulla prima i pasti consumati.");
  closeSheet();
  commit(() => { const r = ensureDay(d); r.override = mode === "auto" ? null : mode; r.meals = {}; r.revision++; }, mode === "auto" ? "Tornato all'automatico" : `Giorno impostato su ${mode} solo per questa data`);
};
A.applyActive = (el) => commit(() => { const r = ensureDay(el.dataset.date); r.planId = activePlan().id; r.meals = {}; r.revision++; }, "Giornata aggiornata al piano attivo");
A.dietTab = (el) => { ui.dietTab = el.dataset.tab; render(); };
A.toggleIntake = (el) => {
  const { pid, sid, date: d } = el.dataset, p = S.supplements.find((x) => x.id === pid);
  const ex = S.intakes.find((i) => i.productId === pid && i.slotId === sid && i.day === d && i.status === "taken");
  commit(() => { if (ex) { ex.status = "cancelled"; ex.cancelledAt = new Date().toISOString(); } else S.intakes.push({ id: "in-" + uid(), productId: pid, slotId: sid, day: d, dose: p.quantity, unit: p.unit, status: "taken", takenAt: new Date().toISOString() }); },
    ex ? `${p.name}: assunzione annullata` : `${p.name} assunto`);
};
A.snooze = (el) => { const min = +el.dataset.min; commit(() => { (S.reminderState[el.dataset.id] ||= {}).snoozedUntil = new Date(Date.now() + min * 60000).toISOString(); }, `Rinviato di ${min} minuti`); };
A.ack = (el) => commit(() => { (S.reminderState[el.dataset.id] ||= {}).ackDay = today(); }, "Chiuso per oggi");
A.weightSheet = () => { ui.errors = []; openSheet(() => sheet("Registra peso", weightForm(true))); };
A.startWorkout = (el) => {
  if (S.session) return go("#/sessione");
  const prog = activeProgram(), k = el.dataset.day;
  S.session = { clientId: uid(), status: "active", programId: prog.id, day: k, startedAt: new Date().toISOString(), cur: 0, timer: null,
    snapshot: { title: dayName(prog, k), cooldown: prog.cooldown, blocks: prog.days[k].map((b) => ({ id: b.id, name: b.name, anim: b.anim, phase: b.phase, restSeconds: b.restSeconds, notes: b.notes,
      sets: b.sets.map((s) => ({ ...s, standardAtStart: S.standardLoads[stdKey(prog.id, s.id)] ?? null, draftKg: null, draftReps: null, actualKg: null, actualReps: null, status: "pending", completedAt: null })) })) } };
  save(); go("#/sessione");
};
A.animPause = (el) => { const svg = document.getElementById("anim-" + el.dataset.id); const p = svg.classList.toggle("paused"); el.setAttribute("aria-pressed", p); el.setAttribute("aria-label", p ? "Riprendi animazione" : "Pausa animazione"); el.innerHTML = icon(p ? "play" : "pause"); };
A.standardSheet = (el) => { ui.errors = []; const { day, block } = el.dataset; openSheet(() => standardSheetHtml(day, block)); };
A.sessionStandard = (el) => { ui.errors = []; const k = S.session.day, b = el.dataset.block; if (S.session.programId !== activeProgram()?.id) return toast("La scheda attiva è cambiata: aggiorna lo standard dalla scheda."); openSheet(() => standardSheetHtml(k, b)); };
A.organizeSheet = () => { const p = activeProgram(); ui.errors = []; ui.form = { days: clone(p.displaySettings?.days || {}), syncDays: true }; for (const k of Object.keys(p.days)) ui.form.days[k] ||= { name: "Scheda " + k, description: "", weekdays: [] }; openSheet(organizeSheetHtml); };
const findSet = (id) => sessionSets().find((x) => x.id === id);
A.repChip = (el) => { findSet(el.dataset.set).draftReps = +el.dataset.n; save(); render(); };
A.doneSet = (el) => {
  const x = findSet(el.dataset.set), mode = el.dataset.mode;
  const kgV = $("#kg-" + x.id).value, repV = $("#reps-" + x.id).value, kg = kgV === "" ? null : Number(kgV), reps = repV === "" ? null : Number(repV);
  if (mode === "recorded" && (kg == null || !(kg >= 0) || kg > 500)) { toast("Inserisci i kg di oggi (0 o più), oppure usa \"Senza peso\"."); return $("#kg-" + x.id).focus(); }
  if (reps != null && (!Number.isInteger(reps) || reps < 0 || reps > 100)) { toast("Ripetizioni: numero intero da 0 a 100."); return $("#reps-" + x.id).focus(); }
  const s = S.session, b = s.snapshot.blocks[s.cur];
  commit(() => {
    const y = findSet(x.id); // stesso oggetto dopo il clone di commit
    Object.assign(y, { status: mode, actualKg: mode === "recorded" ? kg : null, actualReps: reps, completedAt: new Date().toISOString() });
    // Lo standard NON viene toccato: actualKg è il peso della seduta, standardAtStart resta lo snapshot.
    const rest = b.restSeconds; if (rest) S.session.timer = { endAt: Date.now() + rest * 1000 };
    advance();
  }, `Serie registrata${mode === "recorded" ? `: ${num.format(kg)} kg` : ""}`);
};
A.skipSet = (el) => commit(() => { Object.assign(findSet(el.dataset.set), { status: "skipped", actualKg: null, actualReps: null, completedAt: new Date().toISOString() }); advance(); }, "Serie saltata");
A.skipBlock = () => commit(() => { for (const x of S.session.snapshot.blocks[S.session.cur].sets) if (x.status === "pending") Object.assign(x, { status: "skipped", completedAt: new Date().toISOString() }); advance(); }, "Esercizio saltato");
function advance() { const s = S.session, bl = s.snapshot.blocks; if (bl[s.cur].sets.some((x) => x.status === "pending")) return; const n = bl.findIndex((b) => b.sets.some((x) => x.status === "pending")); if (n >= 0) s.cur = n; }
A.goBlock = (el) => { S.session.cur = +el.dataset.i; save(); render(); };
A.restAdd = () => { S.session.timer.endAt += 15000; save(); updateClock(); };
A.restSkip = () => { S.session.timer = null; save(); render(); };
A.finishWorkout = () => {
  const sets = sessionSets(), n = sets.filter((x) => x.status === "recorded" || x.status === "unlogged").length, pend = sets.filter((x) => x.status === "pending").length;
  confirmSheet({ title: "Concludere l'allenamento?", text: `Hai registrato ${n} serie su ${sets.length}.${pend ? ` Le ${pend} serie rimaste verranno segnate come saltate.` : ""} Lo storico concluso non sarà più modificabile.`, ok: "Concludi",
    onOk: () => { for (const x of sessionSets()) if (x.status === "pending") x.status = "skipped";
      S.history.push({ ...S.session, status: "completed", completedAt: new Date().toISOString(), timer: null }); S.session = null; save(); go("#/oggi"); toast("Allenamento salvato nello storico"); } });
};
A.cancelWorkout = () => {
  const n = sessionSets().filter((x) => x.status === "recorded" || x.status === "unlogged").length;
  confirmSheet({ title: "Annullare questo allenamento?", text: `${n ? `Hai già completato ${n} serie. ` : ""}L'allenamento non comparirà nello storico.`, ok: "Annulla allenamento", danger: true,
    onOk: () => { S.session = null; save(); go("#/allena"); toast("Allenamento annullato"); } });
};
A.histAll = () => { ui.histAll = true; render(); };
A.period = (el) => { ui.period = +el.dataset.v; render(); };
A.calMonth = (el) => { const [y, m] = (ui.calMonth || today().slice(0, 7)).split("-").map(Number); const d = new Date(y, m - 1 + +el.dataset.d, 1); ui.calMonth = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; render(); };
A.theme = (el) => { S.settings.theme = el.dataset.v; save(); render(); };
A.resetDemo = () => confirmSheet({ title: "Azzerare i dati demo?", text: "Tutte le modifiche fatte nel prototipo verranno perse e tornano i dati sintetici iniziali.", ok: "Azzera", danger: true,
  onOk: () => { localStorage.removeItem(KEY); S = window.PULSE_SEED(new Date()); S.auth.loggedIn = true; ui.form = {}; ui.editor = null; save(); go("#/oggi"); render(); toast("Dati demo ripristinati"); } });
A.logout = () => { S.auth.loggedIn = false; save(); ui.errors = []; location.hash = ""; render(); };
A.installSheet = () => {
  const ua = navigator.userAgent, standalone = matchMedia("(display-mode: standalone)").matches;
  openSheet(() => sheet("Installa PULSE", standalone ? "<p>PULSE è già installata su questo dispositivo.</p>" : installPrompt ? `<button type="button" class="btn p wide" data-act="installNow">Installa sul dispositivo</button>`
    : /iPhone|iPad/.test(ua) ? "<p>In Safari apri il menu Condividi e scegli <b>Aggiungi alla schermata Home</b>.</p>" : /Android/.test(ua) ? "<p>Apri il menu ⋮ di Chrome e scegli <b>Installa app</b>.</p>"
    : "<p>Usa l'icona di installazione nella barra degli indirizzi, oppure cerca «Installa PULSE» nel menu di Chrome o Edge.</p><p class='note'>Nel prototipo non c'è un service worker: l'installazione vera è nell'app Vue.</p>"));
};
A.installNow = async () => { await installPrompt?.prompt(); installPrompt = null; closeSheet(); };
A.suppSheet = (el) => {
  const p = S.supplements.find((x) => x.id === el.dataset.id);
  ui.errors = []; ui.form = p ? { id: p.id, name: p.name, quantity: p.quantity, unit: p.unit, frequency: p.schedule.length || 1, times: p.schedule.map((s) => s.at || "").concat(Array(8).fill("")).slice(0, 8), slotIds: p.schedule.map((s) => s.id), weekdays: [...p.weekdays], mode: p.mode, active: p.active }
    : { name: "", quantity: null, unit: "", frequency: 1, times: Array(8).fill(""), slotIds: [], weekdays: [0, 1, 2, 3, 4, 5, 6], mode: "always", active: true };
  openSheet(suppSheetHtml);
};
A.suppDelete = (el) => { const p = S.supplements.find((x) => x.id === el.dataset.id);
  confirmSheet({ title: `Eliminare ${esc(p.name)}?`, text: "Lo storico delle assunzioni resta conservato.", ok: "Elimina", danger: true, onOk: () => commit(() => { S.supplements = S.supplements.filter((x) => x.id !== p.id); }, "Integratore eliminato") }); };
A.intakeFix = (el) => { const i = S.intakes.find((x) => x.id === el.dataset.id); ui.errors = [];
  openSheet(() => sheet("Rettifica quantità", `<form data-submit="intakeFix" data-id="${i.id}" novalidate><label class="f">Quantità assunta (${esc(i.unit)})<input class="field" name="dose" type="number" min="0" step="any" inputmode="decimal" value="${i.dose}" required autofocus></label>${errBox()}<div class="sheet-actions"><button type="button" class="btn" data-act="closeSheet">Indietro</button><button class="btn p">Salva rettifica</button></div></form>`)); };
A.intakeCancel = (el) => commit(() => { const i = S.intakes.find((x) => x.id === el.dataset.id); i.status = "cancelled"; i.cancelledAt = new Date().toISOString(); }, "Registrazione annullata");
A.askPerm = async () => { if ("Notification" in window) await Notification.requestPermission(); render(); };
A.testNotif = () => { const how = notify("PULSE", "Notifica di prova: i promemoria funzionano."); if (how === "system") toast("Notifica di sistema inviata"); };
A.remToggle = (el) => commit(() => { const r = S.reminders.find((x) => x.id === el.dataset.id); r.settings.enabled = !r.settings.enabled; }, "Promemoria aggiornato");
A.remDelete = (el) => { const r = S.reminders.find((x) => x.id === el.dataset.id); confirmSheet({ title: "Eliminare il promemoria?", text: esc(reminderLabel(r)), ok: "Elimina", danger: true, onOk: () => commit(() => { S.reminders = S.reminders.filter((x) => x !== S.reminders.find((y) => y.id === r.id)); }, "Promemoria eliminato") }); };
A.remWizard = (el) => { const r = S.reminders.find((x) => x.id === el.dataset.id); ui.errors = [];
  ui.wiz = { step: 1, id: r?.id || null, data: r ? clone(r.settings) : { kind: "meal", target: "", label: "", at: "12:30", timezone: "Europe/Rome", weekdays: [0, 1, 2, 3, 4, 5, 6], enabled: true } }; openSheet(wizardHtml); };
A.wizBack = () => { ui.wiz.step--; ui.errors = []; openSheet(wizardHtml); };
A.planDup = (el) => { const { kind, id } = el.dataset, L = listOf(kind), p = L.find((x) => x.id === id);
  commit(() => { L.push({ ...clone(p), id: (kind === "training" ? "tp-" : "np-") + uid(), title: p.title + " (copia)", status: "draft", provenance: "manual", version: Math.max(...L.map((x) => x.version)) + 1, createdAt: today() }); }, "Copia creata come bozza"); };
A.planExport = (el) => { const { kind, id } = el.dataset, p = listOf(kind).find((x) => x.id === id); download(`${p.title.replace(/\W+/g, "-")}-v${p.version}.csv`, toCsv(kind, p)); toast("CSV esportato"); };
A.planActivate = (el) => { const { kind, id } = el.dataset; ui.errors = []; ui.form = { transfer: true }; openSheet(() => activationSheetHtml(kind, id)); };
A.planDelete = (el) => { const { kind, id } = el.dataset, L = listOf(kind), p = L.find((x) => x.id === id);
  confirmSheet({ title: "Eliminare questa versione?", text: `"${esc(p.title)}" v${p.version} verrà eliminata. Le giornate già registrate conservano i loro pasti.`, ok: "Elimina", danger: true,
    onOk: () => commit(() => { L.splice(L.indexOf(L.find((x) => x.id === id)), 1); }, "Versione eliminata") }); };
A.csvTemplate = (el) => { const k = el.dataset.kind; download(`pulse-esempio-${k === "training" ? "allenamento" : "dieta"}.csv`, sampleCsv(k)); toast("CSV di esempio scaricato"); };
A.csvPrompt = async (el) => { const k = el.dataset.kind, c = (ui.csv[k] ||= {}); c.prompt = aiPrompt(k, c.private); render();
  try { await navigator.clipboard.writeText(c.prompt); toast("Testo per l'AI copiato"); } catch { $("#ai-text")?.select(); toast("Testo pronto: selezionato, copialo con Ctrl+C"); } };
A.csvTry = (el) => { const k = el.dataset.kind; ui.csv[k] = { ...ui.csv[k], filename: "esempio.csv", preview: parseCsv(k, sampleCsv(k), "Esempio importato"), consent: false }; render(); };
A.csvCancel = (el) => { const k = el.dataset.kind; ui.csv[k] = { private: ui.csv[k]?.private }; render(); };
A.csvImport = (el) => {
  const k = el.dataset.kind, c = ui.csv[k], L = listOf(k);
  if (!c?.preview || c.preview.errors.length || !c.consent) return;
  commit(() => { L.push({ ...c.preview.plan, id: (k === "training" ? "tp-" : "np-") + uid(), status: "draft", provenance: "csv", version: Math.max(0, ...L.map((x) => x.version)) + 1, createdAt: today(), csvData: true }); ui.csv[k] = {}; }, "Importato come bozza: attivalo quando vuoi", false);
};
function sampleCsv(kind) {
  return kind === "training"
    ? "giorno;nome_giorno;esercizio;serie;ripetizioni;recupero_s;tipo;per_gamba;note\nA;A · Total body;Squat;4;8;120;lavoro;no;\nA;A · Total body;Panca piana;4;8;90;lavoro;no;\nA;A · Total body;Lat machine;3;10-12;75;lavoro;no;\nB;B · Total body;Stacco rumeno;3;10;90;lavoro;no;\nB;B · Total body;Affondi;3;10;75;lavoro;si;Alternare le gambe"
    : "giorno;pasto;orario;menu;componente;alimento;quantita;unita;kcal;proteine_g;carboidrati_g;grassi_g\nON;Colazione;07:30;1;1;Yogurt greco 0%;170;g;100;17;6;0\nON;Colazione;07:30;1;2;Fiocchi d'avena;40;g;150;5,4;24;2,8\nON;Pranzo;13:00;1;1;Riso basmati;80;g;285;6;63;0,7\nON;Pranzo;13:00;1;1;Farro;80;g;;;;\nON;Pranzo;13:00;1;2;Petto di pollo;150;g;165;35;0;2\nON;Cena;20:00;1;1;Salmone;150;g;312;30;0;21\nOFF;Colazione;07:30;1;1;Yogurt greco 0%;170;g;100;17;6;0\nOFF;Pranzo;13:00;1;1;Insalata di legumi;250;g;;;;\nOFF;Cena;20:00;1;1;Merluzzo;200;g;164;36;0;1,4";
}
A.edTab = (el) => { ui.editor.tab = el.dataset.t; render(); };
A.edSimple = (el) => { ui.editor.simple = el.dataset.v === "1"; render(); };
A.edAddDay = () => { const d = ui.editor.draft, k = String.fromCharCode(Math.max(...Object.keys(d.days).map((x) => x.charCodeAt(0))) + 1); d.days[k] = [newBlock(k)]; d.displaySettings.days[k] = { name: "Scheda " + k, description: "", weekdays: [] }; ui.editor.tab = k; render(); };
A.edDelDay = () => { const e = ui.editor; delete e.draft.days[e.tab]; delete e.draft.displaySettings.days[e.tab]; e.tab = Object.keys(e.draft.days)[0]; render(); };
A.edCopyOn = () => { ui.editor.draft.days.OFF = clone(ui.editor.draft.days.ON); render(); };
A.edAdd = (el) => {
  const arr = getPath(ui.editor.draft, el.dataset.path), w = el.dataset.what, e = ui.editor;
  if (w === "meal") arr.push(newMeal()); else if (w === "block") arr.push(newBlock(e.tab));
  else if (w === "option") arr.push({ id: "o-" + uid(), text: "", quantity: null, unit: "g", nutrition: null });
  else if (w === "group") arr.push({ options: [{ id: "o-" + uid(), text: "", quantity: null, unit: "g", nutrition: null }] });
  else if (w === "menu") arr.push({ title: "Alternativa " + arr.length, notes: "", groups: [{ options: [{ id: "o-" + uid(), text: "", quantity: null, unit: "g", nutrition: null }] }] });
  else if (w === "set") { const last = arr.at(-1); arr.push({ ...clone(last || { reps: "10", kind: "work", perLeg: false }), id: el.dataset.path + "-" + uid() }); }
  render();
};
A.edDel = (el) => { getPath(ui.editor.draft, el.dataset.path).splice(+el.dataset.i, 1); render(); };
A.edMove = (el) => { const arr = getPath(ui.editor.draft, el.dataset.path), i = +el.dataset.i, j = i + +el.dataset.d; [arr[i], arr[j]] = [arr[j], arr[i]]; render(); };

/* ---------- Azioni (change) ---------- */
const CHG = {
  dietDate: (el) => el.value && go("#/dieta/" + el.value),
  shop: (el) => { const r = ensureDay(el.dataset.date); r.shopping[el.dataset.id] = el.checked; save(); },
  loadEx: (el) => { ui.loadEx = el.value; render(); },
  csvPrivate: (el) => { const c = (ui.csv[el.dataset.kind] ||= {}); c.private = el.checked; if (c.prompt) c.prompt = aiPrompt(el.dataset.kind, c.private); render(); },
  csvConsent: (el) => { ui.csv[el.dataset.kind].consent = el.checked; render(); },
  csvFile: (el) => { const k = el.dataset.kind, file = el.files[0]; if (!file) return;
    if (file.size > 512 * 1024) { ui.csv[k] = { ...ui.csv[k], filename: file.name, preview: { errors: [{ line: 0, message: "File oltre 512 KiB." }], warnings: [] } }; return render(); }
    file.text().then((t) => { ui.csv[k] = { ...ui.csv[k], filename: file.name, preview: parseCsv(k, t, file.name), consent: false }; render(); }); },
  edSets: (el) => { const b = ui.editor.draft.days[ui.editor.tab][+el.dataset.i], n = Math.max(1, Math.min(20, parseInt(el.value, 10) || 1)), proto = b.sets[0] || { reps: "10", kind: "work", perLeg: false };
    b.sets = Array.from({ length: n }, (_, i) => b.sets[i] || { ...clone(proto), id: b.id + "-" + uid() }); render(); },
  edReps: (el) => { const b = ui.editor.draft.days[ui.editor.tab][+el.dataset.i], r = /^(\d+)-(\d+)$/.exec(el.value.trim());
    for (const s of b.sets) { s.reps = el.value.trim(); if (r) { s.repMin = +r[1]; s.repMax = +r[2]; } else { delete s.repMin; delete s.repMax; } } },
};

/* ---------- Form (submit) ---------- */
/** Mostra gli errori dentro il form senza ridisegnarlo, così i valori digitati restano. */
function fail(form, msgs, focusSel) {
  let box = form.querySelector(".errbox");
  if (!box) { box = document.createElement("div"); box.className = "errbox"; box.setAttribute("role", "alert"); (form.querySelector(".sheet-actions") || form.lastElementChild).before(box); }
  box.innerHTML = msgs.map(esc).join("<br>");
  (focusSel ? form.querySelector(focusSel) || $(focusSel) : box)?.focus?.();
  return false;
}
SUBMIT.weight = (f, fd) => {
  const kg = Number(fd.get("kg")), day = fd.get("day");
  if (fd.get("kg") === "" || !(kg >= 30 && kg <= 300)) return fail(f, ["Il peso deve essere tra 30 e 300 kg."], f.dataset.sheet ? "#w-kg-s" : "#w-kg");
  if (!day || day > today()) return fail(f, ["Scegli una data non futura."]);
  ui.errors = []; if (f.dataset.sheet) closeSheet();
  commit(() => { S.weights = S.weights.filter((w) => w.day !== day).concat({ day, kg: Math.round(kg * 10) / 10 }).sort((a, b) => a.day.localeCompare(b.day)); }, `Peso salvato: ${num.format(kg)} kg`);
};
SUBMIT.standard = (f, fd) => {
  const prog = activeProgram(), b = prog.days[f.dataset.day].find((x) => x.id === f.dataset.block), vals = {};
  for (const s of b.sets) { const v = fd.get(s.id); if (v === "") { vals[s.id] = null; continue; } const n = Number(v); if (!(n >= 0 && n <= 500)) return fail(f, ["I kg devono essere tra 0 e 500."]); vals[s.id] = n; }
  if (!fd.get("ok")) return fail(f, ["Conferma l'aggiornamento dello standard."]);
  ui.errors = []; closeSheet();
  commit(() => { for (const [id, v] of Object.entries(vals)) S.standardLoads[stdKey(prog.id, id)] = v; }, "Carico standard aggiornato");
};
SUBMIT.organize = (fm) => {
  const f = ui.form, prog = activeProgram();
  if (Object.values(f.days).some((d) => !d.name.trim())) return fail(fm, ["Ogni scheda deve avere un nome."]);
  ui.errors = []; closeSheet();
  commit(() => { prog.displaySettings = { ...(prog.displaySettings || {}), days: clone(f.days) }; if (f.syncDays) S.settings.trainingDays = [...new Set(Object.values(f.days).flatMap((d) => d.weekdays))]; }, "Schede organizzate");
};
SUBMIT.manualRest = (f, fd) => { const s = Number(fd.get("sec")); if (!(s >= 5 && s <= 900)) { toast("Recupero tra 5 e 900 secondi."); return $("#manual-rest").focus(); } S.session.timer = { endAt: Date.now() + s * 1000 }; save(); render(); };
SUBMIT.supp = (fm) => {
  const f = ui.form, errs = [];
  if (!f.name?.trim()) errs.push("Il nome è obbligatorio.");
  if (!(f.quantity > 0)) errs.push("La quantità deve essere maggiore di zero.");
  if (!f.unit) errs.push("Scegli l'unità.");
  if (!f.weekdays.length) errs.push("Scegli almeno un giorno.");
  if (errs.length) return fail(fm, errs);
  const schedule = Array.from({ length: f.frequency }, (_, i) => ({ id: f.slotIds[i] || "sl-" + uid(), at: f.times[i] || "" }));
  const data = { name: f.name.trim(), quantity: f.quantity, unit: f.unit, weekdays: [...f.weekdays], mode: f.mode, active: f.active, schedule };
  ui.errors = []; closeSheet();
  commit(() => { if (f.id) Object.assign(S.supplements.find((x) => x.id === f.id), data); else S.supplements.push({ id: "s-" + uid(), ...data }); }, f.id ? "Integratore aggiornato" : "Integratore aggiunto");
};
SUBMIT.intakeFix = (f, fd) => { const v = Number(fd.get("dose")); if (fd.get("dose") === "" || !(v >= 0)) return fail(f, ["Quantità non valida."]); ui.errors = []; closeSheet();
  commit(() => { const i = S.intakes.find((x) => x.id === f.dataset.id); (i.audit ||= []).push({ from: i.dose, to: v, at: new Date().toISOString() }); i.dose = v; }, "Quantità rettificata"); };
SUBMIT.wizard = (fm) => {
  const w = ui.wiz, f = w.data;
  if (w.step === 1 && f.kind === "custom" && !f.label.trim()) return fail(fm, ["Dai un nome al promemoria personalizzato."], "#wiz-label");
  if (w.step === 2 && (f.kind === "meal" || f.kind === "supplement") && !f.target) return fail(fm, ["Scegli l'attività da ricordare."], "#wiz-target");
  if (w.step === 3 && (!/^\d\d:\d\d$/.test(f.at) || !f.weekdays.length)) return fail(fm, ["Indica orario e almeno un giorno."], "#wiz-at");
  ui.errors = [];
  if (w.step < 4) { w.step++; return openSheet(wizardHtml); }
  closeSheet();
  commit(() => { if (w.id) S.reminders.find((r) => r.id === w.id).settings = clone(f); else S.reminders.push({ id: "r-" + uid(), settings: clone(f) }); delete S.reminderState[w.id]; }, "Promemoria salvato");
};
SUBMIT.prefs = (fm) => {
  const f = ui.form, goals = {};
  for (const [k] of NUTR) { const v = f.goals[k]; if (v == null || v === "") goals[k] = null; else if (!(Number(v) >= 0)) return fail(fm, ["Gli obiettivi devono essere numeri non negativi."]); else goals[k] = Number(v); }
  const split = (s) => String(s).split(",").map((x) => x.trim()).filter(Boolean);
  ui.errors = [];
  commit(() => { S.settings.trainingDays = [...f.trainingDays]; S.settings.preferences = { liked: split(f.liked), disliked: split(f.disliked) }; S.settings.goals = goals; ui.form = {}; }, "Preferenze salvate");
};
SUBMIT.account = (f, fd) => {
  const u = fd.get("username").trim(), cur = fd.get("current"), nx = fd.get("next"), cf = fd.get("confirm"), errs = [];
  if (!/^[a-zA-Z0-9_.-]{3,64}$/.test(u)) errs.push("Nome utente: da 3 a 64 tra lettere, numeri, punti, trattini o underscore.");
  if (cur !== S.auth.password) errs.push("La password attuale non è corretta.");
  if (nx && (nx.length < 12 || new TextEncoder().encode(nx).length > 72)) errs.push("La nuova password deve avere almeno 12 caratteri (massimo 72 byte).");
  if (nx && nx !== cf) errs.push("Le due nuove password non coincidono.");
  if (errs.length) return fail(f, errs);
  ui.errors = [];
  commit(() => { S.auth.username = u; if (nx) S.auth.password = nx; }, nx ? "Credenziali aggiornate: gli altri accessi verranno disconnessi" : "Credenziali aggiornate", false);
};
SUBMIT.activate = (f, fd) => {
  if (!fd.get("ok")) return fail(f, ["Conferma l'attivazione."], "#act-ok");
  const { kind, id } = f.dataset, L = listOf(kind), p = L.find((x) => x.id === id), matches = ui.form.matches || [], transfer = ui.form.transfer;
  ui.errors = []; closeSheet();
  commit(() => { for (const x of L) if (x.status === "active") x.status = "archived"; L.find((x) => x.id === id).status = "active";
    if (kind === "training" && transfer) for (const m of matches) S.standardLoads[stdKey(id, m.to)] = m.kg; }, `"${p.title}" attivato`, false);
};
SUBMIT.editor = (f, fd, submitter) => {
  const e = ui.editor, d = e.draft, tr = e.kind === "training", errs = [];
  if (!d.title?.trim()) errs.push("Il nome è obbligatorio.");
  if (tr) { if (!Object.values(d.days).some((x) => x.length)) errs.push("Aggiungi almeno un esercizio.");
    for (const [k, bl] of Object.entries(d.days)) bl.forEach((b, i) => { if (!b.name?.trim()) errs.push(`Scheda ${k}: esercizio ${i + 1} senza nome.`); if (b.sets.some((s) => !String(s.reps).trim())) errs.push(`Scheda ${k}: ${b.name || "esercizio " + (i + 1)} ha serie senza ripetizioni.`); if (b.restSeconds != null && !(b.restSeconds >= 0)) errs.push(`Scheda ${k}: recupero non valido.`); }); }
  else { if (!d.days.ON.length && !d.days.OFF.length) errs.push("Aggiungi almeno un pasto.");
    for (const md of ["ON", "OFF"]) d.days[md].forEach((m, i) => { if (!m.name?.trim()) errs.push(`Giorno ${md}: pasto ${i + 1} senza nome.`); if (m.menus.some((mn) => mn.groups.some((g) => g.options.some((o) => !o.text?.trim())))) errs.push(`Giorno ${md}: ${m.name || "pasto " + (i + 1)} ha alimenti senza nome.`);
      if (m.menus.some((mn) => mn.groups.some((g) => g.options.some((o) => o.quantity != null && !(o.quantity >= 0))))) errs.push(`Giorno ${md}: quantità non valide in ${m.name}.`);
      m.key ||= m.name.toLowerCase().replace(/\W+/g, "-"); }); }
  if (errs.length) return fail(f, errs, "#ed-title");
  ui.errors = [];
  const L = listOf(e.kind), overwrite = e.id && e.srcStatus === "draft";
  const saved = overwrite ? Object.assign(L.find((x) => x.id === e.id), clone(d)) : { ...clone(d), id: (tr ? "tp-" : "np-") + uid(), status: "draft", provenance: "manual", version: Math.max(0, ...L.map((x) => x.version)) + 1, createdAt: today() };
  if (!overwrite) L.push(saved);
  save(); ui.editor = null; ui.editorKey = "";
  go(`#/tu/piani/${e.kind}`);
  toast(overwrite ? "Bozza aggiornata" : `Salvato come bozza v${saved.version}`);
  if (submitter?.value === "activate") ui.afterNav = () => { ui.form = { transfer: true }; openSheet(() => activationSheetHtml(e.kind, saved.id)); };
};

/* ---------- Eventi globali ---------- */
let swallowClick = false, sw = null;
document.addEventListener("click", (ev) => {
  if (swallowClick) { swallowClick = false; ev.preventDefault(); return; }
  const el = ev.target.closest("[data-act]"); if (!el || el.disabled) return;
  if (el.tagName === "A" && el.dataset.act === "closeSheet") { closeSheet(); return; }
  const fn = A[el.dataset.act]; if (fn) { ev.preventDefault(); fn(el, ev); }
});
document.addEventListener("submit", (ev) => {
  const f = ev.target, fn = SUBMIT[f.dataset.submit]; if (!fn) return;
  ev.preventDefault(); fn(f, new FormData(f), ev.submitter);
});
document.addEventListener("change", (ev) => {
  const el = ev.target;
  if (el.dataset.actChange) return CHG[el.dataset.actChange]?.(el);
  if (el.dataset.bindArr) { const scope = scopeOf(el), arr = getPath(scope, el.dataset.bindArr), v = Number(el.value); const next = el.checked ? [...new Set([...arr, v])] : arr.filter((x) => x !== v); setPath(scope, el.dataset.bindArr, next); return; }
  if (el.dataset.bind && (el.type === "checkbox" || el.tagName === "SELECT")) bindValue(el);
});
document.addEventListener("input", (ev) => {
  const el = ev.target;
  if (el.dataset.bind && el.type !== "checkbox" && el.tagName !== "SELECT") bindValue(el);
  if (el.dataset.draft) { const x = findSet(el.dataset.set); if (!x) return; const v = el.value === "" ? null : Number(el.value); if (el.dataset.draft === "kg") x.draftKg = v; else x.draftReps = v; save(); }
});
const scopeOf = (el) => ({ form: ui.form, wiz: ui.wiz?.data }[el.dataset.scope] || ui.editor?.draft);
function bindValue(el) {
  const v = el.type === "checkbox" ? el.checked : el.type === "number" || el.dataset.bind === "frequency" ? (el.value === "" ? null : Number(el.value)) : el.value;
  const path = el.dataset.bind, scope = scopeOf(el);
  if (/\.nutrition\.kcal$/.test(path)) { const base = path.replace(/\.kcal$/, ""); if (!getPath(scope, base)) setPath(scope, base, { kcal: null, protein_g: null, carbs_g: null, fat_g: null }); }
  if (path === "restSeconds" || /\.restSeconds$/.test(path)) setPath(scope, path.replace(/restSeconds$/, "restRaw"), v == null ? "" : v + " s");
  setPath(scope, path, v);
  if (el.dataset.rerender) { if (el.dataset.scope === "wiz" && path === "kind") ui.wiz.data.target = ""; if (sheetRender) $("#sheet-body").innerHTML = sheetRender(); else render(); el.id && document.getElementById(el.id)?.focus(); }
}
$("#sheet").addEventListener("close", () => { if ($("#sheet").open) return; sheetRender = null; $("#sheet-body").innerHTML = ""; ui.errors = []; const c = sheetClose; sheetClose = null; c?.(); });
$("#sheet").addEventListener("click", (ev) => { if (ev.target.id === "sheet") closeSheet(); });
$("#toast-undo").addEventListener("click", () => { const u = toastUndo; toastUndo = null; $("#toast").classList.remove("show"); u?.(); });
window.addEventListener("hashchange", () => { ui.errors = []; if ($("#sheet").open) closeSheet(); render(); scrollTo(0, 0); $("#main")?.focus({ preventScroll: true }); const f = ui.afterNav; ui.afterNav = null; f?.(); });
matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", applyTheme);
window.addEventListener("beforeinstallprompt", (ev) => { ev.preventDefault(); installPrompt = ev; });
window.addEventListener("storage", (ev) => { if (ev.key === KEY) { S = loadState(); render(); } });

/* Swipe sulle righe pasto: destra = segna, sinistra = annulla. Alternativa da tastiera: il pulsante cerchio. */
document.addEventListener("pointerdown", (ev) => { const it = ev.target.closest(".item[data-swipe]"); if (!it || ev.button) return; sw = { it, x: ev.clientX, y: ev.clientY, dx: 0, on: false }; });
document.addEventListener("pointermove", (ev) => {
  if (!sw) return; const dx = ev.clientX - sw.x, dy = ev.clientY - sw.y;
  if (!sw.on) { if (Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(dx)) { sw = null; return; } if (Math.abs(dx) < 12) return; sw.on = true; sw.it.classList.add("swiping"); }
  sw.dx = dx; sw.it.style.transform = `translateX(${Math.max(-110, Math.min(110, dx))}px)`;
});
const endSwipe = () => {
  if (!sw) return; const { it, dx, on } = sw; sw = null; it.classList.remove("swiping"); it.style.transform = "";
  if (!on) return; swallowClick = true; setTimeout(() => (swallowClick = false), 50);
  const btn = it.querySelector(".check"), done = btn.getAttribute("aria-pressed") === "true";
  if ((dx > 80 && !done) || (dx < -80 && done)) A.toggleMeal(btn);
};
document.addEventListener("pointerup", endSwipe); document.addEventListener("pointercancel", endSwipe);

/* Timer di recupero: endAt persistito, sopravvive al reload. */
function updateClock() {
  const t = S.session?.timer; if (!t) return;
  const rem = Math.max(0, Math.ceil((t.endAt - Date.now()) / 1000)), el = $("#rest-clock");
  if (el) el.textContent = fmtClock(rem);
  if (rem <= 0) { S.session.timer = null; save(); navigator.vibrate?.(200); toast("Recupero finito: prossima serie"); if (location.hash.startsWith("#/sessione")) render(); }
}
setInterval(updateClock, 1000);
setInterval(() => tick(), 20000);

/* Hook per i test (Playwright). */
window.__pulse = { state: () => S, tick: () => tick(new Date()), dueReminders: () => dueReminders().map((r) => r.id), modeOf, autoMode };

setTimeout(() => { render(); tick(); }, 250); // breve skeleton iniziale visibile
