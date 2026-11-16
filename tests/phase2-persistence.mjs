import fs from "node:fs";
import assert from "node:assert/strict";
const [user] = JSON.parse(
  fs.readFileSync(
    process.env.PULSE_TEST_CREDENTIALS || "/tmp/pulse-test/credentials.json",
  ),
);
const base = process.env.PULSE_TEST_URL || "http://127.0.0.1:8080/api/pulse";
const login = await fetch(base + "/login", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ identifier: user.email, password: user.password }),
});
assert.equal(login.status, 200);
const Cookie = login.headers.get("set-cookie").split(";")[0];
async function get(path) {
  const r = await fetch(base + path, { headers: { Cookie } });
  assert.equal(r.status, 200);
  return r.json();
}
assert.ok(
  (await get("/weights")).some((w) => w.day === "2026-11-16" && w.kg === 72.4),
);
assert.ok((await get("/days/2026-11-16")).meals.some((m) => m.consumedAt));
assert.ok((await get("/days/2026-11-17")).shopping.some((i) => i.checked));
assert.ok(
  (await get("/intakes/2026-11-16")).some((i) => i.dose === "1 dose test"),
);
await fetch(base + "/logout", {
  method: "POST",
  headers: { Cookie, "Content-Type": "application/json" },
  body: "{}",
});
console.log(
  "PASS dopo riavvio: peso, consumi, domani/spesa e assunzioni mantenuti in PostgreSQL.",
);
