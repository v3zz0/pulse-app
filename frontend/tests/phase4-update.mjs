// Rehearsal only: replace the service worker via a temporary read-only bind, then restore it.
import { chromium } from "@playwright/test";
import fs from "node:fs";
import { spawnSync } from "node:child_process";
import assert from "node:assert/strict";
const root = process.cwd(),
  temp = "/tmp/pulse-phase4-https";
fs.mkdirSync(temp, { recursive: true, mode: 0o700 });
const args = [
  "compose",
  "--env-file",
  "/tmp/pulse-phase4-production.env",
  "-f",
  "compose.production.yml",
  "-p",
  "pulse-rehearsal",
];
function docker(extra) {
  const r = spawnSync("docker", [...args, ...extra], {
    cwd: root,
    encoding: "utf8",
  });
  if (r.status !== 0) throw new Error(r.stderr);
}
docker([
  "cp",
  "frontend:/usr/share/nginx/html/sw.js",
  temp + "/original-sw.js",
]);
const original = fs.readFileSync(temp + "/original-sw.js", "utf8");
fs.writeFileSync(temp + "/update-sw.js", original);
const override = temp + "/update-compose.yml";
fs.writeFileSync(
  override,
  `services:\n  frontend:\n    volumes:\n      - ${temp}/update-sw.js:/usr/share/nginx/html/sw.js:ro\n`,
);
const browser = await chromium.launch({
  channel: "chromium",
  args: [
    "--ignore-certificate-errors",
    "--no-proxy-server",
    "--host-resolver-rules=MAP pulse.vezzo.vp360web.it 127.0.0.1",
  ],
});
try {
  const r = spawnSync(
    "docker",
    [...args, "-f", override, "up", "-d", "--no-build", "--wait", "frontend"],
    { cwd: root, encoding: "utf8" },
  );
  if (r.status !== 0) throw new Error(r.stderr);
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  let page = await context.newPage();
  await page.goto("https://pulse.vezzo.vp360web.it/");
  const [u] = JSON.parse(
    fs.readFileSync("/tmp/pulse-phase3-test/credentials.json"),
  );
  await page.getByLabel("Email o nome utente").fill(u.email);
  await page.getByLabel("Password", { exact: true }).fill(u.password);
  await page.getByRole("button", { name: "Accedi", exact: true }).click();
  await page.getByRole("link", { name: "Allenati", exact: true }).click();
  await page
    .getByTestId("workout-sync")
    .filter({ hasText: "Tutte le modifiche sincronizzate" })
    .waitFor();
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await page
    .getByTestId("workout-sync")
    .filter({ hasText: "Tutte le modifiche sincronizzate" })
    .waitFor();
  const before = await page.evaluate(async () =>
    fetch("/api/pulse/training")
      .then((r) => r.json())
      .then((r) => r.active.clientId),
  );
  fs.writeFileSync(
    temp + "/update-sw.js",
    original.replace("pulse-shell-", "pulse-shell-rehearsal-update-"),
  );
  await page.evaluate(async () => {
    const r = await navigator.serviceWorker.ready;
    await r.update();
    await new Promise((resolve, reject) => {
      let n = 0;
      const t = setInterval(() => {
        if (r.waiting) {
          clearInterval(t);
          resolve();
        } else if (++n > 100) {
          clearInterval(t);
          reject(new Error("Worker waiting non rilevato"));
        }
      }, 100);
    });
  });
  assert.ok(
    await page.evaluate(
      async () => !!(await navigator.serviceWorker.getRegistration()).waiting,
    ),
  );
  assert.equal(
    await page.evaluate(async () =>
      fetch("/api/pulse/training")
        .then((r) => r.json())
        .then((r) => r.active.clientId),
    ),
    before,
  );
  await page.close();
  page = await context.newPage();
  await page.goto("https://pulse.vezzo.vp360web.it/allenati");
  await page
    .getByTestId("workout-sync")
    .filter({ hasText: "Tutte le modifiche sincronizzate" })
    .waitFor();
  const keys = await page.evaluate(() => caches.keys());
  assert.ok(keys.some((k) => k.startsWith("pulse-shell-rehearsal-update-")));
  assert.equal(keys.filter((k) => k.startsWith("pulse-shell-")).length, 1);
  assert.equal(
    await page.evaluate(async () =>
      fetch("/api/pulse/training")
        .then((r) => r.json())
        .then((r) => r.active.clientId),
    ),
    before,
  );
  await context.close();
  console.log(
    "PASS aggiornamento PWA: nuovo worker in attesa durante allenamento, attivazione dopo chiusura, cache precedente rimossa e sessione conservata.",
  );
} finally {
  await browser.close();
  fs.writeFileSync(temp + "/update-sw.js", original);
  docker(["up", "-d", "--no-build", "--wait", "frontend"]);
}
