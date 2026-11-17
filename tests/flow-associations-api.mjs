import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";

const base = "http://127.0.0.1:8081";
const require = createRequire(import.meta.url);
const { serialize } = require("../backend/src/pulse/csv");
const { exampleRows } = require("../backend/src/pulse/plan-formats");
const [originalUser] = JSON.parse(readFileSync(process.env.PULSE_TEST_CREDENTIALS ||
  "/tmp/pulse-phase3-test/credentials.json"));
const [first, second] = JSON.parse(readFileSync(process.env.PULSE_CSV_CREDENTIALS ||
  "/tmp/pulse-csv-test/csv-credentials.json"));
const stateFile = "/tmp/pulse-csv-test/flow-associations-state.json";

async function client(user) {
  assert.match(user.email, /^pulse-(?:csv-)?test-[12]@example.invalid$/);
  let cookie;
  async function request(path, body, status = 200, method = body ? "PUT" : "GET", origin = base) {
    const res = await fetch(base + "/api/pulse" + path, {
      method,
      headers: { "Content-Type": "application/json", Origin: origin, ...(cookie ? { Cookie: cookie } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    assert.equal(res.status, status, path);
    if (res.headers.has("set-cookie")) cookie = res.headers.get("set-cookie").split(";")[0];
    return res;
  }
  const json = async (...args) => (await request(...args)).json();
  await json("/login", { identifier: user.email, password: user.password }, 200, "POST");
  return { request, json };
}
const a = await client(first), b = await client(second);
if (process.argv.includes("--verify-persistence")) {
  const state = JSON.parse(readFileSync(stateFile));
  const result = await a.json("/training");
  assert.deepEqual(result.program, state.program);
  assert.deepEqual(result.standards, state.standards);
  assert.deepEqual(result.history, state.history);
  assert.deepEqual(await a.json("/plans/training/" + result.program.id + "/export"), state.csv);
  const previous = await a.json("/plans/training/" + state.previousId);
  await a.json("/plans/training/" + state.previousId, {
    action: "activate", confirm: true, activationToken: previous.activation.token,
  });
  console.log("PASS restart PostgreSQL: associazioni manuali, carichi, storico e CSV.");
  process.exit(0);
}

const original = await client(originalUser);
const { program } = await original.json("/training");
assert.deepEqual(Object.keys(program.days).sort(), ["A", "B", "C"]);
assert.equal(Object.values(program.days).flat().length, 31);
assert.equal(program.days.A[0].flowId, "0025");
assert.equal(program.days.A[3].flowId, null);
assert.match(program.days.A[3].media[0].reason, /45°/);
const circuit = program.days.C.at(-1);
assert.equal(circuit.media.length, 3);
assert.ok(circuit.media.every((item) => !item.flowId && item.candidates.length));
const dataset = await original.json("/flow/search?q=panca%20piana%20bb&equipment=barbell");
assert.ok(dataset.items.some((e) => e.id === "0025"));
const search = await a.json("/flow/search?q=0025&muscle=pectorals");
assert.equal(search.items[0].id, "0025");
const meta = await a.json("/flow/exercises/0025");
for (const frame of meta.animation.frames) {
  const res = await a.request(frame.url.replace("/api/pulse", ""));
  assert.match(res.headers.get("content-type"), /image\/svg\+xml/);
  const actual = createHash("sha256").update(Buffer.from(await res.arrayBuffer())).digest("hex");
  assert.equal(actual, frame.sha256);
}
const anonymous = await fetch(base + "/api/pulse/flow/search");
assert.equal(anonymous.status, 401);

const before = await a.json("/training");
assert.ok(before.program && !before.active, "La fixture CSV non deve avere una sessione in corso");
let previousId = before.program.id;
if (before.program.title === "Fixture associazioni Flow" && process.env.PULSE_FLOW_RESTORE_ID)
  previousId = Number(process.env.PULSE_FLOW_RESTORE_ID);
async function importPlan(version) {
  const rows = exampleRows("training").map((row) => ({
    ...row, plan_name: "Fixture associazioni Flow", plan_id: "flow-regression", plan_version: version,
    ...(row.exercise_id === "press1" ? { exercise_name: "Panca piana BB", standard_kg: "60" } : {}),
  }));
  const body = { filename: "flow-test.csv", text: serialize("training", rows) };
  const preview = await a.json("/plans/training/preview", body, 200, "POST");
  assert.deepEqual(preview.errors, []);
  return a.json("/plans/training/import", { ...body, confirm: true, previewToken: preview.previewToken }, 200, "POST");
}
async function activate(plan) {
  const detail = await a.json("/plans/training/" + plan.id);
  return a.json("/plans/training/" + plan.id, {
    action: "activate", confirm: true, activationToken: detail.activation.token,
  });
}
const fixture = await importPlan("1");
await activate(fixture);
let now = await a.json("/training");
const fixtureStandards = now.standards;
const csv = await a.json("/plans/training/" + fixture.id + "/export");
const [press] = now.program.days.A;
const [block] = now.program.days.B;
const firstMove = block.media[0];
const selection = {
  confirm: true, programId: fixture.id, day: "B", blockId: block.id, key: firstMove.key,
  revision: now.program.flowRevision, flowId: "0310",
};
await b.json("/training/flow", selection, 404);
await a.json("/training/flow", selection, 403, "PUT", "https://example.invalid");
await a.json("/training/flow", { ...selection, flowId: "0841" }, 404);
await a.json("/training/flow", { ...selection, key: press.media[0].key }, 404);
const changed = await a.json("/training/flow", selection);
assert.equal(changed.days.B[0].media[0].flowId, "0310");
assert.equal(changed.days.B[0].media[1].flowId, null);
await a.json("/training/flow", selection, 409);
const removed = await a.json("/training/flow", {
  ...selection, day: "A", blockId: press.id, key: press.media[0].key,
  revision: changed.flowRevision, flowId: null,
});
assert.equal(removed.days.A[0].flowId, null);
assert.equal(removed.days.A[0].media[0].reason, "Animazione rimossa.");
now = await a.json("/training");
assert.deepEqual(now.standards, fixtureStandards);
assert.equal(now.standards["A:press1:1"].kg, 60);
assert.deepEqual(await a.json("/plans/training/" + fixture.id + "/export"), csv);
assert.deepEqual(now.history, before.history);

// A subsequent version of the same plan inherits only matching movement keys.
const later = await importPlan("2");
await activate(later);
const inherited = await a.json("/training");
assert.equal(inherited.program.days.B[0].media[0].flowId, "0310");
assert.equal(inherited.program.days.A[0].flowId, null);
assert.equal(inherited.standards["A:press1:1"].kg, 60);
await activate(fixture);
const saved = await a.json("/training");
writeFileSync(stateFile, JSON.stringify({ ...saved, previousId, csv }), { mode: 0o600 });
console.log("PASS Flow API: A/B/C originale, licenze, ricerca, SVG, scelta per circuito, revisioni, ownership, eredità CSV e storico.");
