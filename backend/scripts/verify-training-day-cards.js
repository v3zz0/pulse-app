"use strict";
const assert = require("node:assert/strict");
const { createStrapi, compileStrapi } = require("@strapi/strapi");
(async () => {
  if (process.env.PULSE_TEST_FIXTURES !== "1")
    throw new Error("Opt-in richiesto");
  const app = createStrapi(await compileStrapi());
  await app.load();
  try {
    const users = await app.db
      .query("plugin::users-permissions.user")
      .findMany({
        where: {
          email: {
            $in: [
              "pulse-test-1@example.invalid",
              "pulse-test-2@example.invalid",
              "pulse-csv-test-1@example.invalid",
              "pulse-csv-test-2@example.invalid",
            ],
          },
        },
      });
    const programs = await app.db
      .query("api::training-program.training-program")
      .findMany({
        where: { owner: { $in: users.map((u) => u.id) } },
        populate: { owner: true },
      });
    let count = 0;
    const repo = app.db.query("api::training-day.training-day");
    for (const p of programs) {
      const rows = await repo.findMany({
        where: { program: p.id },
        populate: { owner: true },
      });
      assert.equal(rows.length, Object.keys(p.days).length);
      for (const r of rows) {
        assert.equal(r.owner.id, p.owner.id);
        assert.deepEqual(r.blocks, p.days[r.day]);
        assert.deepEqual(r.cooldown, p.cooldown);
        count++;
      }
    }
    const configuration = await app
      .plugin("content-manager")
      .service("content-types")
      .findConfiguration(app.contentTypes["api::training-day.training-day"]);
    assert.equal(configuration.metadatas.blocks.edit.editable, false);
    assert.equal(configuration.settings.mainField, "title");
    const row = await repo.findOne({ where: { owner: users[0].id } });
    assert(row);
    await assert.rejects(
      () =>
        repo.update({ where: { id: row.id }, data: { title: "invalid edit" } }),
      /generata dal programma/,
    );
    assert.equal(
      (await repo.findOne({ where: { id: row.id } })).title,
      row.title,
    );
    console.log(
      `PASS: ${count} schede separate, contenuto/owner/identificativi preservati, metadata admin non editabili e scrittura diretta bloccata.`,
    );
  } finally {
    await app.destroy();
  }
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
