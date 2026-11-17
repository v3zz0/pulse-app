"use strict";
const r = (method, path, handler) => ({
  method,
  path: "/pulse" + path,
  handler: "plans." + handler,
  config: { auth: false },
});
module.exports = {
  routes: [
    r("GET", "/personal-settings", "settings"),
    r("PUT", "/personal-settings", "saveSettings"),
    r("GET", "/plans/:kind/template", "template"),
    r("POST", "/plans/:kind/preview", "preview"),
    r("POST", "/plans/:kind/import", "import"),
    r("GET", "/plans/:kind", "list"),
    r("POST", "/plans/:kind/editor", "createManual"),
    r("GET", "/plans/:kind/:id/editor", "editor"),
    r("PUT", "/plans/:kind/:id/editor", "saveManual"),
    r("POST", "/plans/:kind/:id/duplicate", "duplicate"),
    r("POST", "/plans/:kind/:id/remove", "remove"),
    r("GET", "/plans/:kind/:id/export", "export"),
    r("GET", "/plans/:kind/:id", "detail"),
    r("PUT", "/plans/:kind/:id", "change"),
  ],
};
