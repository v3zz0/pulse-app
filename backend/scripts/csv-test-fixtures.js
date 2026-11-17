"use strict";
// Never imports personal PDFs or resets existing users/plans. Creates two empty synthetic accounts.
const fs = require("node:fs"),
  { randomBytes } = require("node:crypto");
const { createStrapi, compileStrapi } = require("@strapi/strapi");
(async () => {
  if (process.env.PULSE_TEST_FIXTURES !== "1")
    throw new Error("Opt-in fixture richiesto");
  const app = createStrapi(await compileStrapi());
  await app.load();
  try {
    const role = await app.db
        .query("plugin::users-permissions.role")
        .findOne({ where: { type: "authenticated" } }),
      users = [];
    for (let i = 1; i <= 2; i++) {
      const email = `pulse-csv-test-${i}@example.invalid`,
        repo = app.db.query("plugin::users-permissions.user");
      let user = await repo.findOne({ where: { email } });
      if (user)
        throw new Error(
          "Fixture CSV già presente: riutilizzare il file credenziali protetto, senza reset",
        );
      const password = randomBytes(24).toString("hex");
      const hashed = await app
        .plugin("users-permissions")
        .service("user")
        .ensureHashedPasswords({ password });
      user = await repo.create({
        data: {
          email,
          username: `pulse-csv-test-${i}`,
          provider: "local",
          confirmed: true,
          blocked: false,
          role: role.id,
          ...hashed,
        },
      });
      users.push({ email, password, id: user.id });
    }
    fs.writeFileSync("/testout/csv-credentials.json", JSON.stringify(users), {
      mode: 0o600,
      flag: "wx",
    });
    console.log(
      "PASS: due account CSV sintetici creati senza import o reset; credenziali solo nel file privato.",
    );
  } finally {
    await app.destroy();
  }
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
