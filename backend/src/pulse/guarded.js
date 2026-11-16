"use strict";
const { requireUser } = require("./auth");
module.exports = (action) =>
  async function (ctx) {
    try {
      const user = await requireUser(ctx, strapi);
      await action(ctx, user, strapi);
    } catch (error) {
      if (error.status) return ctx.throw(error.status, error.message);
      throw error;
    }
  };
