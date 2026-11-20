// Test broker for the local Docker stack. Intercepts only synthetic FCM endpoints.
const https = require("node:https");
const { appendFileSync } = require("node:fs");
const { Readable, Writable } = require("node:stream");

if (process.env.PULSE_ENV === "production" || !process.env.PULSE_TEST_PUSH_OUT)
  throw new Error("Test broker available only on the local test stack");

const request = https.request;
https.request = function (options, callback) {
  if (options.hostname !== "fcm.googleapis.com" || !options.path?.startsWith("/fcm/send/pulse-test-"))
    return request.apply(this, arguments);
  const chunks = [];
  return new Writable({
    write(chunk, encoding, done) { chunks.push(Buffer.from(chunk)); done(); },
    final(done) {
      const code = options.path.endsWith("-gone") ? 410 : 201;
      const out = {
        path: options.path, code, encoding: options.headers["Content-Encoding"],
        vapid: /^vapid t=/.test(options.headers.Authorization),
        ttl: Number(options.headers.TTL),
        payload: Buffer.concat(chunks).toString("base64"),
      };
      appendFileSync(process.env.PULSE_TEST_PUSH_OUT, JSON.stringify(out) + "\n");
      const response = Readable.from([]);
      response.statusCode = code;
      response.headers = {};
      callback(response);
      done();
    },
  });
};
