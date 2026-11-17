import fs from "node:fs";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
const require = createRequire(import.meta.url),
  csv = require("../backend/src/pulse/csv"),
  formats = require("../backend/src/pulse/plan-formats");
const base = process.env.PULSE_CSV_BASE || "http://127.0.0.1:1337";
const users = JSON.parse(
  fs.readFileSync(
    process.env.PULSE_CSV_CREDENTIALS ||
      "/tmp/pulse-csv-test/csv-credentials.json",
  ),
);
for (const u of users)
  assert.match(u.email, /^pulse-csv-test-[12]@example.invalid$/);
async function client(u) {
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
        "Content-Type": "application/json",
        Origin: origin,
        Cookie: cookie,
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (r.headers.get("set-cookie"))
      cookie = r.headers.get("set-cookie").split(";")[0];
    const raw = r.status === 204 ? "" : await r.text();
    let data = null;
    try {
      data = raw ? JSON.parse(raw) : null;
    } catch {
      data = { error: { message: "Risposta non JSON del proxy" } };
    }
    assert.equal(
      r.status,
      expected,
      `${path}: ${JSON.stringify(data).slice(0, 250)}`,
    );
    return data;
  };
  await call("/login", { identifier: u.email, password: u.password }, "POST");
  return call;
}
const a = await client(users[0]),
  b = await client(users[1]),
  tag = randomUUID().slice(0, 8);
// Only synthetic sessions are completed to make repeated test runs independent.
let priorSession = (await a("/training")).active;
if (priorSession) {
  for (const block of priorSession.snapshot.blocks)
    priorSession = await a("/training/sessions/" + priorSession.clientId, {
      action: "skip-block",
      blockId: block.id,
      revision: priorSession.revision,
      opId: randomUUID(),
      occurredAt: new Date().toISOString(),
    });
  for (const action of ["cooldown", "finish"])
    priorSession = await a("/training/sessions/" + priorSession.clientId, {
      action,
      revision: priorSession.revision,
      opId: randomUUID(),
      occurredAt: new Date().toISOString(),
    });
}
const before = await a("/plans/nutrition");
const prefs = await a("/personal-settings");
if (prefs.data.goals) assert.equal(prefs.data.goals.kcal, 2400);
assert.equal(prefs.suggestedGoals.kcal, 2900);
await a("/personal-settings", {
  revision: prefs.revision,
  confirm: true,
  data: {
    ...prefs.data,
    favoriteFoods: "Riso, pasta",
    goals: { kcal: 2400, protein_g: 130, carbs_g: 290, fat_g: 80 },
  },
});
await a(
  "/personal-settings",
  { revision: prefs.revision, confirm: true, data: prefs.data },
  "PUT",
  409,
);
assert.equal((await a("/personal-settings")).data.goals.kcal, 2400);
async function prepare(kind, version, mutate = () => {}) {
  const rows = formats.exampleRows(kind).map((r) => ({
    ...r,
    plan_id: "api-" + tag,
    plan_version: String(version),
    plan_name: `Test CSV ${kind} ${tag} v${version}`,
  }));
  mutate(rows);
  const body = { filename: "test.csv", text: csv.serialize(kind, rows) },
    preview = await a("/plans/" + kind + "/preview", body, "POST");
  assert.deepEqual(preview.errors, []);
  return { rows, body, preview };
}
let n = await prepare("nutrition", 1);
assert.equal((await a("/plans/nutrition")).length, before.length);
assert.equal(n.preview.plan.totals.ON.values.kcal, 445);
await a(
  "/plans/nutrition/import",
  { ...n.body, previewToken: n.preview.previewToken, confirm: false },
  "POST",
  400,
);
await b(
  "/plans/nutrition/import",
  { ...n.body, previewToken: n.preview.previewToken, confirm: true },
  "POST",
  409,
);
const imports = await Promise.all([
  a(
    "/plans/nutrition/import",
    { ...n.body, previewToken: n.preview.previewToken, confirm: true },
    "POST",
  ),
  a(
    "/plans/nutrition/import",
    { ...n.body, previewToken: n.preview.previewToken, confirm: true },
    "POST",
  ),
]);
assert.equal(imports[0].id, imports[1].id);
assert(imports.some((r) => r.reused));
let d = await a("/plans/nutrition/" + imports[0].id);
assert.equal(d.plan.status, "draft");
await b("/plans/nutrition/" + d.plan.id, undefined, "GET", 404);
await b("/plans/nutrition/" + d.plan.id + "/export", undefined, "GET", 404);
await b(
  "/plans/nutrition/" + d.plan.id,
  { action: "archive", confirm: true },
  "PUT",
  404,
);
await a(
  "/plans/nutrition/" + d.plan.id,
  { action: "activate", confirm: true, activationToken: d.activation.token },
  "PUT",
  403,
  "https://hostile.invalid",
);
await a("/plans/nutrition/" + d.plan.id, {
  action: "activate",
  confirm: true,
  activationToken: d.activation.token,
});
const date = "2026-11-15",
  day = await a("/days/" + date);
const snapshot = structuredClone(day.meals);
let n2 = await prepare("nutrition", 2, (r) => {
  for (const x of r) x.food_name += " nuova";
});
const saved2 = await a(
  "/plans/nutrition/import",
  { ...n2.body, previewToken: n2.preview.previewToken, confirm: true },
  "POST",
);
const det2 = await a("/plans/nutrition/" + saved2.id);
await a("/plans/nutrition/" + saved2.id, {
  action: "activate",
  confirm: true,
  activationToken: det2.activation.token,
});
assert.deepEqual((await a("/days/" + date)).meals, snapshot);
assert.equal((await a("/nutrition")).id, saved2.id);
await a("/preferences", {
  optionKey: day.meals[0].menus[0].groups[0].options[0].id,
  status: "favorite",
  day: date,
});

const consumed = await a("/days/" + date, {
  action: "meal",
  mealId: day.meals[0].id,
  consumed: true,
  revision: day.revision,
});
await a(
  "/days/" + date,
  { action: "apply-plan", confirm: true, revision: consumed.revision },
  "PUT",
  409,
);
let clear = await a("/days/" + date, {
  action: "meal",
  mealId: day.meals[0].id,
  consumed: false,
  revision: consumed.revision,
});
const applied = await a("/days/" + date, {
  action: "apply-plan",
  confirm: true,
  revision: clear.revision,
});
assert.equal(applied.planId, saved2.id);
const exported = await a("/plans/nutrition/" + saved2.id + "/export");
const round = csv.validate("nutrition", exported.csv, "round.csv");
assert.deepEqual(round.errors, []);
assert.equal(round.plan.meals.OFF[0].menus[0].groups.length, 2);
const bad = await a(
  "/plans/nutrition/preview",
  {
    filename: "bad.csv",
    text: exported.csv.replace("format_version", "missing_header"),
  },
  "POST",
);
assert(bad.errors.length);
// Verify the larger CSV parser is scoped and ordinary JSON retains the old limit.
const largeRows = formats
  .exampleRows("nutrition")
  .map((r) => ({
    ...r,
    plan_id: "large-" + tag,
    notes: "x".repeat(3900),
    meal_notes: "y".repeat(3900),
    menu_notes: "z".repeat(3900),
    plan_notes: "w".repeat(3900),
  }))
  .flatMap((r) => [r, { ...r, alternative_id: r.alternative_id + "-extra" }]);
let large = csv.serialize("nutrition", largeRows);
assert(Buffer.byteLength(JSON.stringify({ text: large })) > 128 * 1024);
assert.deepEqual(
  (
    await a(
      "/plans/nutrition/preview",
      { filename: "large.csv", text: large },
      "POST",
    )
  ).errors,
  [],
);
await a("/personal-settings", { padding: "x".repeat(140000) }, "PUT", 413);
// Training standard transfer, exact matching, immutable snapshots and 60 -> 50 -> unlogged -> 60.
let t = await prepare("training", 1, (rows) => {
  rows[0].standard_kg = "60";
});
let t1 = await a(
  "/plans/training/import",
  { ...t.body, confirm: true, previewToken: t.preview.previewToken },
  "POST",
);
d = await a("/plans/training/" + t1.id);
await a("/plans/training/" + t1.id, {
  action: "activate",
  confirm: true,
  activationToken: d.activation.token,
});
let tr = await a("/training");
assert.equal(tr.standards["A:press1:1"].kg, 60);
let session = await a(
  "/training/sessions",
  { clientId: randomUUID(), programId: t1.id, day: "A" },
  "POST",
);
async function op(body) {
  session = await a("/training/sessions/" + session.clientId, {
    ...body,
    revision: session.revision,
    opId: randomUUID(),
    occurredAt: new Date().toISOString(),
  });
}
await op({
  action: "set",
  setId: "A:press1:1",
  status: "pending",
  draftKg: 50,
  actualReps: 8,
});
await op({
  action: "set",
  setId: "A:press1:1",
  status: "unlogged",
  actualReps: 8,
});
assert.equal(session.snapshot.blocks[0].sets[0].actualKg, null);
let t2p = await prepare("training", 2, (rows) => {
  rows[0].standard_kg = "20";
});
const t2 = await a(
  "/plans/training/import",
  { ...t2p.body, previewToken: t2p.preview.previewToken, confirm: true },
  "POST",
);
d = await a("/plans/training/" + t2.id);
assert(d.activation.matches.some((m) => m.kg === 60 && m.previousKg === 20));
await a(
  "/plans/training/" + t2.id,
  {
    action: "activate",
    confirm: true,
    activationToken: d.activation.token,
    transferLoads: true,
  },
  "PUT",
  409,
);
for (const block of session.snapshot.blocks)
  await op({ action: "skip-block", blockId: block.id });
await op({ action: "cooldown" });
await op({ action: "finish" });
const historySnapshot = structuredClone(session.snapshot);
d = await a("/plans/training/" + t2.id);
await a("/plans/training/" + t2.id, {
  action: "activate",
  confirm: true,
  activationToken: d.activation.token,
  transferLoads: true,
});
tr = await a("/training");
assert.equal(tr.standards["A:press1:1"].kg, 60);
assert.deepEqual(
  tr.history.find((h) => h.clientId === session.clientId).snapshot,
  historySnapshot,
);
const next = await a(
  "/training/sessions",
  { clientId: randomUUID(), programId: t2.id, day: "A" },
  "POST",
);
assert.equal(next.snapshot.blocks[0].sets[0].standardAtStart, 60);
const ex = await a("/plans/training/" + t2.id + "/export");
assert.deepEqual(csv.validate("training", ex.csv, "again.csv").errors, []);
assert(
  csv.parse(ex.csv, "again.csv").rows.some((r) => r.data.standard_kg === "60"),
);
await a(
  "/plans/training/" + t2.id,
  { action: "archive", confirm: true },
  "PUT",
  409,
);
// Custom training days must remain valid reminder targets after importing a program.
const reminderId = randomUUID();
const reminder = await a("/reminders/" + reminderId, {
  action: "settings",
  revision: 0,
  settings: {
    kind: "workout",
    target: "B",
    at: "00:00",
    timezone: "Europe/Rome",
    weekdays: [0, 1, 2, 3, 4, 5, 6],
    enabled: true,
  },
});
assert.equal(reminder.settings.target, "B");
await a(
  "/reminders/" + reminderId,
  { action: "delete", revision: reminder.revision },
  "PUT",
  204,
);
// Leave a clean active session for browser testing; no originals or historical records are deleted.
fs.writeFileSync(
  "/tmp/pulse-csv-test/api-state.json",
  JSON.stringify({
    nutritionId: saved2.id,
    trainingId: t2.id,
    sessionId: next.clientId,
    userId: users[0].id,
  }),
  { mode: 0o600 },
);
console.log(
  "PASS CSV API: preview/no writes, validation, concurrent idempotence, ownership/CSRF, goals/conflicts, immutable days/history, scoped body limits, round trips, transfer, 60/50/unlogged/60.",
);
