const test = require("node:test");
const assert = require("node:assert/strict");

globalThis.SCT = globalThis.SCT || {};
globalThis.SCT.registerAid ||= () => {};
globalThis.SCT.important ||= (css) => css;
require("../../extension/lib/aids/item-info.js");
const { published } = globalThis.SCT.itemInfo;

const v = (ver, date = "4/19/2026 6:21 PM", user = "sitecore\\jsmith") => ({ ver: String(ver), date, user });
const said = (p) => [p.state, p.text, p.next && p.next.state, p.next && p.next.text];

test("item-info: the Published chip, from web's versions against master's newest and its workflow state", () => {
  // the newest is live, and unchanged since
  assert.deepEqual(said(published([v(1), v(2)], [v(2)])), ["yes", "Published · v2", null, null]);
  // the same version, changed after it was published
  assert.deepEqual(said(published([v(2, "4/20/2026 9:00 AM")], [v(2)])), ["yes", "Live v2", "edited", "edited since"]);
  // an older version live, the newer one in workflow, or ready
  const flow = { workflow: "Sample Workflow", state: "Awaiting Approval", final: false };
  assert.deepEqual(said(published([v(2), v(3)], [v(2)], flow)), ["yes", "Live v2", "flow", "v3 · Awaiting Approval"]);
  assert.deepEqual(said(published([v(2), v(3)], [v(2)], { ...flow, state: "Approved", final: true })), ["yes", "Live v2", "ready", "v3 ready to publish"]);
  assert.deepEqual(said(published([v(2), v(3)], [v(2)], { workflow: null })), ["yes", "Live v2", "ready", "v3 ready to publish"]);
  assert.deepEqual(said(published([v(2), v(3)], [v(2)], null)), ["yes", "Live v2", "ready", "v3 not published"]);
  // nothing in web
  assert.deepEqual(said(published([v(1)], [], { ...flow, state: "Draft" })), ["no", "Not published", "flow", "v1 · Draft"]);
  assert.deepEqual(said(published([v(1)], [], { workflow: null })), ["no", "Not published", "ready", "v1 ready to publish"]);
  assert.deepEqual(said(published([v(1)], [], null)), ["no", "Not published", null, null]);
  // web holds a version master no longer has
  assert.deepEqual(said(published([v(1), v(2)], [v(4)])), ["yes", "Live v4", "gone", "not in master"]);
  assert.equal(published([v(2), v(3)], [v(2)], flow).title, "Version 2 is live in the web database. Version 3 is in the Awaiting Approval state of the Sample Workflow workflow.");
});
