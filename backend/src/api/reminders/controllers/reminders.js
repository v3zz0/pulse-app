const { checkDue, withReminderLock } = require("../../../pulse/reminder-due");
const push = require("../../../pulse/push");
const { activePlan } = require("../../../pulse/active-plan");
const guard = require("../../../pulse/guarded");
const { fail, date } = require("../../../pulse/validation");
const { settings, localParts, occurrenceDay } = require("../../../pulse/reminders");
const q = (app, name) => app.db.query(`api::${name}.${name}`);
const present = (r) => ({
  id: r.uniqueKey.split(":").at(-1),
  settings: r.settings,
  occurrence: r.occurrence,
  revision: r.revision,
});
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
    const pushManaged = push.configured() && (await push.activeSubscriptions(app, user.id)).length > 0;
    for (const r of rows) {
      const day = await checkDue(app, user.id, r);
      if (day)
        due.push({
          ...present(r),
          date: day,
          pushManaged,
          delivered: r.occurrence?.date === day && !!(r.occurrence.deliveredAt || r.occurrence.pushShownAt),
        });
    }
    ctx.body = due;
  }),
  save: guard(async (ctx, user, app) =>
    withReminderLock(app, user.id, async () => {
      const id = ctx.params.id;
      if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id)) fail("Identificatore non valido");
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
      if (b.action === "toggle") {
        if (!r || typeof b.enabled !== "boolean") fail("Stato non valido");
        data.settings = { ...r.settings, enabled: b.enabled };
      } else if (b.action === "settings") {
        const s = settings(b.settings || {});
        if (s.kind === "custom" && !s.label) fail("Inserisci un nome");
        if (s.kind === "weight") s.label ||= "Pesarsi";
        if (s.kind === "workout") {
          const program = await activePlan(app, "training", user.id);
          if (!program || !Object.hasOwn(program.days, s.target))
            fail("Scheda non valida");
          s.label ||= program.displaySettings?.days?.[s.target]?.name || "Scheda " + s.target;
        }
        if (s.kind === "supplement") {
          const product = await q(app, "supplement-product").findOne({
            where: { owner: user.id, id: Number(s.target) || 0 },
          });
          if (!product || product.active === false)
            fail("Integratore inesistente o archiviato", 404);
          s.label ||= product.name;
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
          s.label ||= meal.name;
        }
        data.settings = s;
        data.occurrence = null;
        if (!r && (await repo.count({ where: { owner: user.id } })) >= 30)
          fail("Massimo 30 promemoria");
      } else {
        if (!r) fail("Promemoria inesistente", 404);
        const day = occurrenceDay(r);
        if (b.date !== day) fail("Promemoria di un altro giorno", 409);
        const occurrence =
          r.occurrence?.date === day ? { ...r.occurrence } : { date: day };
        if (b.action === "snooze") {
          if (![15, 30, 60].includes(b.minutes)) fail("Rinvio non valido");
          occurrence.snoozedUntil = new Date(
            Date.now() + b.minutes * 60000,
          ).toISOString();
          occurrence.deliveredAt = null;
          occurrence.pushShownAt = null;
        } else if (b.action === "acknowledge") occurrence.acknowledged = true;
        else if (b.action === "delivered") {
          if (occurrence.deliveredAt || occurrence.pushShownAt || !(await checkDue(app, user.id, r)) ||
              (push.configured() && (await push.activeSubscriptions(app, user.id)).length))
            fail("Promemoria già preso in carico", 409);
          occurrence.deliveredAt = new Date().toISOString();
        }
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
