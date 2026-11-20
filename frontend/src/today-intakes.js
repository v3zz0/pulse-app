export function todayIntakes(data, queue, day) {
  if (data?.day !== day)
    return { available: false, hasSchedule: false, remaining: [], queued: 0 };
  const entries = data.entries.filter((entry) => !entry.unscheduled);
  const queued = new Set(queue.filter((item) => item.day === day).map((item) => item.key));
  return {
    available: true,
    hasSchedule: entries.length > 0,
    remaining: entries
      .filter((entry) => entry.status === "pending" && !queued.has(entry.key))
      .sort((a, b) => (a.planned?.at || "99:99").localeCompare(b.planned?.at || "99:99")),
    queued: queued.size,
  };
}
