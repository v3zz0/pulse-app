import https from "node:https";
import fs from "node:fs";
import assert from "node:assert/strict";
const ca = fs.readFileSync("/tmp/pulse-phase4-root.crt");
const front = "pulse.vezzo.vp360web.it",
  back = "apipulse.vezzo.vp360web.it";
const req = (host, path, body, headers = {}) =>
  new Promise((resolve, reject) => {
    const r = https.request(
      {
        host: "127.0.0.1",
        port: 443,
        servername: host,
        path,
        method: body ? "POST" : "GET",
        ca,
        headers: { Host: host, "Content-Type": "application/json", ...headers },
      },
      (res) => {
        let text = "";
        res.on("data", (s) => (text += s));
        res.on("end", () =>
          resolve({ status: res.statusCode, headers: res.headers, text }),
        );
      },
    );
    r.on("error", reject);
    r.end(body ? JSON.stringify(body) : undefined);
  });
const home = await req(front, "/");
assert.equal(home.status, 200);
assert.match(home.headers["strict-transport-security"], /max-age/);
assert.match(home.headers["content-security-policy"], /script-src 'self'/);
assert.equal(home.headers["x-frame-options"], "DENY");
const [u] = JSON.parse(
  fs.readFileSync("/tmp/pulse-phase3-test/credentials.json"),
);
const loginBody = { identifier: u.email, password: u.password };
assert.equal((await req(front, "/api/pulse/login", loginBody)).status, 403);
assert.equal(
  (
    await req(front, "/api/pulse/login", loginBody, {
      Origin: "https://evil.invalid",
    })
  ).status,
  403,
);
const login = await req(front, "/api/pulse/login", loginBody, {
  Origin: "https://" + front,
});
assert.equal(login.status, 200, login.text);
const setCookie = login.headers["set-cookie"].find((c) =>
  c.startsWith("pulse_session="),
);
assert.match(setCookie, /httponly/i);
assert.match(setCookie, /secure/i);
assert.match(setCookie, /samesite=strict/i);
assert.ok(!/domain=/i.test(setCookie));
const Cookie = setCookie.split(";")[0];
assert.equal(
  (await req(front, "/api/pulse/training", null, { Cookie })).status,
  200,
);
assert.equal((await req(front, "/admin")).status, 404);
assert.equal((await req(front, "/api/auth/local", loginBody)).status, 404);
const cors = await req(back, "/api/users/me", null, {
  Origin: "https://evil.invalid",
});
assert.notEqual(
  cors.headers["access-control-allow-origin"],
  "https://evil.invalid",
);
const admin = JSON.parse(fs.readFileSync("/tmp/pulse-phase3-test/admin.json"));
const adminLogin = await req(back, "/admin/login", admin, {
  Origin: "https://" + back,
});
assert.equal(adminLogin.status, 200, adminLogin.text);
assert.ok(
  adminLogin.headers["set-cookie"]?.some((c) => /secure/i.test(c)),
  "Cookie admin Secure atteso",
);
assert.equal(
  (
    await req(
      front,
      "/api/pulse/logout",
      {},
      { Cookie, Origin: "https://" + front },
    )
  ).status,
  204,
);
assert.equal((await req(front, "/api/pulse/me", null, { Cookie })).status, 401);
console.log(
  "PASS TLS locale con CA verificata: domini reali, same-origin /api, cookie Secure/HttpOnly/Strict host-only, CSRF origine richiesta, CORS ristretto, admin nativo e revoca sessione.",
);
