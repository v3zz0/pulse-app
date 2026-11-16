module.exports =
  (_, { strapi }) =>
  async (ctx, next) => {
    const start = Date.now();
    try {
      await next();
    } finally {
      const group = ctx.path.startsWith("/api/pulse/")
        ? "pulse"
        : ctx.path.startsWith("/admin")
          ? "admin"
          : "http";
      // Deliberately exclude URL/query, body, credentials, cookies and user identifiers.
      strapi.log.http(
        `request group=${group} method=${ctx.method} status=${ctx.status} ms=${Date.now() - start}`,
      );
    }
  };
