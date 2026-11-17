"use strict";
const { createHash } = require("node:crypto");
const { fail } = require("./validation");
const MAX_BYTES = 512 * 1024,
  MAX_ROWS = 1000;
const BASE = ["format_version", "plan_id", "plan_name", "plan_version"];
const NUTRITION = [
  ...BASE,
  "day",
  "meal_order",
  "meal_name",
  "meal_time",
  "menu_id",
  "menu_name",
  "food_group",
  "alternative_id",
  "food_name",
  "quantity",
  "unit",
  "food_state",
  "nutrient_basis",
  "basis_quantity",
  "kcal",
  "protein_g",
  "carbs_g",
  "fat_g",
  "nutrition_source",
  "nutrition_status",
  "notes",
  "tags",
  "meal_notes",
  "menu_notes",
  "group_notes",
  "plan_notes",
];
const TRAINING = [
  ...BASE,
  "day",
  "exercise_order",
  "exercise_id",
  "exercise_name",
  "set_type",
  "set_order",
  "reps",
  "reps_min",
  "reps_max",
  "standard_kg",
  "rest_seconds",
  "rest_text",
  "to_failure",
  "per_leg",
  "circuit_id",
  "movement_order",
  "movement_name",
  "movement_reps",
  "notes",
  "video_url",
  "video_review",
  "cooldown",
  "cooldown_seconds",
  "prescription",
  "source_text",
  "video_movement",
  "video_notes",
];
const columns = (kind) =>
  kind === "nutrition"
    ? NUTRITION
    : kind === "training"
      ? TRAINING
      : fail("Tipo piano non valido", 404);
const digest = (text) => createHash("sha256").update(text).digest("hex");
const dangerous = /^[\s]*[=+\-@\t\r]/;
// Excel formula protection is reversible by this importer; formulas are never evaluated.
const escapeSheet = (s) =>
  dangerous.test(s) || s.startsWith("'") ? "'" + s : s;
const unescapeSheet = (s) =>
  s.startsWith("'") && (dangerous.test(s.slice(1)) || s.startsWith("''"))
    ? s.slice(1)
    : s;
function serialize(kind, rows) {
  const fields = columns(kind);
  const cell = (value) =>
    '"' + escapeSheet(String(value ?? "")).replaceAll('"', '""') + '"';
  return (
    "\uFEFF" +
    [
      fields.join(";"),
      ...rows.map((r) => fields.map((k) => cell(r[k])).join(";")),
    ].join("\r\n") +
    "\r\n"
  );
}
function parse(text, filename) {
  if (
    typeof filename !== "string" ||
    filename.length > 180 ||
    !/\.csv$/i.test(filename)
  )
    fail("Seleziona un file .csv");
  if (typeof text !== "string" || !text.isWellFormed() || !text.trim())
    fail("CSV UTF-8 vuoto o non valido");
  if (Buffer.byteLength(text, "utf8") > MAX_BYTES)
    fail("CSV troppo grande: massimo 512 KiB", 413);
  if (/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(text))
    fail("Il CSV contiene caratteri di controllo non ammessi");
  text = text.replace(/^\uFEFF/, "");
  let quote = false,
    counts = { ";": 0, ",": 0, "\t": 0 };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quote && text[i + 1] === '"') i++;
      else quote = !quote;
    } else if (!quote && (c === "\r" || c === "\n")) break;
    else if (!quote && Object.hasOwn(counts, c)) counts[c]++;
  }
  const separator = Object.keys(counts).sort(
    (a, b) => counts[b] - counts[a],
  )[0];
  let records = [],
    cells = [],
    value = "",
    quoted = false,
    closed = false,
    line = 1,
    rowLine = 1;
  const endCell = () => {
    if (value.length > 16000)
      fail(`Riga ${rowLine}: campo oltre 16.000 caratteri`);
    cells.push(unescapeSheet(value));
    if (cells.length > 64) fail(`Riga ${rowLine}: troppe colonne`);
    value = "";
    closed = false;
  };
  const endRow = () => {
    endCell();
    if (cells.some((c) => c !== "")) records.push({ line: rowLine, cells });
    cells = [];
    if (records.length > MAX_ROWS + 1) fail(`Massimo ${MAX_ROWS} righe dati`);
  };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          value += '"';
          i++;
        } else {
          quoted = false;
          closed = true;
        }
      } else {
        value += c;
        if (c === "\n") line++;
      }
    } else if (c === separator) endCell();
    else if (c === "\r" || c === "\n") {
      endRow();
      if (c === "\r" && text[i + 1] === "\n") i++;
      line++;
      rowLine = line;
    } else if (c === '"' && value === "" && !closed) quoted = true;
    else if (closed || c === '"')
      fail(`Riga ${line}: virgolette o separatori non validi`);
    else value += c;
  }
  if (quoted) fail(`Riga ${rowLine}: campo tra virgolette non chiuso`);
  if (value || closed || cells.length) endRow();
  if (records.length < 2)
    fail("Il CSV deve contenere intestazioni e almeno una riga");
  const header = records.shift().cells.map((v) => v.trim());
  if (new Set(header).size !== header.length || header.some((h) => !h))
    fail("Intestazioni duplicate o vuote");
  return {
    separator,
    header,
    rows: records.map((r) => {
      if (r.cells.length !== header.length)
        fail(
          `Riga ${r.line}: attese ${header.length} colonne, trovate ${r.cells.length}`,
        );
      return {
        line: r.line,
        data: Object.fromEntries(header.map((h, i) => [h, r.cells[i].trim()])),
      };
    }),
  };
}
const id = (s, label) => {
  if (
    ["__proto__", "prototype", "constructor"].includes(s) ||
    Object.hasOwn(Object.prototype, s) ||
    !/^[a-zA-Z0-9_:.\-]{1,80}$/.test(s)
  )
    fail(`${label}: identificativo non valido (massimo 80 caratteri)`);
  return s;
};
const number = (s, label, max = 100000, optional = true) => {
  if (s === "" && optional) return null;
  if (!/^\d+(?:[.,]\d+)?$/.test(s))
    fail(`${label}: numero non valido; usa 12,5 oppure 12.5, senza migliaia`);
  const n = Number(s.replace(",", "."));
  if (!Number.isFinite(n) || n > max) fail(`${label}: valore fuori intervallo`);
  return n;
};
const integer = (s, label, max) => {
  const n = number(s, label, max, false);
  if (!Number.isInteger(n) || n < 1)
    fail(`${label}: intero positivo richiesto`);
  return n;
};
const bool = (s, label) => {
  if (!["", "true", "false"].includes(s))
    fail(`${label}: usa true/false o vuoto`);
  return s === "true";
};
function url(s) {
  if (!s) return null;
  try {
    const u = new URL(s);
    if (
      u.protocol !== "https:" ||
      u.username ||
      u.password ||
      u.port ||
      !u.hostname.includes(".") ||
      /^(localhost|127\.|0\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/.test(
        u.hostname,
      ) ||
      u.hostname.startsWith("[")
    )
      throw 0;
    return s;
  } catch {
    fail("URL video non valido: usa HTTPS pubblico, senza credenziali o porte");
  }
}
const consistent = (object, key, value, label) => {
  if (
    Object.hasOwn(object, key) &&
    JSON.stringify(object[key]) !== JSON.stringify(value)
  )
    fail(`${label}: valori contraddittori nelle righe dello stesso gruppo`);
  object[key] = value;
};
function optionalText(object, key, value, label) {
  if (!value) {
    if (!Object.hasOwn(object, key)) object[key] = "";
    return;
  }
  if (object[key] && object[key] !== value)
    fail(`${label}: valori contraddittori`);
  object[key] = value;
}
const nutritionValues = (r, warnings, line) => {
  const v = Object.fromEntries(
    ["kcal", "protein_g", "carbs_g", "fat_g"].map((k) => [
      k,
      number(r[k], k, k === "kcal" ? 10000 : 1000),
    ]),
  );
  if (!["", "per_100g", "per_portion"].includes(r.nutrient_basis))
    fail("nutrient_basis: usa per_100g o per_portion");
  if (!["", "estimated", "declared", "verified"].includes(r.nutrition_status))
    fail("nutrition_status non valido");
  const basisQuantity = number(r.basis_quantity, "basis_quantity", 100000);
  if (r.nutrient_basis === "per_portion" && (!basisQuantity || !r.unit))
    fail(
      "Per porzione serve basis_quantity > 0 nella stessa unità dell’alimento",
    );
  const any = Object.values(v).some((n) => n !== null),
    complete = Object.values(v).every((n) => n !== null);
  if (!complete || !r.nutrition_source || !r.nutrient_basis)
    warnings.push({
      line,
      message:
        "Nutrienti o fonte mancanti: totali parziali, valori non inventati",
    });
  if (any && !r.nutrient_basis)
    fail("Specificare nutrient_basis per i valori nutrizionali");
  if (r.nutrient_basis === "per_100g" && r.unit !== "g")
    fail(
      "I dati per 100 g richiedono quantità in g; nessuna conversione automatica da ml o pezzi",
    );
  if (
    r.nutrient_basis === "per_100g" &&
    [v.protein_g, v.carbs_g, v.fat_g]
      .filter((x) => x !== null)
      .reduce((a, b) => a + b, 0) > 105
  )
    fail("Macronutrienti oltre 105 g per 100 g: valori incoerenti");
  if (complete) {
    const energy = 4 * v.protein_g + 4 * v.carbs_g + 9 * v.fat_g;
    if (Math.abs(energy - v.kcal) > Math.max(30, 0.2 * v.kcal))
      warnings.push({
        line,
        message:
          "Calorie e macro non coerenti: verificare fibre, alcol, fonte e base",
      });
  }
  if (r.nutrition_status === "verified")
    warnings.push({
      line,
      message:
        "Verifica dichiarata nel file, non confermata da PULSE: controllare la fonte prima della revisione esplicita",
    });
  return {
    ...v,
    basis: r.nutrient_basis || null,
    basisQuantity,
    source: r.nutrition_source,
    status: r.nutrition_status === "estimated" ? "estimated" : "declared",
    claimedStatus: r.nutrition_status || "declared",
  };
};
function validate(kind, text, filename) {
  const errors = [],
    warnings = [],
    fields = columns(kind);
  let parsed;
  try {
    parsed = parse(text, filename);
  } catch (e) {
    if (e.status === 413) throw e;
    return {
      errors: [{ line: 1, message: e.message }],
      warnings,
      rows: [],
      plan: null,
    };
  }
  const required =
    kind === "nutrition"
      ? [
          ...BASE,
          "day",
          "meal_order",
          "meal_name",
          "menu_id",
          "food_group",
          "alternative_id",
          "food_name",
        ]
      : [
          ...BASE,
          "day",
          "exercise_order",
          "exercise_id",
          "exercise_name",
          "set_type",
          "set_order",
        ];
  for (const field of required)
    if (!parsed.header.includes(field))
      errors.push({
        line: 1,
        message: `Colonna obbligatoria mancante: ${field}`,
      });
  for (const field of parsed.header)
    if (!fields.includes(field))
      errors.push({ line: 1, message: `Colonna sconosciuta: ${field}` });
  if (errors.length) return { errors, warnings, rows: [], plan: null };
  const rows = [],
    identity = {},
    meals = {},
    days = {},
    seen = new Set();
  let cooldown = null;
  for (const { line, data } of parsed.rows) {
    const r = Object.fromEntries(fields.map((k) => [k, data[k] || ""]));
    rows.push(r);
    try {
      if (r.format_version !== "1") fail("format_version deve essere 1");
      id(r.plan_id, "plan_id");
      if (!r.plan_name || r.plan_name.length > 160)
        fail("plan_name richiesto, massimo 160 caratteri");
      if (!r.plan_version || r.plan_version.length > 80)
        fail("plan_version richiesto, massimo 80 caratteri");
      for (const k of ["plan_id", "plan_name", "plan_version"])
        consistent(identity, k, r[k], k);
      if (kind === "nutrition") {
        if (!["ON", "OFF"].includes(r.day)) fail("day deve essere ON o OFF");
        const order = integer(r.meal_order, "meal_order", 20);
        if (!r.meal_name || r.meal_name.length > 160)
          fail("meal_name richiesto, massimo 160 caratteri");
        if (r.meal_time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(r.meal_time))
          fail("meal_time: usare HH:MM o vuoto");
        for (const k of ["menu_id", "food_group", "alternative_id"])
          id(r[k], k);
        if (!r.food_name) fail("food_name richiesto");
        const unique = [
          r.day,
          order,
          r.menu_id,
          r.food_group,
          r.alternative_id,
        ].join("|");
        if (seen.has(unique))
          fail(
            "Alternativa duplicata nello stesso gruppo; gli alimenti complementari devono avere gruppi distinti",
          );
        seen.add(unique);
        const quantity = number(r.quantity, "quantity");
        if (quantity === 0) fail("quantity deve essere positiva o assente");
        if (
          quantity !== null &&
          !["g", "ml", "piece", "portion"].includes(r.unit)
        )
          fail("unit deve essere g, ml, piece o portion");
        if (!["", "raw", "cooked", "as_sold"].includes(r.food_state))
          fail("food_state deve essere raw, cooked, as_sold o vuoto");
        if (quantity === null)
          warnings.push({
            line,
            message: "Quantità assente: da verificare, nessun totale inventato",
          });
        const n = nutritionValues(r, warnings, line);
        const mealKey = `${r.day}:${order}`;
        const m = (meals[mealKey] ||= {
          id: mealKey,
          order,
          menus: [],
          consumedAt: null,
        });
        for (const [k, v] of Object.entries({
          name: r.meal_name,
          time: r.meal_time,
        }))
          consistent(m, k, v, k);
        optionalText(m, "sourceText", r.meal_notes, "meal_notes");
        let menu = m.menus.find((m) => m.id === r.menu_id);
        if (!menu) {
          menu = { id: r.menu_id, groups: [] };
          m.menus.push(menu);
        }
        consistent(menu, "title", r.menu_name || r.menu_id, "menu_name");
        optionalText(menu, "notes", r.menu_notes, "menu_notes");
        let group = menu.groups.find((g) => g.id === r.food_group);
        if (!group) {
          group = { id: r.food_group, options: [] };
          menu.groups.push(group);
        }
        optionalText(group, "sourceText", r.group_notes, "group_notes");
        if (
          m.menus.length > 20 ||
          menu.groups.length > 30 ||
          group.options.length >= 30
        )
          fail("Troppi menu, gruppi o alternative");
        group.options.push({
          id: `csv:${digest(JSON.stringify([r.plan_id, r.day, order, r.menu_id, r.food_group, r.alternative_id, r.food_name, r.food_state])).slice(0, 32)}`,
          alternativeId: r.alternative_id,
          text:
            r.food_name + (quantity !== null ? ` · ${quantity} ${r.unit}` : ""),
          foodName: r.food_name,
          quantity,
          unit: r.unit,
          foodState: r.food_state,
          nutrition: n,
          notes: r.notes,
          tags: r.tags,
          reviewRequired: true,
        });
        m.menuIndex = 0;
        m.selections = m.menus[0].groups.map(() => 0);
        optionalText(identity, "plan_notes", r.plan_notes, "plan_notes");
      } else {
        if (!r.exercise_name || r.exercise_name.length > 200)
          fail("exercise_name richiesto, massimo 200 caratteri");
        if (bool(r.cooldown, "cooldown")) {
          const duration = number(r.cooldown_seconds, "cooldown_seconds", 3600);
          if (
            duration !== null &&
            (!Number.isInteger(duration) || duration < 1)
          )
            fail("cooldown_seconds deve essere positivo o assente");
          const entry = {
            name: r.exercise_name,
            durationSeconds: duration,
            sourceText: r.source_text || r.notes,
            videos: r.video_url
              ? [
                  {
                    url: url(r.video_url),
                    reviewRequired: true,
                    candidateMovement: r.video_movement,
                    reviewNote: r.video_notes,
                  },
                ]
              : [],
          };
          if (cooldown) {
            const { videos: priorVideos, ...prior } = cooldown,
              { videos: nextVideos, ...next } = entry;
            if (JSON.stringify(prior) !== JSON.stringify(next))
              fail("Defaticamento contraddittorio");
            for (const v of nextVideos)
              if (!priorVideos.some((p) => p.url === v.url))
                priorVideos.push(v);
          } else cooldown = entry;
          continue;
        }
        id(r.day, "day");
        if (r.day.length > 20 || !/^[a-zA-Z0-9_.-]+$/.test(r.day))
          fail("day: massimo 20 lettere, numeri, punti, trattini o underscore");
        const order = integer(r.exercise_order, "exercise_order", 100),
          setOrder = integer(r.set_order, "set_order", 50);
        id(r.exercise_id, "exercise_id");
        if (
          ![
            "warmup",
            "top-set",
            "back-off",
            "work",
            "circuit",
            "superset",
          ].includes(r.set_type)
        )
          fail("set_type non valido");
        const min = number(r.reps_min, "reps_min", 1000),
          max = number(r.reps_max, "reps_max", 1000);
        if (
          (min === null) !== (max === null) ||
          (min !== null &&
            (!Number.isInteger(min) || !Number.isInteger(max) || min > max))
        )
          fail("Intervallo ripetizioni non valido");
        const explicitRange = r.reps.match(/^(\d+)[-–](\d+)$/);
        if (
          min !== null &&
          explicitRange &&
          (Number(explicitRange[1]) !== min || Number(explicitRange[2]) !== max)
        )
          fail("reps e intervallo reps_min/reps_max contraddittori");
        if (
          min !== null &&
          /^\d+$/.test(r.reps) &&
          (Number(r.reps) < min || Number(r.reps) > max)
        )
          fail("reps fuori dall’intervallo dichiarato");
        const kg = number(r.standard_kg, "standard_kg", 1500),
          rest = number(r.rest_seconds, "rest_seconds", 3600);
        if (kg !== null && Math.abs(kg * 100 - Math.round(kg * 100)) > 1e-8)
          fail("standard_kg: massimo due decimali");
        if (rest !== null && (!Number.isInteger(rest) || rest < 1))
          fail("rest_seconds: intero positivo o vuoto");
        if (rest !== null && /[?\/]|\d\s*[-–]\s*\d/.test(r.rest_text))
          fail(
            "Recupero testuale ambiguo: lascia rest_seconds vuoto e conserva rest_text",
          );
        if (rest === null && r.rest_text)
          warnings.push({
            line,
            message: "Recupero senza secondi confermati: timer manuale",
          });
        const toFailure =
            r.to_failure === "" ? null : bool(r.to_failure, "to_failure"),
          perLeg = r.per_leg === "" ? null : bool(r.per_leg, "per_leg");
        if (r.circuit_id) id(r.circuit_id, "circuit_id");
        if (["circuit", "superset"].includes(r.set_type) && !r.circuit_id)
          fail("Circuiti/superset richiedono circuit_id e movimenti");
        const d = (days[r.day] ||= []);
        let block = d.find((b) => b.exerciseId === r.exercise_id);
        if (!block) {
          block = {
            id: `${r.day}:${r.exercise_id}`,
            exerciseId: r.exercise_id,
            order,
            name: r.exercise_name,
            sets: [],
            movements: [],
            videos: [],
          };
          d.push(block);
        }
        if (d.length > 60 || Object.keys(days).length > 12)
          fail("Massimo 12 giorni e 60 esercizi per giorno");
        for (const [k, v] of Object.entries({
          order,
          name: r.exercise_name,
          restSeconds: rest,
          restRaw: r.rest_text,
          notes: r.notes,
          circuitId: r.circuit_id,
          sourceText: r.source_text,
          prescriptionRaw: r.prescription,
        }))
          consistent(block, k, v, k);
        const phase = block.sets.length ? block.phase : r.set_type;
        block.phase = phase;
        const set = {
          id: `${block.id}:${setOrder}`,
          order: setOrder,
          kind: r.set_type,
          reps: r.reps || (min !== null ? `${min}-${max}` : "Da verificare"),
          repsMin: min,
          repsMax: max,
          toFailure,
          perLeg,
          standardKg: kg,
        };
        const prior = block.sets.find((s) => s.order === setOrder);
        if (
          prior &&
          JSON.stringify({ ...prior, movements: undefined }) !==
            JSON.stringify(set)
        )
          fail("Serie duplicata con prescrizioni contraddittorie");
        if (!prior) {
          set.movements = [];
          block.sets.push(set);
        }
        const currentSet = prior || set;
        let movement = null;
        if (r.movement_name) {
          const mo = integer(r.movement_order, "movement_order", 20);
          movement = {
            order: mo,
            name: r.movement_name,
            reps: r.movement_reps || "Da verificare",
          };
          const prev = block.movements.find((m) => m.order === mo);
          if (prev && prev.name !== movement.name)
            fail("Nome movimento contraddittorio");
          const priorMove = currentSet.movements.find((m) => m.order === mo);
          if (
            priorMove &&
            JSON.stringify(priorMove) !== JSON.stringify(movement)
          )
            fail("Ripetizioni movimento contraddittorie nella stessa serie");
          if (!priorMove) currentSet.movements.push(movement);
          if (!prev) block.movements.push(movement);
        } else if (r.circuit_id)
          fail("Specificare movimento e ordine nel circuito");
        const unique = [
          r.day,
          r.exercise_id,
          setOrder,
          movement?.order || "",
          r.video_url,
        ].join("|");
        if (seen.has(unique)) fail("Riga/serie duplicata");
        seen.add(unique);
        if (!["", "needs-review", "confirmed"].includes(r.video_review))
          fail("video_review non valido");
        if (r.video_url) {
          url(r.video_url);
          warnings.push({
            line,
            message:
              "Video importato da revisionare: il CSV non certifica l’associazione",
          });
          if (!block.videos.some((v) => v.url === r.video_url))
            block.videos.push({
              url: r.video_url,
              reviewRequired: true,
              candidateMovement: r.video_movement || r.movement_name,
              reviewNote: r.video_notes,
              claimedReview: r.video_review,
            });
        }
        block.reviewRequired = rest === null && !!r.rest_text;
        if (!r.reps && min === null)
          warnings.push({
            line,
            message: "Ripetizioni non definite: conservate come da verificare",
          });
      }
    } catch (e) {
      errors.push({ line, message: e.message });
    }
  }
  let plan;
  if (kind === "nutrition") {
    const byDay = { ON: [], OFF: [] };
    for (const m of Object.values(meals)) byDay[m.id.split(":")[0]].push(m);
    for (const mode of ["ON", "OFF"]) {
      byDay[mode].sort((a, b) => a.order - b.order);
      if (!byDay[mode].length)
        errors.push({
          line: 1,
          message: `Manca il giorno ${mode}; il piano completo richiede ON e OFF`,
        });
    }
    plan = {
      title: identity.plan_name,
      externalId: identity.plan_id,
      versionLabel: identity.plan_version,
      notes: identity.plan_notes,
      meals: byDay,
    };
  } else {
    for (const blocks of Object.values(days)) {
      blocks.sort((a, b) => a.order - b.order);
      if (new Set(blocks.map((b) => b.order)).size !== blocks.length)
        errors.push({
          line: 1,
          message: "Ordini esercizio duplicati nello stesso giorno",
        });
      for (const b of blocks) {
        b.sets.sort((a, b) => a.order - b.order);
        for (const s of b.sets) {
          s.movements.sort((a, b) => a.order - b.order);
          if (b.circuitId && s.movements.length !== b.movements.length)
            errors.push({
              line: 1,
              message: `Circuito ${b.exerciseId}: movimenti incompleti nella serie ${s.order}`,
            });
        }
        b.phase =
          new Set(b.sets.map((s) => s.kind)).size > 1
            ? "mixed"
            : b.sets[0]?.kind;
        b.movements.sort((a, b) => a.order - b.order);
      }
    }
    if (!Object.keys(days).length)
      errors.push({ line: 1, message: "Nessun giorno di allenamento" });
    if (!cooldown) {
      warnings.push({
        line: 1,
        message: "Defaticamento non fornito: nessuna durata inventata",
      });
      cooldown = {
        name: "Defaticamento non specificato",
        durationSeconds: null,
        sourceText: "Da verificare con il preparatore",
        videos: [],
      };
    }
    plan = {
      title: identity.plan_name,
      externalId: identity.plan_id,
      versionLabel: identity.plan_version,
      days,
      cooldown,
    };
  }
  return {
    errors,
    warnings,
    rows,
    plan,
    sourceHash: digest(serialize(kind, rows)),
    separator: parsed.separator,
  };
}
module.exports = {
  columns,
  serialize,
  parse,
  validate,
  digest,
  MAX_BYTES,
  MAX_ROWS,
  url,
};
