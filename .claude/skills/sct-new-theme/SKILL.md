---
name: sct-new-theme
description: Use when adding a new theme to Themes for Sitecore, or when reworking an existing theme's look across surfaces - recreating a platform's look (an OS, a UI toolkit, an older Sitecore) or putting a new palette on Sitecore's own layout.
---

# Add a theme to Themes for Sitecore

Every theme so far took 5 to 15 review rounds of "still wrong". Almost every round was one of a
small set of failure classes: invisible glyphs on dark surfaces, 10.5's oversized spacing, glyphs garbled
at 125%, tabs and frames that don't join, half-themed states, unchecked pages. The user found them; this
skill makes you find them first, so the user reviews one concept and then one finished theme.

**REQUIRED:** `AGENTS.md` (architecture, environments, gotchas) and the `sct-verify` skill for every check.
Read [pitfalls.md](pitfalls.md) before writing CSS. Work through [coverage.md](coverage.md) before saying done.

## 1. Intake: one AskUserQuestion round

Ask only what the request leaves open, at most four questions:

1. **Reference.** What is the source of truth: screenshots (ask for them at 100% scale; an upscaled one
   misled the Copenhagen port), an install or files on disk (Copenhagen came right only once the 6.6 files
   were ported), or your reconstruction from published metrics? With no files or screenshots, the concept
   board carries your measured numbers for the user to confirm.
2. **Fidelity.** *Recreation* follows the source's rules: bevel direction, title-bar construction, fonts,
   control shapes (Copenhagen, Redmond 3.11, Metal Steel, Cupertino). *Recolour* keeps Sitecore's layout in
   a new palette (Debrightify).
3. **Appearance.** Light, dark, or following the OS (Cupertino: a second token block under
   `@media (prefers-color-scheme: dark)`; every check then runs in both).
4. **Signature pieces.** Which of the platform's metaphors to bring: the taskbar (Dock, Program Manager,
   start bar), window buttons (side and order), the Launchpad metaphor, the login. Offer the source's defaults.

Already decided, don't ask: Sitecore 10.4 and 10.5; Copenhagen-tight density unless the source dictates
otherwise; all of `shell`, `login`, `speak`, `launchpad` from day one; no bundled proprietary fonts or logos
(font stacks only); a place codename rather than a trademark for the name (Copenhagen, Redmond 3.11,
Cupertino). Propose a name and an id.

## 2. Measure the reference

Before any CSS, write a spec table into the theme's header comment (or the generator's constants): exact
palette hex values, font family and size per element, title bar height, caption button size and gap, the
bevel recipe (which edges light, which dark, how many px), tab shape and how the open tab joins its page,
menu row height, dialog insets, field height, scrollbar. Measure pixels at 100%; never estimate from memory.
Where a source colour pair fails 4.5:1 (XP's inactive caption, Apple's system blue under white text), take
the nearest colour that passes and say so on the board.

## 3. Design gate: once

Build one concept board, `test-results/<id>-concepts/index.html`, served with `preview_start` name
`test-results` (pages under `file://` are blocked). Show 2 or 3 concepts of the signature parts: a desktop
window (title bar, buttons, ribbon with tabs), a dialog with tabs and fields, the Launchpad metaphor and
the taskbar. Use real Sitecore icons, copied into the board's folder from the install's
`sitecore/shell/Themes/Standard/*.zip` (the board must not need a Sitecore sign-in). Render each at 1x and
1.25x, and in light and dark if the theme follows the OS. Ask the user to pick.

After the pick, build every surface without stopping. Ask again only for a real blocker.

## 4. Scaffold

A theme is one folder, `extension/themes/<id>/`, and nothing outside it changes: no registry, test, README
or manifest edit. [extension/themes/README.md](../../../extension/themes/README.md) lists the files and every
`theme.json` field. If you find yourself editing a file outside the folder for your theme alone, stop: either
it belongs in the folder, or it is a bug every theme has and goes into the shared layer (`surfaces/`,
`lib/`) as its own change.

- `theme.json`: name, description (the look, no OS or product name), `category`, `order`, `versions`,
  `preview`, and the popup's miniature, `swatch` (fields listed in `extension/popup/swatch.js`: taskbar
  position, title bar and buttons, panel colours). `appearance: "auto"` if it follows the OS light/dark
  setting. Then `npm run themes`, which validates it and regenerates `themes.js` and the README table.
- `tokens.css`: every role in `extension/surfaces/tokens.json` as opaque hex, all
  contrast pairs at 4.5:1 (the unit test enforces both). Dark themes also set `--sct-glyph-filter`,
  `--sct-editor-filter`, `--sct-content-filter` and `color-scheme: dark` scoped to
  `:not([data-sct-surface="ee"])`. Start from the nearest existing theme: Redmond 3.11 or Metal Steel for a
  light classic, Cupertino for one that follows the OS, Debrightify for a dark recolour.
- `<area>.css` for each area the theme styles beyond its tokens (`shell`, `login`, `speak`, `launchpad`,
  `ee`, `admin`); the generator lists what is there, so there are no empty placeholder files. The Experience
  Editor's ribbon is a `speak` frame, so it is styled in `speak.css`. Add `ee.css` only for Sitecore's page
  chrome (field frames, toolbars) around the website, as `sitecore104` does.
- `bar.css`: the theme's look for the site postfix in Sitecore's top bar, `html[data-sct-theme="<id>"]
  sct-bar-postfix`. Every theme so far has one; set a postfix for the site in the popup to see it.
- Once the theme is done, its screenshot: `node tools/previews.cjs <id>` writes `preview.jpg` (plus
  `preview-10.4.jpg`, and `-dark` twins for auto themes) into the folder and regenerates `themes.js`.
- Glyphs and other images in `glyphs/`, loaded as `url("sct-ext:themes/<id>/glyphs/...")`.
- A generator only when the theme draws pixel art: glyphs, bevels, bumps. Copy the pattern of
  `tools/build-metal-css.cjs` (`art()` writes PNG and vector SVG pairs) as `tools/build-<id>-css.cjs`, the
  one file a theme may add outside its folder. Never hand-edit its output; regenerate.
- `hue: true` in `theme.json` if the user may turn the palette round the colour wheel (Fjord):
  `tokens.css` redefines the colour tokens under `[data-sct-hue]` from `--sct-hue`. Check a non-zero hue on
  the page, not just in the popup's preview.
- `dom.js` only for state CSS cannot see: inactive windows (Metal Steel), the Dock
  grouping (Cupertino). Every change goes through the dom-kit so a theme switch reverts it. It also runs
  in the Sitecore module, and next to Sitecore's own scripts: see pitfalls.md section 5 before adding
  elements (an SVG broke the Desktop's onload). Taskbar dedupe and the restore glyph live in `engine.js`
  for every theme; never copy them into a theme.

## 5. Build order

A bug that every token theme has goes into `surfaces/*.css` (the shared token layer), not into your theme.
Your files hold the signature. Steps:

1. Tokens only. Run the shots with `--scale 1.25 --scan` on every surface: this is the recolour baseline.
2. Window chrome: both window kinds, dialogs, the jQuery UI title strip, inactive windows.
3. Ribbon and tabs: every Content Editor ribbon tab, the ISE ribbon, the Experience Editor ribbon; one
   rule set for every tab strip, hover classes included.
4. Content Editor: tree and tree search, header buttons, sections, fields, gutters, status bar, Search tab.
5. Dialogs and every control in SPE's Kitchen Sink.
6. Desktop: taskbar, start menu, every menu and fly-out.
7. SPE: ISE, Console, Show-ListView, Reports.
8. Launchpad, Control Panel, login: with the platform's soul (see pitfalls.md), not 10.5's cards recoloured.

After each step: `node .claude/skills/sct-verify/shots.cjs --themes <id> --versions 10.5,10.4 --scale 1.25 --scan`,
fix or explain every SCAN finding and page error, and read the screenshots. After steps 2, 6 and 7 also run
`windows.cjs`, `menus.cjs`, `taskbar.cjs` and `dock.cjs` (see `sct-verify`), and after step 8 the shots with `--width 1920`.
Screenshots alone missed every problem the user found in the 2026-10-23 themes (pitfalls.md section 6).

## 6. The rules every past theme broke

Details, numbers and selectors are in [pitfalls.md](pitfalls.md).

- **Measure, never assume.** Edges with `getBoundingClientRect`, against the visual neighbour (the
  Page chunk's buttons, the open tab's page), at 100% and 125%. "Fixed" means you measured it.
- **125% is the real screen.** The user's Chrome runs at devicePixelRatio 1.25. 1px gradient stacks and
  `image-rendering: pixelated` garble there. Glyphs are PNG (1x) plus vector SVG (other scales) through
  `image-set()`, boxes are real borders, files load as `sct-ext:` (never `data:`: some installs' CSP blocks it).
  Smooth gradients on surfaces (title bars, buttons, the ribbon) are fine; drawing a glyph out of 1px
  gradient tiles is what garbles.
- **Bitmap glyphs that suit no theme become vectors.** Where Sitecore or an add-on draws a small control as a
  bitmap that looks wrong under themes (the Sitecore Extensions add-on's field-search clear X, a PNG in a white
  frame), hide the bitmap and draw the glyph in CSS (lines from `::before`/`::after`, or a `sct-ext:` SVG mask)
  in the surrounding text colour, positioned from the control it belongs to rather than the add-on's fixed
  offsets. One fix serves every theme: add-on fixes go in `surfaces/bar.css` (loaded under every theme on every
  surface), not in a theme.
- **Every glyph visible on every surface it sits on.** Monochrome glyphs take the text colour (mask) or
  `--sct-glyph-filter`. White icons on dark headers, dark on dark is a bug. Check light and dark.
  Item and script icons can be white (`OfficeWhite`) or black: the shared halo in `surfaces/bar.css` keeps
  them visible on any panel unless the theme's own `filter` on that icon replaces it. Run the shots with
  `--white-icons` to put a white icon in every icon slot.
- **Every state themed.** Hover (`scTab_Hover` turns tabs blank and uppercase), pressed, selected, focus
  (`:focus-visible` only), disabled. On dark themes a hover lifts above its panel.
- **Spacing: Copenhagen-tight, 10.5 pulled back.** 10.5 pads everything more than 10.4 (34px inputs, 28px
  dialog insets, 16px ribbon panels). Fixing a height means pinning the padding too. Measure the ribbon
  against Copenhagen's on the same tab; Whistler and Chicago both came back as "too much padding".
- **The same layout on 10.4 and 10.5.** 10.5 adds Content Editor spacing 10.4 lacks (16px under the ribbon,
  12px beside the tree, 16px before the editor, a 30px section inset, a boxed pager); `surfaces/bar.css`
  takes it out for every theme at low specificity, so a theme's own spacing wins and applies on both
  versions. Never write a margin for one version only. Check it: tree, editor, sections and pager land on
  the same pixels in both versions' shots.
- **Frames join.** The open tab runs into its page with no line under it; the first tab's left edge lines
  up with the page; one bevel light direction everywhere; one frame per field, never a frame in a frame.
  Corners are the theme's (`--sct-radius` plus its own rules); 10.5's rounding left on a control the
  theme draws differently is a bug.
- **The taskbar or dock is always on top of non-modal windows**, as in stock Sitecore, whose `#Desktop`
  ends at the bar's top edge and clips the windows. Only modal dialogs and menus go over it. A theme that
  moves or reshapes the bar keeps that: a full-width bar keeps the windows' area clear of it; a dock narrower
  than the screen floats over the windows, which run on underneath it (the window area extends under the
  dock and the dock sits above, so a maximized window shows beside it). The global header's account items
  stay uncovered too. `dock.cjs` (see `sct-verify`) checks both with a maximized window.
- **Every Desktop window keeps the theme's character, title bar included.** Sitecore draws no caption over the
  Content Editor, Media Library and Workbox windows, only their buttons in the ribbon's tab row. A theme that
  recreates a platform whose windows have title bars draws one on `.scWindowBorder2 > .scCaption >
  #CaptionTopLine`, exactly like its standard windows' caption, with the window's title from
  `content: var(--sct-window-title)` (engine.js reads it from the taskbar) and the window buttons on it; the
  ribbon's menu button (`#SystemMenu`) moves down by the bar's height. A frame drawn round the window's iframe
  never runs across the top of the title bar: offset shadows for the sides and bottom, not a uniform ring
  (Longhorn and Whistler both needed this). Under the bar the ribbon tabs start close, the empty tab-group header
  hidden and the menu button shrunk to the tab row, but never touching it: at least 2px between the bar and the
  tabs (`padding-top: 2px` on the navigator, the menu button moved down with them).
- **Window buttons.** Both window kinds. On the left, push the title clear. On the right, mirror the order
  (close nearest the edge), 8px or more from the border, centred on the bar.
- **No needless scrollbars.** Menus and pages scroll only when they have run out of room to grow.
- **Modals tint.** A faint but visible overlay (12% to 30%), and the host page stays see-through.
- **No dead controls.** A fake caption button or menu bar is worse than none.
- **Motion survives reduced motion.** The user's Chrome reports `prefers-reduced-motion: reduce` (Remote
  Desktop). Keep a slow, faint version of a signature animation; stop flicker and flashes.

## 7. Done

- Every line of [coverage.md](coverage.md) checked on 10.5 and 10.4, at 1x and 1.25x, in each appearance.
- Every SCAN finding fixed or explained in your report, from a run with `--white-icons` too.
- `npm test` passes; the user's Chrome checked per `sct-verify`; anything not checked named plainly.
- One commit per theme, through a private index (AGENTS.md).

## Red flags: stop and check

- "It looks right" from a 100% headless screenshot.
- Checked only the Content Editor, or only 10.5, or only the top frame.
- A per-theme fix for something every theme has (it belongs in `surfaces/`).
- A hover, focus or disabled state you never triggered.
- The Launchpad is 10.5's card grid in new colours, for a Recreation theme.
- A change to `dom.js` checked without reloading the extension.
- Only `shots.cjs` ran: no window maximized or resized, no menu opened, no modal ListView, no mode switch.
- The Launchpad checked only at 1300px wide.
