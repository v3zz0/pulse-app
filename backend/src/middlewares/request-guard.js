"use strict";
// The personal app uses only its cookie API; native JWT login/reset/connect and MCP are unused.
function checkJson(value) {
  let count = 0;
  const visit = (v, depth) => {
    if (++count > 2048 || depth > 16)
      throw Object.assign(new Error("Richiesta troppo complessa"), {
        status: 413,
      });
    if (Array.isArray(v) && v.length > 256)
      throw Object.assign(new Error("Collezione troppo grande"), {
        status: 413,
      });
    if (v && typeof v === "object")
      for (const x of Object.values(v)) visit(x, depth + 1);
  };
  visit(value, 0);
}
module.exports = () => async (ctx, next) => {
  if (ctx.path === "/mcp" || ctx.path.startsWith("/mcp/"))
    return ctx.throw(404);
  if (
    ctx.path.startsWith("/api/") &&
    !ctx.path.startsWith("/api/pulse/") &&
    ctx.path !== "/api/auth/local/register" &&
    ctx.path !== "/api/users/me"
  )
    return ctx.throw(403, "Endpoint non disponibile");
  if (ctx.path.startsWith("/api/pulse/") && ctx.request.body)
    checkJson(ctx.request.body);
  await next();
};
module.exports.checkJson = checkJson;
