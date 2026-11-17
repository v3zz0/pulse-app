"use strict";
const { createHash } = require("node:crypto");
const { activePlan, repo } = require("./active-plan");
const plans = require("./plans");
const content = require("./editor-content");
const { targets, inheritSelections } = require("./flow/associations");
const { fail, text } = require("./validation");

const digest = (value) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
const requestId = (id) => {
  if (
    typeof id !== "string" ||
    !/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(id)
  )
    fail("Operazione non valida");
  return id;
};
const version = (plan, loads) =>
  digest([
    plan.updatedAt,
    plan.editor?.requestId,
    Object.entries(loads).sort(([a], [b]) => a.localeCompare(b)),
  ]);
const loadsFor = (app, kind, owner, id) =>
  kind === "training" ? plans.standards(app, owner, id) : {};

async function snapshot(app, kind, owner, p) {
  const loads = await loadsFor(app, kind, owner, p.id);
  const result = {
    id: p.id,
    title: p.title,
    description: p.editor?.description || "",
    notes: p.notes || p.editor?.notes || "",
    revision: version(p, loads),
  };
  if (kind === "nutrition")
    return {
      ...result,
      schedule: p.editor?.schedule || { mode: "legacy", weekdays: [] },
      meals: p.meals,
    };

  const { decorate } = require("./flow/associations");
  const { days } = await decorate(p);
  return {
    ...result,
    timezone: p.displaySettings?.timezone || "Europe/Rome",
    cooldown: p.cooldown,
    days: Object.entries(days).map(([id, blocks]) => ({
      id,
      name: p.displaySettings?.days?.[id]?.name || "Scheda " + id,
      description: p.displaySettings?.days?.[id]?.description || "",
      weekdays: p.displaySettings?.days?.[id]?.weekdays || [],
      blocks: blocks.map(({ flowId, media, ...b }, index) => ({
        ...b,
        ...(flowId ? { flowId } : {}),
        ...(p.days[id][index].flowCleared
          ? { flowId: null, flowCleared: true }
          : {}),
        sets: b.sets.map((s) => ({
          ...s,
          movements: s.movements?.map((movement, index) => {
            const move = { ...movement, order: movement.order ?? index + 1 };
            const [{ key }] = targets(id, {
              ...b,
              sets: [],
              movements: [move],
            });
            const current = media.find((m) => m.key === key);
            return { ...move, flowId: current?.flowId || null };
          }),
          standardKg: Object.hasOwn(loads, s.id)
            ? loads[s.id]
            : (s.standardKg ?? null),
        })),
      })),
    })),
  };
}

async function writeLoads(app, owner, program, previousLoads) {
  const loads = app.db.query("api::standard-load.standard-load");
  for (const block of Object.values(program.days).flat())
    for (const set of block.sets) {
      if (
        Object.hasOwn(previousLoads, set.id) &&
        previousLoads[set.id] === set.standardKg
      )
        continue;
      if (set.standardKg === null && !Object.hasOwn(previousLoads, set.id))
        continue;
      const uniqueKey = [owner, program.id, set.id].join(":");
      const before = await loads.findOne({ where: { owner, uniqueKey } });
      if (before)
        await loads.update({
          where: { owner, id: before.id },
          data: {
            kg: set.standardKg,
            revision: before.revision + 1,
          },
        });
      else
        await loads.create({
          data: {
            owner,
            programId: program.id,
            setKey: set.id,
            uniqueKey,
            kg: set.standardKg,
            revision: 1,
          },
        });
    }
}

async function save(app, kind, owner, body, id) {
  return plans.lock(app, kind, owner, async () => {
    const q = repo(app, kind),
      op = requestId(body.requestId);
    const payload = content.object(body.data);
    const hash = digest(payload);
    const previous = id ? await plans.owned(app, kind, owner, id) : null;
    if (previous?.editor?.requestId === op) {
      if (previous.editor.hash !== hash) fail("Operazione già utilizzata", 409);
      return snapshot(app, kind, owner, previous);
    }
    const externalId = "manual-" + op;
    if (!id) {
      const prior = await q.findOne({ where: { owner, externalId } });
      if (prior) {
        if (
          prior.status === "deleted" ||
          (prior.editor?.requestId === op && prior.editor.hash !== hash)
        )
          fail("Operazione già utilizzata", 409);
        return snapshot(app, kind, owner, prior);
      }
    }
    const currentLoads = previous
      ? await loadsFor(app, kind, owner, previous.id)
      : {};
    if (previous && body.revision !== version(previous, currentLoads))
      fail("Piano modificato altrove. Riapri l’editor.", 409);
    const title = text(payload.title, 160);
    const description = content.note(payload.description, 300);
    const previousNotes = previous?.notes ?? previous?.editor?.notes;
    const notes =
      payload.notes === previousNotes
        ? previousNotes || ""
        : content.note(payload.notes, 6000);
    const editor = { description, notes, requestId: op, hash };
    const data = { title, editor, csvData: null };
    if (kind === "training") {
      Object.assign(
        data,
        await content.training(app, owner, payload, previous),
      );
      const inherited = inheritSelections(previous, data.days);
      // Supersede the external override only when the editor changed that target.
      if (inherited)
        for (const day of payload.days)
          for (const block of day.blocks) {
            const savedBlock = data.days[day.id].find((b) => b.id === block.id);
            if (block.flowChanged && !savedBlock.movements.length)
              for (const target of targets(day.id, savedBlock))
                delete inherited.choices[target.key];
            block.sets.forEach((set, setIndex) =>
              (set.movements || []).forEach((move, index) => {
                const saved = savedBlock.sets[setIndex].movements[index];
                if (!move.flowChanged || !saved) return;
                const [{ key }] = targets(day.id, {
                  ...savedBlock,
                  sets: [],
                  movements: [saved],
                });
                delete inherited.choices[key];
              }),
            );
          }
      data.flowAssociations = inherited && {
        ...inherited,
        revision: (previous?.flowAssociations?.revision || 0) + 1,
      };
    } else {
      const result = content.nutrition(payload, previous);
      data.meals = result.meals;
      data.notes = notes;
      editor.schedule = result.schedule;
    }
    const saved = previous
      ? await q.update({ where: { owner, id: previous.id }, data })
      : await q.create({
          data: {
            ...data,
            owner,
            sourceHash: hash,
            externalId,
            importVersion: 1,
            versionLabel: "1",
            status: "draft",
            provenance: "manual",
          },
        });
    if (kind === "training") await writeLoads(app, owner, saved, currentLoads);
    return snapshot(app, kind, owner, saved);
  });
}

async function duplicate(app, kind, owner, id, body) {
  return plans.lock(app, kind, owner, async () => {
    const q = repo(app, kind);
    const original = await plans.owned(app, kind, owner, id);
    const externalId = "copy-" + requestId(body.requestId);
    const already = await q.findOne({ where: { owner, externalId } });
    if (already) {
      if (
        already.status === "deleted" ||
        already.editor?.copiedFrom !== original.id
      )
        fail("Operazione già utilizzata", 409);
      return snapshot(app, kind, owner, already);
    }
    const copy = content.duplicateContent(
      kind,
      original,
      await loadsFor(app, kind, owner, original.id),
    );
    if (kind === "training" && original.flowAssociations?.choices) {
      const choices = {};
      for (const [day, blocks] of Object.entries(original.days))
        blocks.forEach((b, i) => {
          const old = targets(day, b),
            next = targets(day, copy.days[day][i]);
          old.forEach((t, j) => {
            if (Object.hasOwn(original.flowAssociations.choices, t.key))
              choices[next[j].key] = original.flowAssociations.choices[t.key];
          });
        });
      copy.flowAssociations = { revision: 0, choices };
    }
    const title = body.title
      ? text(body.title, 160)
      : original.title.slice(0, 151) + " — Copia";
    const plan = await q.create({
      data: {
        ...copy,
        title,
        owner,
        sourceHash: digest([original.sourceHash, externalId]),
        externalId,
        importVersion: 1,
        versionLabel: "1",
        status: "draft",
        provenance: "manual",
        reviewStatus: original.reviewStatus,
        ...(kind === "nutrition"
          ? { notes: original.notes, sourceDate: original.sourceDate }
          : {}),
        editor: {
          description: original.editor?.description || "",
          notes: original.editor?.notes || "",
          ...(original.editor?.schedule
            ? { schedule: original.editor.schedule }
            : {}),
          copiedFrom: original.id,
        },
      },
    });
    if (kind === "training") await writeLoads(app, owner, plan, {});
    return snapshot(app, kind, owner, plan);
  });
}

async function remove(app, kind, owner, id, body) {
  return plans.lock(app, kind, owner, async () => {
    if (body.confirm !== true) fail("Conferma l’eliminazione");
    const p = await plans.owned(app, kind, owner, id, true);
    if (p.status === "deleted") return;
    if (
      kind === "training" &&
      (await app.db
        .query("api::workout-session.workout-session")
        .findOne({ where: { owner, status: "active", programId: p.id } }))
    )
      fail(
        "Concludi o annulla la sessione in corso prima di eliminare la scheda",
        409,
      );
    const isActive = (await activePlan(app, kind, owner))?.id === p.id;
    if (isActive)
      await repo(app, kind).updateMany({
        where: { owner, status: { $null: true }, id: { $ne: p.id } },
        data: { status: "archived" },
      });
    await repo(app, kind).update({
      where: { owner, id: p.id },
      data: { status: "deleted" },
    });
  });
}

module.exports = { snapshot, save, duplicate, remove };
