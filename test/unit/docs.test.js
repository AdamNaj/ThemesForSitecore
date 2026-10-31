const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { AIDS } = require("../../extension/lib/settings.js");
const { stamp, SCENES, pageOf } = require("../../tools/aid-docs.cjs");

const DOCS = path.join(__dirname, "..", "..", "docs");
const pages = Object.fromEntries(["accessibility", "ui-improvements"].map((p) => [p, fs.readFileSync(path.join(DOCS, `${p}.md`), "utf8")]));

test("docs/accessibility.md and docs/ui-improvements.md describe every aid and improvement as its code is now", () => {
  for (const id of Object.keys(AIDS)) {
    assert.ok(SCENES[id], `${id} has no scene in tools/aid-docs.cjs`);
    const page = pageOf(id);
    const m = new RegExp(`<!-- aid:${id}(?: ([0-9a-f]+))? -->`).exec(pages[page]);
    assert.ok(m, `docs/${page}.md has no section for ${id}: add one, with <!-- aid:${id} --> and a <!-- shots:${id} --> block`);
    assert.equal(m[1], stamp(id), `${id} changed since docs/accessibility.md described it: read its section again, then run node tools/aid-docs.cjs ${id} (shoots and stamps it; --stamp ${id} only stamps)`);
  }
});

test("every picture the two pages show exists", () => {
  for (const doc of Object.values(pages)) {
    for (const [, file] of doc.matchAll(/\]\(((?:accessibility|ui-improvements)\/[^)]+)\)/g)) assert.ok(fs.existsSync(path.join(DOCS, file)), file);
  }
});
