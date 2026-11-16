const r = (method, path, handler) => ({
  method,
  path: "/pulse" + path,
  handler: "reminders." + handler,
  config: { auth: false },
});
module.exports = {
  routes: [
    r("GET", "/reminders", "list"),
    r("GET", "/reminders/due", "due"),
    r("PUT", "/reminders/:id", "save"),
    r("GET", "/weekly/:day", "weekly"),
  ],
};
