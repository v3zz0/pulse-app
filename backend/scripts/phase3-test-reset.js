// Explicitly resets phase-3 data only for the two synthetic fixtures. Never personal users.
const { createStrapi, compileStrapi } = require("@strapi/strapi");
(async () => {
  if (process.env.PULSE_TEST_FIXTURES !== "1")
    throw new Error("Opt-in richiesto");
  const app = createStrapi(await compileStrapi());
  await app.load();
  try {
    for (let i = 1; i <= 2; i++) {
      const user = await app.db
        .query("plugin::users-permissions.user")
        .findOne({ where: { email: `pulse-test-${i}@example.invalid` } });
      if (!user) throw new Error("Fixture mancanti");
      for (const name of ["workout-session", "standard-load", "reminder"])
        await app.db
          .query(`api::${name}.${name}`)
          .deleteMany({ where: { owner: user.id } });
    }
    console.log("Reset delle sole fixture sintetiche fase 3.");
  } finally {
    await app.destroy();
  }
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
