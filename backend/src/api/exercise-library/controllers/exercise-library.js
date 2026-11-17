"use strict";
const guard = require("../../../pulse/guarded");
const { text, fail } = require("../../../pulse/validation");
const { note } = require("../../../pulse/editor-content");
const { animatedExercise } = require("../../../pulse/flow/runtime");
const { lock } = require("../../../pulse/plans");
const repository = (app) =>
  app.db.query("api::exercise-library.exercise-library");
const present = (row) => ({ id: row.id, ...row.data });

module.exports = {
  list: guard(async (ctx, user, app) => {
    const results = await repository(app).findMany({
      where: { owner: user.id },
      orderBy: { id: "desc" },
      limit: 500,
    });
    ctx.body = results.map(present);
  }),
  create: guard(async (ctx, user, app) => {
    await lock(app, "training", user.id, async () => {
      const { requestId, name, muscle, equipment, description, notes, flowId } =
        ctx.request.body || {};
      if (
        typeof requestId !== "string" ||
        !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(requestId)
      )
        fail("Operazione non valida");
      const q = repository(app),
        uniqueKey = user.id + ":" + requestId;
      const exists = await q.findOne({ where: { uniqueKey, owner: user.id } });
      if (exists) {
        ctx.body = present(exists);
        return;
      }
      if ((await q.count({ where: { owner: user.id } })) >= 500)
        fail("Libreria personale piena", 409);
      const data = {
        name: text(name, 160),
        muscle: text(muscle, 80),
        equipment: text(equipment, 80),
        description: note(description, 300),
        notes: note(notes),
        flowId: flowId == null ? null : (await animatedExercise(flowId)).id,
      };
      ctx.body = present(
        await q.create({ data: { owner: user.id, uniqueKey, data } }),
      );
    });
  }),
};
