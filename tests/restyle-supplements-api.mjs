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
if (process.argv.includes("--capture-flow")) {
  const state = JSON.parse(fs.readFileSync(file)),
    training = await a("/training");
  state.program = training.program;
  state.standards = training.standards;
  assert.equal(state.program.days.A[0].flowId, "0025");
  const ids = state.products.map((p) => p.id);
  state.products = (await a("/supplements?includeArchived=1")).filter((p) =>
    ids.includes(p.id),
  );
  state.history = await a("/supplements/history");
  state.reminders = (await a("/reminders")).filter((r) =>
    ids.map(String).includes(r.settings.target),
  );
  state.today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const dashboard = await a("/supplements/day/" + state.today);
  state.dayMode = {
    mode: dashboard.mode,
    modeSource: dashboard.modeSource,
    modeRevision: dashboard.modeRevision,
  };
  fs.writeFileSync(file, JSON.stringify(state), { mode: 0o600 });
  console.log(
    "Fotografia privata di programma, carichi, prodotti, modalità e storico aggiornata per il restart.",
  );
  process.exit(0);
}
if (process.argv.includes("--verify-persistence")) {
  const state = JSON.parse(fs.readFileSync(file)),
    training = await a("/training"),
    products = await a("/supplements?includeArchived=1");
  assert.deepEqual(training.program, state.program);
  assert.deepEqual(training.standards, state.standards);
  for (const p of state.products)
    assert.deepEqual(
      products.find((v) => v.id === p.id),
      p,
    );
  assert.deepEqual(await a("/supplements/history"), state.history);
  const ids = state.products.map((p) => String(p.id));
  assert.deepEqual(
    (await a("/reminders"))
      .filter((r) => ids.includes(r.settings.target))
      .sort((a, b) => a.id.localeCompare(b.id)),
    state.reminders.sort((a, b) => a.id.localeCompare(b.id)),
  );
  assert.deepEqual(
    await a("/plans/training/" + state.program.id + "/export"),
    state.csv,
  );
  const dashboard = await a("/supplements/day/" + state.today);
  assert.deepEqual(
    {
      mode: dashboard.mode,
      modeSource: dashboard.modeSource,
      modeRevision: dashboard.modeRevision,
    },
    state.dayMode,
  );
  console.log(
    "PASS PostgreSQL: nomi, calendario, carichi, prodotti archiviati, pianificazioni, promemoria e storico dopo restart.",
  );
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
const today = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Rome",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date());
const slot = (at, mode = "ON") => ({
  id: randomUUID(),
  at,
  timezone: "Europe/Rome",
  weekdays: [0, 1, 2, 3, 4, 5, 6],
  mode,
  everyDays: 1,
  startDate: null,
  dose: "3 g sintetici",
  doseConfirmed: true,
  meal: "Pasto scelto in test",
  reminderEnabled: true,
});
const product = (name, schedule) => ({
  name,
  brand: "Marca sintetica",
  ingredients: "Creatina e caffeina dichiarate solo per test",
  labelQuantity: "1",
  labelUnit: "porzione",
  notes: "Dati sintetici, nessuna raccomandazione",
  instructions: "Etichetta sintetica",
  active: true,
  declaredActives: [
    { name: "Creatina", quantity: 3, unit: "g" },
    { name: "Caffeina", quantity: null, unit: "" },
  ],
  schedule,
});
const slots = [slot("00:01"), slot("00:02")],
  clientId = randomUUID();
let p = await a(
  "/supplements",
  { clientId, data: product("Test prodotto uno", slots), confirm: true },
  "POST",
);
assert.equal(
  (
    await a(
      "/supplements",
      { clientId, data: product("Test prodotto uno", slots), confirm: true },
      "POST",
    )
  ).id,
  p.id,
);
await b(
  "/supplements/" + p.id,
  { data: p, revision: p.revision, confirm: true },
  "PUT",
  404,
);
await a(
  "/supplements/" + p.id,
  { data: { ...p, schedule: [null] }, revision: p.revision, confirm: true },
  "PUT",
  400,
);
await a(
  "/supplements/" + p.id,
  { data: p, revision: p.revision, confirm: true },
  "PUT",
  403,
  "https://hostile.invalid",
);
const p2 = await a(
  "/supplements",
  {
    clientId: randomUUID(),
    data: product("Test prodotto due", [slot("00:03", "OFF")]),
    confirm: true,
  },
  "POST",
);
let dashboard = await a("/supplements/day/" + today);
await a("/supplements/day/" + today, {
  mode: "ON",
  revision: dashboard.modeRevision,
});
dashboard = await a("/supplements/day/" + today);
assert(
  dashboard.entries
    .filter((e) => e.productId === p.id)
    .every((e) => e.status === "pending"),
);
assert(!dashboard.entries.some((e) => e.productId === p2.id));
assert(dashboard.overlaps.some((o) => o.ingredient === "creatina"));
let managed = (await a("/reminders")).filter(
  (r) => r.settings.target === String(p.id) && r.settings.scheduleId,
);
assert.equal(managed.length, 2);
await a(
  "/reminders/" + managed[0].id,
  {
    action: "settings",
    revision: managed[0].revision,
    settings: managed[0].settings,
  },
  "PUT",
  409,
);
const reminderIds = managed.map((r) => r.id).sort();
p = await a("/supplements/" + p.id, {
  data: { ...p, notes: "Modificato in test" },
  revision: p.revision,
  confirm: true,
});
assert.deepEqual(
  (await a("/reminders"))
    .filter((r) => r.settings.target === String(p.id) && r.settings.scheduleId)
    .map((r) => r.id)
    .sort(),
  reminderIds,
);
const intakeBody = {
  productId: p.id,
  slot: slots[0].id,
  status: "taken",
  dose: "2 g effettivi sintetici",
  takenAt: new Date().toISOString(),
  timezone: "Europe/Rome",
  revision: 0,
  confirm: true,
};
let taken = await a("/intakes/" + today, intakeBody);
assert.equal(taken.dose, intakeBody.dose);
assert.equal(taken.plannedSnapshot.dose, slots[0].dose);
await a("/intakes/" + today, intakeBody, "PUT", 409);
await b("/intakes/" + today, intakeBody, "PUT", 404);
// Separate explicit manual events may share a timestamp; retrying one UUID cannot duplicate it.
const manualTime = new Date().toISOString(),
  manual = {
    productId: p.id,
    slot: randomUUID(),
    manual: true,
    status: "taken",
    dose: null,
    takenAt: manualTime,
    timezone: "Europe/Rome",
    revision: 0,
    confirm: true,
  };
const manualOne = await a("/intakes/" + today, manual);
await a("/intakes/" + today, manual, "PUT", 409);
const manualTwo = await a("/intakes/" + today, {
  ...manual,
  slot: randomUUID(),
});
assert.notEqual(manualOne.id, manualTwo.id);
assert.equal(manualOne.takenAt, manualTwo.takenAt);
await a(
  "/intakes/" + today,
  { ...manual, manual: false, slot: randomUUID() },
  "PUT",
  404,
);
let due = await a("/reminders/due");
assert(!due.some((r) => r.settings.scheduleId === slots[0].id));
assert(due.some((r) => r.settings.scheduleId === slots[1].id));
p = await a("/supplements/" + p.id, {
  data: {
    ...p,
    name: "Test prodotto rinominato",
    ingredients: "Etichetta aggiornata",
  },
  revision: p.revision,
  confirm: true,
});
let preserved = (await a("/supplements/history")).find(
  (r) => r.id === taken.id,
);
assert.equal(preserved.name, "Test prodotto uno");
assert.equal(
  preserved.productSnapshot.ingredients,
  intakeBody.productSnapshot?.ingredients ||
    "Creatina e caffeina dichiarate solo per test",
);
const skipped = await a("/intakes/" + today, {
  productId: p.id,
  slot: slots[1].id,
  status: "skipped",
  revision: 0,
  confirm: true,
});
assert.equal(skipped.takenAt, null);
assert.equal(skipped.dose, null);
assert(
  !(await a("/reminders/due")).some((r) => r.settings.target === String(p.id)),
);
taken = await a("/intakes/" + today, {
  ...intakeBody,
  dose: "1 g rettificato sintetico",
  revision: taken.revision,
});
assert.equal(taken.corrections.length, 1);
assert.equal(taken.productSnapshot.name, "Test prodotto uno");
taken = await a("/intakes/" + today, {
  productId: p.id,
  slot: slots[0].id,
  status: "cancelled",
  revision: taken.revision,
  confirm: true,
});
assert.equal(taken.corrections.length, 2);
assert.equal(taken.status, "cancelled");
assert(
  (await a("/reminders/due")).some(
    (r) => r.settings.scheduleId === slots[0].id,
  ),
);
for (const minutes of [15, 30, 60]) {
  const r = (await a("/reminders")).find(
    (r) => r.settings.scheduleId === slots[0].id,
  );
  const updated = await a("/reminders/" + r.id, {
    action: "snooze",
    minutes,
    date: today,
    revision: r.revision,
  });
  assert(Date.parse(updated.occurrence.snoozedUntil) > Date.now());
}
assert(
  !(await a("/reminders/due")).some(
    (r) => r.settings.scheduleId === slots[0].id,
  ),
);
dashboard = await a("/supplements/day/" + today);
await a("/supplements/day/" + today, {
  mode: "OFF",
  revision: dashboard.modeRevision,
});
dashboard = await a("/supplements/day/" + today);
assert(dashboard.entries.some((e) => e.productId === p2.id));
assert(!dashboard.entries.some((e) => e.productId === p.id && !e.unscheduled));
await a("/supplements/" + p.id, {
  action: "archive",
  revision: p.revision,
  confirm: true,
});
await a("/supplements/" + p2.id, {
  action: "archive",
  revision: p2.revision,
  confirm: true,
});
assert(!(await a("/supplements")).some((r) => r.id === p.id));
assert(
  !(await a("/reminders/due")).some((r) =>
    [String(p.id), String(p2.id)].includes(r.settings.target),
  ),
);
await a(
  "/intakes/" + today,
  {
    productId: p.id,
    slot: "12:34",
    status: "taken",
    revision: 0,
    confirm: true,
    dose: null,
  },
  "PUT",
  409,
);
const otherHistory = await b("/supplements/history");
assert(!otherHistory.some((r) => r.productId === p.id));
const products = (await a("/supplements?includeArchived=1")).filter((r) =>
  [p.id, p2.id].includes(r.id),
);
training = await a("/training");
fs.writeFileSync(
  file,
  JSON.stringify({
    previousProgramId,
    program: training.program,
    standards: training.standards,
    csv: originalCsv,
    products,
    history: await a("/supplements/history"),
    reminders: (await a("/reminders")).filter((r) =>
      [String(p.id), String(p2.id)].includes(r.settings.target),
    ),
  }),
  { mode: 0o600 },
);
console.log(
  "PASS API: CSV carichi/attivazione e versioni, rinomina/calendario/CSV immutabile, 60→50→senza peso→60, annullamento, CRUD integratori, ON/OFF, multi-orario, rettifiche/snapshot, archiviazione, sovrapposizioni, snooze e owner/CSRF.",
);
