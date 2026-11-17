import fs from "node:fs";
import assert from "node:assert/strict";
const users = JSON.parse(
  fs.readFileSync("/tmp/pulse-csv-test/csv-credentials.json"),
);
const baseline = "/tmp/pulse-csv-test/persistence.json",
  result = [];
for (const user of users) {
  assert.match(user.email, /^pulse-csv-test-[12]@example.invalid$/);
  const base = "http://127.0.0.1:8081";
  let cookie = "";
  async function get(path, body) {
    const r = await fetch(base + "/api/pulse" + path, {
      method: body ? "POST" : "GET",
      headers: {
        Origin: base,
        Cookie: cookie,
        "Content-Type": "application/json",
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    assert.equal(r.status, 200);
    if (r.headers.get("set-cookie"))
      cookie = r.headers.get("set-cookie").split(";")[0];
    return r.json();
  }
  await get("/login", { identifier: user.email, password: user.password });
  const data = {
    settings: await get("/personal-settings"),
    training: await get("/training"),
    nutrition: await get("/nutrition"),
    plans: {
      nutrition: await get("/plans/nutrition"),
      training: await get("/plans/training"),
    },
  };
  assert(data.training.active);
  assert.equal(
    data.training.standards[user === users[0] ? "A:press1:1" : "D:press1:1"].kg,
    60,
  );
  assert.equal(data.settings.data.goals.kcal, user === users[0] ? 2400 : 2500);
  result.push(data);
}
if (process.argv.includes("--capture")) {
  fs.writeFileSync(baseline, JSON.stringify(result), { mode: 0o600 });
  console.log("PASS: baseline privata catturata per entrambi gli account CSV.");
} else {
  assert.deepEqual(result, JSON.parse(fs.readFileSync(baseline)));
  console.log(
    "PASS PostgreSQL restart: piani/stati/versioni, preferenze/target/revisioni, standard60, sessioni e storico identici.",
  );
}
