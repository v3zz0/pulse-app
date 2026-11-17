"use strict";
const guard = require("../../../pulse/guarded");
const { fail } = require("../../../pulse/validation");
const {
  kg,
  createSnapshot,
  applyOperation,
  metrics,
} = require("../../../pulse/workout");
const { createHash } = require("node:crypto");
const { activePlan } = require("../../../pulse/active-plan");
const q = (app, name) => app.db.query(`api::${name}.${name}`);
const uuid = (value) => {
  if (typeof value !== "string" || !/^[a-f0-9-]{36}$/i.test(value))
    fail("Identificatore non valido");
  return value;
};
const present = (r) =>
  r
    ? {
        clientId: r.clientId,
        programId: r.programId,
        day: r.day,
        status: r.status,
        startedAt: r.startedAt,
        completedAt: r.completedAt,
        snapshot: r.snapshot,
        timer: r.timer,
        revision: r.revision,
        metrics: metrics(r),
      }
    : null;
async function lock(app, owner, fn) {
  return app.db.transaction(async ({ trx }) => {
    await trx.raw("SELECT pg_advisory_xact_lock(hashtext(?))", [
      `workout:${owner}`,
    ]);
    return fn();
  });
}
async function program(app, owner) {
  const p = await activePlan(app, "training", owner);
  if (!p) return null;
  const reviews = await q(app, "video-review").findMany({
    where: { owner, programId: p.id },
  });
  for (const v of [
    ...Object.values(p.days)
      .flat()
      .flatMap((b) => b.videos),
    ...p.cooldown.videos,
  ]) {
    const r = reviews.find((r) => r.url === v.url);
    if (r)
      Object.assign(v, {
        reviewRequired: !r.confirmed,
        reviewBasis: r.basis,
        reviewNote: r.note,
        videoTitle: r.title,
      });
  }
  return p;
}
async function standardMap(app, owner, programId) {
  const rows = await q(app, "standard-load").findMany({
    where: { owner, programId },
  });
  return Object.fromEntries(
    rows.map((r) => [
      r.setKey,
      { kg: r.kg === null ? null : Number(r.kg), revision: r.revision },
    ]),
  );
}
module.exports = {
  overview: guard(async (ctx, user, app) => {
    const p = await program(app, user.id);
    const active = await q(app, "workout-session").findOne({
      where: { owner: user.id, status: "active" },
    });
    const history = await q(app, "workout-session").findMany({
      where: { owner: user.id, status: "completed" },
      orderBy: { startedAt: "desc" },
    });
    ctx.body = {
      program: p
        ? {
            id: p.id,
            title: p.title,
            days: p.days,
            cooldown: p.cooldown,
            reviewStatus: p.reviewStatus,
          }
        : null,
      standards: p ? await standardMap(app, user.id, p.id) : {},
      active: present(active),
      history: history.map(present),
    };
  }),
  standard: guard(async (ctx, user, app) =>
    lock(app, user.id, async () => {
      const b = ctx.request.body || {};
      if (b.confirm !== true) fail("Conferma esplicita richiesta");
      const p = await program(app, user.id);
      if (
        !p ||
        p.id !== b.programId ||
        !Object.values(p.days)
          .flat()
          .some((block) => block.sets.some((s) => s.id === b.setId))
      )
        fail("Serie inesistente", 404);
      const uniqueKey = `${user.id}:${p.id}:${b.setId}`,
        repo = q(app, "standard-load");
      const existing = await repo.findOne({
        where: { uniqueKey, owner: user.id },
      });
      if (
        !Number.isInteger(b.revision) ||
        b.revision !== (existing?.revision || 0)
      )
        fail("Carico modificato altrove: ricarica", 409);
      const data = { kg: kg(b.kg), revision: b.revision + 1 };
      if (existing)
        await repo.update({ where: { id: existing.id, owner: user.id }, data });
      else
        await repo.create({
          data: {
            ...data,
            uniqueKey,
            owner: user.id,
            programId: p.id,
            setKey: b.setId,
          },
        });
      ctx.body = { kg: data.kg, revision: data.revision };
    }),
  ),
  start: guard(async (ctx, user, app) =>
    lock(app, user.id, async () => {
      const b = ctx.request.body || {},
        clientId = uuid(b.clientId),
        repo = q(app, "workout-session");
      const existing = await repo.findOne({
        where: { owner: user.id, clientId },
      });
      if (existing) {
        ctx.body = present(existing);
        return;
      }
      if (await repo.findOne({ where: { owner: user.id, status: "active" } }))
        fail("Hai già una sessione attiva: riprendila", 409);
      const p = await program(app, user.id);
      if (!p || p.id !== b.programId) fail("Programma inesistente", 404);
      const loads = await standardMap(app, user.id, p.id);
      const previous = await repo.findMany({
        where: {
          owner: user.id,
          programId: p.id,
          day: b.day,
          status: "completed",
        },
        orderBy: { startedAt: "desc" },
      });
      const last = {};
      for (const session of previous)
        for (const block of session.snapshot.blocks)
          for (const s of block.sets)
            if (s.status === "recorded" && !last[s.id])
              last[s.id] = {
                kg: s.actualKg,
                reps: s.actualReps,
                at: session.completedAt,
              };
      const snapshot = createSnapshot(
        p,
        b.day,
        Object.fromEntries(
          Object.entries(loads).map(([key, v]) => [key, v.kg]),
        ),
        last,
      );
      ctx.body = present(
        await repo.create({
          data: {
            uniqueKey: `${user.id}:${clientId}`,
            activeKey: `owner:${user.id}`,
            clientId,
            owner: user.id,
            programId: p.id,
            day: b.day,
            status: "active",
            startedAt: new Date(),
            snapshot,
            timer: null,
            operations: [],
            revision: 0,
          },
        }),
      );
    }),
  ),
  operation: guard(async (ctx, user, app) =>
    lock(app, user.id, async () => {
      const clientId = uuid(ctx.params.clientId),
        b = ctx.request.body || {},
        opId = uuid(b.opId),
        repo = q(app, "workout-session");
      const s = await repo.findOne({ where: { owner: user.id, clientId } });
      if (!s) fail("Sessione inesistente", 404);
      const digest = createHash("sha256")
        .update(JSON.stringify(b))
        .digest("hex");
      const prior = (s.operations || []).find((o) => o.id === opId);
      if (prior) {
        if (prior.hash !== digest)
          fail("Identificatore operazione riutilizzato", 409);
        ctx.body = present(s);
        return;
      }
      if (s.status !== "active") fail("Sessione conclusa immutabile", 409);
      if (!Number.isInteger(b.revision) || b.revision !== s.revision)
        fail("Conflitto: sessione modificata altrove", 409);
      const data = applyOperation(s, b);
      data.revision = s.revision + 1;
      data.operations = [...(s.operations || []), { id: opId, hash: digest }];
      if (data.status === "completed") data.activeKey = null;
      ctx.body = present(
        await repo.update({ where: { id: s.id, owner: user.id }, data }),
      );
    }),
  ),
};
