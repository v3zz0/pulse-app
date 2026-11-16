// Synthetic admin for the isolated rehearsal DB only; password never printed.
const { createStrapi, compileStrapi } = require("@strapi/strapi");
const fs = require("node:fs");
const { randomBytes } = require("node:crypto");
(async () => {
  if (
    process.env.PULSE_TEST_FIXTURES !== "1" ||
    process.env.DATABASE_NAME !== "pulse_rehearsal"
  )
    throw new Error("Solo database isolato pulse_rehearsal");
  const app = createStrapi(await compileStrapi());
  await app.load();
  try {
    const role = await app.db
      .query("admin::role")
      .findOne({ where: { code: "strapi-super-admin" } });
    if (!role) throw new Error("Ruolo admin mancante");
    const email = "pulse-admin-test@example.invalid",
      password = randomBytes(32).toString("hex") + "Aa1!";
    const existing = await app.db
      .query("admin::user")
      .findOne({ where: { email } });
    const data = {
      email,
      password,
      firstname: "PULSE",
      lastname: "Synthetic",
      isActive: true,
      roles: [role.id],
    };
    data.password = await app.admin.services.auth.hashPassword(password);
    if (existing)
      await app.db
        .query("admin::user")
        .update({ where: { id: existing.id }, data });
    else await app.db.query("admin::user").create({ data });
    fs.writeFileSync(
      "/testout/admin.json",
      JSON.stringify({ email, password }),
      { mode: 0o600 },
    );
    console.log(
      "Admin sintetico creato solo nella copia isolata; credenziali in file privato.",
    );
  } finally {
    await app.destroy();
  }
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
