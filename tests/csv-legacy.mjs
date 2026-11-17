import fs from "node:fs";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url),
  csv = require("../backend/src/pulse/csv"),
  plans = require("../backend/src/pulse/plans");
const [u] = JSON.parse(
  fs.readFileSync(
    process.env.PULSE_TEST_CREDENTIALS ||
      "/tmp/pulse-phase3-test/credentials.json",
  ),
);
assert.match(u.email, /^pulse-test-[12]@example.invalid$/);
const base = "http://127.0.0.1:1337";
let cookie = "";
async function get(path, body) {
  const r = await fetch(base + "/api/pulse" + path, {
    method: body ? "POST" : "GET",
    headers: {
      Origin: base,
      "Content-Type": "application/json",
      Cookie: cookie,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (r.headers.get("set-cookie"))
    cookie = r.headers.get("set-cookie").split(";")[0];
  assert.equal(r.status, 200);
  return r.json();
}
await get("/login", { identifier: u.email, password: u.password });
for (const kind of ["nutrition", "training"]) {
  const list = await get("/plans/" + kind);
  const legacy = list.find((p) => p.provenance !== "csv");
  assert(legacy);
  const exported = await get("/plans/" + kind + "/" + legacy.id + "/export");
  const round = csv.validate(kind, exported.csv, "legacy.csv");
  assert.deepEqual(round.errors, []);
  const detail = await get("/plans/" + kind + "/" + legacy.id);
  if (kind === "nutrition") {
    for (const mode of ["ON", "OFF"]) {
      assert.equal(
        round.plan.meals[mode].length,
        detail.plan.meals[mode].length,
      );
      for (const [i, m] of detail.plan.meals[mode].entries())
        for (const [mi, menu] of m.menus.entries())
          for (const [gi, group] of menu.groups.entries()) {
            assert.equal(
              round.plan.meals[mode][i].menus[mi].groups[gi].options.length,
              group.options.length,
            );
            assert.deepEqual(
              round.plan.meals[mode][i].menus[mi].groups[gi].options.map(
                (o) => o.foodName,
              ),
              group.options.map((o) => o.text),
            );
          }
    }
  } else {
    for (const day of Object.keys(detail.plan.days)) {
      assert.equal(round.plan.days[day].length, detail.plan.days[day].length);
      for (const [i, b] of detail.plan.days[day].entries()) {
        const r = round.plan.days[day][i];
        assert.equal(r.sets.length, b.sets.length);
        assert.deepEqual(
          r.videos.map((v) => v.url),
          b.videos.map((v) => v.url),
        );
        assert.deepEqual(
          r.movements.map((m) => [m.name, String(m.reps)]),
          b.movements.map((m) => [m.name, String(m.reps)]),
        );
      }
    }
    assert.equal(
      round.plan.cooldown.videos.length,
      detail.plan.cooldown.videos.length,
    );
    const loads = Object.fromEntries(
      Object.values(detail.plan.days)
        .flat()
        .flatMap((b) => b.sets.map((s) => [s.id, 60])),
    );
    const mappings = plans.candidates(detail.plan, round.plan, loads);
    assert(
      mappings.length > 0,
      "Gli identificativi esatti e i campi assenti devono consentire il trasferimento legacy",
    );
  }
  console.log(
    "PASS legacy export/parse",
    kind,
    round.rows.length,
    "rows",
    Buffer.byteLength(exported.csv),
    "bytes; struttura e fonti preservate, nessun import eseguito.",
  );
}
