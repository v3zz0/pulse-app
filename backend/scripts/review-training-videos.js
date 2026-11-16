"use strict";
// Apply externally inspected official metadata without mutating a program or historical snapshots.
const fs = require("node:fs");
const { createStrapi, compileStrapi } = require("@strapi/strapi");
(async () => {
  const [file] = process.argv.slice(2);
  if (!file) throw new Error("Indicare il rapporto privato di verifica video");
  const checks = JSON.parse(fs.readFileSync(file));
  const app = createStrapi(await compileStrapi());
  await app.load();
  try {
    const programs = await app.db
      .query("api::training-program.training-program")
      .findMany({ populate: { owner: true } });
    let n = 0;
    for (const p of programs) {
      if (!p.owner) continue;
      for (const v of [
        ...Object.values(p.days)
          .flat()
          .flatMap((b) => b.videos),
        ...p.cooldown.videos,
      ]) {
        const id = (v.url.match(/(?:youtu\.be\/|shorts\/)([\w-]+)/) || [])[1],
          check = checks.find((c) => c.id === id);
        if (!check) continue;
        const uniqueKey = `${p.owner.id}:${p.id}:${id}`,
          repo = app.db.query("api::video-review.video-review");
        const data = {
          owner: p.owner.id,
          programId: p.id,
          url: v.url,
          confirmed: check.confirmed === true && check.status === 200,
          title: check.title,
          basis: "official-youtube-oembed-title",
          note: check.reason,
          checkedAt: new Date(),
          uniqueKey,
        };
        const row = await repo.findOne({ where: { uniqueKey } });
        if (row) await repo.update({ where: { id: row.id }, data });
        else await repo.create({ data });
        n++;
      }
    }
    console.log(
      `Revisionate ${n} associazioni nei programmi privati assegnati; snapshot storici invariati.`,
    );
  } finally {
    await app.destroy();
  }
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
