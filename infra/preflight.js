// Read-only production configuration validation. Never starts services or changes DNS.
const fs = require("node:fs");
const dns = require("node:dns").promises;
const path = require("node:path");
(async () => {
  const file = process.argv.find((v, i) => i > 1 && !v.startsWith("--"));
  if (!file)
    throw new Error("Uso: node infra/preflight.js file.env [--public]");
  const stat = fs.statSync(file);
  if (stat.mode & 0o077)
    throw new Error("Il file env deve avere permessi 0600");
  const env = {};
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    if (!line.trim() || line.trim().startsWith("#")) continue;
    const i = line.indexOf("=");
    if (i < 1) throw new Error("Riga env non valida");
    env[line.slice(0, i).trim()] = line
      .slice(i + 1)
      .trim()
      .replace(/^['"](.*)['"]$/, "$1");
  }
  for (const key of [
    "DATABASE_PASSWORD",
    "PG_MAINTENANCE_PASSWORD",
    "ADMIN_JWT_SECRET",
    "API_TOKEN_SALT",
    "TRANSFER_TOKEN_SALT",
    "ENCRYPTION_KEY",
    "JWT_SECRET",
  ])
    if (!env[key] || env[key].length < 32)
      throw new Error("Segreto mancante/debole: " + key);
  if (env.DATABASE_USERNAME === "pulse_maintenance")
    throw new Error("Il ruolo manutenzione non può essere usato dall’app");
  if (env.PG_MAINTENANCE_PASSWORD === env.DATABASE_PASSWORD)
    throw new Error("Usare password DB applicativa e manutenzione distinte");
  if (
    (env.APP_KEYS || "").split(",").length < 4 ||
    (env.APP_KEYS || "").split(",").some((k) => k.length < 32)
  )
    throw new Error("APP_KEYS richiede quattro chiavi casuali");
  if (
    !env.ADMIN_ALLOW_CIDRS ||
    /(^|\s)(0\.0\.0\.0\/0|::\/0|private_ranges)(\s|$)/.test(
      env.ADMIN_ALLOW_CIDRS,
    )
  )
    throw new Error("Configurare CIDR admin specifici, non accesso universale");
  if (process.argv.includes("--public")) {
    if (!["0.0.0.0"].includes(env.PULSE_BIND_IP))
      throw new Error("Binding pubblico non configurato");
    if (
      !path
        .normalize(env.TLS_CONFIG || "")
        .endsWith("infra/caddy/tls-public.caddy") ||
      !env.ACME_EMAIL?.includes("@")
    )
      throw new Error("Configurare TLS pubblico e email ACME");
    const expected = (env.PULSE_EXPECTED_IPS || "").split(",").filter(Boolean);
    if (!expected.length)
      throw new Error("Specificare PULSE_EXPECTED_IPS per verificare i DNS");
    for (const host of [
      "pulse.vezzo.vp360web.it",
      "apipulse.vezzo.vp360web.it",
    ]) {
      const addresses = await dns.lookup(host, { all: true });
      if (
        !addresses.length ||
        addresses.some((a) => !expected.includes(a.address))
      )
        throw new Error("DNS mancante o inatteso: " + host);
    }
  }
  console.log(
    "Configurazione valida (" +
      (process.argv.includes("--public")
        ? "DNS verificati"
        : "anteprima privata") +
      "). Questo controllo non autorizza il deploy e non certifica la sicurezza complessiva.",
  );
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
