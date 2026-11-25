import assert from "node:assert/strict";
import test from "node:test";
import { isDayClosed, quoteOfDay } from "../src/day-closed.js";

test("giornata chiusa: pasti saltati contano, integratori e allenamento ON obbligatori", () => {
  const ok = { meals: 3, count: 2, skipped: 1, intakes: { available: true, remaining: [] }, train: true, workoutDone: true };
  assert.equal(isDayClosed(ok), true);
  assert.equal(isDayClosed({ ...ok, skipped: 0 }), false);
  assert.equal(isDayClosed({ ...ok, workoutDone: false }), false);
  assert.equal(isDayClosed({ ...ok, train: false, workoutDone: false }), true);
  assert.equal(isDayClosed({ ...ok, intakes: { available: true, remaining: [{}] } }), false);
  assert.equal(isDayClosed({ ...ok, intakes: { available: false, remaining: [] } }), false);
  assert.equal(isDayClosed({ ...ok, meals: 0, count: 0, skipped: 0 }), false);
});

test("frase del giorno stabile nella data e varia tra date", () => {
  assert.equal(quoteOfDay("2026-11-25"), quoteOfDay("2026-11-25"));
  const set = new Set(Array.from({ length: 60 }, (_, i) => quoteOfDay(`2026-${String((i % 12) + 1).padStart(2, "0")}-${String((i % 28) + 1).padStart(2, "0")}`)));
  assert.ok(set.size > 30);
});
