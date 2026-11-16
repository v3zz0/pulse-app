const { test } = require("node:test");
const assert = require("node:assert/strict");
const { checkJson } = require("../src/middlewares/request-guard");
test("richieste API limitate prima della validazione: profondità e collezioni", () => {
  assert.doesNotThrow(() => checkJson({ action: "set", actualKg: 50 }));
  assert.throws(() => checkJson({ items: Array(257).fill(0) }), /Collezione/);
  let value = {};
  for (let i = 0; i < 18; i++) value = { child: value };
  assert.throws(() => checkJson(value), /complessa/);
});
test("override correttivi sono realmente risolti nel lockfile", () => {
  const fs = require("fs"),
    path = require("path"),
    lock = JSON.parse(
      fs.readFileSync(path.join(__dirname, "../package-lock.json")),
    );
  assert.equal(lock.packages["node_modules/zod"].version, "4.6.7");
  assert.equal(
    lock.packages["node_modules/@modelcontextprotocol/node"].version,
    "2.1.2",
  );
});
