const { test } = require("node:test"),
  a = require("node:assert/strict"),
  { sanitize } = require("../src/pulse/flow/svg");
test("SVG Flow rifiuta contenuto attivo, URL esterni e dichiarazioni XML non autorizzate", () => {
  const safe = '<svg viewBox="0 0 20 20"><g><path d="M0 0h1v1z"/></g></svg>';
  a.equal(sanitize(safe), safe);
  for (const injected of [
    "<script>alert(1)</script>",
    '<image href="https://invalid.example/a.svg"/>',
    '<g onload="alert(1)"></g>',
    '<path style="fill:url(https://invalid.example/a)"/>',
    '<!ENTITY test SYSTEM "file:///etc/passwd">',
  ])
    a.throws(() => sanitize(safe.replace("<g>", injected + "<g>")));
});
