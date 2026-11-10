const test = require("node:test");
const assert = require("node:assert/strict");

globalThis.SCT = globalThis.SCT || {};
globalThis.SCT.registerAid ||= () => {};
globalThis.SCT.important ||= (css) => css;
require("../../extension/lib/aids/field-sizes.js");
const { fieldKey, ownOf, heightOf, choose } = globalThis.SCT.fieldSize;

test("field-sizes: a field's own height, else its type's", () => {
  const entry = { height: 300, fields: { A: 120 } };
  assert.equal(heightOf(entry, "A"), 120);
  assert.equal(heightOf(entry, "B"), 300); // sized with its type
  assert.equal(heightOf(entry, null), 300); // no key: the type's
  assert.equal(heightOf({}, "A"), null); // Sitecore's
  assert.equal(ownOf(entry, "A"), true);
  assert.equal(ownOf(entry, "B"), false);
  assert.equal(ownOf(entry, null), false);
});

test("field-sizes: a drag, the switch both ways, and the type's reset", () => {
  const entry = { mode: "cover", height: 300, fields: { A: 120 } };
  // a drag on a field sized with its type sets the type's height; a field with its own keeps it
  assert.deepEqual(choose(entry, "type", "B", 200), { mode: "cover", height: 200, fields: { A: 120 } });
  // its own height, from the height it has now
  assert.deepEqual(choose(entry, "own", "B", 300), { mode: "cover", height: 300, fields: { A: 120, B: 300 } });
  // sized with its type again
  assert.deepEqual(choose(entry, "group", "A"), { mode: "cover", height: 300, fields: {} });
  // Sitecore's height for the type; own heights stay
  assert.deepEqual(choose(entry, "reset"), { mode: "cover", fields: { A: 120 } });
});

test("field-sizes: a field's key is its template field's ID, or its name when Sitecore's markup has none", () => {
  const cell = (html, label) => ({ innerHTML: html, querySelector: () => label });
  const text = (t) => ({ nodeType: 3, textContent: t });
  const shared = { nodeType: 1, textContent: " [shared]", matches: () => true };
  assert.equal(fieldKey(cell("onfocus=\"...?fld={a60acd61-a6db-4182-8329-c957982cec74}&amp;ctl=F1\"")), "A60ACD61-A6DB-4182-8329-C957982CEC74");
  assert.equal(fieldKey(cell("src=\"...&amp;fld=%7BA60ACD61-A6DB-4182-8329-C957982CEC74%7D\"")), "A60ACD61-A6DB-4182-8329-C957982CEC74");
  assert.equal(fieldKey(cell("<div>no id</div>", { childNodes: [text("Insert Options"), shared, text(":")] })), "name:insert options");
  assert.equal(fieldKey(cell("", { childNodes: [text("Text - Please enter text:")] })), "name:text");
});
