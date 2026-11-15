const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  extractPdf,
  parsePages,
  EXPECTED_HASH,
} = require("../src/pulse/import-diet");
const { selectedIngredients } = require("../src/pulse/nutrition");
test("PDF originale: pagine, pasti extra, note e separazione composizioni", async () => {
  const file =
    process.env.PULSE_TEST_PDF ||
    path.resolve(
      __dirname,
      "../../PULSE_Starter_Codex_Cloud/references/Dieta Alessandro Vezzoli modifica 4.pdf",
    );
  const pages = await extractPdf(fs.readFileSync(file));
  const plan = parsePages(pages, EXPECTED_HASH);
  assert.equal(pages.length, 7);
  assert.equal(plan.meals.ON.length, 8);
  assert.equal(plan.meals.OFF.length, 6);
  assert.equal(plan.supplements.length, 3);
  assert.match(plan.notes, /Pesare alimenti sempre a crudo/);
  assert.match(plan.notes, /GIORNO SEGUENTE/);
  assert.doesNotMatch(plan.notes, /TARIFFARIO/);
  const breakfast = plan.meals.ON.find((m) => m.id === "ON:breakfast");
  assert.equal(breakfast.menus.length, 4);
  assert.equal(breakfast.menus[3].groups.length, 3);
  const lunch = plan.meals.OFF.find((m) => m.id === "OFF:lunch");
  assert.equal(lunch.menus.length, 2);
  assert.match(lunch.menus[0].notes, /Piselli peso a cotto/);
  assert.ok(
    !selectedIngredients(lunch).some((i) => i.text.startsWith("Piselli")),
  );
  const onLunch = plan.meals.ON.find((m) => m.id === "ON:lunch");
  const protein = onLunch.menus[0].groups.findIndex((g) =>
    g.options.some((o) => o.text.includes("pesce grasso")),
  );
  onLunch.selections[protein] = onLunch.menus[0].groups[
    protein
  ].options.findIndex((o) => o.text.includes("pesce grasso"));
  assert.ok(
    selectedIngredients(onLunch).some((i) =>
      i.text.includes("mezzo cucchiaio"),
    ),
  );
});
