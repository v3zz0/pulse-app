"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { createECDH, randomBytes } = require("node:crypto");
const { subscription } = require("../src/pulse/push");

test("accetta gli endpoint Web Push autorizzati con chiavi valide e rifiuta origini arbitrarie", () => {
  const receiver = createECDH("prime256v1");
  const keys = {
    p256dh: receiver.generateKeys().toString("base64url"),
    auth: randomBytes(16).toString("base64url"),
  };
  const endpoint = "https://fcm.googleapis.com/fcm/send/sintetico";
  assert.deepEqual(subscription({ endpoint, keys }), { endpoint, keys, expirationTime: null });
  for (const refused of [
    "http://fcm.googleapis.com/fcm/send/sintetico",
    "https://127.0.0.1/health",
    "https://fcm.googleapis.com.altro.example/test",
    "https://account@fcm.googleapis.com/fcm/send/sintetico",
    "https://fcm.googleapis.com:8443/test",
  ]) assert.throws(() => subscription({ endpoint: refused, keys }), { status: 400 });
  assert.throws(() => subscription({ endpoint, keys, expirationTime: 1 }), { status: 400 });
});
