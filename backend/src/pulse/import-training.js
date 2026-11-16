"use strict";
const { createHash } = require("node:crypto");
const EXPECTED_HASH =
  "55181a2160ec6749157376b824455607383fb286efdb387a08bb0de23bec4fad";
const IMPORT_VERSION = 1;
const uid = "api::training-program.training-program";
const hash = (buffer) => createHash("sha256").update(buffer).digest("hex");

// This parser deliberately accepts only the reviewed source layout and hash.
// No personal source text, videos or program data are bundled into web assets.
async function parseTraining(buffer) {
  if (hash(buffer) !== EXPECTED_HASH)
    throw new Error(
      "PDF diverso dal riferimento: revisionare il parser prima di importare",
    );
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const task = pdfjs.getDocument({
    data: new Uint8Array(buffer),
    useSystemFonts: true,
    isEvalSupported: false,
  });
  try {
    const pdf = await task.promise;
    if (pdf.numPages !== 2) throw new Error("Numero pagine inatteso");
    const days = { A: [], B: [], C: [] };
    let day = null,
      linkCount = 0,
      cooldown;
    for (let pageNumber = 1; pageNumber <= 2; pageNumber++) {
      const page = await pdf.getPage(pageNumber);
      const items = (await page.getTextContent()).items
        .filter((i) => i.str?.trim())
        .map((i) => ({
          text: i.str.trim(),
          x: i.transform[4],
          y: i.transform[5],
        }));
      const annotations = (await page.getAnnotations()).filter((a) => a.url);
      const links = items
        .filter((i) => i.text === "LINK" && i.x > 500 && i.y < 790)
        .sort((a, b) => b.y - a.y);
      if (annotations.length !== links.length)
        throw new Error("Annotazioni video non allineate alle righe LINK");
      const prescriptions = items
        .filter(
          (i) => i.x >= 143 && i.x < 214 && /^(\d+\s*X\s*|3')/i.test(i.text),
        )
        .sort((a, b) => b.y - a.y);
      let upper = 790;
      for (const prescription of prescriptions) {
        const row = items.filter(
          (i) => i.y <= upper + 0.1 && i.y >= prescription.y - 0.1,
        );
        const header = row.find((i) => /^GIORNO [ABC]$/.test(i.text));
        if (header) day = header.text.slice(-1);
        const textAt = (left, right) =>
          row
            .filter(
              (i) => i.x >= left && i.x < right && !/^GIORNO /.test(i.text),
            )
            .sort((a, b) => b.y - a.y || a.x - b.x)
            .map((i) => i.text)
            .join(" ");
        const name = textAt(0, 143),
          notes = textAt(253, 508),
          restRaw = textAt(214, 253);
        const videos = links
          .map((line, index) => ({ line, annotation: annotations[index] }))
          .filter(
            (v) => v.line.y <= upper + 0.1 && v.line.y >= prescription.y - 0.1,
          )
          .map((v) => ({
            url: v.annotation.url,
            sourcePage: pageNumber,
            reviewRequired: true,
            mappingMethod:
              "Ordine annotazioni e righe LINK; rettangoli fuori pagina",
            candidateMovement: items
              .filter((i) => i.x < 143 && Math.abs(i.y - v.line.y) < 1)
              .map((i) => i.text)
              .join(" "),
          }));
        linkCount += videos.length;
        if (pageNumber === 2) {
          cooldown = {
            name,
            durationSeconds: 180,
            sourceText: [name, prescription.text, notes].join(" | "),
            videos,
            sourcePage: 2,
          };
        } else {
          if (!day) throw new Error("Giornata mancante");
          const match = prescription.text.match(/^(\d+)\s*X\s*(.+)$/i);
          if (!match) throw new Error("Serie non riconosciuta");
          const circuit = match[2] === "5+5+5";
          const phase = /RISCALDAMENTO/.test(notes)
            ? "warmup"
            : /TOP SET/.test(notes)
              ? "top-set"
              : /BACK OFF/.test(notes)
                ? "back-off"
                : circuit
                  ? "circuit"
                  : "work";
          const restSeconds =
            restRaw === "1'"
              ? 60
              : restRaw === "2'"
                ? 120
                : restRaw === '30"'
                  ? 30
                  : null;
          const blockId = `${day}:${days[day].length + 1}`;
          days[day].push({
            id: blockId,
            name,
            phase,
            prescriptionRaw: prescription.text,
            restRaw,
            restSeconds,
            reviewRequired: restRaw === "1/2'",
            notes,
            videos,
            sourcePage: 1,
            sourceText: [name, prescription.text, restRaw, notes].join(" | "),
            movements: circuit
              ? row
                  .filter((i) => i.x < 143)
                  .sort((a, b) => b.y - a.y)
                  .map((i) => ({ name: i.text, reps: 5 }))
              : [],
            sets: Array.from({ length: Number(match[1]) }, (_, i) => ({
              id: `${blockId}:${i + 1}`,
              reps: match[2],
              toFailure: /CED/i.test(match[2]),
              standardKg: null,
            })),
          });
        }
        upper = prescription.y - 0.2;
      }
    }
    if (
      days.A.length !== 11 ||
      days.B.length !== 12 ||
      days.C.length !== 8 ||
      !cooldown ||
      linkCount !== 29
    )
      throw new Error("Import incompleto: conteggio righe o video inatteso");
    return {
      title: "Scheda A/B/C importata",
      sourceHash: EXPECTED_HASH,
      importVersion: IMPORT_VERSION,
      reviewStatus: "needs-review",
      days,
      cooldown,
      importReport: {
        pages: 2,
        blocks: 31,
        videoCandidates: 29,
        videoContentVerified: false,
        ambiguousRest: "A:3",
        sourceTextPreserved: true,
      },
    };
  } finally {
    await task.destroy();
  }
}
async function importTraining(strapi, buffer, owner) {
  const data = await parseTraining(buffer);
  return strapi.db.transaction(async ({ trx }) => {
    // Serialize concurrent imports for this owner/version as well as sequential retries.
    await trx.raw("SELECT pg_advisory_xact_lock(hashtext(?))", [
      `training-import:${owner}:${EXPECTED_HASH}:${IMPORT_VERSION}`,
    ]);
    const repo = strapi.db.query(uid);
    const existing = await repo.findOne({
      where: {
        owner,
        sourceHash: EXPECTED_HASH,
        importVersion: IMPORT_VERSION,
      },
    });
    if (existing) return { id: existing.id, alreadyImported: true };
    const plan = await repo.create({ data: { ...data, owner } });
    return { id: plan.id, alreadyImported: false, report: data.importReport };
  });
}
module.exports = { parseTraining, importTraining, EXPECTED_HASH };
