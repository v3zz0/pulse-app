"use strict";
const { requireUser } = require("./auth");
// Keep Strapi's normal parser and its existing limits everywhere else.
module.exports = (original) => (config, runtime) => {
  const normal = original(config, runtime);
  const csv = original(
    { ...config, jsonLimit: "2mb", multipart: false },
    runtime,
  );
  return async (ctx, next) => {
    if (
      ctx.method !== "POST" ||
      !/^\/api\/pulse\/plans\/(nutrition|training)\/(preview|import)$/.test(
        ctx.path,
      )
    )
      return normal(ctx, next);
    // Authenticate and verify Origin before accepting a larger CSV JSON body.
    await requireUser(ctx, runtime.strapi);
    return csv(ctx, next);
  };
};
