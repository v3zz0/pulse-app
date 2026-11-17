"use strict";
const { fail } = require("./validation");
const names = { nutrition: "nutrition-plan", training: "training-program" };
function repo(app, kind) {
  const n = names[kind];
  if (!n) fail("Tipo piano non valido", 404);
  return app.db.query(`api::${n}.${n}`);
}
async function activePlan(app, kind, owner) {
  const q = repo(app, kind);
  return (
    (await q.findOne({
      where: { owner, status: "active" },
      orderBy: { id: "desc" },
    })) ||
    (await q.findOne({
      where: { owner, status: { $null: true } },
      orderBy: { createdAt: "desc" },
    }))
  );
}
module.exports = { repo, activePlan };
