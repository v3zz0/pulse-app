const { test } = require("node:test");
const assert = require("node:assert/strict");
const settings = require("../src/pulse/plan-settings");
const { cards, protect } = require("../src/pulse/training-day-cards");
test("food chips accept legacy strings, remove duplicates and retire removed preference fields", async () => {
  const old = {
    favoriteFoods: "Riso, Pollo\nRISO",
    avoidedFoods: "Broccoli",
    allergies: "",
    intolerances: "",
    easyFoods: "",
    breakfast: "",
    lunch: "",
    dinner: "",
    budget: "",
    mealCount: 4,
    cookingMinutes: 20,
    goals: null,
  };
  const r = settings.validate(old);
  assert.deepEqual(r.favoriteFoods, ["Riso", "Pollo"]);
  assert.deepEqual(r.avoidedFoods, ["Broccoli"]);
  assert.deepEqual(Object.keys(r).sort(), [
    "avoidedFoods",
    "favoriteFoods",
    "goals",
  ]);
  assert.deepEqual(
    settings.validate({ favoriteFoods: [], avoidedFoods: [], goals: null }),
    { favoriteFoods: [], avoidedFoods: [], goals: null },
  );
  const app = {
    db: {
      query: () => ({ findOne: async () => ({ data: old, revision: 1 }) }),
    },
  };
  const got = await settings.get(app, 1);
  assert.deepEqual(Object.keys(got.data).sort(), [
    "avoidedFoods",
    "favoriteFoods",
    "goals",
  ]);
  assert.equal(old.mealCount, 4);
  assert.equal(old.cookingMinutes, 20);
  assert.deepEqual(got.data.favoriteFoods, ["Riso", "Pollo"]);
  assert.throws(() => settings.validate({ ...old, favoriteFoods: [{}] }));
  assert.throws(() =>
    settings.validate({ ...old, avoidedFoods: Array(101).fill("x") }),
  );
});
test("daily Strapi cards preserve full source and identifiers without creating independent programs", () => {
  const source = {
    id: 2,
    owner: { id: 3 },
    title: "Programma",
    days: {
      A: [{ id: "A:1", sets: [{ id: "A:1:1", standardKg: 60 }] }],
      B: [{ id: "B:1", sets: [] }],
      C: [],
    },
    cooldown: { durationSeconds: 180 },
  };
  const split = cards(source);
  assert.deepEqual(
    split.map((x) => x.title),
    ["Scheda A", "Scheda B", "Scheda C"],
  );
  assert(split.every((x) => x.owner === 3 && x.program === 2));
  assert.deepEqual(split[0].blocks, source.days.A);
  split[0].blocks[0].sets[0].standardKg = 50;
  assert.equal(source.days.A[0].sets[0].standardKg, 60);
  assert.throws(() => protect(), /generata dal programma/);
});
