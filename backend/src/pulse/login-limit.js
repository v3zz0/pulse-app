"use strict";
const { createHmac } = require("node:crypto");
const { fail } = require("./validation");
const uid = "api::login-attempt.login-attempt";
function keys(strapi, ip, identifier) {
  const secret = strapi.config.get("server.app.keys")[0];
  return [`ip:${ip}`, `account:${identifier.toLowerCase()}`].map((v) =>
    createHmac("sha256", secret).update(v).digest("hex"),
  );
}
async function consume(strapi, ip, identifier, now = Date.now()) {
  const bucketKeys = keys(strapi, ip, identifier),
    windowMs = Number(process.env.LOGIN_WINDOW_SECONDS || 900) * 1000;
  // A single DB lock coordinates replicas and survives server restarts. No raw IP/email is stored.
  const result = await strapi.db.transaction(async ({ trx }) => {
    await trx.raw("SELECT pg_advisory_xact_lock(hashtext(?))", [
      "pulse-login-limit",
    ]);
    const repo = strapi.db.query(uid);
    const rows = [];
    for (const key of bucketKeys) {
      let r = await repo.findOne({ where: { key } });
      if (!r)
        r = await repo.create({
          data: { key, windowStart: new Date(now), attempts: 0 },
        });
      if (now - Date.parse(r.windowStart) >= windowMs)
        r = await repo.update({
          where: { id: r.id },
          data: { attempts: 0, windowStart: new Date(now) },
        });
      const max =
        rows.length === 0
          ? Number(process.env.LOGIN_IP_MAX || 60)
          : Number(process.env.LOGIN_ACCOUNT_MAX || 10);
      if (r.attempts >= max)
        return {
          retry: Math.max(
            1,
            Math.ceil((Date.parse(r.windowStart) + windowMs - now) / 1000),
          ),
        };
      rows.push(r);
    }
    for (const r of rows)
      await repo.update({
        where: { id: r.id },
        data: { attempts: r.attempts + 1 },
      });
    await repo.deleteMany({
      where: { windowStart: { $lt: new Date(now - 2 * windowMs) } },
    });
    return { keys: bucketKeys };
  });
  if (result.retry) {
    const e = new Error("Troppi tentativi. Riprova più tardi.");
    e.status = 429;
    e.retryAfter = result.retry;
    throw e;
  }
  return result.keys;
}
async function success(strapi, bucketKeys) {
  await strapi.db.transaction(async ({ trx }) => {
    await trx.raw("SELECT pg_advisory_xact_lock(hashtext(?))", [
      "pulse-login-limit",
    ]);
    const repo = strapi.db.query(uid);
    const ip = await repo.findOne({ where: { key: bucketKeys[0] } });
    if (ip)
      await repo.update({
        where: { id: ip.id },
        data: { attempts: Math.max(0, ip.attempts - 1) },
      });
    await repo.deleteMany({ where: { key: bucketKeys[1] } });
  });
}
module.exports = { consume, success, keys };
