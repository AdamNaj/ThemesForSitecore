# Accessibility aids: design

Approved 2026-10-27. Each phase in Section 4 gets its own implementation plan.

## Intent

What you asked for: go beyond restyling. Make Sitecore itself easier to use for people with disabilities: the
page structure, keyboard and focus order, and the ARIA that Sitecore's markup is missing. Look at several kinds of
disability and at how other software is extended to help, and work out how that fits into the extension.

Decisions:
- Driver: broad product value, so breadth across disabilities beats full conformance on one surface.
- Boundary: full extension. ARIA, tab stops and new key handling, plus new UI of our own (command palette, reading
  guide and so on).
- Settings: needs profiles plus a toggle per aid. The ARIA repair, which changes nothing you can see, is on for
  every site with a theme.
- Approach: A (below).

My assumptions (correct any):
- Runs under every theme, Native included once a need is picked; Native with no needs picked still means "do
  nothing".
- Works in the Sitecore module too, so the code lives in `extension/lib` and uses no extension APIs.
- PRODUCT.md's "nothing about how Sitecore behaves changes" becomes "nothing breaks": we add roles, names, keys and
  UI, and never remove or override Sitecore's own handlers.
- Success is measured with axe-core over the real surfaces before and after, plus key journeys (find an item,
  edit a field, save, publish) done with the keyboard only and with a screen reader.

## What the audit found (stock 10.4.1, no theme, 2026-10-27)

axe-core in every frame, a markup survey, and 45 presses of Tab through the Content Editor.

- **Sitecore already has some ARIA, and part of it is wrong.** The Content Editor has `tree`/`treeitem`,
  `tablist`/`tab` and `menu` roles (321 elements with `aria-*`). axe flags attributes not allowed on their role
  (8), a tree missing its required children (2), and `presentation` roles that conflict with focusable elements
  (19). The job is partly repair, not only addition.
- **The Tab order is the main problem for keyboard users.** It goes: logo, Log out, our own picker button (with no
  accessible name, a bug of ours), then about 20 ribbon buttons one after another, before the tree's search box.
  After the tree come the editor's links, the section-collapse glyphs as bare `<img>` tab stops with no names, then
  the fields. There's no skip link, no landmark to jump to, and no way from the tree to the fields without passing
  through everything else.
- **About 66 clickable elements have no role** (the ribbon panel, the section captions, the window buttons), 95
  images have no `alt`, and no frame has a `title`. A screen reader announces "frame, frame, frame".
- **No live regions anywhere**, so "Item saved", validation errors and publish progress are silent. No page sets
  `lang` except Launchpad and the Experience Editor's site. No `prefers-reduced-motion` rules.
- **Launchpad, `/sitecore/admin` and the Experience Editor ribbon** are mostly missing `alt` text and link names,
  the simpler cases.

## Approaches

- **A. One aids layer in the engine, made of small aid modules (chosen).** One file per aid in
  `extension/lib/aids/`, the same `apply`/`revert` contract as a theme's `dom.js`, run in every frame under every
  theme with its own DOM kit, shared with the Sitecore module. It fits the existing patterns and each aid ships on
  its own. The cost: Sheer UI keeps re-rendering markup from the server, so every aid has to be idempotent and cheap.
- B. Fix the markup on the server, in the Sitecore module. Extension users would get nothing, it's a second
  codebase per Sitecore version, and `extension/` may not depend on `sitecore/`. Rejected.
- C. Accessibility per theme, in each `dom.js`. Native and the CSS-only themes would get nothing, and the aids
  would switch off with a theme change. Rejected.

## Section 1: needs and the aid catalogue

Each **need** is a profile in the popup and switches on a set of **aids**. Each aid is one module with its own
toggle; one aid can serve several needs. (exists) marks what is already built.

**Screen reader** (blind users, and low-vision users who rely on speech)
- `aria-repair`: fix Sitecore's invalid ARIA (drop `presentation` on focusable elements, add the tree's required
  children, remove attributes a role doesn't allow).
- `names`: icons next to text get `alt=""`; icon-only buttons and glyphs get their tooltip as their name;
  clickable `div`/`span`/`img` elements get `role=button` and a tab stop; section captions get `aria-expanded`.
- `frame-titles`: name every frame ("Content tree", "Item editor", "Ribbon", "Dialog: Insert from template").
- `landmarks`: banner (the top bar), toolbar (the ribbon), navigation (the tree), main (the editor), each named.
- `fields`: tie each Content Editor field's label and help text to its input; validator errors set
  `aria-invalid` and point to the message.
- `announcer`: one polite live region in the top frame that says "Item saved", validation results, publish
  progress, lock and workflow warnings, and the tree item you just selected.
- `dialogs`: `role=dialog`, `aria-modal`, a name from the caption; focus moves in, stays inside, and goes back to
  where it came from on close.
- `lang`: set `<html lang>` from Sitecore's UI language.

**Keyboard only** (motor impairments, RSI, tremor, switch users, power users)
- `focus-ring`: a clear focus outline on every surface, coloured by the theme, never hidden (WCAG 2.4.7, 2.4.13).
  Focused elements scroll out from under the ribbon (2.4.11).
- `regions`: skip links that appear on focus, and F6 / Shift+F6 to cycle the top bar, ribbon, tree and editor.
- `ribbon-toolbar`: the ribbon becomes one Tab stop with arrow keys inside it (roving tabindex), and its tabs a real
  tablist. That takes out the ~20 Tab stops before the tree.
- `tree-keys`: the ARIA tree pattern. Up/Down, Right expands, Left collapses, Enter opens, Home/End, typing letters
  finds an item, Shift+F10 or the Menu key opens Sitecore's own context menu.
- `menus`: arrow keys and Escape in Sitecore's context and drop-down menus.
- `command-palette`: Ctrl+Shift+Space (proposed; phase 5 confirms it, see Section 3 on shortcuts) searches every ribbon command
  on screen, plus "go to item by path or ID". A command runs by clicking Sitecore's own button.
- `shortcuts-help`: Alt+F1 lists Sitecore's shortcuts (read from the ribbon's own `(Alt+H)` hints) and ours.

**Low vision**
- Beacon theme (exists), Atkinson Hyperlegible (exists), `focus-ring` (thicker under this profile).
- `targets`: hit targets of at least 24px (WCAG 2.5.8); helps tremor too.
- `forced-colors`: with Windows High Contrast on, the themes back off and Windows' own colours win, with icons and
  borders kept visible.
- `where-am-i`: the current item's path, language and version on one line that's always visible and announced.

**Colour vision**
- The colour filter (exists).
- `not-just-colour`: a shape or text wherever Sitecore shows state by colour alone (validator dots, workflow and
  lock indicators).

**Reading and focus** (dyslexia, ADHD, cognitive load, fatigue, brain injury)
- OpenDyslexic (exists), wide spacing (exists).
- `focus-mode`: dim everything except the field being edited.
- `reading-guide`: a ruler band that follows the focused line or the pointer.
- `quiet-ribbon`: hide ribbon groups you never use (your choice, saved per site). Hidden, never removed.
- `where-am-i` (shared with Low vision).
- `session-warning`: a warning two minutes before the session times out, with "keep me signed in" pinging
  Sitecore's own keep-alive (WCAG 2.2.1).

**Motion** (vestibular disorders, migraine, seizure risk)
- `reduced-motion`: switch off Sitecore's and the themes' animations and transitions. Follows the OS by default
  (your RDP sessions report `reduce`).

**Speech input, switch access and eye tracking** need no aids of their own: `names` and `fields` make visible labels
match accessible names (WCAG 2.5.3), and keyboard access, targets and the palette cover the rest.

**Hearing** is out of scope: these screens have no audio or video of their own.

**Defaults.** `aria-repair`, `names`, `frame-titles`, `landmarks`, `lang` and `forced-colors` change nothing you
can see, so they run on every site with a theme. Everything else waits for a need or a toggle. The missing name on
our own picker button gets fixed regardless.

## Section 2: architecture

**Files**
- `extension/lib/aids/registry.js`: `SCT.registerAid(id, { needs, surfaces, css?, apply(ctx), revert?(ctx) })`,
  like `SCT.registerTheme`.
- `extension/lib/aids/<id>.js`: one per aid. CSS-only aids (`focus-ring`, `targets`, `reduced-motion`,
  `forced-colors`) only set `css`.
- The font, spacing and colour filter move from `settings.js` into `aids/font.js`, `aids/spacing.js` and
  `aids/vision.js`. `settings.accessibility()` keeps reading what's already saved.
- Every list of engine scripts takes the new files: the background's registration, the Sitecore module's loader,
  the build.

**Engine**
- `syncAccess` becomes the aids runner. The enabled set is the always-on aids (themed sites), plus the needs' aids,
  plus aids switched on, minus aids switched off, filtered by surface.
- One DOM kit and one mutation observer for all aids, separate from the theme's, so theme switches and aids never
  undo each other.
- Every `apply` is idempotent and cheap. Budget: under 4 ms a pass on the Content Editor, recorded with the
  existing `noteMs` dev hook (`data-sct-aids-ms`).
- The aids' CSS goes into the existing `style[data-sct-access]` in `@layer sct-accessibility`. The focus ring uses
  the theme's accent token where there is one, `Highlight` otherwise.

**Sitecore first.** Key handlers sit on the document and bubble, so Sitecore's own handlers run first. An aid acts
only when the event isn't `defaultPrevented` and the key means nothing to Sitecore, and never stops propagation of
a key it didn't handle. The DOM kit gains `listen(target, type, fn)` with an undo entry. Nothing Sitecore ships is
removed: a tab stop is taken out with `tabindex=-1`, a group hidden with a class.

**Frames.** Each frame runs its own engine and aids. Aids that span frames (F6 regions, palette, announcer,
`where-am-i`, `session-warning`) talk over `postMessage` in an `sct-aid` envelope. The top frame owns the live
region and the palette. Child frames report regions, commands and messages up, and act when asked (focus this
region, click this command). No aid touches another frame's `contentDocument`. The Experience Editor's website gets
no aids; its ribbon frame does.

**Failure.** An aid that throws is reverted and switched off for that frame alone, with a `console.warn`; the other
aids carry on.

**Settings.** `storage.sync.accessibility[origin]` becomes `{ font, spacing, vision, strength, needs: [...],
aids: { id: true|false } }`. The host interface is unchanged; `sitecore/host.js` passes the new fields through.

## Section 3: settings and on-page UI

**The popup's Accessibility tab** (shared `site-settings.js` markup, so the Sitecore module's panel gets it too):
1. **Needs**: checkbox chips (Screen reader, Keyboard, Low vision, Colour vision, Reading and focus, Motion). Any
   number can be on.
2. The existing **Font**, **Spacing** and **Colour filter** rows stay. A need presets them only while you haven't
   set them yourself.
3. **Aids**: a collapsed "Fine-tune" list grouped by need. Each aid has a switch showing one of three states (on
   because of a need, on by you, off by you) and a one-line description. "Reset to needs" clears your choices.
4. A line naming the keys: F6 regions, Ctrl+Shift+Space palette, Alt+F1 help.

The tab passes the same bar itself: `<fieldset>`/`<legend>` groups, `role=switch` with labels, keyboard order
matching the visual order.

**What appears on the page** (palette, skip links, help, `where-am-i`, session warning, reading guide):
- Owned custom elements (`<sct-palette>`, `<sct-skip>`, ...) like today's `<sct-bar-postfix>`, which the DOM kit and
  mutation filter already ignore.
- Base look in each aid's own `css`, which the engine injects with the other aids' CSS, so it is there under Native
  and in the Sitecore module too (`surfaces/bar.css` is not: `files.js` loads nothing under Native). It uses the
  theme's tokens where there are any and system colours (`Canvas`, `CanvasText`, `Highlight`) otherwise. A theme
  may restyle these elements in its own files.
- Palette, help and session warning are real dialogs: focus moves in, Escape closes, focus returns. Tested with axe.
- Every shortcut is checked against Sitecore's own (Content Editor, Desktop, Experience Editor, SPE's ISE) and the
  browser's before it's fixed in that aid's phase.

## Section 4: phasing

Each phase gets its own implementation plan, and each aid lands in its own commit. A phase ships when its aids pass
section 5 on 10.4 and 10.5. Inside a phase, surfaces go in order of use: Content Editor, Desktop, Sheer and jQuery
dialogs, Launchpad, Experience Editor ribbon, `/sitecore/admin`, login. Sitecore 10.0 to 10.3 get the aids through
10.4's mapping, as they get its themes, but are not verified one by one.

0. **Foundation.** The registry, the aids runner in the engine, `listen` in the DOM kit, font, spacing and colour
   filter moved into aids, the new settings shape (old saved values still read), the popup's needs chips and
   fine-tune list, the axe harness and its baseline (section 5), and the name on our own
   picker button. Nothing new to see beyond the settings tab.
1. **Invisible defaults** (screen reader basics, on for every themed site): `aria-repair`, `names`, `frame-titles`,
   `landmarks`, `lang`, `forced-colors`. Measured by axe's counts dropping.
2. **Keyboard:** `focus-ring`, `ribbon-toolbar`, `regions` (skip links and F6), `tree-keys`, `menus`, `dialogs`,
   `targets`.
3. **Telling people what happened:** `announcer`, `fields`, `where-am-i`, `not-just-colour`.
4. **Motion and reading:** `reduced-motion`, `focus-mode`, `reading-guide`, `quiet-ribbon`.
5. **New tools:** `command-palette`, `shortcuts-help`, `session-warning`.

Phases 1 and 2 give most of the value: after them a screen reader user hears names, and a keyboard user reaches
the tree in a few presses. Phases 3 to 5 can be reordered if users ask for one sooner.

## Section 5: testing

**Unit** (`node --test`, `npm test`):
- the enabled set: needs, plus aids switched on, minus aids switched off, the always-on aids only on themed sites,
  nothing under Native until a need is picked;
- `settings.accessibility()` still reads every shape saved before, and drops unknown needs and aids;
- every registered aid has `needs`, `surfaces` and `apply`, and every need names only aids that exist;
- the popup's and the Sitecore module's settings markup carry the same controls.

**Fixture e2e** (Playwright, `test/e2e/fixtures`, minimal markup we write ourselves to match Sitecore's structure,
never copied from Sitecore's files), for every aid:
- applying it twice leaves the same DOM as applying it once;
- reverting it leaves the DOM exactly as it was (serialised before and after);
- it re-applies after a simulated Sheer UI re-render (the markup replaced);
- an aid that throws is switched off alone, and the others still run.

**Live suite** (`sitecore.spec.js` against the 10.4 and 10.5 installs, one browser launch for every page, per the
licence gotcha):
- **axe baseline:** axe-core (a new dev dependency) runs in every frame of every surface under Native with every
  need on, and under one token theme and one theme with a `dom.js` (Chicago). Violation counts per surface and rule
  live in `test/e2e/a11y-baseline.json`. The test fails when a count goes up; each phase lowers the baseline in
  its own commits.
- **Tab order:** in the Content Editor, the tree is reached within 5 presses of Tab, and F6 moves top bar, ribbon,
  tree, editor and back.
- **Journeys, keyboard only:** find an item with `tree-keys`, edit its Title, save with Ctrl+S, and see "Item
  saved" in the live region; open and close a dialog and find focus back where it was; run Save from the palette.
- **Sitecore still works:** with every aid on, Sitecore's own keys (Ctrl+S, Alt+H and the ribbon's other access
  keys, the tree's existing keys, SPE's ISE editor keys) do what they did without the aids.
- **Speed:** `data-sct-aids-ms` stays under 4 ms on the Content Editor.

**People and real browsers** (the `sct-verify` skill):
- the phase's journeys in your Chrome with the extension, and on sc105cm with the Sitecore module;
- a screen reader pass with Windows Narrator, which is built in. NVDA (free) is the screen reader most often used
  with Chrome; installing it on this machine is your call;
- Windows High Contrast on, for `forced-colors`;
- Edge with Dark Reader, to make sure the aids' UI stays readable under it.
