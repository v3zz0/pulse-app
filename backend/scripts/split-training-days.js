"use strict";
// Default is read-only. Run --apply only after backup/authorization on the intended environment.
const { createStrapi, compileStrapi } = require("@strapi/strapi");
const { sync } = require("../src/pulse/training-day-cards");
(async () => {
  const apply = process.argv.includes("--apply"),
    synthetic = process.argv.includes("--synthetic-only");
  if (apply && process.env.PULSE_SPLIT_TRAINING_DAYS !== "1")
    throw new Error(
      "Richiesto PULSE_SPLIT_TRAINING_DAYS=1 e backup verificato",
    );
  const app = createStrapi(await compileStrapi());
  await app.load();
  try {
    const programs = await app.db
      .query("api::training-program.training-program")
      .findMany({ populate: { owner: true } });
    let programsCount = 0,
      dayCount = 0,
      created = 0,
      updated = 0;
    for (const p of programs) {
      if (
        synthetic &&
        !/^pulse-(?:csv-)?test-[12]@example.invalid$/.test(p.owner?.email || "")
      )
        continue;
      programsCount++;
      dayCount += Object.keys(p.days).length;
      if (apply) {
        const r = await sync(app, p.id);
        created += r.created;
        updated += r.updated;
      }
    }
    console.log(
      JSON.stringify({
        mode: apply ? "applied" : "dry-run",
        programs: programsCount,
        days: dayCount,
        created,
        updated,
      }),
    );
  } finally {
    await app.destroy();
  }
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
