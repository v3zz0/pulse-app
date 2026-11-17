"use strict";
const { randomUUID } = require("node:crypto");
const { fail, text } = require("./validation");
const { kg } = require("./workout");

const short = () => randomUUID().replace(/-/g, "").slice(0, 16);
const note = (value, max = 1600) =>
  value == null || value === "" ? "" : text(value, max);
const key = (value) => {
  if (typeof value !== "string" || !/^[a-zA-Z0-9_.:-]{1,128}$/.test(value))
    fail("Identificativo elemento non valido");
  return value;
};
function items(value, max, label, min = 1) {
  if (!Array.isArray(value) || value.length < min || value.length > max)
    fail(label + " non validi");
  if (
    value.some(
      (item) => !item || typeof item !== "object" || Array.isArray(item),
    )
  )
    fail(label + " non validi");
  return value;
}
function object(value) {
  if (!value || typeof value !== "object" || Array.isArray(value))
    fail("Dati del piano non validi");
  return value;
}
function integer(value, min, max, label) {
  if (!Number.isInteger(value) || value < min || value > max)
    fail(label + " non valido");
  return value;
}
function weekdays(value, allowEmpty = false) {
  if (
    !Array.isArray(value) ||
    value.length > 7 ||
    (!allowEmpty && !value.length)
  )
    fail("Seleziona i giorni della settimana");
  return [...new Set(value.map((d) => integer(d, 0, 6, "Giorno")))].sort();
}
function unique(used, value) {
  const id = key(value);
  if (used.has(id)) fail("Identificativo duplicato nel piano");
  used.add(id);
  return id;
}
function own(map, id) {
  return Object.hasOwn(map, id) ? map[id] : undefined;
}
function calendar(value) {
  const timeZone =
    typeof value === "string" && value.length <= 100 ? value : "Europe/Rome";
  try {
    new Intl.DateTimeFormat("it", { timeZone });
  } catch {
    fail("Fuso orario non valido");
  }
  return timeZone;
}

async function training(app, owner, data, previous) {
  const used = new Set(),
    days = {},
    layout = {};
  const flow = require("./flow/runtime");
  const library = app.db.query("api::exercise-library.exercise-library");
  const flows = new Map(),
    custom = new Map();
  async function checkedFlow(id) {
    if (id === null) return null;
    if (typeof id !== "string") fail("Animazione non valida");
    if (!flows.has(id)) flows.set(id, await flow.exercise(id));
    return flows.get(id).animation ? id : null;
  }
  for (const day of items(data.days, 12, "Giornate")) {
    const id = key(day.id);
    if (
      !/^[A-Za-z0-9_.-]{1,20}$/.test(id) ||
      Object.hasOwn(days, id) ||
      Object.hasOwn(Object.prototype, id)
    )
      fail("Riferimento giornata non valido");
    layout[id] = {
      name: text(day.name, 60),
      description: note(day.description, 160),
      weekdays: weekdays(day.weekdays || [], true),
    };
    days[id] = [];
    for (const b of items(day.blocks, 100, "Esercizi")) {
      const blockId = unique(used, b.id);
      const old = own(previous?.days || {}, id)?.find((p) => p.id === blockId);
      const name = text(b.name, 160);
      const sameName = old?.name === name;
      const block = {
        ...(sameName ? old : {}),
        id: blockId,
        exerciseId: sameName && old.exerciseId ? old.exerciseId : blockId,
        name,
        order: days[id].length + 1,
        notes: note(b.notes),
        restSeconds:
          b.restSeconds == null
            ? null
            : integer(b.restSeconds, 1, 3600, "Recupero"),
        restRaw: b.restSeconds === old?.restSeconds ? old?.restRaw || "" : "",
        videos: sameName ? old.videos || [] : [],
        sets: [],
        movements: [],
      };
      if (b.libraryId != null) {
        integer(b.libraryId, 1, Number.MAX_SAFE_INTEGER, "Esercizio personale");
        if (!custom.has(b.libraryId))
          custom.set(
            b.libraryId,
            await library.findOne({ where: { id: b.libraryId, owner } }),
          );
        if (!custom.get(b.libraryId))
          fail("Esercizio personale inesistente", 404);
        block.libraryId = b.libraryId;
        block.exerciseKey = "personal-" + b.libraryId;
      } else if (b.catalogueId != null) {
        await checkedFlow(b.catalogueId);
        block.catalogueId = b.catalogueId;
        block.exerciseKey = "flow-" + b.catalogueId;
      }
      if (Object.hasOwn(b, "flowId") && (b.flowChanged || !sameName)) {
        block.flowId =
          b.flowId === old?.flowId ? old.flowId : await checkedFlow(b.flowId);
        if (b.flowCleared === true && block.flowId === null)
          block.flowCleared = true;
        else delete block.flowCleared;
      }

      for (const s of items(b.sets, 50, "Serie")) {
        const setId = unique(used, s.id);
        if (
          ![
            "warmup",
            "top-set",
            "back-off",
            "work",
            "circuit",
            "superset",
          ].includes(s.kind)
        )
          fail("Tipo di serie non valido");
        const compound = ["circuit", "superset"].includes(s.kind);
        const oldSet = sameName ? old.sets.find((p) => p.id === setId) : null;
        const moves = compound
          ? await Promise.all(
              items(s.movements, 20, "Movimenti", 2).map(async (m, index) => {
                const name = text(m.name, 160);
                const prior =
                  oldSet?.movements?.[index] || old?.movements?.[index];
                const move = {
                  ...(prior?.name === name ? prior : {}),
                  name,
                  reps: text(String(m.reps ?? ""), 40),
                  order: index + 1,
                };
                if (m.flowChanged && Object.hasOwn(m, "flowId")) {
                  move.flowId = await checkedFlow(m.flowId);
                  if (move.flowId === null) move.flowCleared = true;
                  else delete move.flowCleared;
                }
                return move;
              }),
            )
          : [];
        const reps = compound
          ? moves.map((m) => m.reps).join("+")
          : text(s.reps, 80);
        const range = /^([0-9]+)\s*[-–]\s*([0-9]+)$/.exec(reps);
        if (!compound && range) {
          const min = integer(Number(range[1]), 1, 1000, "Ripetizioni");
          integer(Number(range[2]), min, 1000, "Ripetizioni");
        } else if (!compound && /^\d+$/.test(reps))
          integer(Number(reps), 1, 1000, "Ripetizioni");
        else if (
          !compound &&
          !["ced", "amrap", "cedimento"].includes(reps.toLowerCase()) &&
          reps !== oldSet?.reps
        )
          fail("Usa un numero, un intervallo come 8-12 o CED");
        const load = kg(s.standardKg ?? null);
        if (
          load != null &&
          Math.abs(load * 100 - Math.round(load * 100)) > 1e-8
        )
          fail("Il carico ammette fino a due decimali");
        block.sets.push({
          id: setId,
          order: block.sets.length + 1,
          kind: s.kind,
          reps,
          repsMin: range ? Number(range[1]) : null,
          repsMax: range ? Number(range[2]) : null,
          toFailure:
            s.toFailure === true || /^(ced|amrap|cedimento)$/i.test(reps),
          perLeg: s.perLeg === true,
          standardKg: load,
          movements: moves,
        });
      }
      const withMoves = block.sets.filter((s) => s.movements.length);
      if (withMoves.length) {
        if (withMoves.length !== block.sets.length)
          fail("Raggruppa serie singole e circuiti in esercizi separati");
        const signature = (m) => m.map((x) => x.name).join("\n");
        if (
          withMoves.some(
            (s) => signature(s.movements) !== signature(withMoves[0].movements),
          )
        )
          fail(
            "Mantieni gli stessi movimenti nel blocco e varia soltanto le ripetizioni",
          );
        block.movements = withMoves[0].movements;
        block.circuitId = old?.circuitId || blockId;
      }
      block.phase = block.sets[0].kind;
      if (!sameName) {
        block.prescriptionRaw = "";
        block.sourceText = "";
      }
      days[id].push(block);
    }
  }
  const c = object(data.cooldown || {});
  const cooldown = {
    name: c.name ? text(c.name, 160) : "Defaticamento",
    durationSeconds:
      c.durationSeconds == null
        ? null
        : integer(c.durationSeconds, 1, 3600, "Defaticamento"),
    sourceText: note(c.sourceText),
    videos: previous?.cooldown?.videos || [],
  };
  return {
    days,
    cooldown,
    displaySettings: { timezone: calendar(data.timezone), days: layout },
    displayRevision: (previous?.displayRevision || 0) + 1,
  };
}

function food(o, prior, used) {
  const id = unique(used, o.id);
  const priorName = prior?.foodName || prior?.text;
  const foodName = text(o.foodName, 300);
  const unit = note(o.unit, 40);
  const quantity = o.quantity;
  const unchanged =
    prior &&
    foodName === priorName &&
    quantity === (prior.quantity ?? null) &&
    unit === (prior.unit || "");
  // Imported unstructured amounts remain readable until explicitly edited.
  if (
    !unchanged &&
    (typeof quantity !== "number" ||
      !Number.isFinite(quantity) ||
      quantity <= 0 ||
      quantity > 10000 ||
      !["g", "ml", "piece", "portion"].includes(unit))
  )
    fail("Inserisci quantità positiva e unità per ogni alimento");
  if (unchanged) return { ...prior, id, notes: note(o.notes) };
  const sameFood = prior && priorName === foodName && prior.unit === unit;
  return {
    id,
    foodName,
    quantity,
    unit,
    foodState: sameFood ? prior.foodState || "as_sold" : "as_sold",
    text: foodName + " — " + quantity + " " + unit,
    notes: note(o.notes),
    ...(sameFood && prior.nutrition ? { nutrition: prior.nutrition } : {}),
  };
}
function nutrition(data, previous) {
  const schedule = object(data.schedule);
  if (!["daily", "weekly", "legacy"].includes(schedule.mode))
    fail("Calendario non valido");
  if (
    schedule.mode === "legacy" &&
    (!previous ||
      (previous.editor?.schedule?.mode &&
        previous.editor.schedule.mode !== "legacy"))
  )
    fail("Modalità ON/OFF non disponibile");
  const configured =
    schedule.mode === "legacy" ? [] : weekdays(schedule.weekdays);
  const expected =
    schedule.mode === "legacy"
      ? ["ON", "OFF"]
      : schedule.mode === "daily"
        ? ["daily"]
        : configured.map(String);
  const input = object(data.meals);
  if (Object.keys(input).some((k) => !expected.includes(k)))
    fail("Giornata non valida");
  const used = new Set(),
    meals = {};
  for (const day of expected)
    meals[day] = items(input[day], 20, "Pasti").map((m, index) => {
      const id = unique(used, m.id);
      const prior = own(previous?.meals || {}, day)?.find((x) => x.id === id);
      const name = text(m.name, 160);
      const time = m.time || "";
      if (
        time !== "" &&
        (typeof time !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time))
      )
        fail("Orario del pasto non valido");
      const menuIds = new Set(),
        menus = items(m.menus, 20, "Menu").map((menu) => {
          const menuId = unique(menuIds, menu.id);
          const oldMenu = prior?.menus.find(
            (x) =>
              x.id === menuId ||
              (!x.id &&
                x.groups.some((g) => menu.groups?.some((n) => n.id === g.id))),
          );
          const groupIds = new Set();
          return {
            id: menuId,
            title: text(menu.title, 160),
            notes: note(menu.notes),
            groups: items(menu.groups, 30, "Alimenti").map((g) => {
              const groupId = unique(groupIds, g.id);
              const oldGroup = oldMenu?.groups.find((x) => x.id === groupId);
              return {
                id: groupId,
                sourceText: oldGroup?.sourceText || "",
                options: items(g.options, 30, "Sostituzioni").map((o) =>
                  food(
                    o,
                    oldGroup?.options.find((x) => x.id === o.id),
                    used,
                  ),
                ),
              };
            }),
          };
        });
      return {
        ...(prior || {}),
        id,
        name,
        time,
        order: index + 1,
        menus,
        menuIndex: 0,
        selections: menus[0].groups.map(() => 0),
        consumedAt: null,
        sourceText: note(m.sourceText),
      };
    });
  return { meals, schedule: { mode: schedule.mode, weekdays: configured } };
}

function duplicateContent(kind, plan, loads) {
  if (kind === "training") {
    const days = structuredClone(plan.days);
    for (const blocks of Object.values(days))
      for (const b of blocks) {
        b.id = "ex-" + short();
        for (const s of b.sets) {
          s.standardKg =
            own(loads, s.id) ??
            (Object.hasOwn(loads, s.id) ? null : (s.standardKg ?? null));
          s.id = b.id + ":" + short();
        }
      }
    return {
      days,
      cooldown: plan.cooldown,
      displaySettings: plan.displaySettings,
      displayRevision: 0,
    };
  }
  const meals = structuredClone(plan.meals);
  for (const list of Object.values(meals))
    for (const m of list) {
      m.id = "meal-" + short();
      m.consumedAt = null;
      for (const menu of m.menus) {
        menu.id = "menu-" + short();
        for (const g of menu.groups) {
          g.id = "group-" + short();
          for (const o of g.options) o.id = "food-" + short();
        }
      }
    }
  return { meals, supplements: plan.supplements };
}
module.exports = {
  training,
  nutrition,
  duplicateContent,
  note,
  weekdays,
  key,
  object,
};
