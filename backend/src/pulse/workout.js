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
function timestamp(value, now, maximumAge = 30 * 86400000) {
  const t = Date.parse(value);
  if (!Number.isFinite(t) || t > now + 30000 || t < now - maximumAge)
    fail("Timestamp non valido");
  return t;
}
// Suggestions belong to the draft, never to performed results.
function repProposal(set, block) {
  const raw = String(set.reps ?? "").trim();
  if (set.movements?.length || block.movements?.length || /\+/.test(raw))
    return { kind: "compound", text: raw };
  if (set.toFailure || /ced|failure|amrap/i.test(raw))
    return { kind: "open", text: raw };
  if (/^\d+$/.test(raw) && Number(raw) <= 1000)
    return { kind: "exact", text: raw, value: Number(raw) };
  const match = raw.match(/^(\d+)\s*[-–—]\s*(\d+)$/);
  const min = set.repsMin ?? (match ? Number(match[1]) : null);
  const max = set.repsMax ?? (match ? Number(match[2]) : null);
  if (
    Number.isInteger(min) &&
    Number.isInteger(max) &&
    min >= 0 &&
    max >= min &&
    max <= 1000
  )
    return {
      kind: "range",
      text: raw,
      min,
      max,
      options:
        max - min <= 12
          ? Array.from({ length: max - min + 1 }, (_, i) => min + i)
          : [],
    };
  return { kind: "open", text: raw };
}
function prepareDrafts(snapshot) {
  const copy = structuredClone(snapshot);
  for (const block of copy.blocks)
    for (const set of block.sets) {
      if (set.status !== "pending") continue;
      set.repProposal ??= repProposal(set, block);
      if (!Object.hasOwn(set, "draftReps"))
        set.draftReps =
          set.actualReps ??
          (set.repProposal.kind === "exact" ? set.repProposal.value : null);
      set.actualReps = null;
      if (!Object.hasOwn(set, "draftKg"))
        set.draftKg = set.standardAtStart ?? null;
    }
  return copy;
}
function createSnapshot(program, day, loads, previous) {
  if (!Object.hasOwn(program.days, day)) fail("Scheda inesistente", 404);
  const blocks = structuredClone(program.days[day]);
  if (!blocks) fail("Scheda inesistente", 404);
  for (const block of blocks)
    for (const set of block.sets) {
      set.standardAtStart = Object.hasOwn(loads, set.id)
        ? loads[set.id]
        : (set.standardKg ?? null);
      delete set.standardKg;
      set.draftKg = set.standardAtStart;
      set.repProposal = repProposal(set, block);
      set.draftReps =
        set.repProposal.kind === "exact" ? set.repProposal.value : null;
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
  const snapshot = prepareDrafts(session.snapshot);
  let timer = structuredClone(session.timer || null);
  const time = timestamp(
    body.occurredAt,
    now,
    body.action === "cancel" ? Infinity : undefined,
  );
  const completedAt = new Date(time).toISOString();
  const sets = snapshot.blocks.flatMap((b) => b.sets);
  if (body.action === "set") {
    const set = sets.find((s) => s.id === body.setId);
    if (!set) fail("Serie inesistente", 404);
    if (set.status !== "pending") fail("Serie già gestita", 409);
    if (!["pending", "recorded", "unlogged", "skipped"].includes(body.status))
      fail("Stato serie non valido");
    if (body.status === "pending") {
      if (!Object.hasOwn(set, "draftReps"))
        set.draftReps = set.actualReps ?? null;
      if (Object.hasOwn(body, "draftKg")) set.draftKg = kg(body.draftKg);
      if (Object.hasOwn(body, "draftReps") || Object.hasOwn(body, "actualReps"))
        set.draftReps = reps(
          Object.hasOwn(body, "draftReps") ? body.draftReps : body.actualReps,
        );
      set.actualReps = null;
    } else {
      set.status = body.status;
      set.actualKg =
        body.status === "recorded" ? kg(body.actualKg, false) : null;
      set.actualReps = body.status === "skipped" ? null : reps(body.actualReps);
      if (body.status !== "skipped" && set.repProposal) {
        if (set.repProposal.kind === "compound" && set.actualReps !== null)
          fail(
            "Conserva le ripetizioni dei singoli movimenti, senza un totale",
          );
        if (set.repProposal.kind !== "compound" && set.actualReps === null)
          fail("Inserisci le ripetizioni effettivamente eseguite");
      }
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
  } else if (body.action === "cancel") {
    if (body.confirm !== true) fail("Conferma esplicita richiesta");
    return {
      snapshot,
      timer: null,
      status: "cancelled",
      completedAt: null,
      cancelledAt: new Date(now).toISOString(),
    };
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
  const sets =
    session.status === "cancelled"
      ? []
      : session.snapshot.blocks.flatMap((b) => b.sets);
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
module.exports = {
  prepareDrafts,
  repProposal,
  kg,
  createSnapshot,
  applyOperation,
  metrics,
};
