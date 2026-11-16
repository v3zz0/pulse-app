module.exports = {
  async bootstrap({ strapi }) {
    if (process.env.PULSE_ENV === "production") {
      if (
        process.env.PUBLIC_ORIGIN !== "https://pulse.vezzo.vp360web.it" ||
        process.env.PUBLIC_API_URL !== "https://apipulse.vezzo.vp360web.it" ||
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
