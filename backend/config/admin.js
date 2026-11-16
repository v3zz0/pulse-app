module.exports = ({ env }) => ({
  url: "/admin",
  serveAdminPanel: true,
  auth: {
    secret: env("ADMIN_JWT_SECRET"),
    cookie: { secure: env("PULSE_ENV") === "production", sameSite: "strict" },
  },
  rateLimit: {
    enabled: true,
    interval: { min: 5 },
    max: 5,
    delayAfter: 1,
    timeWait: 1000,
  },
  apiToken: { salt: env("API_TOKEN_SALT") },
  transfer: { token: { salt: env("TRANSFER_TOKEN_SALT") } },
  secrets: { encryptionKey: env("ENCRYPTION_KEY") },
});
