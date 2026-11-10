# Content tab first: leave templates and the Media Library alone - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Content tab first stops switching items under `/sitecore/templates` and `/sitecore/media library` (and in the
Media Library app) to their Content tab, and keeps switching everywhere else.

**Architecture:** A pure decision, `SCT.contentTab.leftAlone(path, ids, search)`, exported from the aid's own file and
unit-tested; `apply` gathers its inputs from the page (Quick Info's path, the content tree's active node's ancestors,
the frame's address) and returns before clicking when it says true. Then the hint, the docs section and its scene.

**Tech Stack:** Plain browser JS (shared with the Sitecore module: no extension APIs, no `Array.from`), `node --test`,
Playwright for the docs shots.

**Spec:** `docs/superpowers/specs/2026-11-09-content-tab-scope-design.md`

## Global Constraints

- Templates root `{3C1715FE-6A13-4FCF-845F-DE308BA9741D}`, media library root `{3D6658D8-A0BF-4E75-B3E2-D050FABCF4E1}`.
- The root itself and everything under it are left alone; `/sitecore/templatesX`-style siblings are not.
- No request to the server per item; the switch stays immediate where it still switches.
- When neither path nor tree is on the page, the aid switches as today.
- No em-dashes or en-dashes in any file.
- Several sessions share this checkout and `extension/lib/settings.js` and `docs/ui-improvements.md` carry other
  sessions' uncommitted edits: commit only your hunks, through a private `GIT_INDEX_FILE` as `AGENTS.local.md` says
  (`read-tree HEAD`, `hash-object -w` HEAD's file plus your hunk, `update-index --cacheinfo`, `write-tree`,
  `commit-tree`, `update-ref`), then refresh the shared index entries for those paths. Never `git checkout`/`reset`/
  `restore`/`stash` the tree.
- Commits: a descriptive subject plus a bullet body.

## Review Focus

1. Quick Info's path in mixed case (`/sitecore/Media Library/...`, `/Sitecore/Templates`): left alone. Pinned in Task 1's test.
2. A sibling whose name starts with a root's name (`/sitecore/templates2`, `/sitecore/media library old`): still switches. Pinned in Task 1's test.
3. No Quick Info (collapsed or absent) but the tree shows the item, with translated display names: decided by the ancestors' IDs. Pinned in Task 1's test (ids only, path null).
4. The tree's active node lagging behind the loaded item (the tree still on the previous item): `apply` uses the tree's ancestors only when the active node's ID is the tab's item ID; otherwise treats the tree as absent. Checked in Task 3's live pass (click from a content folder straight into a media folder via the tree, and via Back).
5. The Template Manager and Media Library apps (`ro=` in the address): left alone whatever the path. Pinned in Task 1's test.

---

### Task 1: The decision and the switch

**Files:**
- Modify: `extension/lib/aids/content-tab.js`
- Create: `test/unit/content-tab.test.js`

**Interfaces:**
- Produces: `SCT.contentTab.leftAlone(path: string | null, ids: string[], search: string): boolean`
  - `path`: Quick Info's item path, or null.
  - `ids`: the content tree's active node and its ancestors, as the 32 upper-case hex digits of their `Tree_Node_`
    ids (no braces, no dashes); empty when the tree does not show the item.
  - `search`: the frame's `location.search`.
  - True when `search` has `ro`, or `path` (case-insensitive) is `/sitecore/templates` or `/sitecore/media library`
    or starts with either plus `/`, or `ids` holds either root's ID. False otherwise, including null path and empty ids.

- [ ] **Step 1: Write the failing test** in `test/unit/content-tab.test.js`, loading the aid the way
  `test/unit/field-length.test.js` does (stub `SCT.registerAid`), one `test("content-tab: ...")` with:

```js
const T = "3C1715FE6A134FCF845FDE308BA9741D", M = "3D6658D8A0BF4E75B3E2D050FABCF4E1";
const HOME = "110D559FDEA542EA9C1C8A5DF7E70EF9", CONTENT = "0DE95AE441AB4D019EB067441B7C2450";
assert.equal(leftAlone("/sitecore/templates", [], ""), true);
assert.equal(leftAlone("/sitecore/templates/Sample/Sample Item", [], ""), true);
assert.equal(leftAlone("/Sitecore/Templates/Sample", [], ""), true);
assert.equal(leftAlone("/sitecore/Media Library/Images", [], ""), true);
assert.equal(leftAlone("/sitecore/templates2/x", [], ""), false);
assert.equal(leftAlone("/sitecore/media library old", [], ""), false);
assert.equal(leftAlone("/sitecore/content/Home", [], ""), false);
assert.equal(leftAlone("/sitecore/layout/Layouts", [], ""), false);
assert.equal(leftAlone(null, ["1234ABCD1234ABCD1234ABCD1234ABCD", M, "11111111111111111111111111111111"], ""), true);
assert.equal(leftAlone(null, [T], ""), true);
assert.equal(leftAlone(null, [HOME, CONTENT, "11111111111111111111111111111111"], ""), false);
assert.equal(leftAlone(null, [], ""), false);
assert.equal(leftAlone(null, [], "?ro=%7B3D6658D8-A0BF-4E75-B3E2-D050FABCF4E1%7D&sc_bw=1"), true);
assert.equal(leftAlone("/sitecore/content/Home", [HOME], "?fo=x&sc_bw=1"), false);
```

- [ ] **Step 2: Run it to see it fail**

Run: `node --test test/unit/content-tab.test.js`
Expected: FAIL, `leftAlone` is not a function (or `SCT.contentTab` undefined).

- [ ] **Step 3: Implement `leftAlone` and use it in `apply`** in `extension/lib/aids/content-tab.js`. Export it as
  `SCT.contentTab = { leftAlone }`. In `apply`, for each unseen Content tab whose item has another editor open, gather
  `path` the way `where-am-i.js` `path()` reads Quick Info (`.scEditorQuickInfo input` whose value starts with
  `/sitecore/`), and `ids` by walking up from `.scContentTree .scContentTreeNodeActive` through `.scContentTreeNode`
  ancestors, each node's `:scope > a` id minus `Tree_Node_`, used only when the active node's ID equals the tab's item
  ID (`tab.id.slice("BContent".length)` with braces and dashes stripped, upper-cased). When `leftAlone` is true, return
  for that tab before marking it seen and without clicking, as the spec says. Update the file's header comment to say which trees it leaves alone.

- [ ] **Step 4: Run the tests**

Run: `npm test`
Expected: `content-tab` passes. `docs.test.js` now fails on the `content-tab` stamp; that is Task 2's.

- [ ] **Step 5: Commit** `extension/lib/aids/content-tab.js` and `test/unit/content-tab.test.js` (both yours alone, a
  plain `git add` of those two paths and `git commit -- <paths>` is fine): "Content tab first: templates and the Media
  Library keep their own editors".

### Task 2: Hint, docs and shots

**Files:**
- Modify: `extension/lib/settings.js:161` (the `content-tab` hint only)
- Modify: `docs/ui-improvements.md` (the `### Content tab first` section)
- Modify: `tools/aid-docs.cjs:137` (the `content-tab` scene)
- Regenerated: `docs/ui-improvements/content-tab-off.png`, `content-tab-on.png`

**Interfaces:**
- Consumes: Task 1's behaviour.

- [ ] **Step 1: Hint.** Set the hint to: `"Opens every item on its Content tab, not on a Folder or other editor tab, except in the templates and the Media Library, which keep their own"`.
- [ ] **Step 2: Docs section.** In **What it is for**, drop the media folder from the examples. In **What changes**,
  replace the Media Library sentence with: items under `/sitecore/templates` (the Template Builder) and
  `/sitecore/media library` (a folder's thumbnails), and the Media Library app, open on the tab Sitecore picks.
- [ ] **Step 3: Scene.** Point the `content-tab` scene's `path` at a stock 10.4 item outside both trees that opens on
  a non-Content tab with the aid off (a folder under `/sitecore/layout` or `/sitecore/system`; confirm on specm with the
  aid off that it opens on its Folder tab). Add a `const` for its ID beside `HOME` and `MEDIA`.
- [ ] **Step 4: Shoot and stamp.**

Run: `node tools/aid-docs.cjs content-tab`
Expected: both PNGs rewritten; the off shot shows the Folder tab active, the on shot the Content tab. Read both images.

- [ ] **Step 5: Run the tests**

Run: `npm test`
Expected: all pass.

- [ ] **Step 6: Commit** through a private index (both `settings.js` and `docs/ui-improvements.md` carry other
  sessions' edits): only the hint line, the section, the scene and the two PNGs. Subject: "Content tab first docs: the
  templates and the Media Library keep their editors".

### Task 3: Verify in the user's Chrome

- [ ] **Step 1:** Follow `sct-verify`. Post `{type: "sct-dev-reload"}` from a specm page, reload the tab.
- [ ] **Step 2:** In the Content Editor (`/sitecore/shell`, Content Editor from the Desktop) on specm, open by
  clicking in the tree: a content folder (opens on Content), `/sitecore/templates/Sample/Sample Item` (stays on
  Builder), `/sitecore/templates/Sample` (stock tab), a media folder (stays on its thumbnails), then Back to the
  content folder (Content again). Then the Media Library app from the Launchpad: a media folder stays on thumbnails.
  Check the Content Editor frame's `data-sct-*` attributes say the aid ran.
- [ ] **Step 3:** Collapse Quick Info and repeat the template and media folder opens (the tree path).
- [ ] **Step 4:** Report what was checked, where, with the screenshots read, and what was not.
