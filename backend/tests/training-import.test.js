"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { parseTraining } = require("../src/pulse/import-training");
test("Scheda originale completa, senza carichi inventati o recuperi ambigui risolti", async () => {
  const p = await parseTraining(
    readFileSync(
      process.env.PULSE_TEST_TRAINING_PDF ||
        join(
          __dirname,
          "../../PULSE_Starter_Codex_Cloud/references/Scheda-palestra.PDF",
        ),
    ),
  );
  assert.deepEqual(
    Object.values(p.days).map((d) => d.length),
    [11, 12, 8],
  );
  assert.deepEqual(
    Object.values(p.days).map((d) => d.reduce((n, b) => n + b.sets.length, 0)),
    [23, 27, 25],
  );
  assert.equal(p.days.A[2].restRaw, "1/2'");
  assert.equal(p.days.A[2].restSeconds, null);
  assert.equal(p.days.A[2].reviewRequired, true);
  assert.equal(p.days.A[1].phase, "top-set");
  assert.match(p.days.A[7].notes, /DEADSTOP/);
  assert.match(p.days.B[4].name, /REMATORE MULTIPOWER PRESA SUPINA/);
  assert.match(p.days.C[4].sets[0].reps, /GAMBA/);
  for (const b of Object.values(p.days).flat())
    for (const s of b.sets) assert.equal(s.standardKg, null);
  assert.ok(p.days.A[4].sets.every((s) => s.toFailure));
  for (const b of [p.days.A[6], p.days.B[0], p.days.B[1], p.days.B[9]])
    assert.equal(b.videos.length, 0);
  const c = p.days.C[7];
  assert.equal(c.phase, "circuit");
  assert.equal(c.sets.length, 3);
  assert.deepEqual(
    c.movements.map((m) => m.reps),
    [5, 5, 5],
  );
  assert.deepEqual(
    c.videos.map((v) => v.candidateMovement),
    c.movements.map((m) => m.name),
  );
  const videos = [
    ...Object.values(p.days)
      .flat()
      .flatMap((b) => b.videos),
    ...p.cooldown.videos,
  ];
  assert.equal(videos.length, 29);
  assert.ok(videos.every((v) => v.reviewRequired));
  assert.equal(p.cooldown.durationSeconds, 180);
  assert.match(p.cooldown.sourceText, /OGNI FINE ALLENAMENTO/);
});
test("PDF sconosciuto rifiutato prima di scrivere dati", async () => {
  await assert.rejects(parseTraining(Buffer.from("unknown")), /PDF diverso/);
});
