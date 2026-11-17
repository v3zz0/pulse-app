import fs from "node:fs";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url),
  csv = require("../backend/src/pulse/csv"),
  formats = require("../backend/src/pulse/plan-formats");
const base = process.env.PULSE_TEST_BASE || "http://127.0.0.1:8081";
assert.match(base, /^http:\/\/(127\.0\.0\.1|localhost):\d+$/);
const users = JSON.parse(
  fs.readFileSync(
    process.env.PULSE_CSV_CREDENTIALS ||
      "/tmp/pulse-csv-test/csv-credentials.json",
  ),
);
async function client(u) {
  assert.match(u.email, /^pulse-csv-test-[12]@example.invalid$/);
  let cookie = "";
  const call = async (
    path,
    body,
    method = "PUT",
    expected = 200,
    origin = base,
  ) => {
    const r = await fetch(base + "/api/pulse" + path, {
      method: body ? method : "GET",
      headers: {
        Origin: origin,
        "Content-Type": "application/json",
        Cookie: cookie,
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (r.headers.get("set-cookie"))
      cookie = r.headers.get("set-cookie").split(";")[0];
    const raw = await r.text();
    const data = raw ? JSON.parse(raw) : null;
    assert.equal(
      r.status,
      expected,
      `${path}: ${JSON.stringify(data).slice(0, 300)}`,
    );
    return data;
  };
  await call("/login", { identifier: u.email, password: u.password }, "POST");
  return call;
}
const a = await client(users[0]),
  b = await client(users[1]);
const file = "/tmp/pulse-csv-test/restyle-supplements-state.json";
if (process.argv.includes("--verify-persistence")) {
  const state = JSON.parse(fs.readFileSync(file));
  const training = await a("/training");
  assert.deepEqual(training.program, state.program);
  assert.deepEqual(training.standards, state.standards);
  const products = await a("/supplements?includeArchived=1");
  assert.deepEqual(products.find((p) => p.id === state.product.id), state.product);
  assert.deepEqual(await a("/supplements/history"), state.history);
  assert.deepEqual((await a("/reminders")).find((r) => r.id === state.reminder.id), state.reminder);
  assert.deepEqual(await a("/weights"), state.weights);
  await a("/reminders/" + state.reminder.id, { action: "delete", revision: state.reminder.revision }, "PUT", 204);
  assert.deepEqual(await a("/plans/training/" + state.program.id + "/export"), state.csv);
  console.log("PASS persistenza PostgreSQL: scheda, standard, pesate, storico e promemoria.");
  process.exit(0);
}
async function activate(id) {
  const detail = await a("/plans/training/" + id);
  await a("/plans/training/" + id, {
    action: "activate",
    confirm: true,
    activationToken: detail.activation.token,
    transferLoads: false,
  });
}
if (process.argv.includes("--restore")) {
  const s = JSON.parse(fs.readFileSync(file));
  if (s.previousProgramId) await activate(s.previousProgramId);
  console.log("Fixture precedente riattivata, senza trasferimenti o reset.");
  process.exit(0);
}
let training = await a("/training"),
  previousProgramId = training.program?.id || null;
if (fs.existsSync(file)) {
  const prior = JSON.parse(fs.readFileSync(file));
  if (previousProgramId === prior.program.id)
    previousProgramId = prior.previousProgramId;
}
if (training.active)
  await a("/training/sessions/" + training.active.clientId, {
    action: "cancel",
    confirm: true,
    revision: training.active.revision,
    opId: randomUUID(),
    occurredAt: new Date().toISOString(),
  });
const historyBefore = training.history,
  oldStandards = training.standards;
const rows = formats.exampleRows("training");
rows[0].reps = "5";
rows[0].standard_kg = "60";
rows.push({
  ...rows[0],
  day: "C",
  exercise_id: "testc",
  exercise_name: "Movimento C",
  standard_kg: "",
});
for (const r of rows)
  Object.assign(r, {
    plan_id: "restyle-features-test",
    plan_name: "Test Allenati e Integratori",
    plan_version: "1",
  });
const body = {
    filename: "features.csv",
    text: csv.serialize("training", rows),
  },
  beforePlans = await a("/plans/training"),
  preview = await a("/plans/training/preview", body, "POST");
assert.deepEqual(preview.errors, []);
assert.equal((await a("/plans/training")).length, beforePlans.length);
const imported = await a(
  "/plans/training/import",
  { ...body, confirm: true, previewToken: preview.previewToken },
  "POST",
);
// Import does not silently activate a different version or replace its standards.
training = await a("/training");
if (previousProgramId !== imported.id) {
  assert.equal(training.program?.id || null, previousProgramId);
  assert.deepEqual(training.standards, oldStandards);
}
await activate(imported.id);
training = await a("/training");
assert.equal(training.standards["A:press1:1"].kg, 60);
const flow = await a("/flow/exercises/0025");
assert.equal(flow.id, "0025");
assert.equal(flow.animation.frames.length, 3);
for (const frame of flow.animation.frames) {
  assert.match(frame.url, /\/0025\/frame-0[012]\.svg$/);
}
await a("/flow/exercises/25", undefined, "GET", 404);
await a("/supplements/history?offset=-1", undefined, "GET", 400);
const originalCsv = await a("/plans/training/" + imported.id + "/export");
const names = {
  timezone: "Europe/Rome",
  days: {
    A: { name: "Lunedì", weekdays: [1] },
    B: { name: "Mercoledì", weekdays: [3, 6] },
    C: { name: "Venerdì", weekdays: [5] },
  },
};
await b(
  "/training/layout",
  { programId: imported.id, revision: 0, data: names, confirm: true },
  "PUT",
  404,
);
await a(
  "/training/layout",
  {
    programId: imported.id,
    revision: training.program.displayRevision,
    data: names,
    confirm: false,
  },
  "PUT",
  400,
);
const layout = await a("/training/layout", {
  programId: imported.id,
  revision: training.program.displayRevision,
  data: names,
  confirm: true,
});
await a(
  "/training/layout",
  {
    programId: imported.id,
    revision: layout.displayRevision - 1,
    data: names,
    confirm: true,
  },
  "PUT",
  409,
);
training = await a("/training");
assert.deepEqual(training.program.displaySettings, names);
assert.deepEqual(
  await a("/plans/training/" + imported.id + "/export"),
  originalCsv,
);
let session = await a(
  "/training/sessions",
  { clientId: randomUUID(), programId: imported.id, day: "A" },
  "POST",
);
const op = async (action) =>
  (session = await a("/training/sessions/" + session.clientId, {
    ...action,
    revision: session.revision,
    opId: randomUUID(),
    occurredAt: new Date().toISOString(),
  }));
assert.equal(session.snapshot.blocks[0].sets[0].draftKg, 60);
assert.equal(session.snapshot.blocks[0].sets[0].draftReps, 5);
await op({
  action: "set",
  setId: "A:press1:1",
  status: "pending",
  draftKg: 50,
  draftReps: 4,
});
await op({
  action: "set",
  setId: "A:press1:1",
  status: "unlogged",
  actualKg: 50,
  actualReps: 4,
});
assert.equal(session.snapshot.blocks[0].sets[0].actualKg, null);
await op({ action: "cancel", confirm: true });
assert.equal(session.status, "cancelled");
assert.equal(session.timer, null);
session = await a(
  "/training/sessions",
  { clientId: randomUUID(), programId: imported.id, day: "A" },
  "POST",
);
assert.equal(session.snapshot.blocks[0].sets[0].draftKg, 60);
await op({ action: "cancel", confirm: true });
assert.deepEqual((await a("/training")).history, historyBefore);
const dayFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit",
});
const today = dayFormat.format(new Date());
const tomorrow = new Date(Date.parse(today + "T12:00:00Z") + 86400000).toISOString().slice(0, 10);
const slots = [null, "13:00", "20:00"].map((at) => ({ id: randomUUID(), at }));
const draft = {
  confirm: true, daily: true, clientId: randomUUID(),
  data: { name: "Integratore sintetico API", quantity: 2.5, unit: "g", timezone: "Europe/Rome", slots },
};
const beforeReminders = await a("/reminders");
await a("/supplements", { ...draft, data: { ...draft.data, quantity: 0 } }, "POST", 400);
let product = await a("/supplements", draft, "POST");
assert.equal((await a("/supplements", draft, "POST")).id, product.id);
assert.deepEqual(await a("/reminders"), beforeReminders);
assert.equal(product.schedule.length, 3);
assert.equal(product.schedule[0].at, null);
assert.equal(product.schedule[0].dose, "2.5 g");
for (const day of [today, tomorrow]) {
  const dashboard = await a("/supplements/day/" + day + "?daily=1");
  const entries = dashboard.entries.filter((e) => e.productId === product.id);
  assert.equal(entries.length, 3);
  assert.ok(entries.every((e) => e.status === "pending"));
}
const intakePath = "/intakes/" + today;
const intakeBody = {
  confirm: true, productId: product.id, productRevision: product.revision,
  slot: slots[0].id, revision: 0, status: "taken", dose: "2.5 g",
  takenAt: new Date().toISOString(),
};
await b(intakePath, intakeBody, "PUT", 404);
await a(intakePath, intakeBody, "PUT", 403, "https://example.invalid");
const saved = await a(intakePath, intakeBody);
await a(intakePath, intakeBody, "PUT", 409);
assert.equal((await a(intakePath)).filter((r) => r.productId === product.id).length, 1);
const corrected = await a(intakePath, { ...intakeBody, status: "cancelled", revision: saved.revision });
assert.equal(corrected.corrections[0].status, "taken");
const taken = await a(intakePath, { ...intakeBody, slot: slots[1].id });
assert.equal(taken.takenAt, intakeBody.takenAt);
product = await a("/supplements/" + product.id, {
  ...draft, revision: product.revision,
  data: { ...draft.data, quantity: 3, slots: slots.slice(0, 2) },
});
assert.equal(product.schedule[1].id, slots[1].id);
assert.deepEqual(await a("/reminders"), beforeReminders);
const history = await a("/supplements/history");
assert.equal(history.find((r) => r.id === taken.id).plannedSnapshot.dose, "2.5 g");
product = await a("/supplements/" + product.id, {
  action: "delete", revision: product.revision, confirm: true,
});
assert.ok(!(await a("/supplements")).some((r) => r.id === product.id));
assert.deepEqual(await a("/supplements/history"), history);
assert.ok(!(await b("/supplements/history")).some((r) => r.productId === product.id));

const reminderId = randomUUID(), path = "/reminders/" + reminderId;
const config = {
  kind: "custom", label: "Promemoria API sintetico", timezone: "Europe/Rome",
  enabled: true, at: "00:00", weekdays: [0, 1, 2, 3, 4, 5, 6],
};
let reminder = await a(path, { action: "settings", revision: 0, settings: config });
await a(path, { action: "settings", revision: 0, settings: config }, "PUT", 409);
await b(path, { action: "toggle", revision: reminder.revision, enabled: false }, "PUT", 409);
const due = (await a("/reminders/due")).find((r) => r.id === reminderId);
assert.ok(due);
reminder = await a(path, { action: "snooze", revision: due.revision, date: due.date, minutes: 15 });
assert.ok(!(await a("/reminders/due")).some((r) => r.id === reminderId));
reminder = await a(path, {
  action: "settings", revision: reminder.revision,
  settings: { ...config, at: "19:07", weekdays: [1, 3] },
});
reminder = await a(path, { action: "toggle", revision: reminder.revision, enabled: false });
assert.equal(reminder.settings.at, "19:07");
assert.equal(reminder.settings.enabled, false);
assert.deepEqual(reminder.settings.weekdays, [1, 3]);

const weightsPath = "/weights/" + today;
await a(weightsPath, { kg: -2 }, "PUT", 400);
await Promise.all([a(weightsPath, { kg: 72.4 }), a(weightsPath, { kg: 72.4 })]);
const weights = await a("/weights");
assert.deepEqual(weights.filter((r) => r.day === today), [{ day: today, kg: 72.4 }]);
const finalTraining = await a("/training");
fs.writeFileSync(file, JSON.stringify({
  previousProgramId, program: finalTraining.program, standards: finalTraining.standards,
  csv: originalCsv, product, history, reminder, weights,
}), { mode: 0o600 });
console.log("PASS API: CSV e carichi, 60→50→senza peso→60, Flow, assunzioni quotidiane, storico, peso concorrente e promemoria indipendenti.");
