const id = (prefix) =>
  prefix + "-" + crypto.randomUUID().replace(/-/g, "").slice(0, 16);
export const italianDays = [
  { id: 1, name: "Lunedì", short: "Lun" },
  { id: 2, name: "Martedì", short: "Mar" },
  { id: 3, name: "Mercoledì", short: "Mer" },
  { id: 4, name: "Giovedì", short: "Gio" },
  { id: 5, name: "Venerdì", short: "Ven" },
  { id: 6, name: "Sabato", short: "Sab" },
  { id: 0, name: "Domenica", short: "Dom" },
];
export const series = (kind = "work") => ({
  id: id("serie"),
  kind,
  reps: "",
  standardKg: null,
  toFailure: false,
  perLeg: false,
  movements: [],
});
export const exercise = (selection = {}) => ({
  id: id("ex"),
  name: selection.name || "",
  notes: selection.notes || "",
  restSeconds: null,
  sets: [series()],
  ...selection,
});
export const sessionDay = (n = 1) => ({
  id: id("G"),
  name: "Scheda " + n,
  description: "",
  weekdays: [],
  blocks: [],
});
export const food = () => ({
  id: id("alimento"),
  foodName: "",
  quantity: null,
  unit: "g",
  notes: "",
});
export const group = () => ({ id: id("gruppo"), options: [food()] });
export const menu = (title = "Pasto principale") => ({
  id: id("menu"),
  title,
  notes: "",
  groups: [group()],
});
export const meal = (name = "") => ({
  id: id("pasto"),
  name,
  time: "",
  sourceText: "",
  menus: [menu()],
});
export const blank = (kind) => ({
  title: "",
  description: "",
  notes: "",
  ...(kind === "training"
    ? {
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        days: [sessionDay()],
        cooldown: {
          name: "Defaticamento",
          durationSeconds: null,
          sourceText: "",
        },
      }
    : { schedule: { mode: "daily", weekdays: [] }, meals: { daily: [] } }),
});
export function fromServer(kind, result) {
  const { id: planId, revision, ...draft } = result;
  if (kind === "training") {
    for (const day of draft.days)
      for (const block of day.blocks)
        for (const set of block.sets) {
          const kind = set.kind || block.phase;
          set.kind =
            kind === "warm-up"
              ? "warmup"
              : [
                    "warmup",
                    "work",
                    "top-set",
                    "back-off",
                    "circuit",
                    "superset",
                  ].includes(kind)
                ? kind
                : "work";
          set.reps = String(set.reps ?? "");
          set.movements = (
            set.movements?.length ? set.movements : block.movements || []
          ).map((m) => ({ ...m, reps: String(m.reps ?? "") }));
          if (
            set.movements.length &&
            !["circuit", "superset"].includes(set.kind)
          )
            set.kind = "circuit";
        }
  } else {
    for (const meals of Object.values(draft.meals))
      for (const m of meals)
        for (const item of m.menus) {
          item.id ||= id("menu");
          for (const g of item.groups)
            for (const o of g.options) {
              o.foodName ||= o.text;
              o.quantity ??= null;
              o.unit ||= "";
            }
        }
  }
  return draft;
}
export function move(items, from, offset) {
  const to = from + offset;
  if (from < 0 || to < 0 || to >= items.length || from === to) return;
  items.splice(to, 0, ...items.splice(from, 1));
}
const number = (value) =>
  value == null || value === "" ? null : Number(value);
export function payload(kind, d) {
  const base = { title: d.title, description: d.description, notes: d.notes };
  if (kind === "training")
    return {
      ...base,
      timezone: d.timezone,
      cooldown: {
        name: d.cooldown.name,
        durationSeconds: number(d.cooldown.durationSeconds),
        sourceText: d.cooldown.sourceText,
      },
      days: d.days.map(({ id, name, description, weekdays, blocks }) => ({
        id,
        name,
        description,
        weekdays,
        blocks: blocks.map((b) => ({
          id: b.id,
          name: b.name,
          notes: b.notes,
          restSeconds: number(b.restSeconds),
          ...(b.libraryId != null ? { libraryId: b.libraryId } : {}),
          ...(b.catalogueId ? { catalogueId: b.catalogueId } : {}),
          ...(Object.hasOwn(b, "flowId")
            ? {
                flowId: b.flowId,
                flowCleared: b.flowCleared === true,
                flowChanged: b.flowChanged === true,
              }
            : {}),
          sets: b.sets.map((s) => ({
            id: s.id,
            kind: s.kind,
            reps: String(s.reps || ""),
            standardKg: number(s.standardKg),
            ...(s.toFailure ? { toFailure: true } : {}),
            ...(s.perLeg ? { perLeg: true } : {}),
            ...(s.movements?.length && ["circuit", "superset"].includes(s.kind)
              ? {
                  movements: s.movements.map(
                    ({ name, reps, flowId, flowChanged }) => ({
                      name,
                      reps,
                      ...(flowChanged ? { flowId, flowChanged } : {}),
                    }),
                  ),
                }
              : {}),
          })),
        })),
      })),
    };
  const keys =
    d.schedule.mode === "legacy"
      ? ["ON", "OFF"]
      : d.schedule.mode === "daily"
        ? ["daily"]
        : d.schedule.weekdays.map(String);
  return {
    ...base,
    schedule: d.schedule,
    meals: Object.fromEntries(
      keys.map((day) => [
        day,
        (d.meals[day] || []).map((m) => ({
          id: m.id,
          name: m.name,
          time: m.time,
          sourceText: m.sourceText,
          menus: m.menus.map((item) => ({
            id: item.id,
            title: item.title,
            notes: item.notes,
            groups: item.groups.map((g) => ({
              id: g.id,
              options: g.options.map(
                ({ id, foodName, unit, quantity, notes }) => ({
                  id,
                  foodName,
                  unit,
                  quantity:
                    typeof quantity === "string" &&
                    quantity &&
                    !Number.isFinite(Number(quantity))
                      ? quantity
                      : number(quantity),
                  notes,
                }),
              ),
            })),
          })),
        })),
      ]),
    ),
  };
}
