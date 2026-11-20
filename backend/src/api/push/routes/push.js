"use strict";
const route = (method, path, handler) => ({
  method,
  path: "/pulse/push" + path,
  handler: "push." + handler,
  config: { auth: false },
});
module.exports = { routes: [
  route("GET", "/status", "status"),
  route("PUT", "/device", "register"),
  route("DELETE", "/device", "remove"),
  route("POST", "/test", "test"),
  route("POST", "/messages/:receipt", "claim"),
] };
