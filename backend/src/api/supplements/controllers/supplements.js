const guard = require("../../../pulse/guarded"),
  service = require("../../../pulse/supplements");
module.exports = {
  create: guard(async (ctx, u, a) => {
    ctx.body = await service.saveProduct(a, u.id, null, ctx.request.body || {});
  }),
  update: guard(async (ctx, u, a) => {
    ctx.body = await service.saveProduct(
      a,
      u.id,
      ctx.params.id,
      ctx.request.body || {},
    );
  }),
  dashboard: guard(async (ctx, u, a) => {
    ctx.body = await service.dashboard(a, u.id, ctx.params.day);
  }),
  mode: guard(async (ctx, u, a) => {
    ctx.body = await service.saveMode(
      a,
      u.id,
      ctx.params.day,
      ctx.request.body || {},
    );
  }),
  history: guard(async (ctx, u, a) => {
    ctx.body = await service.history(
      a,
      u.id,
      ctx.query.from,
      ctx.query.to,
      ctx.query.offset || 0,
    );
  }),
};
