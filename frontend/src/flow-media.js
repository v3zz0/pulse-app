import { api } from "./api";
import { read, write } from "./offline";
export const validFrame = (value) =>
  /^\/api\/pulse\/flow\/assets\/[a-f0-9]{40}\/\d{4}\/frame-0[012]\.svg$/.test(
    value,
  );
export async function flowExercise(id) {
  if (!/^\d{4}$/.test(id)) throw new Error("ID Flow non valido");
  let data;
  try {
    data = await api("/flow/exercises/" + id);
  } catch (e) {
    if (e.status) throw e;
    data = await read("flow:" + id);
    if (!data) throw e;
  }
  if (
    data.id !== id ||
    (data.animation &&
      (data.animation.frames.length !== 3 ||
        data.animation.frames.some((f) => !validFrame(f.url))))
  )
    throw new Error("Animazione Flow non valida");
  await write("flow:" + id, data);
  return data;
}
async function verify(response, meta) {
  if (!response.ok) throw new Error("Download SVG non riuscito");
  const bytes = await response.clone().arrayBuffer();
  const hash = [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))]
    .map((v) => v.toString(16).padStart(2, "0"))
    .join("");
  if (hash !== meta.sha256) throw new Error("Integrità SVG non valida");
  return bytes.byteLength;
}
export async function offlineAnimations(ids, onProgress) {
  const unique = [...new Set(ids)];
  if (!unique.length) throw new Error("Nessuna animazione Flow associata");
  const exercises = await Promise.all(unique.map(flowExercise));
  const frames = [
    ...new Map(
      exercises
        .flatMap((e) => e.animation?.frames || [])
        .map((f) => [f.url, f]),
    ).values(),
  ];
  if (!frames.length) throw new Error("Nessuna animazione disponibile");
  const expected = frames.reduce((n, f) => n + f.bytes, 0),
    estimate = await navigator.storage?.estimate();
  if (
    estimate?.quota &&
    (estimate.usage || 0) + expected > estimate.quota * 0.9
  )
    throw new Error("Spazio insufficiente sul dispositivo");
  const staging = "pulse-flow-stage-" + crypto.randomUUID(),
    stage = await caches.open(staging);
  let bytes = 0;
  try {
    for (const [i, f] of frames.entries()) {
      const r = await fetch(f.url, { credentials: "same-origin" });
      bytes += await verify(r, f);
      await stage.put(f.url, r);
      onProgress({ done: i + 1, total: frames.length, bytes });
    }
    for (const f of frames) {
      const revision = f.url.split("/")[5],
        cache = await caches.open("pulse-flow-" + revision);
      await cache.put(f.url, await stage.match(f.url));
    }
    return { bytes, frames: frames.length };
  } finally {
    await caches.delete(staging);
  }
}

export function mediaFor(block) {
  if (block.media) return block.media;
  const moves = (block.movements?.length ? block.movements : block.sets.flatMap((s) => s.movements || []));
  if (moves.length) {
    return [...new Map(moves.map((m, index) => [
      (m.order ?? index + 1) + ":" + m.name, m,
    ])).entries()].map(([key, m]) => ({ key, name: m.name, flowId: m.flowId }));
  }
  return [{ key: block.id, name: block.name, flowId: block.flowId }];
}
