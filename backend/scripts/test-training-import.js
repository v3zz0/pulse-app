"use strict";
// Requires the explicitly created synthetic phase-2 fixture users; never personal accounts.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { createStrapi, compileStrapi } = require("@strapi/strapi");
(async () => {
  if (process.env.PULSE_TEST_FIXTURES !== "1")
    throw new Error("Richiede PULSE_TEST_FIXTURES=1");
  const app = createStrapi(await compileStrapi());
  await app.load();
  try {
    const { importTraining } = require("../src/pulse/import-training");
    const buffer = fs.readFileSync("/private/Scheda-palestra.PDF");
    const ids = [];
    for (let i = 1; i <= 2; i++) {
      const user = await app.db
        .query("plugin::users-permissions.user")
        .findOne({ where: { email: `pulse-test-${i}@example.invalid` } });
      assert.ok(user, "Creare prima le fixture sintetiche");
      const [a, b] = await Promise.all([
        importTraining(app, buffer, user.id),
        importTraining(app, buffer, user.id),
      ]);
      assert.equal(a.id, b.id);
      assert.ok(a.alreadyImported || b.alreadyImported);
      ids.push(a.id);
      const rows = await app.db
        .query("api::training-program.training-program")
        .findMany({ where: { owner: user.id } });
      assert.equal(rows.length, 1);
      assert.equal(rows[0].days.C[7].sets.length, 3);
    }
    assert.notEqual(ids[0], ids[1]);
    console.log(
      "PASS PostgreSQL: import A/B/C per due utenti sintetici, isolamento e idempotenza.",
    );
  } finally {
    await app.destroy();
  }
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
