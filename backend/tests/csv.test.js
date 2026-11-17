const { test } = require("node:test"),
  assert = require("node:assert/strict");
const csv = require("../src/pulse/csv"),
  formats = require("../src/pulse/plan-formats"),
  totals = require("../src/pulse/nutrient-totals"),
  plans = require("../src/pulse/plans");
const valid = (kind, rows = formats.exampleRows(kind)) =>
  csv.validate(kind, csv.serialize(kind, rows), "example.csv");
test("BOM, delimiters, Italian decimals, escaped quotes and multiline notes round-trip", () => {
  for (const kind of ["nutrition", "training"]) {
    const rows = formats.exampleRows(kind);
    rows[0].notes = 'Riga "uno"\nRiga due; testo';
    if (kind === "training")
      for (const r of rows)
        if (r.exercise_id === rows[0].exercise_id) r.notes = rows[0].notes;
    const result = valid(kind, rows);
    assert.deepEqual(result.errors, []);
    assert.equal(result.rows[0].notes, rows[0].notes);
    const again = valid(
      kind,
      formats.exportRows(kind, { ...result.plan, csvData: result.rows }),
    );
    assert.deepEqual(again.plan, result.plan);
  }
  const r = formats.exampleRows("nutrition");
  r[0].quantity = "80,5";
  assert.equal(
    valid("nutrition", r).plan.meals.ON[0].menus[0].groups[0].options[0]
      .quantity,
    80.5,
  );
  for (const sep of [",", "\t"]) {
    const encoded = csv.serialize("nutrition", r).replace(/^\uFEFF/, "");
    const parsed = csv.parse(encoded, "f.csv");
    const text = [
      parsed.header.map((s) => '"' + s + '"').join(sep),
      ...parsed.rows.map((r) =>
        parsed.header
          .map((h) => r.data[h])
          .map((s) => '"' + s.replaceAll('"', '""') + '"')
          .join(sep),
      ),
    ].join("\n");
    assert.deepEqual(csv.validate("nutrition", text, "f.csv").errors, []);
  }
});
test("structural errors, duplicate alternatives, unsafe IDs, limits and URLs are blocked", () => {
  assert.throws(() => csv.parse("a\nb", "file.exe"), /\.csv/);
  assert.throws(() => csv.parse('a\n"bad', "file.csv"), /non chiuso/);
  assert.throws(
    () => csv.parse("a\n" + "x".repeat(csv.MAX_BYTES), "file.csv"),
    (e) => e.status === 413,
  );
  assert.throws(() => csv.parse("a\n\u0000", "file.csv"), /controllo/);
  assert(
    valid("nutrition", [
      ...formats.exampleRows("nutrition"),
      formats.exampleRows("nutrition")[0],
    ]).errors.some((e) => /duplicata/.test(e.message)),
  );
  let r = formats.exampleRows("training");
  r[0].day = "__proto__";
  assert(valid("training", r).errors.length);
  for (const url of [
    "javascript:alert(1)",
    "http://example.com",
    "https://127.0.0.1",
    "https://example.com:8080",
    "https://u:p@example.com",
  ]) {
    r = formats.exampleRows("training");
    r[0].video_url = url;
    assert(valid("training", r).errors.length, url);
  }
  r = formats.exampleRows("nutrition");
  r[0].protein_g = "200";
  assert(valid("nutrition", r).errors.some((e) => /105/.test(e.message)));
  r = formats.exampleRows("training");
  r[1].reps_min = "12";
  r[1].reps_max = "8";
  assert(valid("training", r).errors.length);
  assert(
    csv.validate("nutrition", "format_version;plan_id\n1;x", "file.csv").errors
      .length,
  );
});
test("Excel formula protection is literal and reversible, not executable", () => {
  const rows = formats.exampleRows("nutrition");
  for (const value of [
    '=HYPERLINK("https://example.com")',
    "+cmd",
    "-text",
    "@SUM(A1)",
    "'=literal",
    "'quoted",
  ]) {
    rows[0].notes = value;
    const text = csv.serialize("nutrition", rows);
    assert(text.includes("\"'"));
    assert.equal(csv.validate("nutrition", text, "f.csv").rows[0].notes, value);
  }
});
test("nutrient totals choose one alternative per group; missing values stay partial", () => {
  const result = valid("nutrition"),
    meal = result.plan.meals.ON[0];
  let t = totals.mealTotals(meal);
  assert(t.complete);
  assert.equal(t.values.kcal, 445);
  assert.equal(t.status, "estimated");
  meal.selections[0] = 1;
  t = totals.mealTotals(meal);
  assert.equal(t.values.protein_g, 44.1);
  delete meal.menus[0].groups[1].options[0].nutrition.protein_g;
  t = totals.mealTotals(meal);
  assert(!t.complete);
  assert.equal(t.values.kcal, null);
  assert(t.known.kcal > 0);
  const r = formats.exampleRows("nutrition");
  r[0].nutrition_status = "verified";
  const v = valid("nutrition", r);
  assert.equal(
    v.plan.meals.ON[0].menus[0].groups[0].options[0].nutrition.status,
    "declared",
  );
  assert(v.warnings.some((w) => /dichiarata/.test(w.message)));
});
test("circuits do not multiply sets; exact identity is required to transfer loads", () => {
  const p = valid("training").plan;
  assert.equal(p.days.B[0].sets.length, 1);
  assert.equal(p.days.B[0].movements.length, 2);
  assert.equal(p.days.A[0].sets[1].kind, "top-set");
  const next = structuredClone(p),
    s = p.days.A[0].sets[0];
  const matches = plans.candidates(p, next, { [s.id]: 60 });
  assert.equal(matches[0].kg, 60);
  next.days.A[0].name += " diverso";
  assert.equal(plans.candidates(p, next, { [s.id]: 60 }).length, 0);
});
test("signed previews cannot be replayed across owners, purposes or changed data", () => {
  const app = { config: { get: () => ["private-test-secret"] } };
  const t = plans.token(app, 1, "training", "import", "hash");
  assert.doesNotThrow(() =>
    plans.verify(app, t, 1, "training", "import", "hash"),
  );
  for (const args of [
    [2, "training", "import", "hash"],
    [1, "nutrition", "import", "hash"],
    [1, "training", "activate", "hash"],
    [1, "training", "import", "changed"],
  ])
    assert.throws(() => plans.verify(app, t, ...args));
  assert.throws(() =>
    plans.verify(app, t + "x", 1, "training", "import", "hash"),
  );
});
test("circuit movements can prescribe different reps per set without multiplying sets", () => {
  const r = formats.exampleRows("training");
  const circuit = r.filter((x) => x.circuit_id);
  for (const row of circuit)
    r.push({ ...row, set_order: "2", movement_reps: "8" });
  const result = valid("training", r);
  assert.deepEqual(result.errors, []);
  const b = result.plan.days.B[0];
  assert.equal(b.sets.length, 2);
  assert.deepEqual(
    b.sets[1].movements.map((m) => m.reps),
    ["8", "8"],
  );
});

test("prototype property names cannot become plan/day identifiers", () => {
  for (const day of [
    "__proto__",
    "constructor",
    "toString",
    "hasOwnProperty",
  ]) {
    const rows = formats.exampleRows("training");
    rows[0].day = day;
    assert(valid("training", rows).errors.length);
  }
  const { createSnapshot } = require("../src/pulse/workout");
  assert.throws(
    () => createSnapshot({ days: { A: [] } }, "toString", {}, {}),
    (e) => e.status === 404,
  );
});
