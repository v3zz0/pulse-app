// Run via stdin inside the test-only Strapi container.
const { writeFileSync } = require("node:fs");
const { randomBytes } = require("node:crypto");
const { createStrapi, compileStrapi } = require("@strapi/strapi");

(async () => {
  if (process.env.PULSE_ENV === "production" || !process.env.PULSE_TEST_PUSH_OUT)
    throw new Error("Fixture utilizzabili soltanto nello stack locale di test");
  const app = createStrapi(await compileStrapi());
  await app.load();
  try {
    const role = await app.db.query("plugin::users-permissions.role").findOne({ where: { type: "authenticated" } });
    const suffix = randomBytes(6).toString("hex");
    const users = [];
    for (let i = 0; i < 2; i++) {
      const username = "pulse-bg-" + suffix + "-" + i;
      const email = username + "@example.invalid";
      const password = randomBytes(24).toString("hex");
      const credentials = await app.plugin("users-permissions").service("user").ensureHashedPasswords({ password });
      const user = await app.db.query("plugin::users-permissions.user").create({
        data: { username, email, provider: "local", role: role.id, confirmed: true, blocked: false, ...credentials },
      });
      users.push({ email, password, id: user.id });
    }
    writeFileSync("/push-test/users.json", JSON.stringify(users), { mode: 0o600, flag: "wx" });
    console.log("Creati due utenti sintetici nel database locale.");
  } finally { await app.destroy(); }
})().catch(() => { console.error("Impossibile creare gli utenti sintetici."); process.exitCode = 1; });
