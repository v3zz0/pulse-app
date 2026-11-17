"use strict";
const { createHmac, timingSafeEqual } = require("node:crypto");
const csv = require("./csv"),
  formats = require("./plan-formats"),
  settings = require("./plan-settings");
const { repo, activePlan } = require("./active-plan"),
  { fail } = require("./validation");
const totals = require("./nutrient-totals");
const q = (app, name) => app.db.query(`api::${name}.${name}`);
const lock = (app, kind, owner, fn) =>
  app.db.transaction(async ({ trx }) => {
    await trx.raw("SELECT pg_advisory_xact_lock(hashtext(?))", [
      kind === "training" ? `workout:${owner}` : `plan:nutrition:${owner}`,
    ]);
    return fn();
  });
function sign(app, value) {
  const encoded = Buffer.from(JSON.stringify(value)).toString("base64url");
  return (
    encoded +
    "." +
    createHmac("sha256", app.config.get("server.app.keys")[0])
      .update(encoded)
      .digest("hex")
  );
}
function token(app, owner, kind, purpose, hash) {
  return sign(app, {
    owner,
    kind,
    purpose,
    hash,
    expires: Date.now() + 30 * 60000,
  });
}
function verify(app, value, owner, kind, purpose, hash) {
  if (typeof value !== "string" || value.length > 2000)
    fail("Anteprima richiesta");
  const [encoded, sig] = value.split("."); // No token data is trusted until its signature has been checked.
  const expectedSig = createHmac("sha256", app.config.get("server.app.keys")[0])
    .update(encoded || "")
    .digest("hex");
  if (
    !sig ||
    !/^[a-f0-9]{64}$/.test(sig) ||
    value.split(".").length !== 2 ||
    sig.length !== expectedSig.length ||
    !timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))
  )
    fail("Anteprima non valida", 409);
  let data;
  try {
    data = JSON.parse(Buffer.from(encoded, "base64url").toString());
  } catch {
    fail("Anteprima non valida", 409);
  }
  if (
    data.owner !== owner ||
    data.kind !== kind ||
    data.purpose !== purpose ||
    data.hash !== hash ||
    data.expires < Date.now()
  )
    fail("Anteprima scaduta o dati modificati: ripeti la verifica", 409);
}
const summary = (p, activeId) => ({
  id: p.id,
  title: p.title,
  status: p.id === activeId ? "active" : p.status || "archived",
  version: p.versionLabel || String(p.importVersion),
  externalId: p.externalId || null,
  createdAt: p.createdAt,
  activatedAt: p.activatedAt,
  provenance: p.provenance || "PDF storico",
  reviewStatus: p.reviewStatus,
  schedule: p.editor?.schedule,
  description: p.editor?.description,
});
async function owned(app, kind, owner, id, includeDeleted = false) {
  if (!/^\d+$/.test(String(id))) fail("Piano inesistente", 404);
  const p = await repo(app, kind).findOne({ where: { id: Number(id), owner } });
  if (!p || (!includeDeleted && p.status === "deleted")) fail("Piano inesistente", 404);
  return p;
}
async function standards(app, owner, id) {
  const rows = await q(app, "standard-load").findMany({
    where: { owner, programId: id },
  });
  return Object.fromEntries(
    rows.map((r) => [r.setKey, r.kg === null ? null : Number(r.kg)]),
  );
}
function candidates(previous, next, loads) {
  if (!previous) return [];
  const found = [];
  for (const [day, blocks] of Object.entries(next.days))
    for (const b of blocks)
      for (const [i, s] of b.sets.entries()) {
        const old = previous.days[day]?.find(
          (o) => (o.exerciseId || o.id) === (b.exerciseId || b.id),
        );
        if (!old) continue;
        const os = old.sets.find(
          (s, idx) => (s.order || idx + 1) === (b.sets[i].order || i + 1),
        );
        if (!os) continue;
        const signature = (b, s) =>
          JSON.stringify([
            b.name,
            (s.movements?.length ? s.movements : b.movements || []).map((m) => [
              m.name,
              String(m.reps),
            ]),
            s.kind || b.phase,
            String(s.reps),
            s.repsMin ?? null,
            s.repsMax ?? null,
            s.toFailure ?? null,
            s.perLeg ?? null,
          ]);
        if (signature(old, os) !== signature(b, s)) continue;
        const kg = Object.hasOwn(loads, os.id)
          ? loads[os.id]
          : (os.standardKg ?? null);
        if (kg !== null)
          found.push({
            from: os.id,
            to: s.id,
            exercise: b.name,
            day,
            kg,
            previousKg: s.standardKg ?? null,
          });
      }
  return found;
}
function difference(kind, previous, next) {
  const rows = (p) =>
    !p
      ? []
      : kind === "nutrition"
        ? Object.entries(p.meals).flatMap(([d, ms]) =>
            ms.map((m) => ({
              key: d + ":" + m.name,
              label: d + " · " + m.name,
              value: JSON.stringify(m.menus),
            })),
          )
        : Object.entries(p.days).flatMap(([d, bs]) =>
            bs.map((b) => ({
              key: d + ":" + (b.exerciseId || b.id),
              label: d + " · " + b.name,
              value: JSON.stringify([
                b.name,
                b.sets.map((s) => [s.kind || b.phase, s.reps]),
                b.movements,
                b.restSeconds,
                b.restRaw,
              ]),
            })),
          );
  const before = rows(previous),
    after = rows(next),
    a = new Map(before.map((r) => [r.key, r])),
    b = new Map(after.map((r) => [r.key, r]));
  return {
    previousTitle: previous?.title || null,
    nextTitle: next.title,
    added: after.filter((r) => !a.has(r.key)).map((r) => r.label),
    removed: before.filter((r) => !b.has(r.key)).map((r) => r.label),
    changed: after
      .filter((r) => a.has(r.key) && a.get(r.key).value !== r.value)
      .map((r) => r.label),
  };
}
function decorate(kind, p) {
  if (kind !== "nutrition") return p;
  return {
    ...p,
    totals: Object.fromEntries(
      Object.entries(p.meals).map(([d, ms]) => [d, totals.dayTotals(ms)]),
    ),
    meals: Object.fromEntries(
      Object.entries(p.meals).map(([d, ms]) => [
        d,
        ms.map((m) => ({
          ...m,
          nutrientTotals: totals.mealTotals(m),
          menus: m.menus.map((menu) => ({
            ...menu,
            groups: menu.groups.map((g) => ({
              ...g,
              options: g.options.map((o) => ({
                ...o,
                nutrientTotals: totals.itemTotals(o),
              })),
            })),
          })),
        })),
      ]),
    ),
  };
}
async function preview(app, kind, owner, body) {
  const result = csv.validate(kind, body.text, body.filename);
  if (result.errors.length)
    return { errors: result.errors, warnings: result.warnings, plan: null };
  const active = await activePlan(app, kind, owner),
    s = await settings.get(app, owner);
  const hash = csv.digest(
    JSON.stringify([result.sourceHash, active?.id || null]),
  );
  return {
    errors: [],
    warnings: result.warnings,
    sourceHash: result.sourceHash,
    plan: decorate(kind, result.plan),
    difference: difference(kind, active, result.plan),
    goals: s.data.goals,
    previewToken: token(app, owner, kind, "import", hash),
    rowCount: result.rows.length,
  };
}
async function importPlan(app, kind, owner, body) {
  return lock(app, kind, owner, async () => {
    if (body.confirm !== true) fail("Conferma importazione richiesta");
    const result = csv.validate(kind, body.text, body.filename);
    if (result.errors.length)
      fail(
        `CSV non valido: riga ${result.errors[0].line}, ${result.errors[0].message}`,
      );
    const active = await activePlan(app, kind, owner);
    verify(
      app,
      body.previewToken,
      owner,
      kind,
      "import",
      csv.digest(JSON.stringify([result.sourceHash, active?.id || null])),
    );
    const existing = await repo(app, kind).findOne({
      where: { owner, sourceHash: result.sourceHash, provenance: "csv", status: { $ne: "deleted" } },
    });
    if (existing) return { ...summary(existing, active?.id), reused: true };
    if (
      await repo(app, kind).findOne({
        where: {
          owner,
          externalId: result.plan.externalId,
          versionLabel: result.plan.versionLabel,
          status: { $ne: "deleted" },
        },
      })
    )
      fail(
        "Questa versione esiste con contenuti diversi: incrementa plan_version",
        409,
      );
    if ((await repo(app, kind).count({ where: { owner, provenance: "csv", $or: [{ status: { $null: true } }, { status: { $ne: "deleted" } }] } })) >= 40)
      fail(
        "Massimo 40 versioni salvate per tipo: nessun piano è stato eliminato",
        409,
      );
    const data = {
      ...result.plan,
      owner,
      sourceHash: result.sourceHash,
      importVersion: 1,
      provenance: "csv",
      status: "draft",
      csvData: result.rows,
      reviewStatus: kind === "nutrition" ? "historical-review" : "needs-review",
      importReport: {
        format: "csv-1",
        warnings: result.warnings,
        rows: result.rows.length,
        importedAt: new Date().toISOString(),
      },
    };
    if (kind === "training") {
      const previous = active?.externalId === data.externalId
        ? active
        : await repo(app, kind).findOne({
            where: { owner, externalId: data.externalId, status: { $ne: "deleted" } },
            orderBy: { id: "desc" },
          });
      const { inheritSelections } = require("./flow/associations");
      const inherited = inheritSelections(previous, data.days);
      if (inherited) data.flowAssociations = inherited;
    }
    const saved = await repo(app, kind).create({ data });
    if (kind === "training")
      for (const b of Object.values(saved.days).flat())
        for (const s of b.sets)
          if (s.standardKg !== null)
            await q(app, "standard-load").create({
              data: {
                owner,
                programId: saved.id,
                setKey: s.id,
                uniqueKey: `${owner}:${saved.id}:${s.id}`,
                kg: s.standardKg,
                revision: 1,
              },
            });
    return { ...summary(saved, active?.id), reused: false };
  });
}
async function list(app, kind, owner) {
  const active = await activePlan(app, kind, owner);
  return (
    await repo(app, kind).findMany({
      where: { owner, $or: [{ status: { $null: true } }, { status: { $ne: "deleted" } }] },
      orderBy: { id: "desc" },
    })
  ).map((p) => summary(p, active?.id));
}
async function activation(app, kind, owner, p) {
  const active = await activePlan(app, kind, owner),
    loads =
      kind === "training" && active
        ? await standards(app, owner, active.id)
        : {};
  const targetLoads =
    kind === "training" ? await standards(app, owner, p.id) : {};
  const matches =
    kind === "training"
      ? candidates(active, p, loads).map((m) => ({
          ...m,
          previousKg: Object.hasOwn(targetLoads, m.to)
            ? targetLoads[m.to]
            : m.previousKg,
        }))
      : [];
  const hash = csv.digest(
    JSON.stringify([p.id, p.updatedAt, active?.id || null, matches]),
  );
  return {
    activeId: active?.id || null,
    matches,
    token: token(app, owner, kind, "activate", hash),
    hash,
    difference: difference(kind, active, p),
  };
}
async function detail(app, kind, owner, id) {
  const p = await owned(app, kind, owner, id),
    a = await activation(app, kind, owner, p),
    s = await settings.get(app, owner),
    targetLoads = kind === "training" ? await standards(app, owner, p.id) : {};
  return {
    plan: decorate(kind, {
      ...summary(p, a.activeId),
      ...(kind === "nutrition"
        ? { meals: p.meals, notes: p.notes }
        : {
            days: Object.fromEntries(
              Object.entries(p.days).map(([day, blocks]) => [
                day,
                blocks.map((block) => ({
                  ...block,
                  sets: block.sets.map((set) => ({
                    ...set,
                    standardKg: Object.hasOwn(targetLoads, set.id)
                      ? targetLoads[set.id]
                      : (set.standardKg ?? null),
                  })),
                })),
              ]),
            ),
            cooldown: p.cooldown,
            displaySettings: p.displaySettings,
            notes: p.editor?.notes,
          }),
      report: p.importReport,
    }),
    activation: a,
    goals: s.data.goals,
  };
}
async function change(app, kind, owner, id, body) {
  return lock(app, kind, owner, async () => {
    if (body.confirm !== true) fail("Conferma esplicita richiesta");
    const p = await owned(app, kind, owner, id),
      a = await activation(app, kind, owner, p);
    if (body.action === "archive") {
      if (p.id === a.activeId)
        fail(
          "Attiva prima un altro piano; il piano in uso non può essere archiviato",
          409,
        );
      await repo(app, kind).update({
        where: { id: p.id, owner },
        data: { status: "archived" },
      });
    } else if (body.action === "activate") {
      verify(app, body.activationToken, owner, kind, "activate", a.hash);
      if (
        kind === "training" &&
        (await q(app, "workout-session").findOne({
          where: { owner, status: "active" },
        }))
      )
        fail("Concludi l’allenamento attivo prima di cambiare scheda", 409);
      if (kind === "training" && body.transferLoads === true)
        for (const m of a.matches) {
          const uniqueKey = `${owner}:${p.id}:${m.to}`,
            r = await q(app, "standard-load").findOne({
              where: { owner, uniqueKey },
            });
          const data = { kg: m.kg, revision: (r?.revision || 0) + 1 };
          if (r)
            await q(app, "standard-load").update({
              where: { id: r.id, owner },
              data,
            });
          else
            await q(app, "standard-load").create({
              data: {
                ...data,
                owner,
                uniqueKey,
                programId: p.id,
                setKey: m.to,
              },
            });
        }
      await repo(app, kind).updateMany({
        where: {
          owner,
          $or: [{ status: "active" }, { status: { $null: true } }],
        },
        data: { status: "archived" },
      });
      await repo(app, kind).update({
        where: { id: p.id, owner },
        data: { status: "active", activatedAt: new Date() },
      });
    } else if (body.action === "review" && kind === "nutrition") {
      const meals = structuredClone(p.meals);
      for (const m of Object.values(meals).flat())
        for (const menu of m.menus)
          for (const g of menu.groups)
            for (const o of g.options) {
              if (!totals.itemTotals(o).complete)
                fail(
                  "Prima della revisione completa servono quantità, fonte e tutti i nutrienti per ogni alternativa",
                );
              if (o.nutrition.status !== "estimated")
                o.nutrition.status = "verified";
            }
      await repo(app, kind).update({
        where: { id: p.id, owner },
        data: {
          meals,
          reviewStatus: "reviewed",
          importReport: {
            ...p.importReport,
            nutritionReviewedByOwner: true,
            nutritionReviewAt: new Date().toISOString(),
          },
        },
      });
    } else fail("Azione piano non valida");
    return detail(app, kind, owner, id);
  });
}
async function exportPlan(app, kind, owner, id, day) {
  const p = await owned(app, kind, owner, id),
    loads = kind === "training" ? await standards(app, owner, p.id) : {};
  let exported = p;
  const schedule = p.editor?.schedule;
  if (kind === "nutrition" && schedule && schedule.mode !== "legacy") {
    const key = schedule.mode === "daily" ? "daily" : String(day ?? schedule.weekdays[0]);
    if (!Object.hasOwn(p.meals, key)) fail("Giorno non configurato");
    exported = { ...p, meals: { ON: p.meals[key], OFF: p.meals[key] }, csvData: null };
  }
  return {
    filename:
      kind === "nutrition" ? "pulse_dieta.csv" : "pulse_allenamento.csv",
    csv: csv.serialize(kind, formats.exportRows(kind, exported, loads)),
    warnings:
      kind === "nutrition"
        ? [
            ...(schedule && schedule.mode !== "legacy" ? ["CSV v1 esporta una giornata tipo in ON/OFF; il calendario resta nel piano."] : []),
            "Valori assenti non inventati; la verifica delle fonti va confermata dopo ogni nuova importazione",
          ]
        : ["Ogni associazione video reimportata richiede nuova revisione"],
  };
}
module.exports = {
  preview,
  importPlan,
  list,
  detail,
  change,
  exportPlan,
  candidates,
  difference,
  sign,
  verify,
  token,
  lock, owned, standards,
};
