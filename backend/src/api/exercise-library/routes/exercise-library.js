"use strict";
module.exports = {
  routes: ["GET", "POST"].map((method) => ({
    method,
    path: "/pulse/exercise-library",
    handler: "exercise-library." + (method === "GET" ? "list" : "create"),
    config: { auth: false },
  })),
};
