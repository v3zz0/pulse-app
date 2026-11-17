"use strict";
const { fail, text } = require("./validation");
function localParts(time, timezone) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(time));
  const p = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return {
    date: `${p.year}-${p.month}-${p.day}`,
    time: `${p.hour}:${p.minute}`,
  };
}
function settings(b) {
  if (
    !["meal", "supplement", "workout", "weight", "custom"].includes(b.kind) ||
    typeof b.enabled !== "boolean" ||
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(b.at)
  )
    fail("Promemoria non valido");
  try {
    new Intl.DateTimeFormat("it", { timeZone: b.timezone }).format();
  } catch {
    fail("Fuso orario non valido");
  }
  if (typeof b.timezone !== "string" || b.timezone.length > 100)
    fail("Fuso orario non valido");
  if (
    !Array.isArray(b.weekdays) ||
    !b.weekdays.length ||
    b.weekdays.some((v) => !Number.isInteger(v) || v < 0 || v > 6)
  )
    fail("Giorni non validi");
  return {
    kind: b.kind,
    target: ["weight", "custom"].includes(b.kind) ? "" : String(b.target || ""),
    label: b.label ? text(b.label, 160) : "",
    at: b.at,
    timezone: b.timezone,
    enabled: b.enabled,
    weekdays: [...new Set(b.weekdays)],
  };
}
function isDue(reminder, completed, now = Date.now()) {
  const s = reminder.settings,
    p = localParts(now, s.timezone),
    o = reminder.occurrence?.date === p.date ? reminder.occurrence : {};
  const weekday = new Date(p.date + "T12:00:00Z").getUTCDay();
  return (
    s.enabled &&
    s.weekdays.includes(weekday) &&
    !completed &&
    p.time >= s.at &&
    !o.acknowledged &&
    (!o.snoozedUntil || Date.parse(o.snoozedUntil) <= now)
  );
}
module.exports = { localParts, settings, isDue };
