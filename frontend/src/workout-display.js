export const phases = {
  warmup: "Riscaldamento",
  "warm-up": "Riscaldamento",
  "top-set": "Top set",
  "back-off": "Back-off",
  work: "Serie",
  circuit: "Circuito",
  superset: "Superset",
  mixed: "Serie miste",
};
export const phase = (value) => phases[value] || value || "Serie";
export function standard(set, loads) {
  return Object.hasOwn(loads, set.id)
    ? loads[set.id].kg
    : (set.standardKg ?? null);
}
export function title(value) {
  const s = String(value);
  return s === s.toUpperCase()
    ? s.charAt(0) +
        s
          .slice(1)
          .toLowerCase()
          .replace(/\b(bb|ez|trx)\b/g, (v) => v.toUpperCase())
    : s;
}
export const dayName = (program, key) =>
  program?.displaySettings?.days?.[key]?.name || "Scheda " + key;
export const weekdays = ["Dom", "Lun", "Mar", "Mer", "Gio", "Ven", "Sab"];
