import fs from "node:fs";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
const base = process.env.PULSE_TEST_URL || "http://127.0.0.1:8081/api/pulse";
const users = JSON.parse(
  fs.readFileSync(
    process.env.PULSE_TEST_CREDENTIALS ||
      "/tmp/pulse-phase3-test/credentials.json",
  ),
);
const cookies = [];
for (const user of users) {
  assert.match(user.email, /^pulse-test-[12]@example.invalid$/);
  const r = await fetch(base + "/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier: user.email, password: user.password }),
  });
  assert.equal(r.status, 200);
  cookies.push(r.headers.get("set-cookie").split(";")[0]);
}
async function req(
  path,
  body,
  { owner = 0, status = 200, method = body ? "PUT" : "GET", headers = {} } = {},
) {
  const r = await fetch(base + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(owner === null ? {} : { Cookie: cookies[owner] }),
      ...headers,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await r.text();
  assert.equal(r.status, status, `${method} ${path}: ${text}`);
  return text ? JSON.parse(text) : null;
}
const overview = await req("/training");
const p = overview.program;
assert.ok(p);
assert.equal(p.days.C[7].movements.length, 3);
assert.equal(p.days.A[2].restSeconds, null);
await req("/training", null, { owner: null, status: 401 });
await req(
  "/training/standard",
  { programId: p.id, setId: "A:1:1", kg: 60, revision: 0 },
  { status: 400 },
);
await req(
  "/training/standard",
  { programId: p.id, setId: "A:1:1", kg: 60, revision: 0, confirm: true },
  { headers: { Origin: "https://not-pulse.invalid" }, status: 403 },
);
await req("/training/standard", {
  programId: p.id,
  setId: "A:1:1",
  kg: 60,
  revision: 0,
  confirm: true,
});
await req(
  "/training/standard",
  { programId: p.id, setId: "A:1:1", kg: 40, revision: 0, confirm: true },
  { status: 409 },
);
await req(
  "/training/standard",
  { programId: p.id, setId: "A:1:1", kg: 40, revision: 0, confirm: true },
  { owner: 1, status: 404 },
);
const clientId = randomUUID(),
  body = { clientId, programId: p.id, day: "A" };
const starts = await Promise.all([
  req("/training/sessions", body, { method: "POST" }),
  req("/training/sessions", body, { method: "POST" }),
]);
assert.equal(starts[0].clientId, starts[1].clientId);
let s = starts[0];
assert.equal(s.snapshot.blocks[0].sets[0].draftKg, 60);
await req(
  "/training/sessions",
  { ...body, clientId: randomUUID() },
  { method: "POST", status: 409 },
);
const op = (action) => ({
  ...action,
  opId: randomUUID(),
  revision: s.revision,
  occurredAt: new Date().toISOString(),
});
async function act(action) {
  const b = op(action);
  s = await req("/training/sessions/" + clientId, b);
  return b;
}
await req(
  "/training/sessions/" + clientId,
  op({ action: "timer", command: "start", seconds: 60 }),
  { owner: 1, status: 404 },
);
await act({ action: "set", setId: "A:1:1", status: "pending", draftKg: 50 });
const unlogged = await act({
  action: "set",
  setId: "A:1:1",
  status: "unlogged",
  actualKg: 50,
  actualReps: 10,
});
assert.equal(s.snapshot.blocks[0].sets[0].actualKg, null);
assert.equal(s.snapshot.blocks[0].sets[0].standardAtStart, 60);
const replay = await req("/training/sessions/" + clientId, unlogged);
assert.equal(replay.revision, s.revision);
await req(
  "/training/sessions/" + clientId,
  { ...unlogged, actualKg: 99 },
  { status: 409 },
);
await req(
  "/training/sessions/" + clientId,
  { ...op({ action: "cooldown" }), revision: 0 },
  { status: 409 },
);
await act({
  action: "set",
  setId: "A:2:1",
  status: "recorded",
  actualKg: 50,
  actualReps: 8,
});
assert.equal(s.metrics.volume, 400);
assert.equal(s.metrics.volumeIncomplete, true);
await act({ action: "timer", command: "start", seconds: 60 });
const endAt = s.timer.endAt;
await act({ action: "timer", command: "pause" });
assert.ok(s.timer.pausedRemaining > 0 && s.timer.pausedRemaining <= 60);
await act({ action: "timer", command: "resume" });
assert.ok(s.timer.endAt);
assert.equal(s.timer.pausedRemaining, null);
await req("/training/sessions/" + clientId, op({ action: "finish" }), {
  status: 409,
});
for (const b of s.snapshot.blocks)
  await act({ action: "skip-block", blockId: b.id });
await act({ action: "cooldown" });
const finish = await act({ action: "finish" });
assert.equal(s.status, "completed");
assert.equal(s.metrics.unlogged, 1);
assert.equal(s.metrics.volume, 400);
await req("/training/sessions/" + clientId, finish);
await req("/training/sessions/" + clientId, op({ action: "cooldown" }), {
  status: 409,
});
const nextId = randomUUID();
const next = await req(
  "/training/sessions",
  { clientId: nextId, programId: p.id, day: "A" },
  { method: "POST" },
);
assert.equal(next.snapshot.blocks[0].sets[0].draftKg, 60);
assert.equal(next.snapshot.blocks[1].sets[0].previous.kg, 50);
const timerBody = {
  action: "timer",
  command: "start",
  seconds: 600,
  opId: randomUUID(),
  revision: next.revision,
  occurredAt: new Date().toISOString(),
};
const active = await req("/training/sessions/" + nextId, timerBody);
const own2 = await req("/training", null, { owner: 1 });
assert.equal(own2.history.length, 0);
assert.equal(own2.active, null);
assert.equal(Object.keys(own2.standards).length, 0);
const date = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Rome",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date());
const daily = await req("/days/" + date);
const meal = daily.meals.find((m) => !m.consumedAt);
assert.ok(meal);
const reminderId = randomUUID(),
  settings = {
    kind: "meal",
    target: meal.id,
    at: "00:00",
    timezone: "Europe/Rome",
    enabled: true,
    weekdays: [0, 1, 2, 3, 4, 5, 6],
  };
let reminder = await req("/reminders/" + reminderId, {
  action: "settings",
  settings,
  revision: 0,
});
assert.ok((await req("/reminders/due")).some((r) => r.id === reminderId));
assert.equal((await req("/reminders", null, { owner: 1 })).length, 0);
reminder = await req("/reminders/" + reminderId, {
  action: "snooze",
  minutes: 15,
  date,
  revision: reminder.revision,
});
assert.ok(!(await req("/reminders/due")).some((r) => r.id === reminderId));
reminder = await req("/reminders/" + reminderId, {
  action: "settings",
  settings,
  revision: reminder.revision,
});
await req("/days/" + date, {
  action: "meal",
  mealId: meal.id,
  consumed: true,
  revision: daily.revision,
});
assert.ok(!(await req("/reminders/due")).some((r) => r.id === reminderId));
await req(
  "/reminders/" + reminderId,
  {
    action: "settings",
    settings: { ...settings, timezone: "invalid" },
    revision: reminder.revision,
  },
  { status: 400 },
);
const hist = (await req("/training")).history;
assert.equal(hist[0].snapshot.blocks[0].sets[0].actualKg, null);
assert.ok((await req("/weekly/" + date)).workouts >= 1);
fs.writeFileSync(
  "/tmp/pulse-phase3-test/persistence.json",
  JSON.stringify({ nextId, timer: active.timer, revision: active.revision }),
  { mode: 0o600 },
);
console.log(
  "PASS fase 3 API: 60→50→unlogged→60, serie/esercizi, snapshot/storico, volume, timer, retry concorrenti, ownership, CSRF, conflitti, immutabilità, promemoria/rinvio/soppressione.",
);
