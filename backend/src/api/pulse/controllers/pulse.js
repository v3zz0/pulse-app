"use strict";
const auth = require("../../../pulse/auth");
const validate = require("../../../pulse/validation");
const nutrition = require("../../../pulse/nutrition");
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
  return query(strapi, "nutrition-plan").findOne({
    where: { owner: user.id },
    orderBy: { createdAt: "desc" },
  });
}
async function getDay(user, day) {
  validate.date(day);
  const uniqueKey = `${user.id}:${day}`;
  let entry = await query(strapi, "daily-plan").findOne({
    where: { uniqueKey, owner: user.id },
  });
  if (entry) return entry;
  const plan = await currentPlan(user);
  if (!plan)
    validate.fail(
      "Nessun piano assegnato. Importa la dieta dall’amministrazione.",
      409,
    );
  const data = {
    owner: user.id,
    uniqueKey,
    day,
    mode: "OFF",
    plan: plan.id,
    meals: structuredClone(plan.meals.OFF),
    shoppingChecked: {},
    revision: 0,
  };
  try {
    return await query(strapi, "daily-plan").create({ data });
  } catch (error) {
    entry = await query(strapi, "daily-plan").findOne({
      where: { uniqueKey, owner: user.id },
    });
    if (entry) return entry;
    throw error;
  }
}
const presentDay = (entry) => ({
  day: entry.day,
  mode: entry.mode,
  meals: entry.meals.map((meal) => ({
    ...meal,
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
          title: plan.title,
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
      shoppingChecked = entry.shoppingChecked || {};
    if (body.action === "mode") {
      mode = validate.mode(body.mode);
      if (meals.some((m) => m.consumedAt))
        validate.fail(
          "Annulla i pasti consumati prima di cambiare ON/OFF",
          409,
        );
      const plan = await query(strapi, "daily-plan").findOne({
        where: { id: entry.id },
        populate: { plan: true },
      });
      meals = structuredClone(plan.plan.meals[mode]);
      shoppingChecked = {};
    } else if (body.action === "meal") {
      const index = meals.findIndex((m) => m.id === body.mealId);
      if (index < 0) validate.fail("Pasto inesistente", 404);
      if (body.consumed === true) validate.notFuture(ctx.params.day);
      if (typeof body.consumed === "boolean")
        meals[index].consumedAt = body.consumed
          ? meals[index].consumedAt || new Date().toISOString()
          : null;
      else
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
    const result = await query(strapi, "daily-plan").updateMany({
      where: { id: entry.id, owner: user.id, revision: body.revision },
      data: { meals, mode, shoppingChecked, revision: body.revision + 1 },
    });
    if (result.count !== 1)
      validate.fail("Conflitto: ricarica la giornata", 409);
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
    if (
      !plan ||
      !Object.values(plan.meals)
        .flat()
        .some((m) =>
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
    const existing = await query(strapi, "weight-entry").findOne({
      where: { uniqueKey, owner: user.id },
    });
    if (existing)
      await query(strapi, "weight-entry").update({
        where: { id: existing.id },
        data: { kg },
      });
    else
      await query(strapi, "weight-entry").create({
        data: { owner: user.id, uniqueKey, day, kg },
      });
    ctx.body = { day, kg };
  }),
  supplements: guarded(async (ctx, user) => {
    ctx.body = (
      await query(strapi, "supplement-product").findMany({
        where: { owner: user.id },
        orderBy: { name: "asc" },
      })
    ).map((r) => ({
      id: r.id,
      name: r.name,
      instructions: r.instructions,
      ingredients: r.ingredients,
      source: r.source,
    }));
  }),
  intakes: guarded(async (ctx, user) => {
    const day = validate.date(ctx.params.day);
    ctx.body = (
      await query(strapi, "supplement-intake").findMany({
        where: { owner: user.id, day },
        populate: { product: true },
      })
    ).map((r) => ({
      productId: r.product?.id,
      name: r.productName,
      dose: r.dose,
      slot: r.slot || "daily",
      takenAt: r.takenAt,
    }));
  }),
  saveIntake: guarded(async (ctx, user) => {
    const day = validate.notFuture(ctx.params.day),
      { productId, taken, dose } = ctx.request.body || {};
    if (!Number.isInteger(productId) || typeof taken !== "boolean")
      validate.fail("Assunzione non valida");
    const product = await query(strapi, "supplement-product").findOne({
      where: { id: productId, owner: user.id },
    });
    if (!product) validate.fail("Integratore inesistente", 404);
    const slot = ctx.request.body.slot || "daily";
    if (slot !== "daily" && !/^([01]\d|2[0-3]):[0-5]\d$/.test(slot))
      validate.fail("Orario non valido");
    const uniqueKey = `${user.id}:${day}:${productId}:${slot}`,
      existing = await query(strapi, "supplement-intake").findOne({
        where: { uniqueKey, owner: user.id },
      });
    if (!taken) {
      if (existing)
        await query(strapi, "supplement-intake").delete({
          where: { id: existing.id },
        });
      ctx.status = 204;
      return;
    }
    const data = {
      dose: validate.text(dose, 100),
      takenAt: existing?.takenAt || new Date().toISOString(),
      productName: product.name,
      ingredientsSnapshot: product.ingredients,
    };
    if (existing)
      await query(strapi, "supplement-intake").update({
        where: { id: existing.id },
        data,
      });
    else
      await query(strapi, "supplement-intake").create({
        data: {
          ...data,
          owner: user.id,
          product: product.id,
          uniqueKey,
          day,
          slot,
        },
      });
    ctx.body = { saved: true };
  }),
};
