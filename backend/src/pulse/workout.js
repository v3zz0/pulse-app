"use strict";
const { fail } = require("./validation");
function kg(value, nullable = true) {
  if (value === null && nullable) return null;
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < 0 ||
    value > 1500
  )
    fail("Carico non valido");
  return value;
}
function reps(value) {
  if (value === null || value === undefined) return null;
  if (!Number.isInteger(value) || value < 0 || value > 1000)
    fail("Ripetizioni non valide");
  return value;
}
function timestamp(value, now) {
  const t = Date.parse(value);
  if (!Number.isFinite(t) || t > now + 30000 || t < now - 30 * 86400000)
    fail("Timestamp non valido");
  return t;
}
function createSnapshot(program, day, loads, previous) {
  const blocks = structuredClone(program.days[day]);
  if (!blocks) fail("Scheda inesistente", 404);
  for (const block of blocks)
    for (const set of block.sets) {
      set.standardAtStart = Object.hasOwn(loads, set.id)
        ? loads[set.id]
        : (set.standardKg ?? null);
      delete set.standardKg;
      set.draftKg = set.standardAtStart;
      set.actualKg = null;
      set.actualReps = null;
      set.status = "pending";
      set.completedAt = null;
      set.previous = previous[set.id] || null;
    }
  return {
    title: program.title,
    blocks,
    cooldown: structuredClone(program.cooldown),
    cooldownDone: false,
  };
}
function applyOperation(session, body, now = Date.now()) {
  const snapshot = structuredClone(session.snapshot);
  let timer = structuredClone(session.timer || null);
  const time = timestamp(body.occurredAt, now);
  const completedAt = new Date(time).toISOString();
  const sets = snapshot.blocks.flatMap((b) => b.sets);
  if (body.action === "set") {
    const set = sets.find((s) => s.id === body.setId);
    if (!set) fail("Serie inesistente", 404);
    if (set.status !== "pending") fail("Serie già gestita", 409);
    if (!["pending", "recorded", "unlogged", "skipped"].includes(body.status))
      fail("Stato serie non valido");
    if (body.status === "pending") {
      set.draftKg = kg(body.draftKg);
      set.actualReps = reps(body.actualReps);
    } else {
      set.status = body.status;
      set.actualKg =
        body.status === "recorded" ? kg(body.actualKg, false) : null;
      set.actualReps = body.status === "skipped" ? null : reps(body.actualReps);
      set.completedAt = completedAt;
      if (body.status !== "skipped") {
        const block = snapshot.blocks.find((b) =>
          b.sets.some((s) => s.id === set.id),
        );
        if (block.restSeconds)
          timer = {
            endAt: new Date(time + block.restSeconds * 1000).toISOString(),
            pausedRemaining: null,
          };
      }
    }
  } else if (body.action === "skip-block") {
    const block = snapshot.blocks.find((b) => b.id === body.blockId);
    if (!block) fail("Esercizio inesistente", 404);
    for (const s of block.sets)
      if (s.status === "pending")
        Object.assign(s, {
          status: "skipped",
          actualKg: null,
          actualReps: null,
          completedAt,
        });
  } else if (body.action === "timer") {
    if (body.command === "start") {
      if (
        !Number.isInteger(body.seconds) ||
        body.seconds < 1 ||
        body.seconds > 3600
      )
        fail("Durata non valida");
      timer = {
        endAt: new Date(time + body.seconds * 1000).toISOString(),
        pausedRemaining: null,
      };
    } else if (body.command === "pause") {
      if (timer?.endAt)
        timer = {
          endAt: null,
          pausedRemaining: Math.max(
            0,
            Math.ceil((Date.parse(timer.endAt) - time) / 1000),
          ),
        };
    } else if (body.command === "resume") {
      if (timer?.pausedRemaining != null)
        timer = {
          endAt: new Date(time + timer.pausedRemaining * 1000).toISOString(),
          pausedRemaining: null,
        };
    } else if (body.command === "stop") timer = null;
    else fail("Comando timer non valido");
  } else if (body.action === "cooldown") snapshot.cooldownDone = true;
  else if (body.action === "finish") {
    if (sets.some((s) => s.status === "pending"))
      fail("Completa o salta tutte le serie prima di concludere", 409);
    if (!snapshot.cooldownDone) fail("Conferma il defaticamento", 409);
    return { snapshot, timer: null, status: "completed", completedAt };
  } else fail("Azione non valida");
  return { snapshot, timer };
}
function metrics(session) {
  const sets = session.snapshot.blocks.flatMap((b) => b.sets);
  const recorded = sets.filter((s) => s.status === "recorded");
  return {
    recorded: recorded.length,
    unlogged: sets.filter((s) => s.status === "unlogged").length,
    skipped: sets.filter((s) => s.status === "skipped").length,
    volume: recorded.reduce(
      (n, s) => n + (s.actualReps == null ? 0 : s.actualKg * s.actualReps),
      0,
    ),
    volumeIncomplete: sets.some(
      (s) =>
        s.status === "unlogged" ||
        (s.status === "recorded" && s.actualReps == null),
    ),
  };
}
module.exports = { kg, createSnapshot, applyOperation, metrics };
