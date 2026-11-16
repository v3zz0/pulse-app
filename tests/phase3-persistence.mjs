import fs from "node:fs";
import assert from "node:assert/strict";
const [u] = JSON.parse(
  fs.readFileSync(
    process.env.PULSE_TEST_CREDENTIALS ||
      "/tmp/pulse-phase3-test/credentials.json",
  ),
);
const base = process.env.PULSE_TEST_URL || "http://127.0.0.1:8081/api/pulse";
const login = await fetch(base + "/login", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ identifier: u.email, password: u.password }),
});
assert.equal(login.status, 200);
const Cookie = login.headers.get("set-cookie").split(";")[0];
const r = await fetch(base + "/training", { headers: { Cookie } });
assert.equal(r.status, 200);
const data = await r.json();
const stateFile =
  process.env.PULSE_TEST_STATE || "/tmp/pulse-phase3-test/persistence.json";
if (process.argv.includes("--capture")) {
  const reminderResponse = await fetch(base + "/reminders", {
    headers: { Cookie },
  });
  assert.equal(reminderResponse.status, 200);
  fs.writeFileSync(
    stateFile,
    JSON.stringify({
      nextId: data.active.clientId,
      timer: data.active.timer,
      revision: data.active.revision,
      reminders: await reminderResponse.json(),
    }),
    { mode: 0o600 },
  );
  console.log("Stato sintetico prima del riavvio registrato privatamente.");
  process.exit(0);
}
const expected = JSON.parse(fs.readFileSync(stateFile));
assert.equal(data.active.clientId, expected.nextId);
assert.deepEqual(data.active.timer, expected.timer);
assert.equal(data.active.revision, expected.revision);
assert.equal(data.standards["A:1:1"].kg, 60);
assert.ok(
  data.history.some(
    (h) =>
      h.snapshot.blocks[0].sets[0].status === "unlogged" &&
      h.snapshot.blocks[0].sets[0].actualKg === null,
  ),
);
console.log(
  "PASS dopo riavvio: sessione attiva, revisione, endAt originale, standard60 e storico unlogged invariati.",
);

if (expected.reminders) {
  const r = await fetch(base + "/reminders", { headers: { Cookie } });
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), expected.reminders);
  console.log(
    "PASS promemoria e impostazioni mantenuti dopo riavvio PostgreSQL.",
  );
}
