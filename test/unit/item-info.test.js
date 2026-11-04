const test = require("node:test");
const assert = require("node:assert/strict");

globalThis.SCT = globalThis.SCT || {};
globalThis.SCT.registerAid ||= () => {};
globalThis.SCT.important ||= (css) => css;
require("../../extension/lib/aids/item-info.js");
const { published, candidate, when } = globalThis.SCT.itemInfo;

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

test("item-info: publishing settings hold back the item or a version, and the pill says what the next publish does", () => {
  const now = new Date(2026, 10, 2, 12, 0);
  const at = (text) => ({ text, at: when(text) });
  const soon = at("11/12/2026 9:00 AM");
  const gone = at("11/1/2026 3:03 PM");
  const rules = (over = {}, versions = {}) => ({ publishable: true, from: null, to: null, targets: [], versions, ...over });
  const ver = (over = {}) => ({ publishable: true, from: null, to: null, ...over });
  const go = (mine, web, flow, r) => said(published(mine, web, flow, r, now));
  const approved = { workflow: "Sample Workflow", state: "Approved", final: true };

  assert.deepEqual([when("11/1/2026"), when("1.11.2026 15:03")].map((d) => d.toISOString()), [new Date(2026, 10, 1).toISOString(), new Date(2026, 10, 1, 15, 3).toISOString()]);
  // the whole item held back: one grey part when nothing is live, the live one comes down otherwise
  assert.deepEqual(go([v(1)], [], null, rules({ publishable: false })), ["held", "Never publishes", null, null]);
  assert.deepEqual(go([v(1)], [], null, rules({ from: soon })), ["held", "Publishes from 12 Nov", null, null]);
  assert.deepEqual(go([v(1)], [], null, rules({ targets: ["Preview"] })), ["held", "Not for web", null, null]);
  assert.deepEqual(go([v(2)], [v(2)], undefined, rules({ publishable: false })), ["yes", "Live v2", "down", "comes down on next publish"]);
  assert.deepEqual(go([v(2)], [v(2)], undefined, rules({ to: gone })), ["yes", "Live v2", "down", "comes down on next publish"]);
  assert.deepEqual(go([v(2)], [v(2)], undefined, rules({ targets: ["Internet"] })), ["yes", "Published · v2", null, null]);
  // live until a date
  assert.deepEqual(go([v(2)], [v(2)], undefined, rules({ to: soon })), ["yes", "Live v2", "held", "until 12 Nov"]);
  // the newest version held back, the live one stays
  assert.deepEqual(go([v(2), v(3)], [v(2)], undefined, rules({}, { 3: ver({ publishable: false }) })), ["yes", "Live v2", "held", "v3 not publishable"]);
  assert.deepEqual(go([v(2), v(3)], [v(2)], undefined, rules({}, { 3: ver({ from: soon }) })), ["yes", "Live v2", "held", "v3 from 12 Nov"]);
  // the newest held back, an older one waits: it is the one asked about and shown, the tooltip names the newest
  const r3 = rules({}, { 3: ver({ publishable: false }) });
  assert.equal(candidate([v(1), v(2), v(3)], r3, now), 2);
  const p = published([v(1), v(2), v(3)], [v(1)], approved, r3, now);
  assert.deepEqual(said(p), ["yes", "Live v1", "ready", "v2 ready to publish"]);
  assert.match(p.title, /Version 3's Publishable box is unticked\.$/);
  // the live version expired: an older one goes back, or nothing is left
  assert.deepEqual(go([v(1), v(2)], [v(2)], undefined, rules({}, { 2: ver({ to: gone }) })), ["yes", "Live v2", "down", "back to v1 on next publish"]);
  assert.deepEqual(go([v(1)], [v(1)], undefined, rules({}, { 1: ver({ publishable: false }) })), ["yes", "Live v1", "down", "comes down on next publish"]);
  // nothing live and no version can go
  assert.deepEqual(go([v(1)], [], null, rules({}, { 1: ver({ publishable: false }) })), ["held", "Not publishable", null, null]);
  // no settings read: as before
  assert.deepEqual(go([v(1), v(2)], [v(2)], undefined, null), ["yes", "Published · v2", null, null]);
});

test("item-info: the Stored pill, from where the module says the item lives", () => {
  const { stored } = globalThis.SCT.itemInfo;
  const said = (at) => { const s = stored(at, "master"); return s && [s.state, s.text]; };
  assert.deepEqual(said({ resource: true, sql: false }), ["resource", "In resource files"]);
  assert.deepEqual(said({ resource: false, sql: true }), ["sql", "In database"]);
  assert.deepEqual(said({ resource: true, sql: true }), ["both", "Database overrides resource"]);
  // no module, or nothing found: no pill
  assert.equal(stored(null, "master"), null);
  assert.equal(stored({ resource: false, sql: false }, "master"), null);
});
