"use strict";
const { randomBytes, createHash } = require("node:crypto");
const { fail } = require("./validation");
const limit = require("./login-limit");
const cookie = "pulse_session";
const hash = (value) => createHash("sha256").update(value).digest("hex");
const sessions = (strapi) =>
  strapi.db.query("api::pulse-session.pulse-session");
const cookieOptions = (ctx) => ({
  httpOnly: true,
  secure: process.env.PULSE_ENV === "production" || ctx.secure,
  sameSite: "strict",
  overwrite: true,
  path: "/api/pulse",
  signed: false,
});
// Cookie authentication requires same-origin mutations. No JWT is placed in web storage.
function sameOrigin(ctx) {
  const origin = ctx.get("origin");
  if (process.env.PULSE_ENV === "production" && !origin)
    fail("Origine richiesta", 403);
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
async function login(ctx, strapi) {
  ctx.set("Cache-Control", "no-store");
  sameOrigin(ctx);
  const now = Date.now();
  const { identifier, password } = ctx.request.body || {};
  if (
    typeof identifier !== "string" ||
    identifier.length > 254 ||
    typeof password !== "string" ||
    password.length > 512
  )
    fail("Credenziali non valide", 401);
  let bucketKeys;
  try {
    bucketKeys = await limit.consume(strapi, ctx.ip, identifier);
  } catch (e) {
    if (e.retryAfter) ctx.set("Retry-After", String(e.retryAfter));
    throw e;
  }
  const user = await strapi.db.query("plugin::users-permissions.user").findOne({
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
  await limit.success(strapi, bucketKeys);
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
async function updateProfile(ctx, strapi, owner) {
  const { username, currentPassword, newPassword } = ctx.request.body || {};
  if (typeof username !== "string" || !/^[a-zA-Z0-9_.-]{3,64}$/.test(username))
    fail(
      "Usa da 3 a 64 lettere, numeri, punti, trattini o underscore per il nome utente",
    );
  if (
    typeof currentPassword !== "string" ||
    !currentPassword ||
    currentPassword.length > 512
  )
    fail("Inserisci la password attuale");
  if (
    newPassword !== undefined &&
    (typeof newPassword !== "string" ||
      newPassword.length < 12 ||
      Buffer.byteLength(newPassword, "utf8") > 72)
  )
    fail(
      "La nuova password deve avere almeno 12 caratteri e non superare 72 byte",
    );
  let bucketKeys;
  try {
    bucketKeys = await limit.consume(strapi, ctx.ip, `profile:${owner.id}`);
  } catch (e) {
    if (e.retryAfter) ctx.set("Retry-After", String(e.retryAfter));
    throw e;
  }
  const user = await strapi.db.transaction(async ({ trx }) => {
    await trx.raw("SELECT pg_advisory_xact_lock(hashtext(?))", [
      "pulse-profile-update",
    ]);
    const repo = strapi.db.query("plugin::users-permissions.user");
    const fresh = await repo.findOne({ where: { id: owner.id } });
    const tokenHash = hash(ctx.cookies.get(cookie, { signed: false }) || "");
    const active = await sessions(strapi).findOne({ where: { tokenHash } });
    if (!active || !fresh || fresh.blocked || !fresh.confirmed)
      fail("Sessione scaduta", 401);
    const service = strapi.plugin("users-permissions").service("user");
    if (!(await service.validatePassword(currentPassword, fresh.password)))
      fail("Password attuale non corretta", 403);
    const taken = await repo.findOne({
      where: {
        id: { $ne: fresh.id },
        $or: [{ username: { $eqi: username } }, { email: { $eqi: username } }],
      },
    });
    if (taken) fail("Nome utente non disponibile", 409);
    const data = { username };
    if (newPassword !== undefined)
      Object.assign(
        data,
        await service.ensureHashedPasswords({ password: newPassword }),
      );
    const updated = await repo.update({ where: { id: fresh.id }, data });
    if (newPassword !== undefined) {
      await sessions(strapi).deleteMany({
        where: { owner: fresh.id, tokenHash: { $ne: tokenHash } },
      });
      // Invalidate any previously issued password-reset token.
      await strapi.db
        .query("plugin::users-permissions.user")
        .update({
          where: { id: fresh.id },
          data: { resetPasswordToken: null },
        });
    }
    return updated;
  });
  await limit.success(strapi, bucketKeys);
  ctx.body = { user: { id: user.id, username: user.username } };
}
module.exports = { login, logout, requireUser, updateProfile };
