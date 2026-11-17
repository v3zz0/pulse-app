const calendarDay = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
export const dayOf = (time) => calendarDay.format(new Date(time));
const dateAtNoon = (day) => new Date(day + "T12:00:00Z");
const dateKey = (date) => date.toISOString().slice(0, 10);

export function addDays(day, offset) {
  const date = dateAtNoon(day);
  date.setUTCDate(date.getUTCDate() + offset);
  return dateKey(date);
}
export function startOfWeek(day) {
  return addDays(day, -((dateAtNoon(day).getUTCDay() + 6) % 7));
}
export function moveMonth(month, offset) {
  const date = dateAtNoon(month + "-01");
  date.setUTCMonth(date.getUTCMonth() + offset);
  return dateKey(date).slice(0, 7);
}
export function periodStart(today, period) {
  if (period === "all") return "";
  if (period !== "year") return addDays(today, 1 - Number(period));
  const date = dateAtNoon(today);
  const month = date.getUTCMonth();
  date.setUTCFullYear(date.getUTCFullYear() - 1);
  if (date.getUTCMonth() !== month) date.setUTCDate(0);
  return dateKey(date);
}
export function completedSessions(history) {
  const sessions = new Map();
  for (const session of history) {
    if (
      session.status !== "completed" ||
      !session.clientId ||
      !Number.isFinite(Date.parse(session.completedAt))
    )
      continue;
    const seen = sessions.get(session.clientId);
    if (!seen || session.revision > seen.revision)
      sessions.set(session.clientId, {
        ...session,
        localDay: dayOf(session.completedAt),
      });
  }
  return [...sessions.values()].sort((a, b) =>
    a.completedAt.localeCompare(b.completedAt),
  );
}
export function sessionCounts(sessions) {
  const days = new Map();
  for (const session of sessions)
    days.set(session.localDay, (days.get(session.localDay) || 0) + 1);
  return days;
}
export function frequency(days, today, weeks = 6) {
  const first = addDays(startOfWeek(today), -(weeks - 1) * 7);
  return Array.from({ length: weeks }, (_, i) => {
    const start = addDays(first, i * 7);
    const count = Array.from(
      { length: 7 },
      (_, j) => days.get(addDays(start, j)) || 0,
    ).reduce((sum, n) => sum + n, 0);
    return { start, count };
  });
}
export function calendar(month, days) {
  const start = month + "-01";
  const leading = (dateAtNoon(start).getUTCDay() + 6) % 7;
  const length = dateAtNoon(
    addDays(moveMonth(month, 1) + "-01", -1),
  ).getUTCDate();
  return [
    ...Array(leading).fill(null),
    ...Array.from({ length }, (_, index) => {
      const day = addDays(start, index);
      return { day, number: index + 1, count: days.get(day) || 0 };
    }),
  ];
}
export function exerciseProgress(sessions) {
  const exercises = new Map();
  for (const session of sessions) {
    const perSession = new Map();
    for (const block of session.snapshot?.blocks || []) {
      const name = block.name?.trim();
      if (!name) continue;
      const id =
        block.exerciseKey ||
        "name:" +
          name.normalize("NFC").toLocaleLowerCase("it-IT").replace(/\s+/g, " ");
      for (const set of block.sets || []) {
        if (set.status !== "recorded" || !Number.isFinite(set.actualKg))
          continue;
        const current = perSession.get(id);
        if (
          current &&
          (current.value > set.actualKg ||
            (current.value === set.actualKg &&
              (current.reps ?? -1) >= (set.actualReps ?? -1)))
        )
          continue;
        perSession.set(id, {
          name,
          value: set.actualKg,
          reps: set.actualReps ?? null,
        });
      }
    }
    for (const [id, { name, ...result }] of perSession) {
      if (!exercises.has(id)) exercises.set(id, { id, name, points: [] });
      const exercise = exercises.get(id);
      exercise.name = name;
      exercise.points.push({
        ...result,
        day: session.localDay,
        date: session.completedAt,
        session: session.clientId,
      });
    }
  }
  return [...exercises.values()].sort((a, b) =>
    a.name.localeCompare(b.name, "it"),
  );
}
