"use strict";
// Explicit recovery after /tmp cleanup. Exact known .invalid fixtures only; no plan/data reset.
const fs = require("node:fs");
const { randomBytes } = require("node:crypto");
const { createStrapi, compileStrapi } = require("@strapi/strapi");
(async () => {
  if (
    process.env.PULSE_TEST_FIXTURES !== "1" ||
    process.env.PULSE_TEST_CREDENTIAL_RECOVERY !== "1"
  )
    throw new Error("Opt-in esplicito richiesto");
  const app = createStrapi(await compileStrapi());
  await app.load();
  try {
    for (const [prefix, output] of [
      ["pulse-test", "/testout/main/credentials.json"],
      ["pulse-csv-test", "/testout/csv/csv-credentials.json"],
    ]) {
      if (fs.existsSync(output))
        throw new Error("Il file credenziali esiste già: riutilizzarlo");
      const users = [];
      for (let i = 1; i <= 2; i++) {
        const email = `${prefix}-${i}@example.invalid`,
          repo = app.db.query("plugin::users-permissions.user");
        const user = await repo.findOne({
          where: { email, username: `${prefix}-${i}`, provider: "local" },
        });
        if (!user || user.blocked || !user.confirmed)
          throw new Error(
            "Fixture esatta mancante: nessun nuovo account creato",
          );
        const password = randomBytes(24).toString("hex");
        const data = await app
          .plugin("users-permissions")
          .service("user")
          .ensureHashedPasswords({ password });
        await repo.update({ where: { id: user.id }, data });
        await app.db
          .query("api::pulse-session.pulse-session")
          .deleteMany({ where: { owner: user.id } });
        users.push({ email, password, id: user.id });
      }
      fs.writeFileSync(output, JSON.stringify(users), {
        mode: 0o600,
        flag: "wx",
      });
    }
    console.log(
      "PASS: recuperate solo credenziali dei quattro account sintetici; piani, sessioni workout e storico invariati.",
    );
  } finally {
    await app.destroy();
  }
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
