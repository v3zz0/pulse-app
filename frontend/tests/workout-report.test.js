import assert from "node:assert/strict";
import test from "node:test";
import { reportModel, delta } from "../src/workout-report.js";

test("delta confronta prima i kg poi le ripetizioni", () => {
  assert.deepEqual(delta({ actualKg: 72.5, actualReps: 8, previous: { kg: 70, reps: 8 } }), ["+2,5 kg", "up"]);
  assert.deepEqual(delta({ actualKg: 70, actualReps: 6, previous: { kg: 70, reps: 8 } }), ["-2 rip", "down"]);
  assert.deepEqual(delta({ actualKg: 70, actualReps: 8, previous: { kg: 70, reps: 8 } }), ["=", ""]);
  assert.deepEqual(delta({ actualKg: 70, actualReps: 8, previous: null }), ["", ""]);
});

test("report: volume dalle serie registrate e carico standard separato dal sollevato", () => {
  const set = (id, kg, reps, status = "recorded") => ({ id, reps: 8, standardAtStart: 70, actualKg: kg, actualReps: reps, status, previous: null });
  const m = reportModel({
    startedAt: "2026-11-25T17:42:00Z", completedAt: "2026-11-25T18:51:00Z",
    snapshot: { blocks: [{ name: "Panca", sets: [set(1, 72.5, 8), set(2, null, null, "skipped")] }] },
  }, "Scheda A");
  assert.deepEqual(m.kpis.map((k) => k[0]), ["1h 09'", "1", "1/2", "580 kg"]);
  assert.equal(m.exercises[0].target, "Obiettivo 2×8 · carico 70 kg");
  assert.deepEqual(m.exercises[0].rows[0].slice(0, 3), ["1", "8", "72,5 kg"]);
  assert.deepEqual(m.exercises[0].rows[1].slice(0, 3), ["2", "–", "–"]);
});
