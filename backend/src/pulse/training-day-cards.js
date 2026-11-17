"use strict";
const { AsyncLocalStorage } = require("node:async_hooks");
const { isDeepStrictEqual } = require("node:util");
const { errors } = require("@strapi/utils");
const writes = new AsyncLocalStorage();
const uid = "api::training-day.training-day";
function protect() {
  if (!writes.getStore())
    throw new errors.ApplicationError(
      "Questa scheda è generata dal programma: modifica il CSV o il programma collegato, non la copia giornaliera.",
    );
}
function cards(program) {
  return Object.entries(program.days).map(([day, blocks], index) => ({
    uniqueKey: `${program.id}:${day}`,
    title: `Scheda ${day}`,
    day,
    position: index + 1,
    blocks: structuredClone(blocks),
    cooldown: structuredClone(program.cooldown),
    exerciseCount: blocks.length,
    program: program.id,
    owner: program.owner.id,
  }));
}
async function sync(app, id) {
  return app.db.transaction(async ({ trx }) => {
    await trx.raw("SELECT pg_advisory_xact_lock(hashtext(?))", [
      `training-day-cards:${id}`,
    ]);
    const source = await app.db
      .query("api::training-program.training-program")
      .findOne({ where: { id }, populate: { owner: true } });
    if (!source?.owner)
      throw new Error("Programma senza proprietario: separazione annullata");
    const expected = cards(source),
      repo = app.db.query(uid),
      old = await repo.findMany({
        where: { program: id },
        populate: { owner: true, program: true },
      });
    let created = 0,
      updated = 0;
    await writes.run(true, async () => {
      for (const data of expected) {
        const existing = old.find((r) => r.uniqueKey === data.uniqueKey);
        if (!existing) {
          await repo.create({ data });
          created++;
        } else if (
          !isDeepStrictEqual(existing.blocks, data.blocks) ||
          !isDeepStrictEqual(existing.cooldown, data.cooldown) ||
          existing.owner?.id !== data.owner ||
          existing.title !== data.title ||
          existing.position !== data.position
        ) {
          await repo.update({ where: { id: existing.id }, data });
          updated++;
        }
      }
      for (const row of old)
        if (!expected.some((r) => r.uniqueKey === row.uniqueKey))
          await repo.delete({ where: { id: row.id } });
    });
    return { days: expected.length, created, updated };
  });
}
module.exports = { sync, cards, protect, uid };
