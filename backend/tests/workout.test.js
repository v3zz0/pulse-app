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
