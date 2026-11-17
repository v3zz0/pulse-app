// Synthetic users only. Never run against production.
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
  const call = async (path, body, method = "PUT", expected = 200) => {
    const r = await fetch(base + "/api/pulse" + path, {
      method: body ? method : "GET",
      headers: {
        Origin: base,
        "Content-Type": "application/json",
        Cookie: cookie,
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (r.headers.get("set-cookie"))
      cookie = r.headers.get("set-cookie").split(";")[0];
    const data = await r.json();
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
  b = await client(users[1]);
const stateFile = "/tmp/pulse-csv-test/workout-proposals-state.json";
if (process.argv.includes("--verify-persistence")) {
  const expected = JSON.parse(fs.readFileSync(stateFile));
  for (const s of expected.sessions)
    assert.deepEqual(await a("/training/sessions/" + s.clientId), s);
  assert.deepEqual((await a("/training")).history, expected.history);
  console.log(
    "PASS PostgreSQL: snapshots, annullamenti e storico identici dopo restart.",
  );
  process.exit(0);
}
const before = (await a("/training")).history;
let s = (await a("/training")).active;
const body = (action, revision = s?.revision) => ({
  ...action,
  revision,
  opId: randomUUID(),
  occurredAt: new Date().toISOString(),
});
const op = async (action) =>
  (s = await a("/training/sessions/" + s.clientId, body(action)));
if (s) await op({ action: "cancel", confirm: true });
const rows = formats.exampleRows("training").filter((r) => r.day !== "A");
for (const [i, id, reps, kg] of [
  [1, "exact", "5", "60"],
  [2, "zero", "8", "0"],
  [3, "range", "8-10", ""],
  [4, "ced", "CED", ""],
  [5, "skip", "5", ""],
  [6, "wide", "8-25", ""],
])
  rows.push({
    ...formats.exampleRows("training")[0],
    exercise_order: String(i),
    exercise_id: id,
    exercise_name: `Test ${id}`,
    set_type: "work",
    reps,
    standard_kg: kg,
  });
for (const r of rows)
  Object.assign(r, {
    plan_id: "workout-proposals-test",
    plan_version: "2",
    plan_name: "Test sintetico proposte e annullamento",
  });
const file = {
  filename: "proposals.csv",
  text: csv.serialize("training", rows),
};
const preview = await a("/plans/training/preview", file, "POST");
assert.deepEqual(preview.errors, []);
const imported = await a(
  "/plans/training/import",
  { ...file, previewToken: preview.previewToken, confirm: true },
  "POST",
);
const detail = await a("/plans/training/" + imported.id);
await a("/plans/training/" + imported.id, {
  action: "activate",
  confirm: true,
  activationToken: detail.activation.token,
});
async function start(day = "A") {
  s = await a(
    "/training/sessions",
    { clientId: randomUUID(), programId: imported.id, day },
    "POST",
  );
  return s;
}
const set = (id) =>
  s.snapshot.blocks
    .flatMap((b) => b.sets)
    .find((s) => s.id === "A:" + id + ":1");
const captured = [];
await start();
assert.equal(set("exact").draftKg, 60);
assert.equal(set("exact").draftReps, 5);
assert.equal(set("exact").actualReps, null);
assert.equal(set("zero").draftKg, 0);
assert.equal(set("range").draftKg, null);
assert.equal(set("range").draftReps, null);
assert.deepEqual(set("range").repProposal.options, [8, 9, 10]);
assert.equal(set("wide").draftReps, null);
assert.equal(set("wide").repProposal.max, 25);
assert.equal(set("ced").draftReps, null);
await op({ action: "set", setId: "A:exact:1", status: "pending", draftKg: 50 });
await op({
  action: "set",
  setId: "A:exact:1",
  status: "pending",
  draftReps: 4,
});
assert.equal(set("exact").draftKg, 50);
assert.equal(set("exact").draftReps, 4);
assert.equal(set("exact").status, "pending");
assert.equal(set("exact").actualReps, null);
const replayDraft = body({
  action: "set",
  setId: "A:zero:1",
  status: "pending",
  draftReps: 7,
});
s = await a("/training/sessions/" + s.clientId, replayDraft);
const beforeRecord = structuredClone(s);
await op({
  action: "set",
  setId: "A:exact:1",
  status: "recorded",
  actualKg: 50,
  actualReps: 4,
});
assert.equal(set("exact").actualKg, 50);
assert.equal(set("exact").actualReps, 4);
assert.equal(set("exact").standardAtStart, 60);
assert.equal(s.metrics.volume, 200);
await a(
  "/training/sessions/" + s.clientId,
  body({
    action: "set",
    setId: "A:ced:1",
    status: "unlogged",
    actualReps: null,
  }),
  "PUT",
  400,
);
await op({
  action: "set",
  setId: "A:skip:1",
  status: "skipped",
  actualKg: 60,
  actualReps: 5,
});
assert.equal(set("skip").actualKg, null);
assert.equal(set("skip").actualReps, null);
await op({
  action: "set",
  setId: "A:ced:1",
  status: "unlogged",
  actualKg: 60,
  actualReps: 8,
});
assert.equal(set("ced").actualKg, null);
const oldSnapshot = structuredClone(s.snapshot),
  firstId = s.clientId;
await a(
  "/training/sessions/" + firstId,
  body({ action: "cancel", confirm: false }),
  "PUT",
  400,
);
const cancel = body({ action: "cancel", confirm: true }, 0); // stale device: cancellation wins, server keeps latest snapshot
s = await a("/training/sessions/" + firstId, cancel);
assert.equal(s.status, "cancelled");
assert.equal(s.timer, null);
assert.equal(s.metrics.volume, 0);
assert.deepEqual(s.snapshot, oldSnapshot);
assert.deepEqual(await a("/training/sessions/" + firstId, cancel), s);
assert.deepEqual(await a("/training/sessions/" + firstId, replayDraft), s); // replay returns terminal current state
await a(
  "/training/sessions/" + firstId,
  body(
    { action: "timer", command: "start", seconds: 60 },
    beforeRecord.revision,
  ),
  "PUT",
  409,
);
await b("/training/sessions/" + firstId, undefined, "GET", 404);
await b("/training/sessions/" + firstId, cancel, "PUT", 404);
assert.equal((await a("/training")).active, null);
assert(!(await a("/training")).history.some((h) => h.clientId === firstId));
assert.deepEqual(
  await a(
    "/training/sessions",
    { clientId: firstId, programId: imported.id, day: "A" },
    "POST",
  ),
  s,
);
captured.push(s);
await start();
assert.equal(set("exact").draftKg, 60);
assert.equal(set("exact").draftReps, 5);
await op({
  action: "set",
  setId: "A:exact:1",
  status: "unlogged",
  actualKg: 60,
  actualReps: 5,
});
assert.equal(set("exact").actualKg, null);
for (const block of s.snapshot.blocks)
  await op({ action: "skip-block", blockId: block.id });
await op({ action: "cooldown" });
await op({ action: "finish" });
const completed = structuredClone(s);
captured.push(s);
await a(
  "/training/sessions/" + s.clientId,
  body({ action: "cancel", confirm: true }),
  "PUT",
  409,
);
assert.deepEqual(await a("/training/sessions/" + s.clientId), completed);
await start();
await op({ action: "cancel", confirm: true });
captured.push(s); // accidental empty start
await start("B");
const circuit = s.snapshot.blocks[0].sets[0];
assert.equal(circuit.draftReps, null);
assert.equal(circuit.movements.length, 2);
assert.equal(circuit.movements[0].reps, "5");
await op({
  action: "set",
  setId: circuit.id,
  status: "unlogged",
  actualReps: null,
});
assert.equal(s.snapshot.blocks[0].sets[0].actualReps, null);
await op({ action: "cancel", confirm: true });
captured.push(s);
const after = await a("/training");
for (const old of before)
  assert.deepEqual(
    after.history.find((h) => h.clientId === old.clientId),
    old,
  );
assert.equal(after.standards["A:exact:1"].kg, 60);
assert(!after.history.some((h) => h.status === "cancelled"));
fs.writeFileSync(
  stateFile,
  JSON.stringify({ sessions: captured, history: after.history }),
  { mode: 0o600 },
);
console.log(
  "PASS API: 60/5 → 50×4 → nuovo 60/5; null/0, range, CED, circuiti, unlogged/skipped, annullamento vuoto/con serie, multi-device obsoleto, replay, ownership e storico immutabile.",
);
