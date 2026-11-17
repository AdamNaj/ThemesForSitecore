const test = require("node:test");
const assert = require("node:assert/strict");

globalThis.SCT = globalThis.SCT || {};
globalThis.SCT.registerAid ||= () => {};
globalThis.SCT.important ||= (css) => css;
require("../../extension/lib/aids/list-items.js");
const { fromValue, fromNode, fromPath, parentPath } = globalThis.SCT.listItems;

test("list-items: the item a row names, from an option's value, a tree node's id and a TreelistEx row's title", () => {
  assert.equal(fromValue("{1930bbeb-7805-471a-a3be-4858ac7cf696}"), "{1930BBEB-7805-471A-A3BE-4858AC7CF696}");
  assert.equal(fromValue("I91131632|{1930BBEB-7805-471A-A3BE-4858AC7CF696}"), "{1930BBEB-7805-471A-A3BE-4858AC7CF696}"); // a Treelist's
  assert.equal(fromValue("ID View"), null); // a Droplist's value is a name
  assert.equal(fromValue(""), null);
  assert.equal(fromNode("FIELD91131558_all_3C1715FE6A134FCF845FDE308BA9741D"), "{3C1715FE-6A13-4FCF-845F-DE308BA9741D}");
  assert.equal(fromNode("FIELD91131558_all"), null);
  assert.equal(fromPath("/sitecore/templates/Sample/Sample Item"), "/sitecore/templates/Sample/Sample Item");
  assert.equal(fromPath("/Home/About"), "/sitecore/content/Home/About"); // a content path
  assert.equal(fromPath("Home"), null);
  assert.equal(fromPath(""), null);
});

test("list-items: the path shown is the item's parent's, without /sitecore", () => {
  assert.equal(parentPath("/sitecore/content/Home/About"), "/content/Home");
  assert.equal(parentPath("/sitecore/content"), "/");
  assert.equal(parentPath("/sitecorex/Home/About"), "/sitecorex/Home");
  assert.equal(parentPath("/sitecore"), null);
  assert.equal(parentPath(undefined), null);
});
