const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { AIDS } = require("../../extension/lib/settings.js");
const { stamp, SCENES } = require("../../tools/aid-docs.cjs");

const DOCS = path.join(__dirname, "..", "..", "docs");
const doc = fs.readFileSync(path.join(DOCS, "accessibility.md"), "utf8");

test("docs/accessibility.md describes every aid as its code is now", () => {
  for (const id of Object.keys(AIDS)) {
    assert.ok(SCENES[id], `${id} has no scene in tools/aid-docs.cjs`);
    const m = new RegExp(`<!-- aid:${id}(?: ([0-9a-f]+))? -->`).exec(doc);
    assert.ok(m, `docs/accessibility.md has no section for ${id}: add one, with <!-- aid:${id} --> and a <!-- shots:${id} --> block`);
    assert.equal(m[1], stamp(id), `${id} changed since docs/accessibility.md described it: read its section again, then run node tools/aid-docs.cjs ${id} (shoots and stamps it; --stamp ${id} only stamps)`);
  }
});

test("every picture docs/accessibility.md shows exists", () => {
  for (const [, file] of doc.matchAll(/\]\((accessibility\/[^)]+)\)/g)) assert.ok(fs.existsSync(path.join(DOCS, file)), file);
});
