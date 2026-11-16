module.exports = ({ env }) => [
  "global::access-log",
  "strapi::errors",
  {
    name: "strapi::security",
    config: {
      hsts:
        env("PULSE_ENV") === "production"
          ? { maxAge: 31536000, includeSubDomains: false }
          : false,
      frameguard: { action: "deny" },
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          "frame-ancestors": ["'none'"],
          upgradeInsecureRequests:
            env("PULSE_ENV") === "production" ? [] : null,
        },
      },
    },
  },
  {
    name: "strapi::cors",
    config: {
      origin: env.array("CORS_ORIGINS", [
        "http://localhost:8080",
        "http://127.0.0.1:8080",
        "http://localhost:8081",
        "http://127.0.0.1:8081",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:1337",
        "http://127.0.0.1:1337",
      ]),
      credentials: true,
      headers: ["Content-Type", "Authorization", "Origin", "Accept"],
      maxAge: 600,
    },
  },
  "strapi::query",
  {
    name: "strapi::body",
    config: {
      jsonLimit: "128kb",
      formLimit: "64kb",
      textLimit: "64kb",
      formidable: {
        maxFileSize: 10 * 1024 * 1024,
        maxTotalFileSize: 10 * 1024 * 1024,
        maxFiles: 4,
      },
    },
  },
  "global::request-guard",
  "strapi::session",
  "strapi::favicon",
  "strapi::public",
];
