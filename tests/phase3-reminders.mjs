import fs from "node:fs";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
const [u] = JSON.parse(
  fs.readFileSync(
    process.env.PULSE_TEST_CREDENTIALS ||
      "/tmp/pulse-phase3-test/credentials.json",
  ),
);
assert.match(u.email, /^pulse-test-1@example.invalid$/);
const base = process.env.PULSE_TEST_URL || "http://127.0.0.1:8081/api/pulse";
const login = await fetch(base + "/login", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ identifier: u.email, password: u.password }),
});
assert.equal(login.status, 200);
const Cookie = login.headers.get("set-cookie").split(";")[0];
async function req(p, b) {
  const r = await fetch(base + p, {
    method: b ? "PUT" : "GET",
    headers: { Cookie, "Content-Type": "application/json" },
    ...(b ? { body: JSON.stringify(b) } : {}),
  });
  assert.ok(r.ok, await r.clone().text());
  return r.status === 204 ? null : r.json();
}
const date = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Rome",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date());
const products = await req("/supplements"),
  intakes = await req("/intakes/" + date),
  product = products.find((p) => !intakes.some((i) => i.productId === p.id));
assert.ok(product);
const id = randomUUID();
let r = await req("/reminders/" + id, {
  action: "settings",
  revision: 0,
  settings: {
    kind: "supplement",
    target: String(product.id),
    at: "00:00",
    timezone: "Europe/Rome",
    enabled: true,
    weekdays: [0, 1, 2, 3, 4, 5, 6],
  },
});
assert.ok((await req("/reminders/due")).some((x) => x.id === id));
for (const minutes of [15, 30, 60]) {
  const before = Date.now();
  r = await req("/reminders/" + id, {
    action: "snooze",
    minutes,
    date,
    revision: r.revision,
  });
  const deadline = Date.parse(r.occurrence.snoozedUntil);
  assert.ok(
    deadline >= before + minutes * 60000 &&
      deadline <= Date.now() + minutes * 60000,
  );
  r = await req("/reminders/" + id, {
    action: "settings",
    revision: r.revision,
    settings: r.settings,
  });
}
await req("/intakes/" + date, {
  productId: product.id,
  taken: true,
  dose: "Dose sintetica test promemoria",
  slot: "23:59",
});
assert.ok(!(await req("/reminders/due")).some((x) => x.id === id));
await req("/intakes/" + date, {
  productId: product.id,
  taken: false,
  slot: "23:59",
});
await req("/reminders/" + id, { action: "delete", revision: r.revision });
const overview = await req("/training"),
  wid = randomUUID();
r = await req("/reminders/" + wid, {
  action: "settings",
  revision: 0,
  settings: {
    kind: "workout",
    target: overview.active.day,
    at: "00:00",
    timezone: "Europe/Rome",
    enabled: true,
    weekdays: [0, 1, 2, 3, 4, 5, 6],
  },
});
assert.ok(!(await req("/reminders/due")).some((x) => x.id === wid));
await req("/reminders/" + wid, { action: "delete", revision: r.revision });
const before = overview.history[0].snapshot.blocks[0].sets[0].standardAtStart;
let load = await req("/training/standard", {
  programId: overview.program.id,
  setId: "A:1:1",
  kg: 70,
  revision: overview.standards["A:1:1"].revision,
  confirm: true,
});
const changed = await req("/training");
assert.equal(changed.active.snapshot.blocks[0].sets[0].standardAtStart, 60);
assert.equal(
  changed.history[0].snapshot.blocks[0].sets[0].standardAtStart,
  before,
);
await req("/training/standard", {
  programId: overview.program.id,
  setId: "A:1:1",
  kg: 60,
  revision: load.revision,
  confirm: true,
});
console.log(
  "PASS: promemoria integratore soppresso dopo assunzione, allenamento soppresso dopo avvio, aggiornamento esplicito standard non altera sessione o storico.",
);
