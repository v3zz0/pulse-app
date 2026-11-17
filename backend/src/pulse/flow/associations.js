"use strict";
const { createHash } = require("node:crypto");
const { reviewed, uncertain } = require("./reviewed");
const { fail } = require("../validation");
const runtime = require("./runtime");
const lock = require("../../../flow.lock.json");

function describe(e) {
  return { id: e.id, name: e.name, equipment: e.equipment, muscle: e.target };
}

function targetKey(day, block, movement) {
  return createHash("sha256").update(JSON.stringify([
    day, block.id, runtime.normalize(block.name), runtime.normalize(block.notes),
    movement?.order ?? null, runtime.normalize(movement?.name),
  ])).digest("hex");
}

// A movement repeated in multiple sets has a single association. The original
// block and its sets remain unchanged and keep all their own prescriptions.
function targets(day, block) {
  const movements = new Map();
  for (const items of [block.movements, ...block.sets.map((s) => s.movements)]) {
    for (const [index, move] of (items || []).entries()) {
      const movement = { ...move, order: move.order ?? index + 1 };
      const key = targetKey(day, block, movement);
      if (!movements.has(key) || movement.flowId || movement.flowCleared) movements.set(key, movement);
    }
  }
  if (movements.size)
    return Array.from(movements, ([key, m]) => ({ key, name: m.name, explicit: m.flowId, cleared: m.flowCleared }));
  return [{ key: targetKey(day, block), name: block.name, explicit: block.flowId, cleared: block.flowCleared }];
}

function resolveTarget(target, choices, catalogue) {
  const base = { key: target.key, name: target.name, flowId: null, candidates: [] };
  const get = (id) => catalogue?.byId.get(id);
  const manual = Object.hasOwn(choices, target.key) ? choices[target.key] : undefined;
  if (manual !== undefined) {
    if (manual === null) return { ...base, status: "unavailable", reason: "Animazione rimossa." };
    const chosen = manual.revision === lock.revision ? get(manual.id) : null;
    return chosen
      ? { ...base, flowId: chosen.id, animation: describe(chosen), status: "confirmed", method: "manual" }
      : { ...base, status: "review", reason: "La scelta salvata richiede una nuova verifica del catalogo." };
  }
  if (target.cleared)
    return { ...base, status: "unavailable", reason: "Animazione rimossa." };
  if (!catalogue) return { ...base, status: "unavailable", reason: "Catalogo Flow non disponibile sul server." };

  const explicit = get(target.explicit);
  if (explicit)
    return { ...base, flowId: explicit.id, animation: describe(explicit), status: "confirmed", method: "existing" };

  const name = runtime.normalize(target.name);
  const rule = reviewed.find(([aliases]) => aliases.includes(name));
  if (rule) {
    const [, id, expectedName, equipment] = rule;
    const entry = get(id);
    if (entry?.name === expectedName && entry.equipment === equipment)
      return { ...base, flowId: id, animation: describe(entry), status: "confirmed", method: "reviewed" };
  }

  const notes = Object.hasOwn(uncertain, name) ? uncertain[name] : undefined;
  const candidates = notes
    ? (notes.ids || []).map(get).filter(Boolean)
    : catalogue.animated.filter((e) => runtime.normalize(e.name) === name).slice(0, 6);
  return {
    ...base,
    status: candidates.length ? "review" : "unavailable",
    reason: notes?.reason || (candidates.length ? "Conferma la variante prima di usare l’animazione." : ""),
    candidates: candidates.map(describe),
  };
}

async function decorate(program) {
  const catalogue = await runtime.catalog().catch((e) => {
    if (e.status === 404 || e.status === 503) return null;
    throw e;
  });
  const saved = program.flowAssociations || {};
  const choices = saved.choices || {};
  const days = Object.fromEntries(Object.entries(program.days).map(([day, blocks]) => [
    day,
    blocks.map((block) => {
      const media = targets(day, block).map((target) => resolveTarget(target, choices, catalogue));
      const isCircuit = media.length > 1 || block.movements?.length ||
        block.sets.some((s) => s.movements?.length);
      return { ...block, media, flowId: isCircuit ? null : media[0].flowId };
    }),
  ]));
  return { days, flowAvailable: !!catalogue, flowRevision: saved.revision || 0 };
}

async function select(program, body) {
  if (body.confirm !== true) fail("Conferma esplicita richiesta");
  const current = program.flowAssociations || {};
  const revision = current.revision || 0;
  if (body.revision !== revision) fail("Animazione modificata altrove. Ricarica la scheda.", 409);
  if (!Object.hasOwn(program.days, body.day)) fail("Scheda inesistente", 404);
  const block = program.days[body.day].find((b) => b.id === body.blockId);
  if (!block || !targets(body.day, block).some((t) => t.key === body.key))
    fail("Movimento inesistente", 404);
  if (body.flowId !== null) await runtime.animatedExercise(body.flowId);

  return {
    revision: revision + 1,
    choices: {
      ...current.choices,
      [body.key]: body.flowId === null ? null : { id: body.flowId, revision: lock.revision },
    },
  };
}

function inheritSelections(previous, days) {
  const choices = previous?.flowAssociations?.choices;
  if (!choices) return null;
  const keys = Object.entries(days).flatMap(([day, blocks]) =>
    blocks.flatMap((block) => targets(day, block).map(({ key }) => key)));
  const matching = keys.filter((key) => Object.hasOwn(choices, key));
  return matching.length
    ? { revision: 0, choices: Object.fromEntries(matching.map((key) => [key, choices[key]])) }
    : null;
}

module.exports = { decorate, select, targets, inheritSelections };
