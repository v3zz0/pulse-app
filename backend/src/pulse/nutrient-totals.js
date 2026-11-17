"use strict";
const { selectedIngredients } = require("./nutrition");
const KEYS = ["kcal", "protein_g", "carbs_g", "fat_g"];
function itemTotals(item) {
  const n = item?.nutrition;
  let factor = null;
  if (n && item.quantity > 0 && n.source) {
    if (n.basis === "per_100g" && item.unit === "g")
      factor = item.quantity / 100;
    if (n.basis === "per_portion" && n.basisQuantity > 0)
      factor = item.quantity / n.basisQuantity;
  }
  const values = Object.fromEntries(
    KEYS.map((k) => [
      k,
      factor !== null && typeof n[k] === "number" ? n[k] * factor : null,
    ]),
  );
  return {
    values,
    status: n?.status || "missing",
    source: n?.source || "",
    complete: KEYS.every((k) => values[k] !== null),
  };
}
function combine(items) {
  const known = Object.fromEntries(KEYS.map((k) => [k, 0])),
    complete = items.length > 0 && items.every((i) => i.complete);
  for (const i of items) for (const k of KEYS) known[k] += i.values[k] ?? 0;
  for (const k of KEYS) known[k] = Math.round(known[k] * 100) / 100;
  return {
    known,
    values: complete ? known : Object.fromEntries(KEYS.map((k) => [k, null])),
    complete,
    items: items.length,
    status: !complete
      ? "partial"
      : items.some((i) => i.status === "estimated")
        ? "estimated"
        : items.every((i) => i.status === "verified")
          ? "verified"
          : "declared",
  };
}
function mealTotals(meal) {
  return combine(selectedIngredients(meal).map(itemTotals));
}
function dayTotals(meals) {
  return combine(meals.flatMap((m) => selectedIngredients(m).map(itemTotals)));
}
module.exports = { itemTotals, mealTotals, dayTotals };
