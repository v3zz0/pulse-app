const { test } = require("node:test");
const assert = require("node:assert/strict");
const { selectMeal, shopping } = require("../src/pulse/nutrition");
const validate = require("../src/pulse/validation");
const meal = {
  id: "synthetic",
  menus: [
    {
      groups: [
        {
          options: [
            { id: "rice", text: "100 g riso" },
            { id: "pasta", text: "100 g pasta" },
          ],
        },
        { options: [{ id: "oil", text: "1 cucchiaio olio" }] },
      ],
    },
  ],
  selections: [0, 0],
};
test("alternative non sommate, ingredienti complementari presenti", () => {
  assert.deepEqual(
    shopping([meal]).map((x) => x.id),
    ["rice", "oil"],
  );
  assert.deepEqual(
    shopping([selectMeal(meal, 0, [1, 0])]).map((x) => x.id),
    ["pasta", "oil"],
  );
});
test("consumo storico non riscritto da sostituzioni", () =>
  assert.throws(
    () => selectMeal({ ...meal, consumedAt: "2026-11-16" }, 0, [1, 0]),
    /Annulla/,
  ));
test("validazione input ostili e selezioni fuori indice", () => {
  assert.throws(() => selectMeal(meal, 1, []));
  assert.throws(() => selectMeal(meal, 0, [99, 0]));
  assert.throws(() => validate.kg(NaN));
  assert.throws(() => validate.mode("OTHER"));
  assert.throws(() => validate.date("2026-02-30"));
});
