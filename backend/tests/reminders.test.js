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
