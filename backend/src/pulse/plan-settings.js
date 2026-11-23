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
/** Foto profilo: JPEG/PNG/WebP già ridimensionata dal client, come data URL, massimo ~200 KB. */
function avatar(value) {
  if (value == null || value === "") return null;
  if (typeof value !== "string" || value.length > 270000 || !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/.test(value))
    fail("Foto profilo non valida");
  return value;
}
/** Giorni di allenamento (0 = domenica … 6 = sabato): decidono ON/OFF automatico. */
function trainingDays(value = []) {
  if (!Array.isArray(value) || value.length > 7 || value.some((d) => !Number.isInteger(d) || d < 0 || d > 6))
    fail("Giorni di allenamento non validi");
  return [...new Set(value)].sort();
}
/** ON se la data (YYYY-MM-DD, giorno locale) cade in un giorno di allenamento. */
const autoMode = (days, day) => (days.includes(new Date(day + "T12:00:00Z").getUTCDay()) ? "ON" : "OFF");
function validate(data) {
  if (!data || typeof data !== "object" || Array.isArray(data))
    fail("Impostazioni non valide");
  const out = {
    favoriteFoods: foodList(data.favoriteFoods),
    avoidedFoods: foodList(data.avoidedFoods),
    trainingDays: trainingDays(data.trainingDays),
    avatar: avatar(data.avatar),
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
    trainingDays: trainingDays(stored.trainingDays || []),
    avatar: avatar(stored.avatar),
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
module.exports = { get, save, validate, suggestedGoals, trainingDays, autoMode, avatar };
