"use strict";
const route = (method, path, handler) => ({
  method,
  path: "/pulse" + path,
  handler: "pulse." + handler,
  config: { auth: false },
});
module.exports = {
  routes: [
    route("POST", "/login", "login"),
    route("POST", "/logout", "logout"),
    route("GET", "/me", "me"),
    route("PUT", "/profile", "profile"),
    route("GET", "/nutrition", "nutrition"),
    route("GET", "/days/:day", "day"),
    route("PUT", "/days/:day", "updateDay"),
    route("GET", "/preferences", "preferences"),
    route("PUT", "/preferences", "savePreference"),
    route("GET", "/weights", "weights"),
    route("PUT", "/weights/:day", "saveWeight"),
    route("GET", "/supplements", "supplements"),
    route("PUT", "/intakes/:day", "saveIntake"),
    route("GET", "/intakes/:day", "intakes"),
  ],
};
