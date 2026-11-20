"use strict";
const { ECDH, createECDH, createHash, randomUUID } = require("node:crypto");
const webpush = require("web-push");
const { fail } = require("./validation");
const { checkDue, withReminderLock } = require("./reminder-due");

const q = (app, name) => app.db.query(`api::${name}.${name}`);
const sha = (value) => createHash("sha256").update(value).digest("hex");
const validUntil = (now) => new Date(now + 2 * 60000);
const providers = new Set([
  "fcm.googleapis.com", "updates.push.services.mozilla.com",
  "web.push.apple.com",
]);
const b64 = (value, size) =>
  typeof value === "string" && value.length === Math.ceil(size * 4 / 3) && /^[\w-]+$/.test(value) &&
  Buffer.from(value, "base64url").length === size &&
  Buffer.from(value, "base64url").toString("base64url") === value;

function configured() {
  const publicKey = process.env.PULSE_WEB_PUSH_PUBLIC_KEY;
  const privateKey = process.env.PULSE_WEB_PUSH_PRIVATE_KEY;
  const subject = process.env.PULSE_WEB_PUSH_SUBJECT;
  if (!b64(publicKey, 65) || !b64(privateKey, 32) ||
      !/^mailto:[^\s@]+@[^\s@]+$/.test(subject || "")) return null;
  try {
    const key = createECDH("prime256v1");
    key.setPrivateKey(Buffer.from(privateKey, "base64url"));
    if (key.getPublicKey().toString("base64url") !== publicKey) return null;
  } catch { return null; }
  return { publicKey, privateKey, subject };
}

function subscription(value, now = Date.now()) {
  const { endpoint, keys, expirationTime } = value || {};
  let url;
  try { if (typeof endpoint === "string" && endpoint.length <= 2048) url = new URL(endpoint); } catch {}
  // Only accept public Web Push providers. The transport does not follow redirects.
  if (!url || url.protocol !== "https:" || url.username || url.password || url.port ||
      url.hash || url.pathname === "/" ||
      (!providers.has(url.hostname) && !/^[a-z0-9-]+\.notify\.windows\.com$/.test(url.hostname)) ||
      !b64(keys?.p256dh, 65) || !b64(keys?.auth, 16) ||
      Buffer.from(keys.p256dh, "base64url")[0] !== 4 ||
      (expirationTime != null && (!Number.isSafeInteger(expirationTime) || expirationTime <= now)))
    fail("Iscrizione alle notifiche non valida");
  try { ECDH.convertKey(Buffer.from(keys.p256dh, "base64url"), "prime256v1"); }
  catch { fail("Chiave del dispositivo non valida"); }
  return { endpoint: url.href, keys: { p256dh: keys.p256dh, auth: keys.auth },
    expirationTime: expirationTime ?? null };
}

async function activeSubscriptions(app, owner, now = Date.now()) {
  const publicKey = configured()?.publicKey;
  if (!publicKey) return [];
  const devices = await q(app, "push-device").findMany({
    where: owner == null ? {} : { owner },
    populate: { owner: { select: ["id", "blocked", "confirmed"] } },
  });
  if (!devices.length) return [];
  const sessions = await q(app, "pulse-session").findMany({
    where: { id: { $in: devices.map((d) => d.sessionId) }, expiresAt: { $gt: new Date(now) } },
    select: ["id"],
  });
  const valid = new Set(sessions.map((s) => s.id));
  return devices.filter((d) => valid.has(d.sessionId) && d.owner?.confirmed && !d.owner.blocked &&
    d.subscription.vapidPublicKey === publicKey &&
    (d.subscription.expirationTime == null || d.subscription.expirationTime > now));
}

async function register(app, owner, sessionId, value) {
  const publicKey = configured()?.publicKey;
  if (!publicKey) fail("Push non configurate sul server", 503);
  const data = { ...subscription(value), vapidPublicKey: publicKey };
  const endpointHash = sha(data.endpoint);
  await withReminderLock(app, owner, async (trx) => {
    await trx.raw("SELECT pg_advisory_xact_lock(hashtext(?))", ["push-endpoint:" + endpointHash]);
    const repo = q(app, "push-device");
    const current = await repo.findOne({ where: { owner, sessionId } });
    if (current?.endpointHash === endpointHash) {
      await repo.update({ where: { id: current.id, owner }, data: { subscription: data } });
      return;
    }
    if (await repo.findOne({ where: { endpointHash }, select: ["id"] }))
      fail("Rinnova l’iscrizione del browser", 409);
    if (current) await repo.delete({ where: { id: current.id, owner } });
    if ((await activeSubscriptions(app, owner)).length >= 15)
      fail("Limite dei dispositivi attivi raggiunto", 409);
    await repo.create({ data: { owner, sessionId, endpointHash, subscription: data } });
  });
}
function unregister(app, owner, sessionId) {
  return withReminderLock(app, owner, () => q(app, "push-device").deleteMany({ where: { owner, sessionId } }));
}
async function status(app, owner, sessionId) {
  const vapid = configured();
  const active = vapid ? (await activeSubscriptions(app, owner)).find((d) => d.sessionId === sessionId) : null;
  return { publicKey: vapid?.publicKey || null, registered: !!active };
}

function occurrenceKey(device, reminder, day) {
  const snooze = reminder.occurrence?.date === day ? reminder.occurrence.snoozedUntil : null;
  return sha(JSON.stringify([device.id, reminder.uniqueKey, day, snooze || null, reminder.settings]));
}
function locallyDelivered(reminder, day) {
  return reminder.occurrence?.date === day && !!reminder.occurrence.deliveredAt;
}

async function reserve(app, device, reminderId, now) {
  const owner = device.owner.id;
  return withReminderLock(app, owner, async () => {
    if (!(await q(app, "push-device").findOne({ where: { id: device.id, owner, sessionId: device.sessionId } })))
      return null;
    if (!(await q(app, "pulse-session").findOne({ where: {
      id: device.sessionId, owner, expiresAt: { $gt: new Date(now) },
    }, select: ["id"] }))) return null;
    const r = await q(app, "reminder").findOne({ where: { id: reminderId, owner } });
    const day = r && await checkDue(app, owner, r, now);
    if (!day || locallyDelivered(r, day)) return null;
    const key = occurrenceKey(device, r, day);
    const repo = q(app, "push-delivery");
    const previous = await repo.findOne({ where: { key, owner } });
    if (previous && (previous.finished || previous.shownAt || previous.attempts >= 3 ||
        Date.parse(previous.retryAt) > now)) return null;
    const attempts = (previous?.attempts || 0) + 1;
    const data = { attempts, validUntil: validUntil(now), retryAt: new Date(now + attempts * 120000) };
    return previous
      ? repo.update({ where: { id: previous.id, owner }, data })
      : repo.create({ data: { ...data, owner, deviceId: device.id, reminderId, key, receipt: randomUUID() } });
  });
}

async function dispatch(app, device, delivery, vapid, deliver) {
  try {
    await deliver(device.subscription, JSON.stringify({ receipt: delivery.receipt }), {
      TTL: 120, urgency: "normal", topic: delivery.key.slice(0, 32), timeout: 5000, vapidDetails: vapid,
    });
  } catch (error) {
    if ([404, 410].includes(error.statusCode)) {
      await q(app, "push-device").deleteMany({
        where: { id: device.id, owner: device.owner.id, sessionId: device.sessionId },
      });
    } else if (!error.statusCode || error.statusCode === 429 || error.statusCode >= 500) return;
  }
  await q(app, "push-delivery").updateMany({ where: { id: delivery.id }, data: { finished: true } });
}

let running = false;
async function run(app, { now = Date.now(), deliver = webpush.sendNotification.bind(webpush) } = {}) {
  const vapid = configured();
  if (!vapid || running) return;
  running = true;
  try {
    const devices = await activeSubscriptions(app, null, now);
    const expired = await q(app, "push-device").findMany({ select: ["id"] });
    const active = new Set(devices.map((d) => d.id));
    // Delete only rows that predate this sweep so registration on another worker can finish.
    for (const d of expired.filter((d) => !active.has(d.id))) {
      await q(app, "push-device").deleteMany({
        where: { id: d.id, updatedAt: { $lt: new Date(now - 60000) } },
      });
    }
    await q(app, "push-delivery").deleteMany({
      where: { createdAt: { $lt: new Date(now - 3 * 86400000) } },
    });
    const owners = new Map();
    for (const d of devices) {
      if (!owners.has(d.owner.id)) owners.set(d.owner.id, []);
      owners.get(d.owner.id).push(d);
    }
    for (const [owner, targets] of owners) {
      const reminders = await q(app, "reminder").findMany({ where: { owner } });
      for (const reminder of reminders) {
        if (!(await checkDue(app, owner, reminder, now))) continue;
        for (const device of targets) {
          const delivery = await reserve(app, device, reminder.id, now);
          if (delivery) await dispatch(app, device, delivery, vapid, deliver);
        }
      }
    }
  } finally {
    running = false;
  }
}

async function testDevice(app, owner, sessionId) {
  const vapid = configured();
  if (!vapid) fail("Push non configurate sul server", 503);
  const device = (await activeSubscriptions(app, owner)).find((d) => d.sessionId === sessionId);
  if (!device) fail("Attiva le notifiche su questo dispositivo", 409);
  const delivery = await withReminderLock(app, owner, async () => {
    const now = Date.now(), repo = q(app, "push-delivery");
    if (await repo.findOne({ where: { owner, deviceId: device.id, reminderId: { $null: true },
      createdAt: { $gt: new Date(now - 30000) } } }))
      fail("Attendi 30 secondi prima di un nuovo test", 429);
    return repo.create({ data: { owner, deviceId: device.id, key: sha(randomUUID()), receipt: randomUUID(),
      attempts: 1, retryAt: new Date(now), validUntil: validUntil(now) } });
  });
  try {
    await webpush.sendNotification(device.subscription, JSON.stringify({ receipt: delivery.receipt }), {
      TTL: 120, urgency: "normal", timeout: 5000, vapidDetails: vapid,
    });
  } catch (error) {
    if ([404, 410].includes(error.statusCode)) {
      await unregister(app, owner, sessionId);
      fail("Iscrizione scaduta. Attiva di nuovo le notifiche", 410);
    }
    fail("Il servizio push non ha accettato il test", 502);
  }
}

async function claim(app, owner, sessionId, receipt) {
  if (!configured() || !/^[a-f0-9-]{36}$/.test(receipt)) return null;
  return withReminderLock(app, owner, async () => {
    const repo = q(app, "push-delivery");
    const row = await repo.findOne({ where: { receipt, owner } });
    if (!row || row.shownAt || Date.parse(row.validUntil) <= Date.now()) return null;
    const device = (await activeSubscriptions(app, owner)).find((d) => d.id === row.deviceId && d.sessionId === sessionId);
    if (!device) return null;
    let tag = "pulse-push-test";
    if (row.reminderId) {
      const r = await q(app, "reminder").findOne({ where: { id: row.reminderId, owner } });
      const day = r && await checkDue(app, owner, r);
      if (!day || locallyDelivered(r, day) || occurrenceKey(device, r, day) !== row.key) return null;
      tag = "pulse-" + r.uniqueKey.split(":").at(-1) + "-" + day;
      const occurrence = r.occurrence?.date === day ? r.occurrence : { date: day };
      if (!occurrence.pushShownAt) {
        await q(app, "reminder").update({ where: { id: r.id, owner }, data: {
          occurrence: { ...occurrence, pushShownAt: new Date().toISOString() },
          revision: r.revision + 1,
        } });
      }
    }
    await repo.update({ where: { id: row.id, owner }, data: { shownAt: new Date(), finished: true } });
    return { tag, test: !row.reminderId };
  });
}

module.exports = { configured, subscription, activeSubscriptions, register, unregister, status, run, testDevice, claim };
