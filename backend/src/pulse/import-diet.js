"use strict";
const { createHash } = require("node:crypto");
const IMPORT_VERSION = 2;
const EXPECTED_HASH =
  "97405c4055504ee720f98ab400bc02a5f9debafa6fbea1cf0ae7d6a6b41eda87";
const id = (value) =>
  createHash("sha256").update(value).digest("hex").slice(0, 20);
// Keep exact source text alongside structured menus. Never treat the UI demo as a source.
async function extractPdf(buffer) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const task = pdfjs.getDocument({
    data: new Uint8Array(buffer),
    useSystemFonts: true,
    isEvalSupported: false,
  });
  const pdf = await task.promise;
  const pages = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const content = await (await pdf.getPage(i)).getTextContent();
    let lines = [],
      line = "",
      lastY = null;
    for (const item of content.items) {
      if (!("str" in item)) continue;
      const y = item.transform[5];
      if (lastY !== null && Math.abs(y - lastY) > 2 && line) {
        lines.push(line.trim());
        line = "";
      }
      line += (line ? " " : "") + item.str;
      lastY = y;
      if (item.hasEOL) {
        lines.push(line.trim());
        line = "";
      }
    }
    if (line) lines.push(line.trim());
    pages.push(lines.filter(Boolean).join("\n"));
  }
  await task.destroy();
  return pages;
}
function alternatives(text, key) {
  const original = text;
  text = text.replace(/\)o\s/g, ") o ").replace(/\be\/o\b/g, "e oppure");
  const parts = [];
  let start = 0,
    depth = 0;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "(") depth++;
    if (text[i] === ")") depth = Math.max(0, depth - 1);
    const separator =
      depth === 0 && (text.slice(i, i + 3) === " o " || text[i] === "/");
    if (separator) {
      parts.push(text.slice(start, i).trim());
      start = i + (text[i] === "/" ? 1 : 3);
    }
  }
  parts.push(text.slice(start).trim());
  const expanded = parts.filter(Boolean).flatMap((value) => {
    const match = value.match(/^(.*?)(?:\(([^()]+)\))(.*)$/);
    if (
      match &&
      /cereali.*in chicco|legumi secchi|carne bianca|pesce grasso|pesce magro/.test(
        match[1],
      )
    ) {
      return match[2]
        .split(/[,/]/)
        .map((food) => `${match[1].trim()} — ${food.trim()}${match[3]}`)
        .filter(Boolean);
    }
    return [value];
  });
  let quantity = null;
  return expanded.map((value, i) => {
    const explicit = value.match(
      /^(?:Pancake:\s*)?(\d+(?:[.,-]\d+)?\s*(?:g|ml)\b)/i,
    )?.[1];
    if (explicit) quantity = explicit;
    const inherited = i > 0 && !/^\d/.test(value) && quantity;
    let label = value;
    if (i > 0 && !/^\d/.test(value)) {
      if (original.includes("latte di ") && !value.includes("latte"))
        label = "latte di " + value;
      else if (original.startsWith("crema di ") && !value.includes("crema"))
        label = "crema di " + value;
      else if (original.includes("farina") && !value.includes("farina"))
        label = "farina di " + value;
      else if (original.includes("semi di ") && !value.includes("semi"))
        label = "semi di " + value;
    }
    return {
      id: id(key + ":" + i),
      text: inherited ? `${quantity} ${label}` : label,
      sourceText: original,
      reviewRequired: !!inherited || original.includes("/"),
      source: "PDF storico",
      nutrients: null,
    };
  });
}
function parseMeal(raw, key, name, time) {
  const blocks = raw
    .split(/\nOppure\n|\n(?=B\))/i)
    .map((x) => x.replace(/^[AB]\)/, "").trim())
    .filter(Boolean);
  const menus = blocks.map((block, menuIndex) => {
    const lines = block.replace(/\)o\s/g, ") o ").split("\n");
    const groups = [];
    let current = "";
    for (const line of lines) {
      const begins =
        /^(?:\d|Infuso|Pancake:|Porridge:|Verdure|Piatto|Condire|NB\.|NOTE|Piselli)/i.test(
          line,
        );
      const continuation = /\bo\s*$|[\/+]\s*$/.test(current);
      if (begins && current && !continuation) {
        groups.push(current);
        current = "";
      }
      current += (current ? " " : "") + line;
    }
    if (current) groups.push(current);
    const notes = groups.filter((t) => /^(NOTE|NB\.|Piselli)/.test(t));
    const ingredients = groups
      .filter((t) => !/^(NOTE|NB\.|Piselli)/.test(t))
      .flatMap((t) =>
        t.split(/\s*\+\s*|\s+con (?=\d+\s*ml di albumi)|\s+con (?=crema di)/),
      );
    return {
      notes: notes.join("\n"),
      title:
        blocks.length > 1 ? `Alternativa ${menuIndex + 1}` : "Pasto del piano",
      groups: ingredients.map((text, i) => ({
        id: id(key + ":" + menuIndex + ":" + i),
        sourceText: text,
        options: alternatives(text, key + ":" + menuIndex + ":" + i),
      })),
    };
  });
  return {
    id: key,
    name,
    time,
    timeSource: "Orario organizzativo modificabile, non prescritto",
    sourceText: raw,
    menus,
    menuIndex: 0,
    selections: menus[0].groups.map(() => 0),
    consumedAt: null,
  };
}
function parsePages(pages, sourceHash) {
  const full = pages.join("\n").replace(/\r/g, "");
  if (
    !full.includes("17-09-2026") ||
    !full.includes("Giorni Off") ||
    !full.includes("Giorni On")
  )
    throw new Error("Documento non riconosciuto");
  const offStart = full.indexOf("Giorni Off"),
    onStart = full.indexOf("Giorni On"),
    notesStart = full.indexOf("NOTE GENERALI:");
  const headings = [
    ["Colazione", "breakfast", "08:00"],
    ["Spuntino 1", "snack1", "10:30"],
    ["Pre -workout", "pre-workout", ""],
    ["Pranzo", "lunch", "13:00"],
    ["Spuntino 2", "snack2", "17:00"],
    ["Cena", "dinner", "20:30"],
    ["Pre letto", "bedtime", ""],
  ];
  const meals = {};
  for (const [mode, section] of [
    ["OFF", full.slice(offStart, onStart)],
    ["ON", full.slice(onStart, notesStart)],
  ]) {
    const positions = headings
      .map(([label, key, time]) => ({
        label,
        key,
        time,
        start: section.indexOf("\n" + label + "\n"),
      }))
      .filter((x) => x.start >= 0)
      .sort((a, b) => a.start - b.start);
    meals[mode] = positions.map((item, index) => {
      let raw = section
        .slice(
          item.start + item.label.length + 2,
          positions[index + 1]?.start ?? section.length,
        )
        .trim();
      if (raw.includes("Sgarro sano:"))
        raw = raw.slice(0, raw.indexOf("Sgarro sano:")).trim();
      return parseMeal(raw, mode + ":" + item.key, item.label, item.time);
    });
    const first = positions[0];
    const morning = section
      .slice(section.indexOf("\n") + 1, first.start)
      .trim();
    if (morning)
      meals[mode].unshift(
        parseMeal(morning, mode + ":wake", "Al risveglio", ""),
      );
  }
  if (meals.OFF.length !== 6 || meals.ON.length !== 8)
    throw new Error(
      "Numero pasti inatteso: verificare estrazione prima di importare",
    );
  const before = full.slice(0, offStart),
    supplementText = before.slice(before.indexOf("Assumere"));
  const supplements = supplementText
    .split(/\n(?=Assumere)/)
    .map((instructions, i) => ({
      name: [
        "Multiminerale (piano storico)",
        "Creatina monoidrato (piano storico)",
        "BCAA (piano storico)",
      ][i],
      instructions: instructions.trim(),
      ingredients: ["Multiminerali", "Creatina", "Aminoacidi ramificati"][i],
      source: "historical-plan",
    }));
  const end = full.indexOf("STUDIO DI NUTRIZIONE UMANA", notesStart);
  const notes = full.slice(notesStart, end > 0 ? end : undefined).trim();
  const extra = full.slice(full.indexOf("Sgarro sano:"), notesStart).trim();
  return {
    importVersion: IMPORT_VERSION,
    title: "Piano storico 17/09/2026 — da rivedere",
    sourceHash,
    sourceDate: "2026-09-17",
    reviewStatus: "historical-review",
    meals,
    supplements,
    notes:
      "Validità originale 30–40 giorni. Piano storico da rivedere con il professionista.\n\n" +
      notes +
      "\n\n" +
      extra,
    importReport: {
      pages: pages.length,
      sourceHash,
      mealCounts: { OFF: meals.OFF.length, ON: meals.ON.length },
      preservedSource: true,
      reviewRequired: true,
      reviewNotes:
        "Slash, quantità condivise, note condizionali e frequenze conservati testualmente: verificare i gruppi prima di considerarli equivalenze. Nessun valore nutrizionale inventato. Tariffario e recapiti esclusi.",
    },
  };
}
async function importDiet(strapi, buffer, ownerId) {
  const sourceHash = createHash("sha256").update(buffer).digest("hex");
  if (sourceHash !== EXPECTED_HASH)
    throw new Error(
      "PDF diverso dal riferimento verificato: aggiornare e revisionare il parser prima di importare",
    );
  const existing = await strapi.db
    .query("api::nutrition-plan.nutrition-plan")
    .findOne({
      where: { sourceHash, importVersion: IMPORT_VERSION, owner: ownerId },
    });
  if (existing) return { id: existing.id, alreadyImported: true };
  const pages = await extractPdf(buffer),
    data = parsePages(pages, sourceHash);
  return strapi.db.transaction(async () => {
    const plan = await strapi.db
      .query("api::nutrition-plan.nutrition-plan")
      .create({ data: { ...data, owner: ownerId } });
    for (const product of data.supplements) {
      const repo = strapi.db.query(
        "api::supplement-product.supplement-product",
      );
      if (
        !(await repo.findOne({ where: { owner: ownerId, name: product.name } }))
      )
        await repo.create({ data: { ...product, owner: ownerId } });
    }
    for (const name of [
      "Creatine Gummies",
      "Multivitamin Gummies",
      "POWA pre-workout",
    ])
      if (
        !(await strapi.db
          .query("api::supplement-product.supplement-product")
          .findOne({ where: { owner: ownerId, name } }))
      )
        await strapi.db
          .query("api::supplement-product.supplement-product")
          .create({
            data: {
              owner: ownerId,
              name,
              source: "manual",
              instructions:
                "Verificare etichetta e dose con il professionista. Nessuna dose preimpostata.",
              ingredients: name.includes("Creatine")
                ? "Creatina"
                : name.includes("POWA")
                  ? "Caffeina e creatina: verificare etichetta"
                  : "Multivitaminico: verificare etichetta",
            },
          });
    return { id: plan.id, alreadyImported: false, report: data.importReport };
  });
}
module.exports = {
  extractPdf,
  parsePages,
  parseMeal,
  importDiet,
  EXPECTED_HASH,
};
