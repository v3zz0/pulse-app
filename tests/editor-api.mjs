// Local synthetic users only.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { fromServer, payload } from "../frontend/src/editor-model.js";

const base = process.env.PULSE_TEST_BASE || "http://127.0.0.1:8081";
assert.match(base, /^http:\/\/(127\.0\.0\.1|localhost):\d+$/);
const users = JSON.parse(
  readFileSync(
    process.env.PULSE_CSV_CREDENTIALS ||
      "/tmp/pulse-csv-test/csv-credentials.json",
  ),
);
const state = "/tmp/pulse-csv-test/editor-state.json";
async function client(user) {
  assert.match(user.email, /^pulse-(?:csv-)?test-[12]@example.invalid$/);
  let cookie;
  async function request(
    path,
    body,
    status = 200,
    method = body ? "PUT" : "GET",
  ) {
    const res = await fetch(base + "/api/pulse" + path, {
      method,
      headers: {
        Origin: base,
        "Content-Type": "application/json",
        ...(cookie ? { Cookie: cookie } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (res.headers.has("set-cookie"))
      cookie = res.headers.get("set-cookie").split(";")[0];
    const data = res.status === 204 ? null : await res.json();
    assert.equal(res.status, status, path + " " + (data?.error?.message || ""));
    return data;
  }
  await request(
    "/login",
    { identifier: user.email, password: user.password },
    200,
    "POST",
  );
  return request;
}
if (process.argv.includes("--verify-legacy")) {
  const [fixture] = JSON.parse(
    readFileSync(
      process.env.PULSE_TEST_CREDENTIALS ||
        "/tmp/pulse-phase3-test/credentials.json",
    ),
  );
  const legacy = await client(fixture);
  for (const kind of ["training", "nutrition"]) {
    const prefix = "/plans/" + kind;
    const { id } = (await legacy(prefix)).find(
      (p) => p.provenance === "PDF storico",
    );
    const original = await legacy(prefix + "/" + id + "/export");
    const copy = await legacy(
      prefix + "/" + id + "/duplicate",
      { requestId: randomUUID() },
      200,
      "POST",
    );
    const path = prefix + "/" + copy.id;
    try {
      const data = payload(kind, fromServer(kind, copy));
      data.title = "Verifica sintetica " + kind;
      const saved = await legacy(path + "/editor", {
        requestId: randomUUID(),
        revision: copy.revision,
        data,
      });
      assert.equal(saved.notes, copy.notes);
      const exported = await legacy(path + "/export");
      const preview = await legacy(
        prefix + "/preview",
        { filename: exported.filename, text: exported.csv },
        200,
        "POST",
      );
      assert.deepEqual(preview.errors, []);
      assert.deepEqual(await legacy(prefix + "/" + id + "/export"), original);
      console.log(
        "PASS copia, modifica ed export della fixture storica " + kind,
      );
    } finally {
      await legacy(path + "/remove", { confirm: true }, 204, "POST");
    }
  }
  process.exit(0);
}
const a = await client(users[0]),
  b = await client(users[1]);
if (process.argv.includes("--verify-persistence")) {
  for (const [path, body] of JSON.parse(readFileSync(state)))
    assert.deepEqual(await a(path), body);
  console.log(
    "PASS PostgreSQL dopo riavvio: schede, dieta, esercizi privati, storico.",
  );
  process.exit(0);
}

const tag = randomUUID().slice(0, 8);
const collection = (kind) => "/plans/" + kind;
const editor = (kind, id) =>
  collection(kind) + (id ? "/" + id : "") + "/editor";
const create = (kind, data) =>
  a(editor(kind), { requestId: randomUUID(), data }, 200, "POST");
const saveBody = (plan, data) => ({
  requestId: randomUUID(),
  revision: plan.revision,
  data,
});
const duplicate = (kind, id, requestId) =>
  a(collection(kind) + "/" + id + "/duplicate", { requestId }, 200, "POST");
const remove = (kind, id, confirm = true, status = 204) =>
  a(collection(kind) + "/" + id + "/remove", { confirm }, status, "POST");
async function activate(kind, id) {
  const path = collection(kind) + "/" + id;
  const { activation } = await a(path);
  await a(path, {
    action: "activate",
    confirm: true,
    activationToken: activation.token,
  });
}
const previous = Object.fromEntries(
  await Promise.all(
    ["training", "nutrition"].map(async (kind) => [
      kind,
      (await a(collection(kind))).find((p) => p.status === "active")?.id,
    ]),
  ),
);
const toRestore = [];
const syntheticDates = [];
try {
  const flow = await a("/flow/search?limit=12&all=1&q=barbell%20bench%20press");
  const animated = flow.items.find((item) => item.hasAnimation);
  assert.ok(animated);
  const detail = await a("/flow/exercises/" + animated.id);
  assert.ok(detail.animation);
  const unanimated = (await a("/flow/search?all=1&q=0841")).items.find(
    (item) => item.id === "0841",
  );
  assert.equal(unanimated?.hasAnimation, false);
  assert.equal((await a("/flow/exercises/0841")).animation, null);
  assert.ok(
    !(await a("/flow/search?q=0841")).items.some((item) => item.id === "0841"),
  );
  const privatePayload = {
    requestId: randomUUID(),
    name: "Movimento personale " + tag,
    muscle: "Dorso",
    equipment: "Banda",
    description: "Descrizione",
    notes: "Note",
  };
  const personal = await a("/exercise-library", privatePayload, 200, "POST");
  assert.deepEqual(
    await a("/exercise-library", privatePayload, 200, "POST"),
    personal,
  );
  assert.ok(!(await b("/exercise-library")).some((x) => x.id === personal.id));
  const training = {
    title: "Scheda manuale " + tag,
    description: "Spalle e petto",
    notes: "Tecnica",
    timezone: "Europe/Rome",
    cooldown: { name: "Camminata", durationSeconds: 30 },
    days: [
      {
        id: "A",
        name: "Petto",
        weekdays: [1, 3],
        blocks: [
          {
            id: "panca",
            name: animated.name,
            catalogueId: animated.id,
            flowId: animated.id,
            restSeconds: 90,
            sets: [
              { id: "warm", kind: "warmup", reps: "10", standardKg: 0 },
              { id: "top", kind: "top-set", reps: "5", standardKg: 60 },
              { id: "back", kind: "back-off", reps: "8-10", standardKg: 50 },
              { id: "ced", kind: "work", reps: "CED", standardKg: null },
            ],
          },
          {
            id: "personale",
            libraryId: personal.id,
            name: personal.name,
            sets: [{ id: "work", kind: "work", reps: "5" }],
          },
          {
            id: "circuito",
            name: "Circuito prova",
            sets: [
              {
                id: "dual",
                kind: "superset",
                movements: [
                  {
                    name: animated.name,
                    reps: "8",
                    flowId: animated.id,
                    flowChanged: true,
                  },
                  { name: "Squat", reps: "12" },
                ],
              },
            ],
          },
        ],
      },
      {
        id: "B",
        name: "Schiena",
        weekdays: [5],
        blocks: [
          {
            id: "personale-b",
            libraryId: personal.id,
            name: personal.name,
            sets: [{ id: "work-b", kind: "work", reps: "5" }],
          },
        ],
      },
    ],
  };
  await b(
    editor("training"),
    { requestId: randomUUID(), data: training },
    404,
    "POST",
  );
  const request = { requestId: randomUUID(), data: training };
  const initial = await a(editor("training"), request, 200, "POST");
  assert.deepEqual(await a(editor("training"), request, 200, "POST"), initial);
  assert.equal(initial.days[0].blocks[0].flowId, animated.id);
  assert.equal(
    initial.days[0].blocks[2].sets[0].movements[0].flowId,
    animated.id,
  );
  await b(editor("training", initial.id), null, 404);
  await b(editor("training", initial.id), saveBody(initial, training), 404);
  await b(
    collection("training") + "/" + initial.id + "/duplicate",
    { requestId: randomUUID() },
    404,
    "POST",
  );
  await b(
    collection("training") + "/" + initial.id + "/remove",
    { confirm: true },
    404,
    "POST",
  );
  await activate("training", initial.id);
  if (previous.training) toRestore.push(["training", previous.training]);
  const start = () =>
    a(
      "/training/sessions",
      { clientId: randomUUID(), programId: initial.id, day: "A" },
      200,
      "POST",
    );
  let s = await start();
  const set = (id) =>
    s.snapshot.blocks.flatMap((block) => block.sets).find((x) => x.id === id);
  const op = async (change) => {
    s = await a("/training/sessions/" + s.clientId, {
      opId: randomUUID(),
      revision: s.revision,
      occurredAt: new Date().toISOString(),
      ...change,
    });
  };
  assert.equal(set("top").draftKg, 60);
  assert.equal(set("top").draftReps, 5);
  assert.equal(set("warm").draftKg, 0);
  assert.equal(set("ced").draftKg, null);
  assert.equal(set("ced").draftReps, null);
  assert.deepEqual(
    set("dual").movements.map(({ reps }) => reps),
    ["8", "12"],
  );
  assert.deepEqual(set("back").repProposal.options, [8, 9, 10]);
  await op({
    action: "set",
    setId: "top",
    status: "recorded",
    actualKg: 50,
    actualReps: 4,
  });
  assert.equal(set("top").actualKg, 50);
  assert.equal(set("top").standardAtStart, 60);
  assert.equal(s.metrics.volume, 200);
  assert.ok(Math.abs(Date.parse(s.timer.endAt) - Date.now() - 90000) < 3000);
  await op({
    action: "set",
    setId: "warm",
    status: "unlogged",
    actualReps: 10,
    actualKg: 0,
  });
  assert.equal(set("warm").actualKg, null);
  await remove("training", initial.id, true, 409);

  const snapshotBefore = structuredClone(s);
  const changed = structuredClone(training);
  changed.days[0].blocks.reverse();
  changed.days[0].blocks[2].sets[0].standardKg = 5;
  const edited = await a(
    editor("training", initial.id),
    saveBody(await a(editor("training", initial.id)), changed),
  );
  assert.deepEqual(
    edited.days[0].blocks.map((x) => x.id),
    ["circuito", "personale", "panca"],
  );
  assert.deepEqual(await a("/training/sessions/" + s.clientId), snapshotBefore);
  await a(editor("training", initial.id), saveBody(initial, training), 409);

  for (const block of s.snapshot.blocks)
    await op({ action: "skip-block", blockId: block.id });
  await op({ action: "cooldown" });
  await op({ action: "finish" });
  const done = s;
  s = await start();
  assert.equal(set("top").draftKg, 60);
  await op({ action: "cancel", confirm: true });
  const duplicateId = randomUUID();
  const copy = await duplicate("training", initial.id, duplicateId);
  assert.deepEqual(await duplicate("training", initial.id, duplicateId), copy);
  assert.equal(copy.days[0].blocks[0].sets[0].movements[0].flowId, animated.id);
  assert.notEqual(copy.days[0].blocks[0].id, edited.days[0].blocks[0].id);
  assert.equal(copy.days[0].blocks[1].libraryId, personal.id);
  assert.equal(copy.days[0].blocks[2].sets[1].standardKg, 60);
  assert.equal(copy.days[0].blocks[2].flowId, animated.id);
  const oldFormat = await a(collection("training") + "/" + copy.id + "/export");
  assert.deepEqual(
    (
      await a(
        collection("training") + "/preview",
        { filename: oldFormat.filename, text: oldFormat.csv },
        200,
        "POST",
      )
    ).errors,
    [],
  );
  await remove("training", initial.id, false, 400);
  await remove("training", initial.id);
  await remove("training", initial.id);
  assert.ok(
    !(await a(collection("training"))).some((p) => p.id === initial.id),
  );
  assert.deepEqual(await a("/training/sessions/" + done.clientId), done);
  assert.ok(
    (await a("/training")).history.some((x) => x.clientId === done.clientId),
  );
  console.log(
    "PASS editor allenamenti: isolamento, Flow e personali, serie, carichi, timer, copie, CSV e storico.",
  );

  const meal = (id, name, food, amount) => ({
    id,
    name,
    time: "08:00",
    sourceText: "Note",
    menus: [
      {
        id: "base",
        title: "Pasto principale",
        groups: [
          {
            id: "primo",
            options: [
              { id: id + "-food", foodName: food, quantity: amount, unit: "g" },
              { id: id + "-alt", foodName: "Pane", quantity: 30, unit: "g" },
            ],
          },
        ],
      },
      {
        id: "secondo",
        title: "Alternativa completa",
        groups: [
          {
            id: "primo",
            options: [
              {
                id: id + "-menu",
                foodName: "Yogurt",
                quantity: 2,
                unit: "piece",
              },
            ],
          },
        ],
      },
    ],
  });
  const diet = {
    title: "Piano settimanale " + tag,
    notes: "Controllo",
    schedule: { mode: "weekly", weekdays: [1, 2] },
    meals: {
      1: [meal("lun", "Colazione di lunedì", "Avena", 80)],
      2: [meal("mar", "Colazione di martedì", "Riso", 100)],
    },
  };
  const d = await create("nutrition", diet);
  await b(editor("nutrition", d.id), undefined, 404);
  await activate("nutrition", d.id);
  if (previous.nutrition) toRestore.push(["nutrition", previous.nutrition]);
  const monday = new Date(
    Date.UTC(2035, 0, 1 + 7 * Math.floor(Math.random() * 2300)),
  );
  for (let i = 0; i < 3; i++) {
    const date = new Date(monday);
    date.setUTCDate(date.getUTCDate() + i);
    syntheticDates.push("/days/" + date.toISOString().slice(0, 10));
  }
  const days = await Promise.all(syntheticDates.map((p) => a(p)));
  assert.equal(days[0].planId, d.id);
  assert.equal(days[0].planUsesModes, false);
  assert.equal(days[0].meals[0].name, diet.meals[1][0].name);
  assert.equal(days[1].meals[0].name, diet.meals[2][0].name);
  assert.deepEqual(days[2].meals, []);
  assert.ok(days[0].nutrientTotals.kcal == null);
  let modified = structuredClone(diet);
  modified.meals[1][0].menus[0].groups[0].options[0].quantity = 85;
  modified.meals[1][0].menus[0].groups[0].options.pop();
  await a(
    editor("nutrition", d.id),
    saveBody(await a(editor("nutrition", d.id)), modified),
  );
  const oldDay = await a(syntheticDates[0]);
  assert.equal(oldDay.planOutdated, true);
  assert.deepEqual(oldDay.meals, days[0].meals);
  const refreshed = await a(syntheticDates[0], {
    action: "apply-plan",
    confirm: true,
    revision: oldDay.revision,
  });
  assert.equal(refreshed.meals[0].menus[0].groups[0].options[0].quantity, 85);
  assert.equal(refreshed.planOutdated, false);

  const dCopy = await duplicate("nutrition", d.id, randomUUID());
  assert.notEqual(dCopy.meals[1][0].id, d.meals[1][0].id);
  modified = structuredClone(dCopy);
  modified.meals[1][0].menus[0].groups[0].options[0].quantity = 40;
  await a(editor("nutrition", dCopy.id), saveBody(dCopy, modified));
  assert.equal(
    (await a(editor("nutrition", d.id))).meals[1][0].menus[0].groups[0]
      .options[0].quantity,
    85,
  );
  const dietCsv = await a(
    collection("nutrition") + "/" + d.id + "/export?day=2",
  );
  assert.match(dietCsv.csv, /Riso/);
  assert.doesNotMatch(dietCsv.csv, /Avena/);
  assert.deepEqual(
    (
      await a(
        collection("nutrition") + "/preview",
        { filename: dietCsv.filename, text: dietCsv.csv },
        200,
        "POST",
      )
    ).errors,
    [],
  );
  await remove("nutrition", d.id);
  assert.deepEqual((await a(syntheticDates[0])).meals, refreshed.meals);
  console.log(
    "PASS editor dieta: calendario, alternative, copia, esportazione v1, giornate storiche e valori ignoti.",
  );
  const paths = [
    editor("training", copy.id),
    editor("nutrition", dCopy.id),
    "/exercise-library",
    "/training/sessions/" + done.clientId,
    syntheticDates[0],
  ];
  writeFileSync(
    state,
    JSON.stringify(await Promise.all(paths.map(async (p) => [p, await a(p)]))),
    { mode: 0o600 },
  );
} finally {
  const current = (await a("/training")).active;
  if (current)
    await a("/training/sessions/" + current.clientId, {
      action: "cancel",
      confirm: true,
      revision: current.revision,
      opId: randomUUID(),
      occurredAt: new Date().toISOString(),
    });
  for (const [kind, id] of toRestore) await activate(kind, id);
}
