module.exports = ({ env }) => ({
  host: env("HOST", "0.0.0.0"),
  port: env.int("PORT", 1337),
  url: env("PUBLIC_API_URL", ""),
  proxy: {
    koa: env.bool("TRUST_PROXY", false),
    ipHeader: "X-Forwarded-For",
    maxIpsCount: 1,
  },
  cron: {
    enabled: Boolean(env("PULSE_WEB_PUSH_PUBLIC_KEY", "")),
    tasks: {
      pulsePush: {
        options: { rule: "*/30 * * * * *", tz: "Europe/Rome" },
        task: async ({ strapi }) => {
          try { await require("../src/pulse/push").run(strapi); }
          catch { strapi.log.warn("Web Push: errore nel controllo dei promemoria"); }
        },
      },
    },
  },
  app: { keys: env.array("APP_KEYS") },
});
