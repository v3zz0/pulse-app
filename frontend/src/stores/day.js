import { defineStore } from "pinia";
import { api, send } from "../api.js";
export const localDate = (offset = 0) => {
  const now = new Date();
  now.setDate(now.getDate() + offset);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
};
export const useDay = defineStore("day", {
  state: () => ({
    date: localDate(),
    mode: "OFF",
    meals: [],
    shopping: [],
    revision: 0,
    preferences: {},
    plan: null,
    planId: null,
    nutrientTotals: null,
    busy: false,
    error: "",
  }),
  getters: {
    next() {
      return this.meals.find((m) => !m.consumedAt);
    },
    count() {
      return this.meals.filter((m) => m.consumedAt).length;
    },
  },
  actions: {
    apply(data) {
      this.planId = data.planId;
      this.nutrientTotals = data.nutrientTotals;
      this.mode = data.mode;
      this.meals = data.meals;
      this.revision = data.revision;
      this.shopping = data.shopping;
    },
    async load(date = localDate()) {
      this.busy = true;
      this.error = "";
      this.date = date;
      try {
        const [day, prefs, plan] = await Promise.all([
          api("/days/" + date),
          api("/preferences"),
          api("/nutrition"),
        ]);
        this.apply(day);
        this.preferences = prefs;
        this.plan = plan;
      } catch (e) {
        this.error = e.message;
      } finally {
        this.busy = false;
      }
    },
    async change(body) {
      if (this.busy) return;
      this.busy = true;
      this.error = "";
      try {
        this.apply(
          await send("/days/" + this.date, {
            ...body,
            revision: this.revision,
          }),
        );
        return true;
      } catch (e) {
        this.error = e.message;
        if (e.status === 409) this.apply(await api("/days/" + this.date));
        return false;
      } finally {
        this.busy = false;
      }
    },
    isDone(id) {
      return !!this.meals.find((m) => m.id === id)?.consumedAt;
    },
    choice(meal) {
      const menu = meal.menus[meal.menuIndex || 0];
      const items = (
        meal.selectedIngredients ||
        menu.groups.map((g, i) => g.options[meal.selections?.[i] || 0])
      ).map((i) => i?.text || "Da verificare");
      return { title: items.slice(0, 2).join(" · "), desc: items.join(" · ") };
    },
    toggle(id) {
      return this.change({
        action: "meal",
        mealId: id,
        consumed: !this.isDone(id),
      });
    },
    setMode(mode) {
      return this.change({ action: "mode", mode });
    },
    select(id, menuIndex, selections) {
      return this.change({ action: "meal", mealId: id, menuIndex, selections });
    },
    async prefer(optionKey, status) {
      try {
        await send("/preferences", { optionKey, status, day: this.date });
        this.preferences[optionKey] = status;
      } catch (e) {
        this.error = e.message;
      }
    },
    checkShopping(itemId, checked) {
      return this.change({ action: "shopping", itemId, checked });
    },
  },
});
