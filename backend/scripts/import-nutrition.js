"use strict";
// Run inside backend: node scripts/import-nutrition.js /private/diet.pdf user@example.com
const { readFileSync } = require("node:fs");
const { createStrapi, compileStrapi } = require("@strapi/strapi");
(async () => {
  const [file, email] = process.argv.slice(2);
  if (!file || !email)
    throw new Error(
      "Uso: node scripts/import-nutrition.js file.pdf email-utente",
    );
  const app = createStrapi(await compileStrapi());
  await app.load();
  try {
    const user = await app.db
      .query("plugin::users-permissions.user")
      .findOne({ where: { email } });
    if (!user)
      throw new Error("Creare prima un utente confermato dal pannello Strapi");
    console.log(
      await require("../src/pulse/import-diet").importDiet(
        app,
        readFileSync(file),
        user.id,
      ),
    );
  } finally {
    await app.destroy();
  }
})().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
