# Accessibility aids, phase 0 (foundation) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The machinery every later aid runs on: the needs and aids settings, an aids runner in the engine, the
popup's needs chips and fine-tune list, the Sitecore module carrying the new settings, and an axe baseline, proven
end to end by one real aid (`frame-titles`).

**Architecture:** The catalogue of needs and aids is data in `extension/lib/settings.js` (the background, the popup
and the engine all load it). Each aid's code is `extension/lib/aids/<id>.js`, registered with `SCT.registerAid`
next to `SCT.registerTheme` in `dom-kit.js`. The engine's `applyAccess` gains a runner that keeps one DOM kit per
running aid and one mutation observer for all of them, separate from the theme's.

**Tech Stack:** Plain browser JS (no build step), `node --test`, Playwright, axe-core (new dev dependency), C#
(.NET Framework, the Sitecore module's processor).

**Spec:** `docs/superpowers/specs/2026-10-27-accessibility-aids-design.md` (Section 4, phase 0).

## Deviations from the spec (approve or reject in review)

1. **Font, spacing and the colour filter stay where they are** (`settings.js`, `applyAccess`) instead of moving
   into `aids/font.js`, `aids/spacing.js`, `aids/vision.js`. They are valued settings, not on/off aids, and they
   work today; moving them buys nothing in phase 0. The catalogue is for toggleable aids.
2. **`frame-titles` moves from phase 1 to phase 0** as the pilot aid, so the runner, the always-on rule, the
   fine-tune list and the axe baseline have something real to run.
3. **One DOM kit per aid**, not one for all, so an aid that throws can be reverted alone (Section 2's failure rule).
   The observer stays shared.
4. **Needs preset the font and spacing at the moment you tick them, in the UI**, and only when those rows are on
   their plain choice. There is no stored "preset vs own" state; the first need ticked wins a conflict.

## Global Constraints

- No em-dashes or en-dashes in any file; use a hyphen.
- Files in `extension/lib/` are shared with the Sitecore module: no extension APIs, no `Array.from` (Prototype.js
  replaces it).
- Never touch a child frame's `contentDocument` from a parent frame (this phase's aids never need to).
- Nothing Sitecore ships is removed or overwritten: an existing attribute value is left as it is.
- Native with no needs picked means "do nothing": no aid runs.
- Commits: several sessions share this checkout. Commit only your files through a private index:
  `GIT_INDEX_FILE=.git/sct-<task>-index git read-tree HEAD`, `git update-index --add <files>`, `git write-tree`,
  `git commit-tree <tree> -p HEAD -m <subject> -m <bullets>`, `git update-ref refs/heads/main <commit> HEAD`,
  then without `GIT_INDEX_FILE` run `git update-index --add <files>`. Subject plus bullet body, no attribution.
- `npm test` passes after every task.

## Review Focus

1. **Settings saved before this change** (the old `{ font, spacing, vision, strength }` in `storage.sync` and in
   a Sitecore user's profile) load exactly as before. Pinned in Task 1 (JS); the C# side has no test harness, so
   Task 8 Step 2 checks a user's saved font survives the new `ReadAccess`.
2. **A theme switch while aids are on**: the theme's `revertDom` must not undo the aids, and the aids must not undo
   the theme's DOM module. Pinned in Task 3 (Fjord to Chicago).
3. **Frames Sitecore adds after load** (a Desktop window opening, a dialog) get named on the next pass. Pinned in
   Task 3.
4. **An engine that stops** (Disable on this site, an extension reload's handover) leaves the page exactly as
   Sitecore built it. Pinned in Task 3.
5. **A frame whose `title` Sitecore (or a project) already set** keeps it. Pinned in Task 3.

---

### Task 1: The needs and aids settings

**Files:**
- Modify: `extension/lib/settings.js` (the accessibility block, about lines 95-160, and the export)
- Test: `test/unit/settings.test.js`

**Interfaces:**
- Produces, on `SCT.settings`:
  - `NEEDS`: `{ "screen-reader": "Screen reader", keyboard: "Keyboard", "low-vision": "Low vision",
    "colour-vision": "Colour vision", reading: "Reading and focus", motion: "Motion" }` (key order is the UI's).
  - `NEED_PRESETS`: `{ "low-vision": { font: "hyperlegible" }, reading: { font: "opendyslexic", spacing: "wide" } }`.
  - `AIDS`: `{ "frame-titles": { needs: ["screen-reader"], always: true, surfaces: null, name: "Frame names",
    hint: "Names each frame, so a screen reader says what it holds" } }`. `surfaces: null` means every surface,
    otherwise an array of `detect.js` surface names.
  - `accessibility(value)` returns `null` when nothing is set, else
    `{ font, spacing, vision, strength, needs: string[], aids: { [id]: boolean } }`.
  - `enabledAids(a, { themed, surface })` returns aid ids in `AIDS` order.
  - `aidReason(a, id)` returns `"own"`, a need id, `"always"` or `null`.

- [ ] **Step 1: Write the failing tests** in `test/unit/settings.test.js`:

```js
test("a site's needs and aids: unknown ones are dropped, old saved values still load", () => {
  // saved before needs existed: same values, empty needs and aids
  assert.deepEqual(settings.accessibility({ font: "opendyslexic" }),
    { font: "opendyslexic", spacing: null, vision: null, strength: null, needs: [], aids: {} });
  assert.equal(settings.accessibility({ needs: ["telepathy"], aids: { "x-ray": true } }), null);
  // needs come back once each, in NEEDS order; aids keep only known ids with boolean values
  assert.deepEqual(settings.accessibility({ needs: ["reading", "keyboard", "reading"] }).needs, ["keyboard", "reading"]);
  assert.deepEqual(settings.accessibility({ aids: { "frame-titles": false, "x-ray": true } }).aids, { "frame-titles": false });
  assert.deepEqual(settings.accessibility({ aids: { "frame-titles": "yes" } }), null);
});

test("which aids run: always-on aids on themed sites, needs anywhere, your choice over both", () => {
  const on = (a, themed) => settings.enabledAids(settings.accessibility(a), { themed, surface: "shell" });
  assert.deepEqual(settings.enabledAids(null, { themed: true, surface: "shell" }), ["frame-titles"]);
  assert.deepEqual(settings.enabledAids(null, { themed: false, surface: "shell" }), []); // Native does nothing
  assert.deepEqual(on({ needs: ["motion"] }, false), ["frame-titles"]); // any need wakes the always-on aids
  assert.deepEqual(on({ needs: ["screen-reader"] }, false), ["frame-titles"]);
  assert.deepEqual(on({ aids: { "frame-titles": false } }, true), []);
  assert.deepEqual(on({ aids: { "frame-titles": true } }, false), ["frame-titles"]);
  assert.equal(settings.aidReason(settings.accessibility({ aids: { "frame-titles": false } }), "frame-titles"), "own");
  assert.equal(settings.aidReason(settings.accessibility({ needs: ["screen-reader"] }), "frame-titles"), "screen-reader");
  assert.equal(settings.aidReason(null, "frame-titles"), "always");
});

test("every aid's needs exist, every aid is named, every preset is a real value", () => {
  for (const [id, aid] of Object.entries(settings.AIDS)) {
    for (const n of aid.needs) assert.ok(Object.hasOwn(settings.NEEDS, n), `${id}: ${n}`);
    assert.ok(aid.name && aid.hint, id);
  }
  for (const [n, p] of Object.entries(settings.NEED_PRESETS)) {
    assert.ok(Object.hasOwn(settings.NEEDS, n), n);
    if (p.font) assert.ok(Object.hasOwn(settings.FONTS, p.font), n);
  }
});
```

(`fs` and `ext` as in the existing accessibility test; lift them to the file's top.)

- [ ] **Step 2: Run** `npm test`. Expected: the new tests FAIL (`enabledAids is not a function`, the deepEqual on
  the old shape fails).

- [ ] **Step 3: Implement** in `settings.js`. `accessibility()` keeps its current checks for font, spacing,
  vision and strength, adds `needs` and `aids`, and returns `null` only when all six are empty.
  `enabledAids`: an aid runs when `a.aids[id] === true`; never when `=== false`; otherwise when one of its needs
  is in `a.needs`, or when it is `always` and (`themed` or `a.needs.length`). Then filter by `surfaces`, except
  when `surface` is `null` (the popup's view: no filter). Both functions treat `a === null` as no settings.
  `aidReason`: `"own"` when `a.aids` has the id, else the first of its needs in `a.needs`, else `"always"` when
  `always`, else `null`. Extend the existing "unknown values are off" test's `deepEqual` to the new shape.

- [ ] **Step 4: Run** `npm test`. Expected: PASS.

- [ ] **Step 5: Commit** `extension/lib/settings.js`, `test/unit/settings.test.js`: "Accessibility needs and the
  aids catalogue in settings".

### Task 2: `listen` and `registerAid` in the DOM kit

**Files:**
- Modify: `extension/lib/dom-kit.js`
- Test: `test/e2e/domkit.spec.js`

**Interfaces:**
- Produces: `kit.listen(target, type, fn, options)`: adds the listener, records an undo that removes it.
  `SCT.registerAid(id, { apply(ctx), revert?(ctx) })` stores into `SCT.aidModules` (created like `SCT.domModules`).

- [ ] **Step 1: Write the failing test** `"listen's handler is gone after revertAll"` in `domkit.spec.js`: listen
  for `click` on `#close` with a counter, `click()` once, `revertAll()`, `click()` again; expect the counter to be
  `1`. And `"registerAid stores a module by id"`: `SCT.registerAid("t", m)`, expect `SCT.aidModules.t === m`.
- [ ] **Step 2: Run** `npx playwright test domkit`. Expected: FAIL, `kit.listen is not a function`.
- [ ] **Step 3: Implement** both in `dom-kit.js`; return `listen` from `createDomKit`.
- [ ] **Step 4: Run** `npx playwright test domkit`. Expected: PASS.
- [ ] **Step 5: Commit** "DOM kit: listen with undo, and registerAid for accessibility aids".

### Task 3: The aids runner and the `frame-titles` aid

**Files:**
- Create: `extension/lib/aids/frame-titles.js`
- Modify: `extension/lib/engine.js` (`applyAccess` about line 629, `doRequestTheme` about line 94, `start` about
  line 923, `stop` about line 400)
- Modify: `extension/background.js` (`contentFiles`), `tools/build-sitecore.mjs` (`bundle`)
- Create: `test/e2e/fixtures/site/sitecore/shell/aids.html`, `test/e2e/aids.spec.js`
- Modify: `playwright.config.js` (the fixtures project's `testMatch` gains `aids`)
- Test: `test/unit/build.test.js`

**Interfaces:**
- Consumes: `SCT.settings.enabledAids`, `SCT.settings.AIDS` (Task 1); `kit.listen`, `SCT.aidModules` (Task 2).
- Produces: the aid context `ctx = { surface, version, doc, top, own, addClass, setAttr, move, listen }` (the last
  five bound to that aid's kit; `top` is the engine's `TOP`). Engine functions `syncAids()` (works out the set,
  reverts aids that left it, applies new ones) and `runAids()` (re-runs `apply` for every running aid, on the
  observer's animation frame). Dev hook `html.dataset.sctAidsMs` through `noteMs(ms, "sctAidsMs")`.
- Script order: `lib/aids/<id>.js` for every `SCT.settings.AIDS` key, after `lib/dom-kit.js` and before
  `lib/engine.js`, in both `contentFiles()` and `bundle()`.

**`frame-titles` decisions.** On `frame` and `iframe` elements with no `title` attribute, or an empty one, and a
`src` other than empty or `about:blank`, set `title` from the decoded `src` path, first match wins:

| Path ends with (case-insensitive) | Title |
|---|---|
| `/Content Editor.aspx` | `Content Editor` |
| `/Controls/JqueryModalDialogs.html` | `Dialog` |
| `/Rich Text Editor/EditorWindow.aspx` | `Rich text editor` |
| `/Rich Text Editor/Preview.aspx` | `Rich text preview` |
| `/ExperienceEditor/Ribbon.aspx` | `Experience Editor ribbon` |
| `.SecurityDetails.aspx` | `Security details` |
| anything else | `Sitecore: ` + the last path segment without its extension, and for a dotted xaml name only the part after the last dot |

It reads nothing inside the frame. A title it set is updated when Sitecore changes the frame's `src`; a title
someone else set is never touched.

- [ ] **Step 1: Write the fixture** `aids.html`: four iframes (`src="/sitecore/shell/Applications/Content%20Editor.aspx"`,
  one with `title="Mine"`, one `about:blank`, one `src="/sitecore/shell/-/xaml/Sitecore.Shell.Applications.Foo.Bar.aspx"`),
  then the scripts in `contentFiles()` order without `lib/dev.js` and `content.js`, plus
  `themes/chicago/dom.js`, served by `fixtureServer` from the extension folder (add a route mapping
  `/ext/*` to `extension/` in `helpers.js` `fixtureServer`, with `.js` served as `text/javascript`). The spec
  starts its own server on port 4930 and uses a plain Playwright `page` (no extension). A last inline script defines a fake host
  implementing the interface in `engine.js`'s header, exposes `window.fake = { site, theme, fire(kind) }`
  (`site` is what `site()` returns, `theme` the id `apply()` answers with), and calls `SCT.startEngine(fakeHost)`.

- [ ] **Step 2: Write the failing tests** in `aids.spec.js` (each reads titles with `[...document.querySelectorAll("iframe")].map((f) => f.getAttribute("title"))`):
  - `"an always-on aid names frames on a themed site, not under Native"`: theme `fjord`: titles
    `["Content Editor", "Mine", null, "Sitecore: Bar"]`; then `fake.theme = "native"`, `fake.fire("theme")`:
    `[null, "Mine", null, null]`.
  - `"a need turns it on under Native; switched off it stays off on a themed site"`: Native with
    `accessibility: { needs: ["screen-reader"] }` then `fire("accessibility")`: names present;
    theme `fjord` with `aids: { "frame-titles": false }`: names absent.
  - `"running again changes nothing; stopping restores the page exactly"`: record `document.body.innerHTML`
    before start under Native, switch to `fjord`, `fire("accessibility")` twice, expect the same HTML both times,
    then `SCT.engine.unload()`: expect the HTML before start.
  - `"a frame added later is named on the next pass"`: append an iframe with `src=".../Rich%20Text%20Editor/Preview.aspx"`;
    expect.poll its title to be `Rich text preview`.
  - `"a theme switch keeps the aids' changes, and the theme's"`: `fjord` to `chicago`: titles still present and
    `document.querySelector("[data-sct-owned]")` from Chicago's DOM module present.
  - `"an aid that throws is switched off alone"`: before start, the fixture's query string `?boom` adds
    `SCT.settings.AIDS.boom = { needs: [], always: true, surfaces: null, name: "b", hint: "b" }` and registers an
    aid that calls `ctx.setAttr(document.body, "data-boom", "1")` then throws. Under `fjord`: frames named,
    `body` has no `data-boom`, and one console warning contains `boom`.

- [ ] **Step 3: Run** `npx playwright test aids`. Expected: FAIL (no titles).
- [ ] **Step 4: Implement** the runner in `engine.js` and the aid in `aids/frame-titles.js`:
  - `syncAids()` runs at the end of `applyAccess()`, after `engine.theme` is set in `doRequestTheme`, and once the
    DOM is ready (`whenDomReady` in `start`). It does nothing until the DOM is ready, and when the engine is not
    `alive()` it reverts every aid. `themed` is `engine.theme && engine.theme !== "native"`.
  - Each `apply` runs in `try`/`catch`. On a throw: `console.warn("[Themes for Sitecore] aid", id, err)`, revert
    that aid's kit, call its `revert`, add the id to a per-frame `brokenAids` set that `syncAids` skips.
  - The aids' observer copies the theme observer's owned-node filter (`childList`, `subtree`) and schedules
    `runAids()` with `requestAnimationFrame`. Time each pass with `noteMs(ms, "sctAidsMs")`.
  - `stop()` reverts the aids before `applyAccess()`.
  - Add the aid files to `contentFiles()` and `bundle()` as in Interfaces.
- [ ] **Step 5: Add a unit test** in `build.test.js`: `"every aid has its module, in the content scripts and the Sitecore bundle"`:
  for each `AIDS` key, `extension/lib/aids/<id>.js` exists and `bundle()` contains `SCT.registerAid("<id>"`; the
  background's script list (read `background.js` as text) names `lib/aids/` in the `contentFiles` return line.
- [ ] **Step 6: Run** `npm test` and `npx playwright test --project=fixtures`. Expected: all PASS.
- [ ] **Step 7: Commit** "Aids runner in the engine, with frame names as its first aid".

### Task 4: Needs and fine-tune in the Accessibility tab

**Files:**
- Modify: `extension/popup/site-settings.js` (`ACCESS_HTML`, `mountAccessibility`), `extension/popup/popup.css`
- Test: `test/unit/settings.test.js`, `test/e2e/engine.spec.js`

**Interfaces:**
- Consumes: `NEEDS`, `NEED_PRESETS`, `AIDS`, `accessibility`, `enabledAids`, `aidReason` (Task 1).
- Produces markup ids: `#needs` (a `<fieldset>` with `<legend>Needs</legend>` and one
  `<input type="checkbox" name="need" value="<id>">` label per need), `#aids` (a `<details>` with
  `<summary>Fine-tune</summary>`, one row per aid built at mount: `<input type="checkbox" role="switch" data-aid="<id>">`,
  the aid's `name`, its `hint` in `<small>`, and a reason line), `#aids-reset` (a button "Reset to needs").
  The keys line: "Keys: F6 moves between areas, Ctrl+Shift+Space opens the command palette, Alt+F1 lists
  shortcuts." is left out until phases 2 and 5 ship those keys.

**Behaviour.**
- Ticking a need: if `#font` is on "Theme" and the need has a preset font, select it; the same for spacing. Save.
- A switch shows `enabledAids(a, { themed: true, surface: null })` (null surface: no filter) membership. Its
  reason line: `own` "Your choice", a need id "From <need name>", `always` "On whenever a theme is", none "Off".
- Toggling a switch: if the new state equals what it would be without an own choice, delete `aids[id]`;
  otherwise set it. Save.
- Reset: `aids = {}`, save, redraw the switches.
- Everything saves through the existing `write()` path, now passing `needs` and `aids`.

- [ ] **Step 1: Write the failing unit check** in the existing accessibility test: for every `NEEDS` id,
  `popup.includes(`name="need" value="${id}"`)`.
- [ ] **Step 2: Write the failing e2e test** `"the Accessibility tab's needs preset the font and the fine-tune
  switches save your choice"` in `engine.spec.js`, opening the popup the way the hue slider test does: tick
  "Reading and focus": storage `accessibility[BASE]` matches `{ needs: ["reading"], font: "opendyslexic", spacing: "wide" }`;
  open Fine-tune: the Frame names switch is checked with "From" absent and "On whenever a theme is" shown;
  untick it: `aids` is `{ "frame-titles": false }` and the line says "Your choice"; Reset: `aids` is `{}`.
  Clean up with `chrome.storage.sync.remove("accessibility")`.
- [ ] **Step 3: Run** both. Expected: FAIL.
- [ ] **Step 4: Implement.** Style the chips with the existing `.seg` look where it fits; the `<details>` gets the
  pane's row styles. The tab's Tab order follows the visual order.
- [ ] **Step 5: Run** `npm test` and `npx playwright test --project=fixtures`. Expected: PASS.
- [ ] **Step 6: Commit** "Accessibility tab: needs that preset the reading aids, and a fine-tune list".

### Task 5: The Sitecore module keeps needs and aids

**Files:**
- Modify: `sitecore/ThemesProcessor.cs` (`Fonts`/`Visions` arrays about line 33, `ReadAccess` about line 129, the
  save handler's length check about line 220)
- Test: `test/unit/settings.test.js`

**Interfaces:**
- Produces: `static readonly string[] Needs = { ... }` and `Aids = { ... }` in `ThemesProcessor`, matching
  `Object.keys(NEEDS)` and `Object.keys(AIDS)`. `ReadAccess` returns the same six keys `accessibility()` does,
  `needs` as a `string[]` filtered and ordered by `Needs`, `aids` as a `Dictionary<string, bool>` filtered by
  `Aids`, and `null` when all six are empty. The save handler's limit on `access` rises from 200 to 1000 characters.
- `sitecore/host.js` needs no change: it already passes `cfg.accessibility` through `SCT.settings.accessibility`.

- [ ] **Step 1: Write the failing test**: in the existing check, add
  `assert.deepEqual(list("Needs"), Object.keys(settings.NEEDS))` and the same for `Aids`, and assert the server's
  source contains `access.Length > 1000`.
- [ ] **Step 2: Run** `npm test`. Expected: FAIL.
- [ ] **Step 3: Implement** in `ThemesProcessor.cs`; `JavaScriptSerializer` gives `object[]` for arrays and
  `Dictionary<string, object>` for objects, so filter those, keeping only `bool` values for aids.
- [ ] **Step 4: Run** `npm test` and `npm run build:sitecore`. Expected: tests PASS, the build compiles the DLL
  with no errors.
- [ ] **Step 5: Commit** "Sitecore module: keep a user's needs and aids".

### Task 6: The axe baseline

**Files:**
- Modify: `package.json` (devDependency `"axe-core": "^4.10.3"`), `package-lock.json`
- Create: `test/e2e/a11y.js`, `test/e2e/a11y-baseline.json` (generated)
- Modify: `test/e2e/sitecore.spec.js`

**Interfaces:**
- Produces: `axeCounts(page) -> Promise<{ [ruleId]: number }>` in `a11y.js`: injects `axe-core/axe.min.js` into
  every frame whose URL starts with the page's origin, runs it with
  `runOnly: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa", "best-practice"]` and `resultTypes: ["violations"]`, and
  sums the nodes per rule across frames.
- Baseline shape: `{ "<version>": { "<page>": { "<scenario>": { "<ruleId>": count } } } }`.
- Pages (paths as people open them): `desktop` `/sitecore/shell`, `contentEditor`
  `/sitecore/shell/Applications/Content%20Editor.aspx?sc_bw=1`, `launchpad`
  `/sitecore/shell/sitecore/client/Applications/Launchpad`, `ee` `/?sc_mode=edit`, `admin` `/sitecore/admin`.
- Scenarios: `native` (Native, no needs), `needs` (Native, every need), `fjord`, `chicago`.

- [ ] **Step 1: Write the test** `"accessibility problems never grow"` in `sitecore.spec.js`, inside the suite's
  one launched browser: for each host version, scenario and page, set the scenario through storage, open the page,
  wait for `load` plus 4 s, and compare `axeCounts(page)` to the baseline: every rule's count at most the
  baseline's, no rule missing from it. With `SCT_A11Y_UPDATE=1`, write the counts to the baseline file instead.
  Restore the overrides and `accessibility` it changed.
- [ ] **Step 2: Run** `npm i -D axe-core@^4.10.3`, then `SCT_A11Y_UPDATE=1 npx playwright test sitecore -g "never grow"`
  to write the baseline. Expected: the file exists with both versions, five pages and four scenarios.
- [ ] **Step 3: Run** `npx playwright test sitecore -g "never grow"`. Expected: PASS. Then check the
  baseline: `frame-title` is lower under `fjord` and `needs` than under `native` (frame names at work).
- [ ] **Step 4: Commit** "axe baseline for every surface, scenario and Sitecore version".

### Task 7: Our own button, docs, spec

**Files:**
- Modify: `AGENTS.md` (the "How it works" table), `sitecore/README.md` (the list of files `sct.js` is built
  from), `docs/superpowers/specs/2026-10-27-accessibility-aids-design.md`, possibly `sitecore/host.js`

- [ ] **Step 1: Check the module's picker button** on `https://specm.dev.local/sitecore/shell/Applications/Content%20Editor.aspx`
  with a Chromium launched **without** the extension (copy of `.auth/profile` in the scratchpad): read the
  accessibility tree with CDP `Accessibility.getFullAXTree` and look for a `button` named `Themes for Sitecore`.
  Expected: present (the closed shadow root holds the `aria-label`). If it is missing, give `sct-themes-button`
  the name the tree needs and check again.
- [ ] **Step 2: Update the spec**: the audit bullet about our button says what Step 1 found, and Section 4's
  phase 0 and phase 1 lines and Section 2's file list reflect the deviations at the top of this plan.
- [ ] **Step 3: Add `extension/lib/aids/<id>.js`** to AGENTS.md's table ("One accessibility aid each: what it
  serves is in `settings.js` `AIDS`, its code here, run under every theme by `engine.js`.") and to
  `sitecore/README.md`'s file list.
- [ ] **Step 4: Run** `npm test`. Expected: PASS.
- [ ] **Step 5: Commit** "Accessibility aids: docs, and the spec brought in line with phase 0".

### Task 8: Verify in the real browser

- [ ] **Step 1:** Follow the `sct-verify` skill. In the user's Chrome: reload the extension
  (`{type: "sct-dev-reload"}` from a Sitecore page), open the Content Editor on specm under a theme, and check in
  every frame that `iframe[title]` matches the table; switch the site to Native and check the titles are gone.
  Screenshot the Accessibility tab with Fine-tune open, and read the screenshot.
- [ ] **Step 2:** On sc105cm with the extension disabled for that site (the module's picker in charge): before
  deploying the new module build, set a reading font in the module's panel; deploy (`npm run build:sitecore`,
  copied over the webroot); reload and check the font is still on. Then tick a need, reload, and check the frames
  are named and that the module saved `needs`.
- [ ] **Step 3:** Report what was verified, where, and what could not be (Edge needs the user to reload it).
