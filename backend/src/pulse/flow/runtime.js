"use strict";
const fs = require("node:fs/promises"),
  path = require("node:path"),
  { createHash } = require("node:crypto"),
  { sanitize } = require("./svg"),
  { fail } = require("../validation"),
  lock = require("../../../flow.lock.json");
const root = () =>
  path.resolve(
    process.env.FLOW_DATA_PATH ||
      path.resolve(__dirname, "../../../../storage/flow"),
  );
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
    c.exercises.length !== lock.counts.exercises
  )
    fail("Catalogo Flow non valido", 503);
  cached = c;
  return c;
}
async function exercise(id) {
  if (!/^\d{4}$/.test(id)) fail("ID Flow non valido", 404);
  const c = await catalog(),
    e = c.exercises.find((e) => e.id === id);
  if (!e) fail("Esercizio Flow inesistente", 404);
  return {
    ...e,
    revision: lock.revision,
    repository: lock.repository,
    animation: e.animation
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
  if (!meta) fail("Risorsa Flow inesistente", 404);
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
module.exports = { exercise, asset };
