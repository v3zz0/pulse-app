"use strict";
const guard = require("../../../pulse/guarded"),
  plans = require("../../../pulse/plans"),
  csv = require("../../../pulse/csv"),
  formats = require("../../../pulse/plan-formats"),
  settings = require("../../../pulse/plan-settings");
module.exports = {
  template: guard(async (ctx, user, app) => {
    const kind = ctx.params.kind;
    ctx.body = {
      filename:
        kind === "nutrition"
          ? "pulse_dieta_esempio.csv"
          : "pulse_allenamento_esempio.csv",
      csv: csv.serialize(kind, formats.exampleRows(kind)),
      prompt: formats.prompt(kind),
      maxBytes: csv.MAX_BYTES,
    };
  }),
  list: guard(async (ctx, user, app) => {
    ctx.body = await plans.list(app, ctx.params.kind, user.id);
  }),
  preview: guard(async (ctx, user, app) => {
    ctx.body = await plans.preview(
      app,
      ctx.params.kind,
      user.id,
      ctx.request.body || {},
    );
  }),
  import: guard(async (ctx, user, app) => {
    ctx.body = await plans.importPlan(
      app,
      ctx.params.kind,
      user.id,
      ctx.request.body || {},
    );
  }),
  detail: guard(async (ctx, user, app) => {
    ctx.body = await plans.detail(app, ctx.params.kind, user.id, ctx.params.id);
  }),
  change: guard(async (ctx, user, app) => {
    ctx.body = await plans.change(
      app,
      ctx.params.kind,
      user.id,
      ctx.params.id,
      ctx.request.body || {},
    );
  }),
  export: guard(async (ctx, user, app) => {
    ctx.body = await plans.exportPlan(
      app,
      ctx.params.kind,
      user.id,
      ctx.params.id,
    );
  }),
  settings: guard(async (ctx, user, app) => {
    ctx.body = await settings.get(app, user.id);
  }),
  saveSettings: guard(async (ctx, user, app) => {
    ctx.body = await settings.save(app, user.id, ctx.request.body || {});
  }),
};
