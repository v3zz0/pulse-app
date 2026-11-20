"use strict";
const guard = require("../../../pulse/guarded");
const push = require("../../../pulse/push");

module.exports = {
  status: guard(async (ctx, user, app) => {
    ctx.body = await push.status(app, user.id, ctx.state.pulseSessionId);
  }),
  register: guard(async (ctx, user, app) => {
    await push.register(app, user.id, ctx.state.pulseSessionId, ctx.request.body);
    ctx.status = 204;
  }),
  remove: guard(async (ctx, user, app) => {
    await push.unregister(app, user.id, ctx.state.pulseSessionId);
    ctx.status = 204;
  }),
  test: guard(async (ctx, user, app) => {
    await push.testDevice(app, user.id, ctx.state.pulseSessionId);
    ctx.status = 204;
  }),
  claim: guard(async (ctx, user, app) => {
    const data = await push.claim(app, user.id, ctx.state.pulseSessionId, ctx.params.receipt);
    if (data) ctx.body = data;
    else ctx.status = 204;
  }),
};
