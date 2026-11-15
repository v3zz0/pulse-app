"use strict";
// Explicit opt-in fixture creation. Synthetic users only; password never printed.
const fs = require("node:fs");
const { randomBytes } = require("node:crypto");
const { createStrapi, compileStrapi } = require("@strapi/strapi");
(async () => {
  if (process.env.PULSE_TEST_FIXTURES !== "1")
    throw new Error("Richiede PULSE_TEST_FIXTURES=1");
  const app = createStrapi(await compileStrapi());
  await app.load();
  try {
    const role = await app.db
      .query("plugin::users-permissions.role")
      .findOne({ where: { type: "authenticated" } });
    const users = [];
    for (let index = 1; index <= 2; index++) {
      const email = `pulse-test-${index}@example.invalid`,
        password = randomBytes(24).toString("hex");
      const existing = await app.db
        .query("plugin::users-permissions.user")
        .findOne({ where: { email } });
      const service = app.plugin("users-permissions").service("user");
      const user = existing
        ? await service.edit(existing.id, { password, confirmed: true })
        : await service.add({
            username: `pulse-test-${index}`,
            email,
            password,
            provider: "local",
            confirmed: true,
            blocked: false,
            role: role.id,
          });
      for (const type of [
        "daily-plan",
        "food-preference",
        "weight-entry",
        "supplement-intake",
        "pulse-session",
      ])
        await app.db
          .query(`api::${type}.${type}`)
          .deleteMany({ where: { owner: user.id } });
      const result = await require("../src/pulse/import-diet").importDiet(
        app,
        fs.readFileSync("/private/Dieta Alessandro Vezzoli modifica 4.pdf"),
        user.id,
      );
      users.push({ email, password, id: user.id, planId: result.id });
    }
    fs.writeFileSync("/testout/credentials.json", JSON.stringify(users), {
      mode: 0o600,
    });
    console.log(
      "Due utenti sintetici e piani privati pronti. Credenziali salvate solo nel file locale protetto.",
    );
  } finally {
    await app.destroy();
  }
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
