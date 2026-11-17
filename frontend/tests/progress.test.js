import assert from "node:assert/strict";
import { test } from "node:test";
import {
  calendar,
  completedSessions,
  dayOf,
  exerciseProgress,
  frequency,
  periodStart,
  sessionCounts,
} from "../src/progress-model.js";

test("calendar periods use civil dates, Monday weeks and valid leap days", () => {
  assert.equal(periodStart("2024-03-01", "30"), "2024-02-01");
  assert.equal(periodStart("2024-02-29", "year"), "2023-02-28");
  assert.equal(periodStart("2026-01-07", "all"), "");
  const days = new Map([
    ["2024-02-04", 4],
    ["2024-01-28", 2],
    ["2024-02-05", 1],
  ]);
  assert.deepEqual(frequency(days, "2024-02-04", 2), [
    { start: "2024-01-22", count: 2 },
    { start: "2024-01-29", count: 4 },
  ]);
  const feb = calendar("2024-02", days);
  assert.equal(feb[0], null);
  assert.equal(feb[3].number, 1);
  assert.equal(feb[6].count, 4);
  assert.equal(feb.at(-1).number, 29);
});
test("completed sessions deduplicate by id and use the device's date", () => {
  const entry = {
    clientId: "done",
    status: "completed",
    completedAt: "2026-10-31T23:30:00Z",
    revision: 1,
  };
  const result = completedSessions([
    entry,
    { ...entry, revision: 2 },
    { ...entry, clientId: "cancelled", status: "cancelled" },
    { ...entry, clientId: "unfinished", status: "active" },
  ]);
  assert.equal(result.length, 1);
  assert.equal(result[0].revision, 2);
  assert.deepEqual([...sessionCounts(result)], [[dayOf(entry.completedAt), 1]]);
});
test("one actual best set per session and exercise, including zero and incomplete reps", () => {
  const date = "2026-11-17T12:00:00Z";
  const set = (kg, reps, status = "recorded") => ({
    status,
    actualKg: kg,
    actualReps: reps,
    standardAtStart: 99,
  });
  const move = (name, sets, exerciseKey) => ({ name, sets, exerciseKey });
  const workouts = [
    {
      clientId: "one",
      localDay: "2026-11-17",
      completedAt: date,
      snapshot: {
        blocks: [
          move(
            "Panca piana",
            [set(40, 5), set(50, 4), set(100, 1, "skipped")],
            "flow-0025",
          ),
          move(
            "panca piana",
            [set(50, 6), set(null, null, "unlogged")],
            "flow-0025",
          ),
          move("Panca inclinata", [set(0, null)]),
          move("Altro", [set(null, null), set(50, null, "unlogged")]),
        ],
      },
    },
    {
      clientId: "two",
      localDay: "2026-11-17",
      completedAt: date,
      snapshot: {
        blocks: [
          move("Panca piana", [set(55, null)], "flow-0025"),
          move("Panca piana", [set(20, 5)], "personal-1"),
        ],
      },
    },
  ];
  const entries = exerciseProgress(workouts);
  assert.equal(entries.length, 3);
  assert.deepEqual(
    entries
      .find((e) => e.id === "flow-0025")
      .points.map(({ value, reps }) => [value, reps]),
    [
      [50, 6],
      [55, null],
    ],
  );
  assert.equal(
    entries.find((e) => e.id === "name:panca inclinata").points[0].value,
    0,
  );
  assert.equal(entries.find((e) => e.id === "personal-1").points[0].value, 20);
});
