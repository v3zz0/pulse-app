const r = (path, handler) => ({
  method: "GET",
  path: "/pulse/flow" + path,
  handler: "flow." + handler,
  config: { auth: false },
});
module.exports = {
  routes: [
    r("/search", "search"),
    r("/exercises/:id", "exercise"),
    r("/assets/:revision/:id/:frame", "asset"),
  ],
};
