"use strict";
const { randomBytes, createHash } = require("node:crypto");
const { fail } = require("./validation");
const cookie = "pulse_session";
const hash = (value) => createHash("sha256").update(value).digest("hex");
const sessions = (strapi) =>
  strapi.db.query("api::pulse-session.pulse-session");
const cookieOptions = (ctx) => ({
  httpOnly: true,
  secure: ctx.secure,
  sameSite: "strict",
  overwrite: true,
  path: "/api/pulse",
  signed: false,
});
// Cookie authentication requires same-origin mutations. No JWT is placed in web storage.
function sameOrigin(ctx) {
  const origin = ctx.get("origin");
  if (
    origin &&
    origin !== (process.env.PUBLIC_ORIGIN || `${ctx.protocol}://${ctx.host}`)
  )
    fail("Origine non consentita", 403);
  if (ctx.get("sec-fetch-site") === "cross-site")
    fail("Richiesta non consentita", 403);
}
async function requireUser(ctx, strapi) {
  ctx.set("Cache-Control", "no-store");
  const token = ctx.cookies.get(cookie, { signed: false });
  if (!token) fail("Accesso richiesto", 401);
  const session = await sessions(strapi).findOne({
    where: { tokenHash: hash(token) },
    populate: { owner: true },
  });
  if (
    !session ||
    new Date(session.expiresAt) <= new Date() ||
    !session.owner ||
    session.owner.blocked ||
    !session.owner.confirmed
  )
    fail("Sessione scaduta", 401);
  ctx.state.pulseUser = session.owner;
  if (ctx.method !== "GET") sameOrigin(ctx);
  return session.owner;
}
const attempts = new Map();
async function login(ctx, strapi) {
  ctx.set("Cache-Control", "no-store");
  sameOrigin(ctx);
  const ip = ctx.ip,
    now = Date.now();
  for (const [key, item] of attempts)
    if (now - item.start > 900000) attempts.delete(key);
  const attempt = attempts.get(ip) || { start: now, count: 0 };
  attempt.count++;
  attempts.set(ip, attempt);
  if (attempt.count > 20) fail("Troppi tentativi. Riprova tra 15 minuti.", 429);
  const { identifier, password } = ctx.request.body || {};
  if (
    typeof identifier !== "string" ||
    identifier.length > 254 ||
    typeof password !== "string" ||
    password.length > 512
  )
    fail("Credenziali non valide", 401);
  const user = await strapi.db
    .query("plugin::users-permissions.user")
    .findOne({
      where: {
        $or: [{ email: identifier.toLowerCase() }, { username: identifier }],
        provider: "local",
      },
    });
  const valid =
    user &&
    (await strapi
      .plugin("users-permissions")
      .service("user")
      .validatePassword(password, user.password));
  if (!valid || user.blocked || !user.confirmed)
    fail("Credenziali non valide", 401);
  attempts.delete(ip);
  const previous = ctx.cookies.get(cookie, { signed: false });
  if (previous)
    await sessions(strapi).delete({ where: { tokenHash: hash(previous) } });
  const token = randomBytes(32).toString("hex"),
    expiresAt = new Date(now + 7 * 86400000);
  await sessions(strapi).create({
    data: { owner: user.id, tokenHash: hash(token), expiresAt },
  });
  await sessions(strapi).deleteMany({
    where: { expiresAt: { $lt: new Date() } },
  });
  ctx.cookies.set(cookie, token, {
    ...cookieOptions(ctx),
    maxAge: 7 * 86400000,
  });
  ctx.body = { user: { id: user.id, username: user.username } };
}
async function logout(ctx, strapi) {
  sameOrigin(ctx);
  const token = ctx.cookies.get(cookie, { signed: false });
  if (token)
    await sessions(strapi).delete({ where: { tokenHash: hash(token) } });
  ctx.cookies.set(cookie, null, cookieOptions(ctx));
  ctx.status = 204;
}
module.exports = { login, logout, requireUser };
