const guard = require("../../../pulse/guarded"),
  flow = require("../../../pulse/flow/runtime");
module.exports = {
  exercise: guard(async (ctx) => {
    ctx.body = await flow.exercise(ctx.params.id);
  }),
  asset: guard(async (ctx) => {
    const { raw, sha } = await flow.asset(
      ctx.params.revision,
      ctx.params.id,
      ctx.params.frame,
    );
    ctx.set("Content-Type", "image/svg+xml");
    ctx.set("X-Content-Type-Options", "nosniff");
    ctx.set("Content-Security-Policy", "default-src 'none'; sandbox");
    ctx.set("Cache-Control", "private, max-age=31536000, immutable");
    ctx.set("ETag", '"' + sha + '"');
    ctx.body = raw;
  }),
};
