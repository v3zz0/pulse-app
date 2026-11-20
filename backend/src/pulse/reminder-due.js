"use strict";
const { activePlan } = require("./active-plan");
const { mealsForDate } = require("./nutrition");
const { localParts, occurrenceDay, isDue } = require("./reminders");
const q = (app, name) => app.db.query(`api::${name}.${name}`);

async function completed(app, owner, s, day) {
  if (s.kind === "meal") {
    const daily = await q(app, "daily-plan").findOne({ where: { owner, day } });
    const plan = daily ? null : await activePlan(app, "nutrition", owner);
    const meals = daily?.meals || (plan ? mealsForDate(plan, "OFF", day) : []);
    return !meals.some((m) => m.id === s.target && !m.consumedAt);
  }
  if (s.kind === "supplement")
    return require("./supplements").reminderDone(
      app,
      owner,
      s,
      day,
    );
  if (s.kind === "custom") return false;
  if (s.kind === "weight")
    return !!(await q(app, "weight-entry").findOne({ where: { owner, day } }));
  const sessions = await q(app, "workout-session").findMany({
    where: { owner, day: s.target },
  });
  return sessions.some((r) => localParts(r.startedAt, s.timezone).date === day);
}
async function checkDue(app, owner, reminder, now = Date.now()) {
  if (!isDue(reminder, false, now)) return null;
  const day = occurrenceDay(reminder, now);
  if (await completed(app, owner, reminder.settings, day)) return null;
  return day;
}

const withReminderLock = (app, owner, fn) =>
  app.db.transaction(async ({ trx }) => {
    await trx.raw("SELECT pg_advisory_xact_lock(hashtext(?))", [`reminder:${owner}`]);
    return fn(trx);
  });

module.exports = { checkDue, withReminderLock };
