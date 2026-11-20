const { test } = require("node:test");
const a = require("node:assert/strict");
const { localParts, isDue, settings } = require("../src/pulse/reminders");
test("promemoria timezone, rinvii e soppressione dopo completamento", () => {
  const now = Date.parse("2026-11-16T12:00:00Z"),
    s = settings({
      kind: "meal",
      target: "test",
      at: "12:00",
      timezone: "Europe/Rome",
      enabled: true,
      weekdays: [1],
    });
  a.equal(localParts(now, s.timezone).time, "13:00");
  a.equal(isDue({ settings: s }, false, now), true);
  a.equal(isDue({ settings: s }, true, now), false);
  a.equal(
    isDue(
      {
        settings: s,
        occurrence: {
          date: "2026-11-16",
          snoozedUntil: new Date(now + 60000).toISOString(),
        },
      },
      false,
      now,
    ),
    false,
  );
  a.equal(
    isDue(
      { settings: s, occurrence: { date: "2026-11-16", acknowledged: true } },
      false,
      now,
    ),
    false,
  );
  a.equal(
    isDue(
      { settings: s, occurrence: { date: "2026-11-15", acknowledged: true } },
      false,
      now,
    ),
    true,
  );
  a.throws(() => settings({ ...s, timezone: "no/such" }), /Fuso/);
});

test("un rinvio dopo mezzanotte conserva il giorno della scadenza", () => {
  const { occurrenceDay } = require("../src/pulse/reminders");
  const reminder = {
    settings: { enabled: true, at: "23:55", timezone: "Europe/Rome", weekdays: [5] },
    occurrence: { date: "2026-11-20", snoozedUntil: "2026-11-20T23:10:00.000Z" },
  };
  a.equal(isDue(reminder, false, Date.parse("2026-11-20T23:05:00Z")), false);
  a.equal(isDue(reminder, false, Date.parse("2026-11-20T23:10:00Z")), true);
  a.equal(occurrenceDay(reminder, Date.parse("2026-11-20T23:10:00Z")), "2026-11-20");
});

test("un orario saltato al cambio d’ora scatta al primo minuto valido", () => {
  const reminder = { settings: { enabled: true, at: "02:30", timezone: "Europe/Rome", weekdays: [0] } };
  a.equal(isDue(reminder, false, Date.parse("2026-03-29T00:59:00Z")), false);
  a.equal(isDue(reminder, false, Date.parse("2026-03-29T01:00:00Z")), true);
  a.equal(isDue(reminder, true, Date.parse("2026-03-29T01:00:00Z")), false);
});
