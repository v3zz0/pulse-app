const { test } = require("node:test");
const a = require("node:assert/strict");
const {
  applyOperation,
  createSnapshot,
  metrics,
} = require("../src/pulse/workout");
const now = Date.now(),
  occurredAt = new Date(now).toISOString();
const program = {
  title: "Synthetic",
  days: {
    A: [
      {
        id: "A:1",
        restSeconds: 60,
        sets: [{ id: "A:1:1", reps: "CED", standardKg: null }],
      },
    ],
  },
  cooldown: { durationSeconds: 180 },
};
test("60 standard → 50 temporaneo → completata senza peso → nuova sessione 60", () => {
  const snapshot = createSnapshot(program, "A", { "A:1:1": 60 }, {}),
    s = { snapshot, timer: null };
  const draft = applyOperation(
    s,
    {
      action: "set",
      setId: "A:1:1",
      status: "pending",
      draftKg: 50,
      occurredAt,
    },
    now,
  );
  const result = applyOperation(
    draft,
    {
      action: "set",
      setId: "A:1:1",
      status: "unlogged",
      actualKg: 50,
      actualReps: 8,
      occurredAt,
    },
    now,
  );
  const set = result.snapshot.blocks[0].sets[0];
  a.equal(set.actualKg, null);
  a.equal(set.standardAtStart, 60);
  a.equal(metrics(result).volume, 0);
  a.equal(
    createSnapshot(program, "A", { "A:1:1": 60 }, {}).blocks[0].sets[0].draftKg,
    60,
  );
  a.equal(result.timer.endAt, new Date(now + 60000).toISOString());
  const pause = applyOperation(
    result,
    {
      action: "timer",
      command: "pause",
      occurredAt: new Date(now + 10000).toISOString(),
    },
    now + 10000,
  );
  a.equal(pause.timer.pausedRemaining, 50);
  const resume = applyOperation(
    pause,
    {
      action: "timer",
      command: "resume",
      occurredAt: new Date(now + 20000).toISOString(),
    },
    now + 20000,
  );
  a.equal(resume.timer.endAt, new Date(now + 70000).toISOString());
});
test("nessun completamento con serie pendenti e nessun peso invalido", () => {
  const s = { snapshot: createSnapshot(program, "A", {}, {}), timer: null };
  a.throws(
    () => applyOperation(s, { action: "finish", occurredAt }, now),
    /tutte le serie/,
  );
  a.throws(
    () =>
      applyOperation(
        s,
        {
          action: "set",
          setId: "A:1:1",
          status: "recorded",
          actualKg: null,
          occurredAt,
        },
        now,
      ),
    /Carico/,
  );
  a.throws(
    () =>
      applyOperation(
        s,
        {
          action: "set",
          setId: "A:1:1",
          status: "recorded",
          actualKg: -1,
          occurredAt,
        },
        now,
      ),
    /Carico/,
  );
  const r = applyOperation(
    s,
    {
      action: "set",
      setId: "A:1:1",
      status: "recorded",
      actualKg: 0,
      actualReps: 10,
      occurredAt,
    },
    now,
  );
  a.equal(metrics(r).volume, 0);
  a.equal(metrics(r).recorded, 1);
});
test("proposte esatte, intervalli, CED, zero/null e circuiti senza risultati inventati", () => {
  const p = structuredClone(program);
  p.days.A[0].sets = [
    { id: "exact", reps: "5", standardKg: 60 },
    { id: "zero", reps: "8", standardKg: 0 },
    { id: "missing", reps: "8-10", standardKg: null },
    { id: "ced", reps: "CED", standardKg: null },
    {
      id: "compound",
      reps: "5+5+5",
      movements: [
        { name: "Uno", reps: 5 },
        { name: "Due", reps: 5 },
        { name: "Tre", reps: 5 },
      ],
    },
  ];
  const original = structuredClone(p);
  const snapshot = createSnapshot(p, "A", {}, {}),
    sets = snapshot.blocks[0].sets;
  a.deepEqual(p, original);
  a.equal(sets[0].draftKg, 60);
  a.equal(sets[0].draftReps, 5);
  a.equal(sets[1].draftKg, 0);
  a.equal(sets[2].draftKg, null);
  a.equal(sets[2].draftReps, null);
  a.deepEqual(sets[2].repProposal.options, [8, 9, 10]);
  a.equal(sets[3].draftReps, null);
  a.equal(sets[4].draftReps, null);
  a.equal(sets[4].movements[2].reps, 5);
  a(
    sets.every(
      (s) =>
        s.status === "pending" && s.actualKg === null && s.actualReps === null,
    ),
  );
  let session = { snapshot };
  session = applyOperation(
    session,
    {
      action: "set",
      setId: "exact",
      status: "pending",
      draftKg: 50,
      occurredAt,
    },
    now,
  );
  session = applyOperation(
    session,
    {
      action: "set",
      setId: "exact",
      status: "pending",
      draftReps: 4,
      occurredAt,
    },
    now,
  );
  a.equal(session.snapshot.blocks[0].sets[0].draftKg, 50);
  a.equal(session.snapshot.blocks[0].sets[0].actualReps, null);
  const recorded = applyOperation(
    session,
    {
      action: "set",
      setId: "exact",
      status: "recorded",
      actualKg: 50,
      actualReps: 4,
      occurredAt,
    },
    now,
  );
  a.equal(metrics(recorded).volume, 200);
  a.equal(createSnapshot(p, "A", {}, {}).blocks[0].sets[0].draftKg, 60);
  const unlogged = applyOperation(
    session,
    {
      action: "set",
      setId: "exact",
      status: "unlogged",
      actualKg: 60,
      actualReps: 4,
      occurredAt,
    },
    now,
  );
  a.equal(unlogged.snapshot.blocks[0].sets[0].actualKg, null);
  const skipped = applyOperation(
    session,
    {
      action: "set",
      setId: "exact",
      status: "skipped",
      actualKg: 60,
      actualReps: 5,
      occurredAt,
    },
    now,
  );
  a.equal(skipped.snapshot.blocks[0].sets[0].actualReps, null);
  a.equal(skipped.snapshot.blocks[0].sets[0].actualKg, null);
  a.throws(
    () =>
      applyOperation(
        session,
        { action: "set", setId: "ced", status: "unlogged", occurredAt },
        now,
      ),
    /ripetizioni effettivamente/,
  );
  a.throws(
    () =>
      applyOperation(
        session,
        {
          action: "set",
          setId: "compound",
          status: "unlogged",
          actualReps: 15,
          occurredAt,
        },
        now,
      ),
    /singoli movimenti/,
  );
});
test("annullamento confermato conserva lo snapshot, ferma il timer ed esclude metriche", () => {
  const s = {
    status: "active",
    snapshot: createSnapshot(program, "A", {}, {}),
    timer: { endAt: occurredAt },
  };
  s.snapshot.blocks[0].sets[0] = {
    ...s.snapshot.blocks[0].sets[0],
    status: "recorded",
    actualKg: 60,
    actualReps: 5,
  };
  const original = structuredClone(s);
  a.throws(
    () => applyOperation(s, { action: "cancel", occurredAt }, now),
    /Conferma/,
  );
  const cancelled = applyOperation(
    s,
    { action: "cancel", confirm: true, occurredAt },
    now,
  );
  a.equal(cancelled.status, "cancelled");
  a.equal(cancelled.timer, null);
  a.equal(cancelled.completedAt, null);
  a.deepEqual(cancelled.snapshot, s.snapshot);
  a.deepEqual(s, original);
  a.equal(metrics(cancelled).volume, 0);
  a.equal(metrics(cancelled).recorded, 0);
  const old = applyOperation(
    s,
    {
      action: "cancel",
      confirm: true,
      occurredAt: new Date(now - 60 * 86400000).toISOString(),
    },
    now,
  );
  a.equal(old.status, "cancelled");
  a.equal(old.cancelledAt, new Date(now).toISOString());
});

test("ripresa legacy: propone solo bozze mancanti, conserva modifiche e storico", () => {
  const { prepareDrafts } = require("../src/pulse/workout");
  const old = {
    blocks: [
      {
        movements: [],
        sets: [
          {
            id: "one",
            status: "pending",
            reps: "5",
            standardAtStart: 60,
            draftKg: 50,
            actualReps: 4,
          },
          {
            id: "two",
            status: "pending",
            reps: "5",
            standardAtStart: 60,
            draftKg: null,
            actualReps: null,
          },
          {
            id: "done",
            status: "recorded",
            reps: "5",
            actualKg: 40,
            actualReps: 3,
          },
        ],
      },
    ],
  };
  const copy = structuredClone(old),
    prepared = prepareDrafts(old),
    sets = prepared.blocks[0].sets;
  a.equal(sets[0].draftKg, 50);
  a.equal(sets[0].draftReps, 4);
  a.equal(sets[0].actualReps, null);
  a.equal(sets[1].draftKg, null);
  a.equal(sets[1].draftReps, 5);
  sets[1].draftReps = null;
  a.equal(prepareDrafts(prepared).blocks[0].sets[1].draftReps, null);
  a.deepEqual(sets[2], copy.blocks[0].sets[2]);
  a.deepEqual(old, copy);
});
