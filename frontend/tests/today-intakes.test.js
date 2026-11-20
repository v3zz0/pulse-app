import assert from "node:assert/strict";
import test from "node:test";
import { todayIntakes } from "../src/today-intakes.js";

test("le dosi rimanenti sono ordinate e una dose salvata o accodata scompare", () => {
  const day = "2026-11-20";
  const dose = (key, at, status = "pending") => ({ key, status, planned: { at } });
  const data = { day, entries: [dose("sera", "20:00"), dose("mattina", "08:00"), dose("pranzo", "12:00")] };
  assert.deepEqual(todayIntakes(data, [], day).remaining.map((e) => e.key), ["mattina", "pranzo", "sera"]);
  data.entries[1].status = "taken";
  assert.deepEqual(todayIntakes(data, [], day).remaining.map((e) => e.key), ["pranzo", "sera"]);
  const queued = [{ key: "pranzo", day, body: { status: "taken" } }];
  assert.deepEqual(todayIntakes(data, queued, day).remaining.map((e) => e.key), ["sera"]);
  assert.equal(todayIntakes(data, queued, day).queued, 1);
  assert.equal(todayIntakes(data, queued, "2026-11-21").available, false);
});
