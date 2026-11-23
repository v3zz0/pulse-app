"use strict";
const auth = require("../../../pulse/auth");
const validate = require("../../../pulse/validation");
const nutrition = require("../../../pulse/nutrition");
const { activePlan } = require("../../../pulse/active-plan");
const nutrientTotals = require("../../../pulse/nutrient-totals");
const settings = require("../../../pulse/plan-settings");
const uid = (name) => `api::${name}.${name}`;
const query = (strapi, name) => strapi.db.query(uid(name));
const safeUser = (user) => ({ id: user.id, username: user.username });
// All endpoints go through this guard. No standard collection REST routes are exposed.
const guarded = (action) =>
  async function (ctx) {
    try {
      const user = await auth.requireUser(ctx, strapi);
      await action(ctx, user);
    } catch (error) {
      if (error.status) return ctx.throw(error.status, error.message);
      throw error;
    }
  };
const handler = (action) =>
  async function (ctx) {
    try {
      await action(ctx, strapi);
    } catch (error) {
      if (error.status) return ctx.throw(error.status, error.message);
      throw error;
    }
  };
async function currentPlan(user) {
  return activePlan(strapi, "nutrition", user.id);
}
const usesModes = (plan) => !plan?.editor?.schedule || plan.editor.schedule.mode === "legacy";
async function getDay(user, day) {
  validate.date(day);
  const uniqueKey = `${user.id}:${day}`;
  let entry = await query(strapi, "daily-plan").findOne({
    where: { uniqueKey, owner: user.id },
    populate: { plan: true },
  });
  const days = (await settings.get(strapi, user.id)).data.trainingDays,
    auto = settings.autoMode(days, day);
  // Giornata mai toccata dall'utente: segue i giorni di allenamento attuali.
  if (entry && entry.revision === 0 && entry.mode !== auto && usesModes(entry.plan) && !entry.meals.some((m) => m.consumedAt || m.skippedAt)) {
    await query(strapi, "daily-plan").updateMany({
      where: { id: entry.id, owner: user.id, revision: 0 },
      data: { mode: auto, meals: structuredClone(nutrition.mealsForDate(entry.plan, auto, day)), shoppingChecked: {} },
    });
    entry = await query(strapi, "daily-plan").findOne({ where: { uniqueKey, owner: user.id }, populate: { plan: true } });
  }
  if (entry) return Object.assign(entry, { autoMode: auto });
  const plan = await currentPlan(user);
  if (!plan)
    validate.fail(
      "Nessun piano attivo. Crea o attiva un piano da Dieta.",
      409,
    );
  const data = {
    owner: user.id,
    uniqueKey,
    day,
    mode: usesModes(plan) ? auto : "OFF",
    plan: plan.id,
    meals: structuredClone(nutrition.mealsForDate(plan, usesModes(plan) ? auto : "OFF", day)),
    planEditRevision: plan.editor?.requestId || null,
    shoppingChecked: {},
    revision: 0,
  };
  try {
    await query(strapi, "daily-plan").create({ data });
    const created = await query(strapi, "daily-plan").findOne({
      where: { uniqueKey, owner: user.id },
      populate: { plan: true },
    });
    return Object.assign(created, { autoMode: auto });
  } catch (error) {
    entry = await query(strapi, "daily-plan").findOne({
      where: { uniqueKey, owner: user.id },
      populate: { plan: true },
    });
    if (entry) return Object.assign(entry, { autoMode: auto });
    throw error;
  }
}
const presentDay = (entry) => ({
  day: entry.day,
  planId: entry.plan?.id || null,
  planUsesModes: !entry.plan?.editor?.schedule || entry.plan.editor.schedule.mode === "legacy",
  planOutdated: (entry.planEditRevision || null) !== (entry.plan?.editor?.requestId || null),
  nutrientTotals: nutrientTotals.dayTotals(entry.meals),
  mode: entry.mode,
  autoMode: entry.autoMode,
  meals: entry.meals.map((meal) => ({
    ...meal,
    nutrientTotals: nutrientTotals.mealTotals(meal),
    selectedIngredients: nutrition.selectedIngredients(meal),
  })),
  revision: entry.revision,
  shopping: nutrition.shopping(entry.meals, entry.shoppingChecked),
});
module.exports = {
  login: handler(auth.login),
  logout: handler(auth.logout),
  profile: guarded((ctx, user) => auth.updateProfile(ctx, strapi, user)),
  me: guarded(async (ctx, user) => {
    ctx.body = { user: safeUser(user) };
  }),
  nutrition: guarded(async (ctx, user) => {
    const plan = await currentPlan(user);
    ctx.body = plan
      ? {
          id: plan.id,
          title: plan.title,
          provenance: plan.provenance || "PDF storico",
          sourceDate: plan.sourceDate,
          reviewStatus: plan.reviewStatus,
          notes: plan.notes,
          report: plan.importReport,
        }
      : null;
  }),
  day: guarded(async (ctx, user) => {
    ctx.body = presentDay(await getDay(user, ctx.params.day));
  }),
  updateDay: guarded(async (ctx, user) => {
    const entry = await getDay(user, ctx.params.day),
      body = ctx.request.body || {};
    if (!Number.isInteger(body.revision) || body.revision !== entry.revision)
      validate.fail("Giornata modificata altrove: ricarica e riprova", 409);
    let meals = structuredClone(entry.meals),
      mode = entry.mode,
      shoppingChecked = entry.shoppingChecked || {},
      nextPlanId = entry.plan?.id,
      planEditRevision = entry.planEditRevision;
    if (body.action === "apply-plan") {
      if (body.confirm !== true) validate.fail("Conferma esplicita richiesta");
      if (meals.some((m) => m.consumedAt || m.skippedAt))
        validate.fail(
          "Giornata con pasti consumati: mantieni il piano storico",
          409,
        );
      const current = await currentPlan(user);
      if (!current) validate.fail("Nessun piano attivo", 409);
      meals = structuredClone(nutrition.mealsForDate(current, mode, entry.day));
      planEditRevision = current.editor?.requestId || null;
      shoppingChecked = {};
      nextPlanId = current.id;
    } else if (body.action === "mode") {
      mode = body.mode === "auto" ? entry.autoMode : validate.mode(body.mode);
      if (meals.some((m) => m.consumedAt || m.skippedAt))
        validate.fail(
          "Annulla i pasti consumati prima di cambiare ON/OFF",
          409,
        );
      const plan = await query(strapi, "daily-plan").findOne({
        where: { id: entry.id },
        populate: { plan: true },
      });
      const selected = plan.plan;
      if (!selected || (selected.editor?.schedule && selected.editor.schedule.mode !== "legacy"))
        validate.fail("Il piano segue il calendario settimanale", 409);
      if ((selected.editor?.requestId || null) !== (entry.planEditRevision || null))
        validate.fail("Applica il piano aggiornato prima di cambiare ON/OFF", 409);
      meals = structuredClone(nutrition.mealsForDate(selected, mode, entry.day));
      shoppingChecked = {};
    } else if (body.action === "meal") {
      const index = meals.findIndex((m) => m.id === body.mealId);
      if (index < 0) validate.fail("Pasto inesistente", 404);
      if (body.consumed === true || body.skipped === true) validate.notFuture(ctx.params.day);
      // Mangiato e saltato si escludono: segnare uno annulla l'altro.
      if (typeof body.consumed === "boolean") {
        meals[index].consumedAt = body.consumed
          ? meals[index].consumedAt || new Date().toISOString()
          : null;
        if (body.consumed) meals[index].skippedAt = null;
      } else if (typeof body.skipped === "boolean") {
        meals[index].skippedAt = body.skipped
          ? meals[index].skippedAt || new Date().toISOString()
          : null;
        if (body.skipped) meals[index].consumedAt = null;
      } else
        meals[index] = nutrition.selectMeal(
          meals[index],
          body.menuIndex,
          body.selections,
        );
    } else if (body.action === "shopping") {
      if (
        typeof body.checked !== "boolean" ||
        !nutrition.shopping(meals).some((i) => i.id === body.itemId)
      )
        validate.fail("Voce spesa non valida");
      shoppingChecked = { ...shoppingChecked, [body.itemId]: body.checked };
    } else validate.fail("Azione non valida");
    // Conditional update prevents silently overwriting another tab/device.
    await strapi.db.transaction(async () => {
      const result = await query(strapi, "daily-plan").updateMany({
        where: { id: entry.id, owner: user.id, revision: body.revision },
        data: { meals, mode, shoppingChecked, planEditRevision, revision: body.revision + 1 },
      });
      if (result.count !== 1)
        validate.fail("Conflitto: ricarica la giornata", 409);
      // Strapi updateMany only updates scalar fields; change the relation in the same transaction.
      if (nextPlanId !== entry.plan?.id)
        await query(strapi, "daily-plan").update({
          where: { id: entry.id, owner: user.id },
          data: { plan: nextPlanId },
        });
    });
    ctx.body = presentDay(await getDay(user, ctx.params.day));
  }),
  preferences: guarded(async (ctx, user) => {
    const rows = await query(strapi, "food-preference").findMany({
      where: { owner: user.id },
    });
    ctx.body = Object.fromEntries(rows.map((r) => [r.optionKey, r.status]));
  }),
  savePreference: guarded(async (ctx, user) => {
    const { optionKey, status } = ctx.request.body || {};
    if (!["favorite", "avoid", "neutral"].includes(status))
      validate.fail("Preferenza non valida");
    validate.text(optionKey);
    const plan = await currentPlan(user);
    let meals = plan ? Object.values(plan.meals).flat() : [];
    if (ctx.request.body?.day) {
      const day = validate.date(ctx.request.body.day);
      const saved = await query(strapi, "daily-plan").findOne({
        where: { owner: user.id, day },
      });
      meals = [...meals, ...(saved?.meals || [])];
    }
    if (
      !meals.some((m) =>
        m.menus.some((menu) =>
          menu.groups.some((g) => g.options.some((o) => o.id === optionKey)),
        ),
      )
    )
      validate.fail("Opzione inesistente", 404);
    const uniqueKey = `${user.id}:${optionKey}`,
      existing = await query(strapi, "food-preference").findOne({
        where: { uniqueKey, owner: user.id },
      });
    if (existing)
      await query(strapi, "food-preference").update({
        where: { id: existing.id },
        data: { status },
      });
    else
      await query(strapi, "food-preference").create({
        data: { owner: user.id, uniqueKey, optionKey, status },
      });
    ctx.body = { optionKey, status };
  }),
  weights: guarded(async (ctx, user) => {
    ctx.body = (
      await query(strapi, "weight-entry").findMany({
        where: { owner: user.id },
        orderBy: { day: "asc" },
      })
    ).map((r) => ({ day: r.day, kg: Number(r.kg) }));
  }),
  saveWeight: guarded(async (ctx, user) => {
    const day = validate.notFuture(ctx.params.day),
      kg = validate.kg(ctx.request.body?.kg),
      uniqueKey = `${user.id}:${day}`;
    await strapi.db.transaction(async ({ trx }) => {
      await trx.raw("SELECT pg_advisory_xact_lock(hashtext(?))", [
        `weight:${uniqueKey}`,
      ]);
      const weights = query(strapi, "weight-entry");
      const existing = await weights.findOne({
        where: { uniqueKey, owner: user.id },
      });
      if (existing)
        await weights.update({ where: { id: existing.id, owner: user.id }, data: { kg } });
      else
        await weights.create({ data: { owner: user.id, uniqueKey, day, kg } });
    });
    ctx.body = { day, kg };
  }),
  supplements: guarded(async (ctx, user) => {
    ctx.body = await require("../../../pulse/supplements").list(
      strapi,
      user.id,
      ctx.query.includeArchived === "1",
    );
  }),
  intakes: guarded(async (ctx, user) => {
    ctx.body = await require("../../../pulse/supplements").listTaken(
      strapi,
      user.id,
      ctx.params.day,
    );
  }),
  saveIntake: guarded(async (ctx, user) => {
    const b = ctx.request.body || {};
    ctx.body = await require("../../../pulse/supplements").record(
      strapi,
      user.id,
      ctx.params.day,
      b,
    );
    if (b.taken === false) ctx.status = 204;
  }),
};
