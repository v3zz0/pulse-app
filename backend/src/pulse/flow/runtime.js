"use strict";
const fs = require("node:fs/promises"),
  path = require("node:path"),
  { createHash } = require("node:crypto"),
  { sanitize } = require("./svg"),
  { fail } = require("../validation"),
  lock = require("../../../flow.lock.json");
const { reviewed, uncertain } = require("./reviewed");
const termsById = new Map();
for (const [aliases, id] of reviewed) termsById.set(id, aliases.join(" "));
for (const [alias, entry] of Object.entries(uncertain))
  for (const id of entry.ids || [])
    termsById.set(id, [termsById.get(id), alias].filter(Boolean).join(" "));
const root = () =>
  path.resolve(
    process.env.FLOW_DATA_PATH ||
      path.resolve(__dirname, "../../../../storage/flow"),
  );
function normalize(value) {
  return String(value ?? "").normalize("NFKD").replace(/\p{Diacritic}/gu, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
function reusable(e) {
  return e.animation?.license === "CC0-1.0" &&
    e.provenance?.artworkLicense === "CC0-1.0";
}
let cached;
async function catalog() {
  if (cached) return cached;
  let c;
  try {
    c = JSON.parse(
      await fs.readFile(
        path.join(root(), lock.revision, "catalog.json"),
        "utf8",
      ),
    );
  } catch {
    fail("Dataset Flow non installato su questo server", 404);
  }
  if (
    c.revision !== lock.revision ||
    !Array.isArray(c.exercises) || c.exercises.length !== lock.counts.exercises
  )
    fail("Catalogo Flow non valido", 503);
  const animated = c.exercises.filter(reusable);
  const byId = new Map(animated.map((e) => [e.id, e]));
  cached = { ...c, animated, byId };
  return cached;
}
async function exercise(id) {
  if (typeof id !== "string" || !/^\d{4}$/.test(id)) fail("ID Flow non valido", 404);
  const c = await catalog(),
    e = c.exercises.find((e) => e.id === id);
  if (!e) fail("Esercizio Flow inesistente", 404);
  return {
    ...e,
    revision: lock.revision,
    repository: lock.repository,
    animation: reusable(e)
      ? {
          ...e.animation,
          frames: e.animation.frames.map((f, i) => {
            if (f !== `assets/${id}/frame-0${i}.svg` || !c.assets[f])
              fail("Metadati Flow non validi", 503);
            return {
              url: `/api/pulse/flow/assets/${lock.revision}/${id}/frame-0${i}.svg`,
              ...c.assets[f],
            };
          }),
        }
      : null,
  };
}
async function asset(revision, id, frame) {
  if (
    revision !== lock.revision ||
    !/^\d{4}$/.test(id) ||
    !/^frame-0[012]\.svg$/.test(frame)
  )
    fail("Risorsa Flow inesistente", 404);
  const c = await catalog(),
    key = `assets/${id}/${frame}`,
    meta = c.assets[key];
  if (!meta || !c.byId.has(id)) fail("Risorsa Flow inesistente", 404);
  const raw = await fs
    .readFile(path.join(root(), revision, key))
    .catch(() => null);
  if (
    !raw ||
    createHash("sha256").update(raw).digest("hex") !== meta.sha256 ||
    sanitize(raw.toString("utf8")) !== raw.toString("utf8")
  )
    fail("Integrità SVG Flow non valida", 503);
  return { raw, sha: meta.sha256 };
}
async function animatedExercise(id) {
  const e = await exercise(id);
  if (!e.animation) fail("Animazione non disponibile", 404);
  return e;
}
async function search(params) {
  for (const field of ["q", "equipment", "muscle", "offset"])
    if (params[field] !== undefined &&
        (typeof params[field] !== "string" || params[field].length > 100))
      fail("Ricerca non valida");
  const c = await catalog();
  const offset = Number(params.offset || 0);
  if (!Number.isInteger(offset) || offset < 0 || offset > c.animated.length)
    fail("Pagina non valida");
  const words = normalize(params.q).split(" ").filter(Boolean);
  const matched = c.animated.filter((e) => {
    const label = normalize([
      e.id, e.name, e.equipment, e.target, e.bodyPart, termsById.get(e.id),
    ].join(" "));
    return (!params.equipment || e.equipment === params.equipment) &&
      (!params.muscle || e.target === params.muscle) && words.every((w) => label.includes(w));
  });
  const size = 18;
  return {
    items: matched.slice(offset, offset + size).map((e) => ({
      id: e.id, name: e.name, equipment: e.equipment, muscle: e.target,
    })),
    next: offset + size < matched.length ? offset + size : null,
    equipment: [...new Set(c.animated.map((e) => e.equipment))].sort(),
    muscles: [...new Set(c.animated.map((e) => e.target))].sort(),
  };
}
module.exports = { exercise, asset, catalog, animatedExercise, search, normalize };
