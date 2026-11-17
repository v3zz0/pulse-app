"use strict";
// Explicit synthetic fixture only; never infer an association in an imported personal plan.
const { createStrapi, compileStrapi } = require("@strapi/strapi");
(async () => {
  if (process.env.PULSE_TEST_FIXTURES !== "1")
    throw new Error("Opt-in fixture richiesto");
  const app = createStrapi(await compileStrapi());
  await app.load();
  try {
    const owner = await app.db
      .query("plugin::users-permissions.user")
      .findOne({ where: { email: "pulse-csv-test-1@example.invalid" } });
    if (!owner) throw new Error("Fixture mancante");
    const repo = app.db.query("api::training-program.training-program"),
      p = await repo.findOne({
        where: {
          owner: owner.id,
          externalId: "restyle-features-test",
          versionLabel: "1",
        },
      });
    if (
      !p ||
      p.title !== "Test Allenati e Integratori" ||
      p.days.A[0].id !== "A:press1"
    )
      throw new Error("Programma sintetico inatteso");
    const days = structuredClone(p.days);
    days.A[0].flowId = "0025";
    if (p.days.A[0].flowId !== "0025")
      await repo.update({
        where: { id: p.id, owner: owner.id },
        data: { days },
      });
    console.log(
      "Fixture Flow 0025 esplicita aggiunta al solo programma sintetico. Non è una verifica di corrispondenza automatica.",
    );
  } finally {
    await app.destroy();
  }
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
