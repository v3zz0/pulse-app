const route = (method, path, handler) => ({
  method,
  path: "/pulse" + path,
  handler: "training." + handler,
  config: { auth: false },
});
module.exports = {
  routes: [
    route("GET", "/training", "overview"),
    route("PUT", "/training/standard", "standard"),
    route("POST", "/training/sessions", "start"),
    route("PUT", "/training/sessions/:clientId", "operation"),
  ],
};
