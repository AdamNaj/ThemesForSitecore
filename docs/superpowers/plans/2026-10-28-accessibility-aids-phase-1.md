# Accessibility aids phase 1 (invisible defaults) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Five always-on aids that change nothing anyone sees and lower axe's counts: `aria-repair`, `names`, `landmarks`, `lang`, `forced-colors`.

**Architecture:** Each aid is one `extension/lib/aids/<id>.js` registered with `SCT.registerAid`, listed in `settings.js` `AIDS` and the module's `Aids` list, run by the phase 0 runner. The runner learns a `css` member for CSS-only aids. Fixture pages get one shared fake host that loads every aid.

**Tech Stack:** plain JS shared with the Sitecore module (no extension APIs, no `Array.from`), Playwright fixtures, axe-core live baseline.

**Spec:** `docs/superpowers/specs/2026-10-27-accessibility-aids-design.md` (Section 1 "Screen reader" and "Low vision", Section 4 phase 1).

## Global Constraints

- Nothing Sitecore ships is removed; a role is changed or added through the aid's kit, so revert restores it exactly.
- Two aids never write the same attribute of the same element (reverts would cross): `aria-repair` owns the roles it repairs, including the ribbon's; `landmarks` only touches elements with no `role`.
- Every `apply` is idempotent and selects only what is still undone (`img:not([alt])` style selectors), so a pass on the Content Editor stays under 4 ms.
- The Experience Editor's website (surface `ee`) gets no DOM aids; its ribbon frame (`speak`) does.
- Names are English strings, short, sentence case; no em-dashes or en-dashes in any file.
- Survey of the live markup (10.4.1 and 10.5, Native, 2026-10-28) is the source for every selector below.

## Review Focus

1. Sheer UI re-renders the tree and the editor (expand a node, switch item): the repaired roles come back on the new nodes. Pinned by each fixture's "markup replaced" step.
2. A tree node expanded after load has `role="treeitem"` and its children list `role="group"`, so a screen reader still hears level and expanded state. Pinned in Task 2.
3. An element we made a button reacts to Enter and Space exactly once, and not at all when Sitecore's own key handler already handled the key (`defaultPrevented`). Pinned in Task 3.
4. A page that sets its own `lang` (admin, the EE website) keeps it. Pinned in Task 5.
5. Under Windows High Contrast the selected tree item, the active ribbon tab and the themes' masked glyphs stay visible. Pinned in Task 6 with `emulateMedia({ forcedColors: "active" })`.

---

### Task 1: Runner and fixture groundwork

**Files:** Modify `extension/lib/dom-kit.js`, `extension/lib/engine.js`; Create `test/e2e/fixtures/site/aid-host.js`; Modify `test/e2e/fixtures/site/sitecore/shell/aids.html`, `test/e2e/aids.spec.js`, `test/unit/settings.test.js`.

**Produces:**
- `kit.setAttr(el, name, null)` removes the attribute (undo puts it back).
- `SCT.registerAid(id, { apply?(ctx), css? })`: `css` is a string the engine writes, with every running aid's, into one owned `<style data-sct-aids>` as `@layer sct-accessibility{...}`; an aid needs `apply` or `css`.
- `ctx.listen(target, type, fn, options)` already exists; key handlers check `e.defaultPrevented` first.
- `aid-host.js`: loads detect, settings, themes, dom-kit, color-map, live-map, chicago's dom.js, every `lib/aids/<id>.js` from `SCT.settings.AIDS`, then engine, then starts the fake host of `aids.html` (`window.fake`). A fixture page is its markup plus `<script src="/aid-host.js"></script>`.
- `test/e2e/aids.spec.js` helper `aidCase(page, url, { check, rerender })`: themed load, `check()`, second pass identical, `rerender()` then `check()` again, `SCT.engine.unload()` restores `document.body.innerHTML` exactly.

- [ ] Unit test: every `AIDS` entry has `needs` (known), `surfaces` null or detect.js names, `name`, `hint`, `always` boolean; loading `dom-kit.js` then each aid file in node registers a module with `apply` or `css`. Run `npm test`, see it fail only if a field is missing (it passes for frame-titles; it is the guard for later tasks).
- [ ] e2e test (fixture): a test-only aid `?css` registered with `css: "body{outline:3px solid red}"` puts that rule in `style[data-sct-aids]` while it runs and removes the style on unload; `setAttr(el, "alt", null)` removes and revert restores. Run, see FAIL.
- [ ] Implement in dom-kit and engine (`syncAids` rewrites the style's text when the running set changes). Run, PASS.
- [ ] Move `aids.html`'s inline host into `aid-host.js`; all 10 existing aid tests still pass.
- [ ] Commit "Aids runner: CSS-only aids, attribute removal, a shared fixture host".

### Task 2: `aria-repair` (surfaces `["shell"]`, needs `["screen-reader"]`, always)

**Files:** Create `extension/lib/aids/aria-repair.js`, `test/e2e/fixtures/site/sitecore/shell/Applications/ce-aids.html`; Modify `settings.js` AIDS, `sitecore/ThemesProcessor.cs` Aids, `test/e2e/aids.spec.js`.

Repairs, from the survey:
- Content tree: `.scContentTree a[role="group"]` becomes `role="treeitem"`; the sibling `div` that holds its children (`.scContentTreeNode > div:not(.scContentTreeNodeGutter)`) gets `role="group"`.
- Ribbon: `.scRibbon[role="tablist"]` becomes `role="region"` (its `aria-label` stays); each `.scRibbonNavigatorButtonsGroupButtons` holding `[role="tab"]` gets `role="tablist"` and `aria-label="Ribbon tabs"`.
- `img[alt=""]` with a `role` other than none/presentation, or a `tabindex`: when it has `aria-labelledby` or `aria-label`, `alt` is removed; otherwise `alt` takes its `title` when there is one.
- name `hint`: "Fixes Sitecore's wrong roles, so a screen reader reads the tree and the ribbon right".

- [ ] Fixture `ce-aids.html`: a two-level tree in Sitecore's shape (glyph img, gutter, `a[role=group][aria-expanded][aria-selected]` with icon span and text, children div), a ribbon (`.scRibbon[role=tablist][aria-label]` > navigator group > `a[role=tab]` x2, plus a strip with a button), a section caption with `img[alt=""][role=button][tabindex=0][aria-labelledby]`. Write it from the survey's shape, never from Sitecore's files.
- [ ] Test "aria-repair: tree items, the ribbon's tablist and labelled images" with `aidCase`: roles as above; rerender replaces the tree's inner HTML with an expanded copy. Run, FAIL.
- [ ] Implement; add to AIDS and the C# list. Run the aid tests and `npm test`, PASS.
- [ ] Commit.

### Task 3: `names` (surfaces shell, speak, launchpad, admin, login; needs `["screen-reader", "keyboard"]`, always)

**Files:** Create `extension/lib/aids/names.js`, fixtures `sitecore/client/Applications/Launchpad-aids.html`, `sitecore/admin/aids.html`; Modify the CE fixture, AIDS, C#, spec.

Rules, in order:
1. `img:not([alt])`: inside a link or button that has other text, or a 1px spacer (`blank.gif`, or width or height 1), or without a `title`: `alt=""`; with a `title`: `alt` = title.
2. `img[alt]` whose alt equals the trimmed text of its closest `a, button, [role=button]`: `alt=""`.
3. Known nameless controls get `aria-label`: `.sc-global-logo` "Launchpad"; `#BTAddNewSearch` "New search"; `#navigationTreeViewButton` "Navigation tree"; `img.scRibbonPanelUp` "Scroll up"; `img.scRibbonPanelDown` "Scroll down"; `img.scRibbonPanelOpen` "More options"; `img.scComboboxDropDown` "Show options"; `input.bucketSearch` "Search"; `select[id$="_unselected"]` "Available items"; `select[id$="_selected"]` "Selected items". Only when the element has no accessible name already (no text, `aria-label`, `aria-labelledby`, or non-empty `title`/`alt`).
4. A leaf `div, span, img, td` with `onclick`, no `role`, no interactive descendant (`a, button, input, select, textarea, [tabindex], [onclick]`), not `body`: `role="button"`, `tabindex="0"` unless it has one; one delegated `keydown` listener on the document clicks such an element on Enter or Space when `!e.defaultPrevented`, then `preventDefault()`.
- name "Names", hint "Gives images, icon buttons and clickable parts a name a screen reader can say".

- [ ] Fixtures from the survey: CE spacer and labelled icons, ribbon scroll images, an icon-only tab, bucket search input and selects, a clickable `span` with `onclick` incrementing `window.clicks`; Launchpad header logo link, a tile link `a > img[alt="Forms"] + span Forms`, the user portrait `img` beside the name; admin `a > img + text`.
- [ ] Test "names: images, icon buttons and clickable parts" with `aidCase` on all three fixtures, plus: Enter on the clickable span gives `clicks === 1`; a `keydown` handler that calls `preventDefault()` first leaves `clicks === 0`. Run, FAIL.
- [ ] Implement; AIDS, C#. PASS, `npm test`.
- [ ] Commit.

### Task 4: `landmarks` (surfaces shell, speak, launchpad, admin; needs `["screen-reader"]`, always)

**Files:** Create `extension/lib/aids/landmarks.js`; Modify fixtures, AIDS, C#, spec.

Per surface, an element that exists and has no `role` gets the role and `aria-label`:
- shell: `#ContentTreePanel` navigation "Content tree"; `#ContentEditor` main "Item editor"; `#Desktop` main "Desktop"; `#Startbar` region "Taskbar".
- launchpad: `header.sc-applicationHeader` banner; `.sc-launchpad` main "Launchpad".
- admin: `mat-toolbar` banner.
- speak: `nav.sc-quickbar` `aria-label` "Quick bar" (no role change: it is a nav already).
- hint "Marks the page's main parts, so a screen reader can jump between them".

- [ ] Test "landmarks: the tree, the editor, the Desktop and Launchpad" (`aidCase` on CE, Launchpad, a Desktop fixture `sitecore/shell/desktop-aids.html` with `#Desktop` and `#Startbar`). Run, FAIL.
- [ ] Implement; AIDS, C#. PASS. Commit.

### Task 5: `lang` (surfaces shell, speak, launchpad, admin, login; needs `["screen-reader"]`, always)

**Files:** Create `extension/lib/aids/lang.js`; Modify AIDS, C#, spec.

`<html>` without a `lang` gets Sitecore's UI language: the `shell#lang` cookie, else the `sc_lang` query parameter, else a `lang_<code>` class on the first `form`; nothing when none is found. A page's own `lang` is never changed. Hint "Tells a screen reader which language to speak".

- [ ] Test "lang: from Sitecore's cookie, never over the page's own" (fixture sets `document.cookie = "shell#lang=da"` before the host loads; admin fixture with `<html lang="en">` keeps `en` when the cookie says `da`). Run, FAIL.
- [ ] Implement; AIDS, C#. PASS. Commit.

### Task 6: `forced-colors` (surfaces null, needs `["low-vision"]`, always, CSS only)

**Files:** Create `extension/lib/aids/forced-colors.js`; Modify AIDS, C#, spec.

`css`, inside `@media (forced-colors: active)`:
- selected and active states Sitecore and the themes show by background alone get `Highlight`/`HighlightText`: `.scContentTreeNodeActive`, `.scRibbonNavigatorButtonsActive`, `.scRibbonEditorTabActive`, `.scMenuItem:hover`, `.scListviewItemSelected`, `[aria-selected="true"]`;
- buttons and ribbon buttons keep an edge: `outline: 1px solid ButtonText; outline-offset: -1px` on `.scRibbonToolbarLargeButton, .scRibbonToolbarSmallButton, .scButton, button`;
- the themes' masked glyphs: any element whose `mask-image` is set keeps a visible fill with `forced-color-adjust: none` and `background-color: CanvasText`; the selectors come from a forced-colors screenshot pass over Fjord and Chicago on the Content Editor (Step 1), listed in the file.
- hint "Keeps selections, buttons and icons visible with Windows High Contrast on".

- [ ] Live look first: Content Editor on specm under Fjord, Chicago and Native with `emulateMedia({ forcedColors: "active" })`, screenshots read; list what vanishes.
- [ ] Test "forced-colors: selections and glyphs stay visible" on the CE fixture with forced colors emulated: the active tree node's computed `background-color` is the system Highlight colour; without forced colors the rule does nothing. Run, FAIL.
- [ ] Implement; AIDS, C#. PASS. Commit.

### Task 7: Baseline and live check

- [ ] `npx playwright test test/e2e/sitecore.spec.js -g "accessibility problems"` against both installs: counts must not grow. Then `SCT_A11Y_UPDATE=1` to lower the baseline; read the diff (rules that should drop: `aria-allowed-attr`, `aria-allowed-role`, `presentation-role-conflict`, `image-alt`, `image-redundant-alt`, `link-name`, `select-name`, `label`, `html-has-lang`, `region`, `landmark-unique`). Commit "a11y baseline: phase 1".
- [ ] Taskbar and Content Editor checks for every theme on 10.4 (`sct-verify` taskbar.cjs, the live suite's theme tests), since `names` adds tab stops and roles.
- [ ] The user's Chrome on specm: the Content Editor and Desktop with Mountain View, every frame's roles read back; aidsMs under 4.
- [ ] Spec: mark phase 1 done with the date.
