const { activePlan } = require("../../../pulse/active-plan");
const guard = require("../../../pulse/guarded");
const { fail, date } = require("../../../pulse/validation");
const { settings, localParts, isDue } = require("../../../pulse/reminders");
const q = (app, name) => app.db.query(`api::${name}.${name}`);
const present = (r) => ({
  id: r.uniqueKey.split(":").at(-1),
  settings: r.settings,
  occurrence: r.occurrence,
  revision: r.revision,
});
async function completed(app, owner, s, day) {
  if (s.kind === "meal") {
    const daily = await q(app, "daily-plan").findOne({ where: { owner, day } });
    return (
      !daily || !daily.meals.some((m) => m.id === s.target && !m.consumedAt)
    );
  }
  if (s.kind === "supplement")
    return !!(await q(app, "supplement-intake").findOne({
      where: { owner, day, product: Number(s.target) },
    }));
  const sessions = await q(app, "workout-session").findMany({
    where: { owner, day: s.target },
  });
  return sessions.some((r) => localParts(r.startedAt, s.timezone).date === day);
}
module.exports = {
  list: guard(async (ctx, user, app) => {
    ctx.body = (
      await q(app, "reminder").findMany({ where: { owner: user.id } })
    ).map(present);
  }),
  due: guard(async (ctx, user, app) => {
    const rows = await q(app, "reminder").findMany({
        where: { owner: user.id },
      }),
      due = [];
    for (const r of rows) {
      const day = localParts(Date.now(), r.settings.timezone).date;
      if (isDue(r, await completed(app, user.id, r.settings, day)))
        due.push({
          ...present(r),
          date: day,
          delivered: r.occurrence?.date === day && !!r.occurrence.deliveredAt,
        });
    }
    ctx.body = due;
  }),
  save: guard(async (ctx, user, app) =>
    app.db.transaction(async ({ trx }) => {
      await trx.raw("SELECT pg_advisory_xact_lock(hashtext(?))", [
        `reminder:${user.id}`,
      ]);
      const id = ctx.params.id;
      if (!/^[a-f0-9-]{36}$/i.test(id)) fail("Identificatore non valido");
      const b = ctx.request.body || {},
        uniqueKey = `${user.id}:${id}`,
        repo = q(app, "reminder"),
        r = await repo.findOne({ where: { owner: user.id, uniqueKey } });
      if (!Number.isInteger(b.revision) || b.revision !== (r?.revision || 0))
        fail("Promemoria modificato altrove", 409);
      if (b.action === "delete") {
        if (r) await repo.delete({ where: { id: r.id, owner: user.id } });
        ctx.status = 204;
        return;
      }
      let data = { revision: b.revision + 1 };
      if (b.action === "settings") {
        const s = settings(b.settings);
        s.label = s.kind === "workout" ? "Scheda " + s.target : s.target;
        if (s.kind === "workout") {
          const program = await activePlan(app, "training", user.id);
          if (!program?.days[s.target]) fail("Scheda non valida");
        }
        if (s.kind === "supplement") {
          const product = await q(app, "supplement-product").findOne({
            where: { owner: user.id, id: Number(s.target) || 0 },
          });
          if (!product) fail("Integratore inesistente", 404);
          s.label = product.name;
        }
        if (s.kind === "meal") {
          const p = await activePlan(app, "nutrition", user.id);
          const currentDay = localParts(Date.now(), s.timezone).date;
          const daily = await q(app, "daily-plan").findOne({
            where: { owner: user.id, day: currentDay },
          });
          const meal = [
            ...(p ? Object.values(p.meals).flat() : []),
            ...(daily?.meals || []),
          ].find((m) => m.id === s.target);
          if (!meal) fail("Pasto inesistente", 404);
          s.label = meal.name;
        }
        data.settings = s;
        data.occurrence = null;
        if (!r && (await repo.count({ where: { owner: user.id } })) >= 30)
          fail("Massimo 30 promemoria");
      } else {
        if (!r) fail("Promemoria inesistente", 404);
        const day = localParts(Date.now(), r.settings.timezone).date;
        if (b.date !== day) fail("Promemoria di un altro giorno", 409);
        const occurrence =
          r.occurrence?.date === day ? { ...r.occurrence } : { date: day };
        if (b.action === "snooze") {
          if (![15, 30, 60].includes(b.minutes)) fail("Rinvio non valido");
          occurrence.snoozedUntil = new Date(
            Date.now() + b.minutes * 60000,
          ).toISOString();
          occurrence.deliveredAt = null;
        } else if (b.action === "acknowledge") occurrence.acknowledged = true;
        else if (b.action === "delivered")
          occurrence.deliveredAt = new Date().toISOString();
        else fail("Azione non valida");
        data.occurrence = occurrence;
      }
      ctx.body = present(
        r
          ? await repo.update({ where: { id: r.id, owner: user.id }, data })
          : await repo.create({ data: { ...data, uniqueKey, owner: user.id } }),
      );
    }),
  ),
  weekly: guard(async (ctx, user, app) => {
    const end = date(ctx.params.day),
      start = new Date(Date.parse(end + "T12:00:00Z") - 6 * 86400000)
        .toISOString()
        .slice(0, 10);
    const days = await q(app, "daily-plan").findMany({
      where: { owner: user.id, day: { $gte: start, $lte: end } },
    });
    const sessions = await q(app, "workout-session").findMany({
      where: { owner: user.id, status: "completed" },
    });
    ctx.body = {
      start,
      end,
      planned: days.reduce((n, d) => n + d.meals.length, 0),
      consumed: days.reduce(
        (n, d) => n + d.meals.filter((m) => m.consumedAt).length,
        0,
      ),
      workouts: sessions.filter((s) => {
        const d = localParts(s.completedAt, "Europe/Rome").date;
        return d >= start && d <= end;
      }).length,
    };
  }),
};
