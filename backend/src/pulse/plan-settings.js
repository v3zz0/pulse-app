"use strict";
const { fail } = require("./validation");
const repo = (app) => app.db.query("api::personal-setting.personal-setting");
const suggestedGoals = { kcal: 2900, protein_g: 140, carbs_g: 405, fat_g: 80 };
const fields = [
  "favoriteFoods",
  "avoidedFoods",
  "allergies",
  "intolerances",
  "easyFoods",
  "breakfast",
  "lunch",
  "dinner",
  "budget",
];
function validate(data) {
  if (!data || typeof data !== "object" || Array.isArray(data))
    fail("Impostazioni non valide");
  const out = {};
  for (const k of fields) {
    if (typeof data[k] !== "string" || data[k].length > 2000)
      fail(`Campo ${k} non valido, massimo 2.000 caratteri`);
    out[k] = data[k].trim();
  }
  for (const [k, max] of [
    ["cookingMinutes", 480],
    ["mealCount", 12],
  ]) {
    const v = data[k];
    if (
      v !== null &&
      (!Number.isInteger(v) ||
        v < 0 ||
        v > max ||
        (k === "mealCount" && v === 0))
    )
      fail(`Campo ${k} non valido`);
    out[k] = v;
  }
  if (data.goals !== null) {
    if (!data.goals || typeof data.goals !== "object")
      fail("Obiettivi non validi");
    out.goals = {};
    for (const [k, max] of [
      ["kcal", 10000],
      ["protein_g", 1000],
      ["carbs_g", 2000],
      ["fat_g", 1000],
    ]) {
      const v = data.goals[k];
      if (typeof v !== "number" || !Number.isFinite(v) || v <= 0 || v > max)
        fail(`Obiettivo ${k} non valido`);
      out.goals[k] = v;
    }
  } else out.goals = null;
  return out;
}
async function get(app, owner) {
  const r = await repo(app).findOne({ where: { owner } });
  return {
    data: r?.data || {
      ...Object.fromEntries(fields.map((k) => [k, ""])),
      cookingMinutes: null,
      mealCount: null,
      goals: null,
    },
    revision: r?.revision || 0,
    suggestedGoals,
  };
}
async function save(app, owner, body) {
  return app.db.transaction(async ({ trx }) => {
    await trx.raw("SELECT pg_advisory_xact_lock(hashtext(?))", [
      `personal-setting:${owner}`,
    ]);
    const old = await repo(app).findOne({ where: { owner } });
    if (
      !Number.isInteger(body.revision) ||
      body.revision !== (old?.revision || 0)
    )
      fail("Impostazioni modificate altrove: ricarica prima di salvare", 409);
    if (body.confirm !== true) fail("Conferma esplicita richiesta");
    const data = { data: validate(body.data), revision: body.revision + 1 };
    if (old) await repo(app).update({ where: { id: old.id, owner }, data });
    else
      await repo(app).create({
        data: { ...data, owner, uniqueKey: String(owner) },
      });
    return get(app, owner);
  });
}
module.exports = { get, save, validate, suggestedGoals };
