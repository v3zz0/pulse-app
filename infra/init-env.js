// Creates local secrets without printing or overwriting existing configuration.
const { randomBytes } = require("node:crypto");
const { writeFileSync } = require("node:fs");
const secret = () => randomBytes(32).toString("hex");
const values = {
  DATABASE_NAME: "pulse",
  DATABASE_USERNAME: "pulse",
  DATABASE_PASSWORD: secret(),
  PG_MAINTENANCE_PASSWORD: secret(),
  APP_KEYS: [secret(), secret(), secret(), secret()].join(","),
  ADMIN_JWT_SECRET: secret(),
  API_TOKEN_SALT: secret(),
  TRANSFER_TOKEN_SALT: secret(),
  ENCRYPTION_KEY: secret(),
  JWT_SECRET: secret(),
};
writeFileSync(
  ".env",
  Object.entries(values)
    .map(([k, v]) => `${k}=${v}`)
    .join("\n") + "\n",
  { flag: "wx", mode: 0o600 },
);
console.log(".env creato. Conservare i segreti privatamente.");
