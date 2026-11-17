"use strict";
const { protect } = require("../../../../pulse/training-day-cards");
module.exports = {
  beforeCreate: protect,
  beforeUpdate: protect,
  beforeUpdateMany: protect,
  beforeDelete: protect,
  beforeDeleteMany: protect,
};
