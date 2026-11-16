import fs from "node:fs";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
const base = process.env.PULSE_TEST_URL || "http://127.0.0.1:8081/api/pulse";
const file = "/tmp/pulse-phase4-rate.json";
const identifier = process.argv.includes("--after-restart")
  ? JSON.parse(fs.readFileSync(file)).identifier
  : `pulse-rate-${randomUUID()}@example.invalid`;
async function bad() {
  return fetch(base + "/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Forwarded-For": "203.0.113.10",
    },
    body: JSON.stringify({
      identifier,
      password: "synthetic-invalid-password",
    }),
  });
}
if (!process.argv.includes("--after-restart")) {
  for (let n = 0; n < 10; n++) assert.equal((await bad()).status, 401);
  fs.writeFileSync(file, JSON.stringify({ identifier }), { mode: 0o600 });
}
const blocked = await bad();
assert.equal(blocked.status, 429);
assert.ok(Number(blocked.headers.get("retry-after")) > 0);
const cors = await fetch(base + "/me", {
  headers: { Origin: "https://untrusted.invalid" },
});
assert.notEqual(
  cors.headers.get("access-control-allow-origin"),
  "https://untrusted.invalid",
);
for (const path of ["/mcp", "/api/auth/local", "/api/auth/forgot-password"]) {
  const r = await fetch(
    (path === "/mcp"
      ? process.env.STRAPI_TEST_URL || "http://127.0.0.1:1337"
      : base.replace("/api/pulse", "")) + path,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    },
  );
  assert.ok([403, 404].includes(r.status));
}
const [u] = JSON.parse(
  fs.readFileSync(
    process.env.PULSE_TEST_CREDENTIALS ||
      "/tmp/pulse-phase3-test/credentials.json",
  ),
);
assert.match(u.email, /^pulse-test-/);
const login = await fetch(base + "/login", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ identifier: u.email, password: u.password }),
});
assert.equal(login.status, 200);
const cookie = login.headers.get("set-cookie");
assert.match(cookie, /httponly/i);
assert.match(cookie, /samesite=strict/i);
const oversize = await fetch(base + "/weights/2026-11-16", {
  method: "PUT",
  headers: { "Content-Type": "application/json", Cookie: cookie.split(";")[0] },
  body: JSON.stringify({ kg: 72, extra: Array(257).fill(0) }),
});
assert.equal(oversize.status, 413);
console.log(
  "PASS: throttle login" +
    (process.argv.includes("--after-restart")
      ? " persistente dopo riavvio"
      : "") +
    ", Retry-After, CORS negato, endpoint inutilizzati chiusi, cookie, limite collezioni e login legittimo.",
);
