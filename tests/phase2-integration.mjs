import fs from "node:fs";
import assert from "node:assert/strict";
const users = JSON.parse(
  fs.readFileSync(
    process.env.PULSE_TEST_CREDENTIALS || "/tmp/pulse-test/credentials.json",
  ),
);
const base = process.env.PULSE_TEST_URL || "http://127.0.0.1:8080/api/pulse";
async function request(path, { method = "GET", body, cookie } = {}) {
  const r = await fetch(base + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return {
    status: r.status,
    body: r.status === 204 ? null : await r.json(),
    cookie: r.headers.get("set-cookie")?.split(";")[0],
  };
}
const login = async (user) => {
  const r = await request("/login", {
    method: "POST",
    body: { identifier: user.email, password: user.password },
  });
  assert.equal(r.status, 200);
  assert.ok(r.cookie);
  return r.cookie;
};
assert.equal((await request("/days/2026-11-16")).status, 401);
const first = await login(users[0]),
  second = await login(users[1]);
const csrf = await fetch(base + "/logout", {
  method: "POST",
  headers: {
    Cookie: first,
    Origin: "https://untrusted.example",
    "Content-Type": "application/json",
  },
  body: "{}",
});
assert.equal(csrf.status, 403);
let day = (await request("/days/2026-11-16", { cookie: first })).body;
// Start from a known state using explicit undo; never modify another user's data.
for (const meal of day.meals.filter((m) => m.consumedAt))
  day = (
    await request("/days/2026-11-16", {
      method: "PUT",
      cookie: first,
      body: {
        revision: day.revision,
        action: "meal",
        mealId: meal.id,
        consumed: false,
      },
    })
  ).body;
day = (
  await request("/days/2026-11-16", {
    method: "PUT",
    cookie: first,
    body: { revision: day.revision, action: "mode", mode: "ON" },
  })
).body;
assert.equal(day.meals.length, 8);
const oldRevision = day.revision;
let r = await request("/days/2026-11-16", {
  method: "PUT",
  cookie: first,
  body: {
    revision: day.revision,
    action: "meal",
    mealId: day.meals[0].id,
    consumed: true,
    owner: users[1].id,
  },
});
assert.equal(r.status, 200);
day = r.body;
assert.ok(
  (await request("/days/2026-11-16", { cookie: first })).body.meals[0]
    .consumedAt,
);
assert.equal(
  (await request("/days/2026-11-16", { cookie: second })).body.meals.some(
    (m) => m.consumedAt,
  ),
  false,
);
r = await request("/days/2026-11-16", {
  method: "PUT",
  cookie: first,
  body: { revision: oldRevision, action: "mode", mode: "OFF" },
});
assert.equal(r.status, 409);
const meal = day.meals.find((m) => m.id === "ON:breakfast");
r = await request("/days/2026-11-16", {
  method: "PUT",
  cookie: first,
  body: {
    revision: day.revision,
    action: "meal",
    mealId: meal.id,
    menuIndex: 1,
    selections: meal.menus[1].groups.map(() => 0),
  },
});
assert.equal(r.status, 200);
const optionKey = meal.menus[0].groups[0].options[0].id;
assert.equal(
  (
    await request("/preferences", {
      method: "PUT",
      cookie: first,
      body: { optionKey, status: "favorite" },
    })
  ).status,
  200,
);
assert.equal(
  (await request("/preferences", { cookie: first })).body[optionKey],
  "favorite",
);
assert.equal(
  (await request("/preferences", { cookie: second })).body[optionKey],
  undefined,
);
assert.equal(
  (
    await request("/weights/2026-11-16", {
      method: "PUT",
      cookie: first,
      body: { kg: 72.4 },
    })
  ).status,
  200,
);
assert.ok(
  (await request("/weights", { cookie: first })).body.some(
    (w) => w.kg === 72.4,
  ),
);
assert.equal((await request("/weights", { cookie: second })).body.length, 0);
assert.equal(
  (
    await request("/weights/2026-11-16", {
      method: "PUT",
      cookie: first,
      body: { kg: -1 },
    })
  ).status,
  400,
);
const products = (await request("/supplements", { cookie: first })).body;
assert.equal(products.length, 6);
assert.equal(
  (
    await request("/intakes/2026-11-16", {
      method: "PUT",
      cookie: second,
      body: { productId: products[0].id, taken: true, dose: "1 dose test" },
    })
  ).status,
  404,
);
assert.equal(
  (
    await request("/intakes/2026-11-16", {
      method: "PUT",
      cookie: first,
      body: { productId: products[0].id, taken: true, dose: "1 dose test" },
    })
  ).status,
  200,
);
assert.ok(
  (await request("/intakes/2026-11-16", { cookie: first })).body.some(
    (i) => i.dose === "1 dose test",
  ),
);
assert.equal(
  (
    await request("/intakes/2026-11-16", {
      method: "PUT",
      cookie: first,
      body: {
        productId: products[0].id,
        taken: true,
        slot: "18:00",
        dose: "Seconda dose test",
      },
    })
  ).status,
  200,
);
assert.equal(
  (await request("/intakes/2026-11-16", { cookie: first })).body.length,
  2,
);
let tomorrow = (await request("/days/2026-11-17", { cookie: first })).body;
r = await request("/days/2026-11-17", {
  method: "PUT",
  cookie: first,
  body: { revision: tomorrow.revision, action: "mode", mode: "OFF" },
});
assert.equal(r.status, 200);
tomorrow = r.body;
assert.equal(
  (
    await request("/days/2026-11-17", {
      method: "PUT",
      cookie: first,
      body: {
        revision: tomorrow.revision,
        action: "shopping",
        itemId: tomorrow.shopping[0].id,
        checked: true,
      },
    })
  ).status,
  200,
);
assert.equal(
  (await request("/days/2026-11-17", { cookie: first })).body.shopping[0]
    .checked,
  true,
);
assert.equal(
  (await request("/logout", { method: "POST", cookie: first, body: {} }))
    .status,
  204,
);
assert.equal((await request("/me", { cookie: first })).status, 401);
await request("/logout", { method: "POST", cookie: second, body: {} });
console.log(
  "PASS: login/logout revocabile, ownership due utenti, dieta 8/6 pasti, consumi, conflitti, sostituzioni, preferenze, peso, assunzioni, domani e spesa persistenti via API.",
);
