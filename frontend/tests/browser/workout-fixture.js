import { expect } from "@playwright/test";
// Preserve prior results. Only finish an exhausted synthetic fixture and start a
// fresh session; never reset a program, standard load, owner or history.
export async function ensurePendingWorkout(page, user) {
  expect(user.email).toMatch(/^pulse-test-[12]@example.invalid$/);
  const origin = new URL(page.url()).origin;
  async function call(path, data, method = "PUT") {
    const r = await page.request.fetch(origin + "/api/pulse" + path, {
      method: data ? method : "GET",
      headers: { Origin: origin },
      ...(data ? { data } : {}),
    });
    expect(r.status()).toBe(200);
    return r.json();
  }
  expect(Number.isInteger(user.id)).toBeTruthy();
  expect((await call("/me")).user.id).toBe(user.id);
  let { active: s, program } = await call("/training");
  if (
    s &&
    s.snapshot.blocks
      .flatMap((b) => b.sets)
      .filter((s) => s.status === "pending").length >= 2
  )
    return;
  const op = async (data) =>
    (s = await call("/training/sessions/" + s.clientId, {
      ...data,
      revision: s.revision,
      opId: crypto.randomUUID(),
      occurredAt: new Date().toISOString(),
    }));
  if (s) {
    for (const block of s.snapshot.blocks)
      await op({ action: "skip-block", blockId: block.id });
    await op({ action: "cooldown" });
    await op({ action: "finish" });
  }
  await call(
    "/training/sessions",
    { clientId: crypto.randomUUID(), programId: program.id, day: "A" },
    "POST",
  );
  await page.reload();
}
