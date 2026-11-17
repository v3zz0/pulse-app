const r = (method, path, handler) => ({
  method,
  path: "/pulse" + path,
  handler: "supplements." + handler,
  config: { auth: false },
});
module.exports = {
  routes: [
    r("POST", "/supplements", "create"),
    r("GET", "/supplements/history", "history"),
    r("GET", "/supplements/day/:day", "dashboard"),
    r("PUT", "/supplements/day/:day", "mode"),
    r("PUT", "/supplements/:id", "update"),
  ],
};
