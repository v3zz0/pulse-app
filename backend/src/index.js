module.exports = {
  register({ strapi }) {
    strapi
      .get("middlewares")
      .extend("strapi::body", require("./pulse/csv-body"));
  },
  async bootstrap({ strapi }) {
    if (process.env.PULSE_ENV === "production") {
      // I domini arrivano dall'ambiente (PULSE_PUBLIC_ORIGIN / PULSE_API_URL nel compose):
      // devono essere due origini https pure (senza path o slash finale) e diverse tra loro.
      const isOrigin = (v) => {
        try {
          const u = new URL(v);
          return u.protocol === "https:" && v === u.origin;
        } catch {
          return false;
        }
      };
      if (
        !isOrigin(process.env.PUBLIC_ORIGIN) ||
        !isOrigin(process.env.PUBLIC_API_URL) ||
        process.env.PUBLIC_ORIGIN === process.env.PUBLIC_API_URL ||
        process.env.TRUST_PROXY !== "true"
      )
        throw new Error("Configurazione produzione: verificare domini e proxy");
      for (const key of [
        "APP_KEYS",
        "ADMIN_JWT_SECRET",
        "API_TOKEN_SALT",
        "TRANSFER_TOKEN_SALT",
        "ENCRYPTION_KEY",
        "JWT_SECRET",
        "DATABASE_PASSWORD",
      ])
        if (!process.env[key] || process.env[key].length < 32)
          throw new Error("Segreto produzione mancante o troppo corto: " + key);
    }

    const store = strapi.store({ type: "plugin", name: "users-permissions" });
    const advanced = await store.get({ key: "advanced" });
    await store.set({
      key: "advanced",
      value: { ...advanced, allow_register: false },
    });
  },
};
