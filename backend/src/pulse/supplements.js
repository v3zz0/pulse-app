"use strict";
const { fail, text, date, notFuture } = require("./validation");
const { localParts } = require("./reminders");
const q = (a, n) => a.db.query(`api::${n}.${n}`);
const uid = (v) => {
  if (
    typeof v !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)
  )
    fail("Identificatore non valido");
  return v;
};
const optional = (v, max) => (v == null || v === "" ? "" : text(v, max));
const clock = (v) => {
  if (typeof v !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(v))
    fail("Orario non valido");
  return v;
};
const zone = (v) => {
  if (typeof v !== "string" || v.length > 100) fail("Fuso orario non valido");
  try {
    new Intl.DateTimeFormat("it", { timeZone: v }).format();
  } catch {
    fail("Fuso orario non valido");
  }
  return v;
};
const lock = (app, owner, fn) =>
  app.db.transaction(async ({ trx }) => {
    await trx.raw("SELECT pg_advisory_xact_lock(hashtext(?))", [
      `supplement:${owner}`,
    ]);
    await trx.raw("SELECT pg_advisory_xact_lock(hashtext(?))", [
      `reminder:${owner}`,
    ]);
    return fn();
  });
function validateProduct(b) {
  if (!b || typeof b !== "object" || Array.isArray(b))
    fail("Integratore non valido");
  if (
    !Array.isArray(b.declaredActives) ||
    b.declaredActives.length > 30 ||
    !Array.isArray(b.schedule) ||
    b.schedule.length > 8 ||
    typeof b.active !== "boolean"
  )
    fail("Programmazione o ingredienti non validi");
  const result = {
    name: text(b.name, 160),
    brand: optional(b.brand, 100),
    ingredients: optional(b.ingredients, 4000),
    labelQuantity: optional(b.labelQuantity, 100),
    labelUnit: optional(b.labelUnit, 40),
    notes: optional(b.notes, 2000),
    instructions: optional(b.instructions, 4000),
    active: b.active,
  };
  result.declaredActives = b.declaredActives.map((a) => {
    if (!a || typeof a !== "object" || Array.isArray(a))
      fail("Ingrediente non valido");
    const quantity =
      a.quantity === "" || a.quantity == null ? null : a.quantity;
    if (
      quantity !== null &&
      (typeof quantity !== "number" ||
        !Number.isFinite(quantity) ||
        quantity <= 0 ||
        quantity > 1e6)
    )
      fail("Quantità dichiarata non valida");
    const unit = optional(a.unit, 40);
    if (quantity !== null && !unit)
      fail("Specificare l’unità della quantità dichiarata");
    return { name: text(a.name, 100), quantity, unit };
  });
  const ids = new Set();
  result.schedule = b.schedule.map((s) => {
    if (!s || typeof s !== "object" || Array.isArray(s))
      fail("Orario non valido");
    if (ids.has(uid(s.id))) fail("Orario duplicato");
    ids.add(s.id);
    if (
      !Array.isArray(s.weekdays) ||
      !s.weekdays.length ||
      s.weekdays.some((n) => !Number.isInteger(n) || n < 0 || n > 6)
    )
      fail("Seleziona i giorni");
    if (
      !["any", "ON", "OFF"].includes(s.mode) ||
      typeof s.reminderEnabled !== "boolean"
    )
      fail("Frequenza non valida");
    const dose = optional(s.dose, 100),
      everyDays = s.everyDays;
    if (dose && s.doseConfirmed !== true)
      fail("Conferma personalmente la dose pianificata");
    if (!Number.isInteger(everyDays) || everyDays < 1 || everyDays > 365)
      fail("Intervallo giorni non valido");
    if (everyDays > 1 && !s.startDate)
      fail("Data iniziale richiesta per la frequenza");
    return {
      id: s.id,
      at: clock(s.at),
      timezone: zone(s.timezone),
      weekdays: [...new Set(s.weekdays)].sort(),
      mode: s.mode,
      everyDays,
      startDate: s.startDate ? date(s.startDate) : null,
      dose,
      doseConfirmed: !!dose,
      meal: optional(s.meal, 100),
      reminderEnabled: s.reminderEnabled,
    };
  });
  for (let i = 0; i < result.schedule.length; i++)
    for (const t of result.schedule.slice(i + 1)) {
      const s = result.schedule[i];
      if (
        s.at === t.at &&
        (s.mode === t.mode || s.mode === "any" || t.mode === "any") &&
        s.weekdays.some((n) => t.weekdays.includes(n))
      )
        fail("Orari sovrapposti per lo stesso prodotto: usa un solo slot");
    }
  return result;
}
function applies(s, day, mode, ignoreMode = false) {
  const weekday = new Date(day + "T12:00:00Z").getUTCDay();
  const distance = s.startDate
    ? Math.round(
        (Date.parse(day + "T12:00:00Z") -
          Date.parse(s.startDate + "T12:00:00Z")) /
          86400000,
      )
    : 0;
  return (
    s.weekdays.includes(weekday) &&
    distance >= 0 &&
    distance % (s.everyDays || 1) === 0 &&
    (ignoreMode || s.mode === "any" || s.mode === mode)
  );
}
function present(p) {
  return {
    id: p.id,
    name: p.name,
    brand: p.brand || "",
    ingredients: p.ingredients || "",
    labelQuantity: p.labelQuantity || "",
    labelUnit: p.labelUnit || "",
    notes: p.notes || "",
    instructions: p.instructions || "",
    source: p.source,
    active: p.active !== false,
    revision: p.revision || 0,
    declaredActives: p.declaredActives || [],
    schedule: p.schedule || [],
  };
}
const status = (r) => r.status || "taken";
function intake(r) {
  return {
    id: r.id,
    productId: r.product?.id ?? r.product,
    name: r.productName,
    dose: r.dose,
    slot: r.slot || "daily",
    day: r.day,
    takenAt: r.takenAt,
    status: status(r),
    revision: r.revision || 0,
    productSnapshot: r.productSnapshot || {
      name: r.productName,
      ingredients: r.ingredientsSnapshot,
    },
    plannedSnapshot: r.plannedSnapshot,
    corrections: r.corrections || [],
  };
}
async function owned(app, owner, id) {
  if (!/^\d+$/.test(String(id))) fail("Integratore inesistente", 404);
  const p = await q(app, "supplement-product").findOne({
    where: { owner, id: Number(id) },
  });
  if (!p) fail("Integratore inesistente", 404);
  return p;
}
async function list(app, owner, all = false) {
  const rows = await q(app, "supplement-product").findMany({
    where: { owner },
    orderBy: { name: "asc" },
  });
  return rows.filter((p) => all || p.active !== false).map(present);
}
function dailyProduct(b) {
  if (!b || !Array.isArray(b.slots) || b.slots.length < 1 || b.slots.length > 8)
    fail("Scegli da 1 a 8 assunzioni al giorno");
  const quantity = b.quantity;
  if (typeof quantity !== "number" || !Number.isFinite(quantity) ||
      quantity <= 0 || quantity > 1e6)
    fail("Quantità non valida");
  const unit = text(b.unit, 40), timezone = zone(b.timezone),
    ids = new Set(), times = new Set();
  return {
    name: text(b.name, 160),
    active: true,
    schedule: b.slots.map((slot) => {
      const id = uid(slot?.id), at = slot.at ? clock(slot.at) : null;
      if (ids.has(id) || (at && times.has(at))) fail("Orario duplicato");
      ids.add(id);
      if (at) times.add(at);
      return {
        id, at, timezone, weekdays: [0, 1, 2, 3, 4, 5, 6],
        mode: "any", everyDays: 1, startDate: null,
        quantity, unit, dose: quantity + " " + unit, doseConfirmed: true,
        meal: "", reminderEnabled: false,
      };
    }),
  };
}
async function saveProduct(app, owner, id, b) {
  return lock(app, owner, async () => {
    if (b.confirm !== true) fail("Conferma esplicita richiesta");
    if (b.action && !["save", "archive", "delete"].includes(b.action))
      fail("Azione non valida");
    if (!id && ["archive", "delete"].includes(b.action)) fail("Integratore inesistente", 404);
    let p = id ? await owned(app, owner, id) : null;
    if (!id) {
      const clientKey = `${owner}:${uid(b.clientId)}`;
      p = await q(app, "supplement-product").findOne({
        where: { owner, clientKey },
      });
      if (p) return present(p);
    }
    if (p?.active === false && b.action === "delete") return present(p);
    if (
      id &&
      (!Number.isInteger(b.revision) || b.revision !== (p.revision || 0))
    )
      fail("Integratore modificato altrove: ricarica", 409);
    if (
      !id &&
      (await q(app, "supplement-product").count({
        where: { owner, $or: [{ active: true }, { active: { $null: true } }] },
      })) >= 100
    )
      fail("Massimo 100 prodotti per account");
    const validated =
      ["archive", "delete"].includes(b.action)
        ? { active: false }
        : b.daily === true ? dailyProduct(b.data) : validateProduct(b.data);
    const data = { ...validated, revision: (p?.revision || 0) + 1 };
    delete data.id;
    delete data.source;
    p = id
      ? await q(app, "supplement-product").update({
          where: { id: p.id, owner },
          data,
        })
      : await q(app, "supplement-product").create({
          data: {
            ...data,
            owner,
            source: "manual",
            clientKey: `${owner}:${b.clientId}`,
          },
        });
    return present(p);
  });
}
async function dayMode(app, owner, day) {
  const explicit = await q(app, "supplement-day").findOne({
    where: { owner, day },
  });
  const daily = await q(app, "daily-plan").findOne({ where: { owner, day } });
  return {
    mode: explicit?.mode || daily?.mode || null,
    modeSource: explicit ? "integratori" : daily ? "dieta" : null,
    modeRevision: explicit?.revision || 0,
  };
}
async function saveMode(app, owner, day, b) {
  date(day);
  if (!["ON", "OFF"].includes(b.mode)) fail("Giorno ON/OFF non valido");
  return lock(app, owner, async () => {
    const repo = q(app, "supplement-day"),
      r = await repo.findOne({ where: { owner, day } });
    if (!Number.isInteger(b.revision) || b.revision !== (r?.revision || 0))
      fail("Giorno modificato altrove", 409);
    const data = { mode: b.mode, revision: b.revision + 1 };
    if (r) await repo.update({ where: { id: r.id, owner }, data });
    else
      await repo.create({
        data: { ...data, owner, day, uniqueKey: `${owner}:${day}` },
      });
    return dayMode(app, owner, day);
  });
}
function normalize(s) {
  return s
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
function overlaps(products) {
  const names = new Map(),
    known = [
      ["creatina", /\bcreatin(?:a|e)?\b/],
      ["caffeina", /\bcaffein(?:a|e)?\b/],
      ["vitamina c", /\bvitamin[ae]? c\b/],
      ["vitamina d", /\bvitamin[ae]? d[23]?\b/],
      ["magnesio", /\b(?:magnesio|magnesium)\b/],
      ["zinco", /\b(?:zinco|zinc)\b/],
      ["ferro", /\b(?:ferro|iron)\b/],
      ["calcio", /\b(?:calcio|calcium)\b/],
    ];
  for (const p of products.filter((p) => p.active)) {
    const set = new Set();
    for (const a of p.declaredActives) {
      const n = normalize(a.name);
      set.add(known.find(([, re]) => re.test(n))?.[0] || n);
    }
    for (const [name, re] of known)
      if (re.test(normalize(p.ingredients))) set.add(name);
    for (const n of set) {
      if (!names.has(n)) names.set(n, []);
      names.get(n).push({ id: p.id, name: p.name });
    }
  }
  return [...names]
    .filter(([, v]) => v.length > 1)
    .map(([ingredient, products]) => ({ ingredient, products }));
}
async function dashboard(app, owner, day, daily = false) {
  date(day);
  const products = await list(app, owner, true),
    m = daily ? {} : await dayMode(app, owner, day);
  const rows = (
      await q(app, "supplement-intake").findMany({
        where: { owner, day },
        populate: { product: true },
      })
    ).map(intake),
    entries = [];
  let modeRequired = false;
  for (const p of products.filter((p) => p.active))
    for (const s of p.schedule) {
      if (!m.mode && s.mode !== "any" && applies(s, day, null, true))
        modeRequired = true;
      if (!daily && !applies(s, day, m.mode)) continue;
      const record = rows.find((r) => r.productId === p.id && r.slot === s.id);
      entries.push({
        key: `${p.id}:${s.id}`,
        productId: p.id,
        name: p.name,
        slot: s.id,
        planned: s,
        status:
          record && record.status !== "cancelled" ? record.status : "pending",
        record: record || null,
      });
    }
  for (const r of rows.filter((r) => r.status !== "cancelled"))
    if (!entries.some((e) => e.productId === r.productId && e.slot === r.slot))
      entries.push({
        key: `${r.productId}:${r.slot}`,
        productId: r.productId,
        name: r.name,
        slot: r.slot,
        planned: r.plannedSnapshot || null,
        status: r.status,
        record: r,
        unscheduled: true,
      });
  entries.sort((a, b) =>
    (a.planned?.at || "99:99").localeCompare(b.planned?.at || "99:99"),
  );
  return {
    day,
    ...m,
    modeRequired,
    products,
    entries,
    overlaps: overlaps(products),
  };
}
async function history(app, owner, from, to, offset = 0) {
  offset = Number(offset);
  if (!Number.isInteger(offset) || offset < 0 || offset > 1000000)
    fail("Pagina storico non valida");
  const where = { owner };
  if (from) where.day = { $gte: date(from) };
  if (to) where.day = { ...where.day, $lte: date(to) };
  return (
    await q(app, "supplement-intake").findMany({
      where,
      populate: { product: true },
      orderBy: [{ day: "desc" }, { id: "desc" }],
      limit: 200,
      offset,
    })
  ).map(intake);
}
async function listTaken(app, owner, day) {
  date(day);
  return (
    await q(app, "supplement-intake").findMany({
      where: { owner, day },
      populate: { product: true },
      orderBy: { id: "asc" },
    })
  )
    .map(intake)
    .filter((r) => r.status === "taken");
}
async function record(app, owner, day, b) {
  notFuture(day);
  return lock(app, owner, async () => {
    const p = await owned(app, owner, b.productId),
      slot = b.slot || "daily";
    if (
      typeof slot !== "string" ||
      (slot !== "daily" &&
        !/^([01]\d|2[0-3]):[0-5]\d$/.test(slot) &&
        !/^[a-f0-9-]{36}$/i.test(slot))
    )
      fail("Slot non valido");
    const repo = q(app, "supplement-intake"),
      key = `${owner}:${day}:${p.id}:${slot}`,
      old = await repo.findOne({ where: { owner, uniqueKey: key } }),
      planned = (p.schedule || []).find((s) => s.id === slot);
    if (b.manual !== undefined && typeof b.manual !== "boolean")
      fail("Assunzione manuale non valida");
    if (b.manual === true) {
      uid(slot);
      if (b.confirm !== true || !Number.isInteger(b.revision) || !b.status)
        fail("Conferma manuale richiesta");
    }
    if (!old && slot.length === 36 && !planned && b.manual !== true)
      fail("Orario inesistente", 404);
    const next =
      b.status ||
      (b.taken === true ? "taken" : b.taken === false ? "cancelled" : "");
    if (!["taken", "skipped", "cancelled"].includes(next))
      fail("Assunzione non valida");
    if (b.status && (b.confirm !== true || !Number.isInteger(b.revision)))
      fail("Conferma e revisione richieste");
    if (b.revision !== undefined && b.revision !== (old?.revision || 0))
      fail("Assunzione modificata altrove: ricarica", 409);
    if (!old && next === "cancelled") return null;
    if (b.productRevision !== undefined &&
        b.productRevision !== (p.revision || 0) && next === "taken")
      fail("Programmazione modificata altrove", 409);
    if (!old && p.active === false)
      fail("Prodotto archiviato: nessuna nuova assunzione", 409);
    const timezone = zone(b.timezone || planned?.timezone || "Europe/Rome");
    let dose =
      next === "taken"
        ? b.dose == null || b.dose === ""
          ? null
          : text(b.dose, 100)
        : null;
    let takenAt =
      next === "taken"
        ? b.takenAt || old?.takenAt || new Date().toISOString()
        : null;
    if (
      next === "taken" &&
      (!Number.isFinite(Date.parse(takenAt)) ||
        Date.parse(takenAt) > Date.now() + 30000 ||
        localParts(takenAt, timezone).date !== day)
    )
      fail("Inserisci l’orario effettivo nella data selezionata");
    if (next === "taken") takenAt = new Date(takenAt).toISOString();
    if (
      old &&
      next === status(old) &&
      dose === (old.dose || null) &&
      takenAt === (old.takenAt ? new Date(old.takenAt).toISOString() : null)
    )
      return intake({ ...old, product: p });
    const corrections = old
      ? [
          ...(old.corrections || []),
          {
            status: status(old),
            dose: old.dose,
            takenAt: old.takenAt,
            revision: old.revision || 0,
            changedAt: new Date().toISOString(),
          },
        ]
      : [];
    if (corrections.length > 100) fail("Limite rettifiche raggiunto");
    const data = {
      status: next,
      dose,
      takenAt,
      revision: (old?.revision || 0) + 1,
      corrections,
      productName: old ? old.productName || "Nome non registrato" : p.name,
      ingredientsSnapshot: old ? old.ingredientsSnapshot : p.ingredients,
      productSnapshot:
        old?.productSnapshot ||
        (old
          ? {
              name: old.productName || "Nome non registrato",
              ingredients: old.ingredientsSnapshot ?? null,
              legacy: true,
            }
          : present(p)),
      plannedSnapshot: old ? old.plannedSnapshot || null : planned || null,
    };
    const saved = old
      ? await repo.update({ where: { id: old.id, owner }, data })
      : await repo.create({
          data: { ...data, owner, product: p.id, uniqueKey: key, day, slot },
        });
    // An explicit undo can reopen just this slot's notification for today.
    if (next === "cancelled")
      for (const r of await q(app, "reminder").findMany({ where: { owner } }))
        if (
          r.occurrence?.date === day &&
          r.settings.kind === "supplement" &&
          r.settings.target === String(p.id) &&
          (r.settings.scheduleId === slot ||
            (!r.settings.scheduleId &&
              (slot === "daily" || r.settings.at === slot)))
        )
          await q(app, "reminder").update({
            where: { id: r.id, owner },
            data: { occurrence: null, revision: r.revision + 1 },
          });
    return intake({ ...saved, product: p });
  });
}
async function reminderDone(app, owner, s, day) {
  const p = await q(app, "supplement-product").findOne({
    where: { owner, id: Number(s.target) || 0 },
  });
  if (!p || p.active === false) return true;
  const rows = await q(app, "supplement-intake").findMany({
    where: { owner, day, product: p.id },
  });
  const done = rows.filter((r) => ["taken", "skipped"].includes(status(r)));
  if (s.scheduleId) return done.some((r) => r.slot === s.scheduleId);
  if (done.some((r) => !r.slot || r.slot === "daily" || r.slot === s.at)) return true;
  const slots = p.schedule || [];
  const matches = slots.filter((slot) => slot.at === s.at);
  const relevant = matches.length ? matches : slots;
  return relevant.length > 0 && relevant.every((slot) => done.some((r) => r.slot === slot.id));
}
module.exports = {
  validateProduct,
  applies,
  overlaps,
  present,
  list,
  saveProduct,
  saveMode,
  dashboard,
  history,
  listTaken,
  record,
  reminderDone,
};
