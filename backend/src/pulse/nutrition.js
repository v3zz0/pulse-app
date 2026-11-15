"use strict";
const { fail } = require("./validation");
// A meal contains alternative menus; each menu contains groups. One item per group,
// all groups together. This keeps “oppure” separate from complementary ingredients.
function selectedIngredients(meal) {
  const menu = meal.menus[meal.menuIndex || 0];
  const items = menu.groups.map(
    (group, i) => group.options[meal.selections?.[i] || 0],
  );
  if (
    menu.notes?.includes("mezzo cucchiaio") &&
    items.some((item) => /pesce grasso/.test(item?.text))
  ) {
    return items.map((item) =>
      /Condire con 1 cucchiaio/.test(item?.text)
        ? {
            ...item,
            id: item.id + "-half",
            text: item.text.replace("1 cucchiaio raso", "mezzo cucchiaio"),
            conditionalNote: menu.notes,
          }
        : item,
    );
  }
  return items;
}
function shopping(meals, checked = {}) {
  const items = new Map();
  for (const meal of meals)
    for (const ingredient of selectedIngredients(meal)) {
      if (!ingredient) continue;
      const key = ingredient.id;
      const existing = items.get(key);
      if (existing) existing.servings++;
      else
        items.set(key, {
          id: key,
          label: ingredient.text,
          servings: 1,
          checked: checked[key] === true,
          reviewRequired: ingredient.reviewRequired === true,
        });
    }
  return [...items.values()];
}
function selectMeal(meal, menuIndex, selections) {
  if (!Number.isInteger(menuIndex) || !meal.menus[menuIndex])
    fail("Alternativa inesistente");
  if (
    !Array.isArray(selections) ||
    selections.length !== meal.menus[menuIndex].groups.length
  )
    fail("Selezioni incomplete");
  selections.forEach((index, i) => {
    if (
      !Number.isInteger(index) ||
      !meal.menus[menuIndex].groups[i].options[index]
    )
      fail("Alimento inesistente");
  });
  if (meal.consumedAt)
    fail("Annulla il consumo prima di cambiare il pasto", 409);
  return { ...meal, menuIndex, selections };
}
module.exports = { selectedIngredients, shopping, selectMeal };
