"use strict";
const { sync } = require("../../../../pulse/training-day-cards");
module.exports = {
  async afterCreate(event) {
    await sync(strapi, event.result.id);
  },
  async afterUpdate(event) {
    if (
      ["days", "title", "cooldown", "owner"].some((k) =>
        Object.hasOwn(event.params.data, k),
      )
    )
      await sync(strapi, event.result.id);
  },
};
