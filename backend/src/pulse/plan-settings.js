"use strict";
const { fail } = require("./validation");
const repo = (app) => app.db.query("api::personal-setting.personal-setting");
const suggestedGoals = { kcal: 2900, protein_g: 140, carbs_g: 405, fat_g: 80 };
function foodList(value) {
  const values = typeof value === "string" ? value.split(/[,;\n]+/) : value;
  if (
    !Array.isArray(values) ||
    values.length > 100 ||
    values.some((v) => typeof v !== "string")
  )
    fail("Elenco alimenti non valido");
  const out = [];
  for (const raw of values) {
    const v = raw.trim();
    if (
      v &&
      !out.some(
        (o) => o.toLocaleLowerCase("it-IT") === v.toLocaleLowerCase("it-IT"),
      )
    )
      out.push(v);
  }
  if (out.join("\n").length > 2000)
    fail("Elenco alimenti: massimo 2.000 caratteri");
  return out;
}
function validate(data) {
  if (!data || typeof data !== "object" || Array.isArray(data))
    fail("Impostazioni non valide");
  const out = {
    favoriteFoods: foodList(data.favoriteFoods),
    avoidedFoods: foodList(data.avoidedFoods),
  };
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
  const stored = r?.data || {};
  // Expose only current settings; legacy fields are not reused in AI prompts.
  const data = {
    favoriteFoods: foodList(stored.favoriteFoods || []),
    avoidedFoods: foodList(stored.avoidedFoods || []),
    goals: stored.goals ?? null,
  };
  return {
    data,
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
