# Pitfalls: what the user had to correct, and the rule that prevents it

Collected from every theme session (Copenhagen, Redmond 3.11, Metal Steel, Cupertino, Debrightify,
Sitecore 10.4). Quotes are the user's words. Selectors are Sitecore's.

## 1. Dark and light: text, fonts and glyphs

**Glyphs that vanish.** "if the background is dark and the buttons would not be well visible - the buttons
colors should be changed"; "the left-most icon ... should be white on a dark theme", "likewise with the white
icon on other dark themes like Copenhagen"; "The expand/collapse ribbon button is invisible ... until i hover
over it. On cupertino it's glyph is black".
- Window buttons are restyled per theme, never left as Sitecore's images on a new bar colour.
- Monochrome UI glyphs (ribbon collapse chevron, menu fly-out arrows, rule-editor triangles, tree search
  buttons, filter-token X, EE breadcrumb separators, Launchpad 9-dot button, Control Panel back arrow) take
  the text colour of what they sit on. The shared layer does the ribbon toggle (`surfaces/shell.css`) and the
  EE `.sc-quickbar-button` (`surfaces/speak.css`) as a CSS mask filled with the text colour; don't add a
  per-theme `filter: invert` on top, it darkens them again. Masks must point at images both versions ship
  (`Accordion_up.png`; 10.4 has no `accordion_*_grey.png`, and a mask on a missing image hides the element).
  10.4 has no `_grey` glyphs at all: its section chevrons, ribbon chunk launchers and the tree search
  options arrow are darker or paler than 10.5's, so a theme tuned on 10.5 needs them inked for 10.4 too.
- 10.5's global logo (SPEAK header, admin pages) is a dark image made for a white bar: on a dark bar mask it
  and fill it with the bar's text colour.
- Elsewhere dark themes use `filter: var(--sct-glyph-filter)` (`invert(1) hue-rotate(180deg)`). Never on
  colour item icons, Media Library thumbnails or Rich Text content, and never on a field (it inverts the
  typed text too: the dark-field magnifier needs a replacement icon instead).
- Glyphs are images or masks, so computed colour says nothing. The scanner (`--scan`) measures rendered
  pixels; also zoom into crops.
- Light themes fail too: white or pale chevrons on light grey section headers (Cupertino), `#ccc` images at
  half opacity on a light ribbon (Sitecore 10.4).
- **Monochrome icons carry a halo of the opposite colour**, as Sitecore 6 (and Copenhagen) did for a white
  icon on its white dialog header. Sitecore's `OfficeWhite` set (1311 icons, all white, for its dark headers)
  is what SPE dialogs (the Kitchen Sink) and items often pick; on a theme's white tree, item header or dialog
  header they vanish. `surfaces/bar.css` gives every `OfficeWhite` image a 1px dark `drop-shadow` and every
  `_black` icon a light one, at zero specificity, for every theme: never write it per theme. A theme that
  sets its own `filter` on an icon slot (a glyph filter, a recolour) replaces the halo there, so it appends
  `drop-shadow(0 0 1px rgb(0 0 0 / 0.7))` to its own chain. The default pages show no white icons, so check
  with `shots.cjs --scan --white-icons` (see `sct-verify`).

**Text on the wrong background.** "Log out" dark blue on a black SPEAK header; white ribbon tab labels on a
light band (10.4 floats its tab group out of an uncontained band: `display: flow-root` on the band; it does
the same to the ribbon groups of every ribbon outside the Content Editor, so Menlo's ISE ribbon line ran
through the buttons: "the ribbon bottom line seems to be rendering above the button's bottom"); the
Metal ISE caption path light grey on lavender ("make the text dark purple"): SPE writes it as `<i>` with an
inline `color:#bbb` inside the window caption; `surfaces/shell.css` now draws it at 75% of the title's colour
for every token theme, so a theme overrides it (with `!important`) only to pick its own; month captions dark on a navy
calendar bar; login labels unreadable on a red background.
- Check every label against the band it actually sits on, on both versions.
- 10.4 leftovers: its red `#DC291E` on section stripes, active tabs, the Administration band and the
  Control Panel title band. Map the version's accent explicitly (`[data-sct-version="10.4"]` token block).

**Bright patches.** "the Cupertino and darkify themes are blinding light" (that one was Launchpad CSS never
loading, see section 6); "SPE reports look poorly on dark theme"; "The SPE ISE progress is completely
unusable on dark themes".
- Sheer UI and SPE write backgrounds inline in every spelling: `#fff`, `white`, `White`, `rgb(255, 255, 255)`.
  Selectors need the `i` flag and spacing variants. `lib/live-map.js` maps stylesheets and inline styles the
  build never saw; extend it rather than listing patches per theme.
- SPEAK uses `hsl()`/`hsla()`; c3 charts use `fill`/`stroke` (map greys, keep data colours); the Write-Progress
  overlay is SPE's `opacity: .9` with black text; Ace runs under `--sct-editor-filter`, so its scrollbar
  colours must be pre-inverted (#bcc2ca/#fdfeff render as #494e54/#1f2020) and checked by sampling pixels.
- Rich Text previews and the website inside the Experience Editor stay as the site renders them. Never set
  `color-scheme` on the `ee` surface.
- Translucent surfaces (menus, Dock, Launchpad over wallpaper) keep text at AA over the busiest backdrop
  pixel (Cupertino measured 5.5:1 light, 9.3:1 dark); strengthen the tint if blur is not enough.

**Hover on dark.** Debrightify's hovers fell to the app background, darker than the panel, so rows went
dark on hover. A hover lifts (lighter) above its own panel. Disabled menu rows don't highlight.

**Fonts.** Font stacks only (no bundled fonts). Never use the `font` shorthand without restating
`line-height`: it put the Copenhagen ListView title 4px high. Keep the theme's font off `.ace_editor` and
its children. Folder view: "the text under icons ... look very odd with such bold and large text".

**Both appearances.** A theme that follows the OS must be checked in light and dark; Cupertino light was
skipped once because Windows was in dark mode.

## 2. Spacing and density

The user's baseline is Copenhagen: "the padding inside the dialog (on Redmond and Metal) should be closer
to what it is on Copenhagen"; "Lower the paddings on the ribbon sections ... they are too spaced"; "the 10.5
Cupertino is much more spaced than the Cupertino on 10.4 ... I would like them unified".

| Place | 10.5 stock | Target |
|---|---|---|
| Ribbon chunk panel sides | 16px | 4px; captions wider than the buttons keep 4px from the edge |
| Ribbon chunk panel top | 0 | 3px (a large button touched the frame in Metal) |
| Above and below the ribbon strip | ~12-15px | 5-8px (`display: flow-root` instead of a fixed height) |
| Button, gallery, small-button column side padding | 8px | 5px |
| Dialog insets and footer | 28px | 8px; OK/Cancel 8px from the corner |
| Text inputs | `min-height: 34px`, 8px padding, rounded | the theme's own height (Copenhagen 21-22px square, Redmond 24px, Metal 22px) |
| `.scContentControl` | `min-height: 35px` | `min-height: 0` plus an explicit height |
| Quick Info rows | `line-height: 35px` | ~17px in Copenhagen; the theme's row |
| Content Editor gutters (under ribbon, left of tree, splitter to editor, under content) | 16/12/16/12px | half or less; inline styles, so `!important`; scope to the CE splitter, `#ContentEditor` also exists in Field Editor dialogs |
| Editor panel inset | 30px | 15px (shared layer) |
| Taskbar | 51px, `.DesktopArea { bottom: 50px }` | change both together, and pin the tray, search box and database label |

- **Fix a height, pin the padding.** Stock 10.4.1 `Ribbon.css` pads `.chunk .panel` `10px 8px`, 10.5
  `0 16px 10px`. Redmond fixed the panel at 46px and on 10.4 the buttons slid 10px down over the captions.
  The user guessed "less padding at the top of the button"; the cause was the panel. Diff the stock `Ribbon.css`
  against the test install's before blaming its project CSS.
- **Exclude `select[multiple]` and `select[size]`** from field height rules, or treelists clip.
- **Header buttons** (`.scEditorHeaderButton`: Expand, Collapse, language, version) also carry `.scButton`,
  so push-button styling leaks onto them: "too tall ... oversized and spaced too much". Style them as
  compact toolbar buttons centred on the tab row.
- **Tree search panel:** "needs to have much less padding": 10.5 gives the buttons 8px and
  `#ContentTreeActualSize` 15px top padding. Tree rows 18px with a steady 1px border so selection does not
  shift them.
- **Ribbon content stays inside its chunk.** Only 20 of the Content Editor's 90 panels fit at one point.
  Every button, gallery and date box sits inside the chunk's inner bevel with a gap above the caption,
  hover and pressed included; measure every ribbon tab at 100% and 125%.
- **Vertical centring.** Title bar text, the ListView Filter box ("not centered vertically and does not
  align with the text", three rounds), SPEAK header items (avatar 3.8px low, Launchpad button 6.9px low,
  the Sitecore Extensions "MASTER" 10px low). Centre against the visual neighbour, not the container: the
  ListView's Page chunk fills its panel including the bottom 10px, so the Filter panel splits it 5px/5px.
  The shared rule targets `#Filter` to outrank SPE's ID rules.
- **ISE script tabs:** "should be wider to accommodate for the X". SPE pulls the close X 10px into a 20px
  right padding; with less padding put it 6px after the label and 8 to 9px from the tab edge.
- **Dialog tabs:** "too little left padding inside the tab". SPE's tab pages keep a 10px right gutter per
  field; give the left 14px.
- **Dialog headers and tab strips keep Sitecore's heights.** Sitecore sizes a dialog's body and its tab pages
  from the header's and the tab strip's boxes, so a header rule or tab strip a few pixels thicker makes the
  tab page scroll (Application Options: the scan's "3px too short"). Draw heavier rules with `box-shadow`
  over a border of the stock width, not with a thicker border.
- **Menus never scroll unless they've run out of room.** "Notebook tends to show scrollbars on the
  context menus": Sitecore sizes a popup from its content when it opens, so a theme that makes rows,
  fonts or paddings bigger can leave the menu a row short and scrolling. Same for pages: Chicago's
  Launchpad scrolled because 8px of padding sat on top of Sitecore's `min-height: 100vh` (the shared layer
  now zeroes that min-height; padding on the page still adds up). The scan reports
  both as `scroll` findings; open every kind of menu with `menus.cjs`.
- **Dock and taskbar:** "should collapse horizontally to only be as wide as the apps need"; app buttons
  "should not be taking the full width and have rounded corners". Keep 12px or more from screen edges;
  maximised windows stop above the Dock; a window dragged over it stays visible (`overflow: clip;
  overflow-clip-margin: border-box` on the Desktop area).

## 3. Icons and glyphs: size, crispness, centring

"The [+]/[-] icons get garbled on Redmond theme"; "The Metal Steel theme icons are showing garbled on my
screen more than not ... do a proper treatment"; "They still do not look 100% right, they can be blocky and
distorted"; "I wonder if it's correct to use SVG to paint pixels ... or rather paint the intended shape".

What failed, in order: stacks of 1px `linear-gradient` tiles (seams and smudges at fractional offsets);
solid-colour tiles and inner shadows (soft); PNG with `image-rendering: pixelated` everywhere (blocky,
every fourth pixel doubled); per-pixel SVG rects (1px black outlines turn grey); smooth 8x PNGs (soft).

What works:
- **Boxes are real CSS borders.** A border snaps to device pixels. Redmond's tree box: 9x9, 1px black
  border, white fill, strokes as solid tiles inside, margins that keep Sitecore's 16x16 footprint
  (`9px 3px 8px 4px` in content trees, on top of the stock `margin: 5px 0`). Compare row positions before
  and after.
- **Everything else is a PNG plus a vector SVG of the intended shape**, written by the generator's `art()`:
  `image-set(url(x.png) 1x, url(x.svg) 2x)`, `image-rendering: pixelated` only inside
  `@media (resolution: 1dppx)`. Arrows are polygons through the pixel-step midpoints, radios and knobs real
  circles, bars and squares `shape-rendering: crispEdges`. Title-bar glyphs keep their box frames on the
  pixel grid and draw only diagonals as lines. A 1px transparent margin around each PNG stops Chrome
  softening its edge. Reset the inherited `image-rendering` at zero specificity at the top of each sheet.
- **Load glyph files as `sct-ext:themes/<id>/glyphs/<file>`** (background.js rewrites it, the manifest's
  `web_accessible_resources` already covers `themes/*/glyphs/*`, `test/unit/assets.test.js` checks it).
  `data:` URIs fail under a CSP without `data:` in `img-src`; root-relative URLs must point into `/sitecore` (unit test).
- **Swap Sitecore's `<img>` glyphs** with `object-fit: none; object-position: -999px -999px` plus a
  background, not `content: url()` (Chrome ignored it on 10.4) and not by changing `src` from script
  (it broke tree expansion).
- **Show the user a side-by-side comparison** at 1x and 1.25x before rolling a glyph technique out to every
  glyph; "crisp" claimed from a 100% capture was wrong twice.
- **Icons fit their box.** Small ribbon buttons hold a 16px icon in a 21px box (shared layer); Redmond's
  large buttons have 41px inside: 24px icon plus 14px label, 3px to spare. ISE's tree and variables toggles
  are positioned by SPE's script for a 34px tab strip; the shared layer (`surfaces/shell.css`) anchors them
  to the first tab's middle and keeps SPE's 52px reserve on the strip, so a theme adds no `margin-top`
  nudge (they drifted whenever tab heights changed) and doesn't draw a strip line under them.
  "the icons on the LHS of the tabs are cut off from the bottom". `windows.cjs` checks them.
- **Centre icons in large ribbon buttons** over their captions; cover `.sc-chunk-gallerybutton` in the EE.
- **The Sitecore Extensions add-on** (in the user's Chrome, not in Playwright) draws its own X in the field
  search ("the X should be smaller ... covers the textbox border") and a ribbon toggle pinned inline at
  `top:58px; right:50px` (`#sc-ext-toggleRibon-button`; `surfaces/ee.css` repositions it).
- **Launchpad icons** must exist (`forms.png`, not `form.png`); the EE tile links `/?sc_mode=edit`.

## 4. Borders, frames, bevels, tabs, title bars

**Tabs.** "The tabs are often detached from the content they are switching"; "The selected tab is
virtually indistinguishable"; "I told you to fix the white line below this tab on Redmond"; "The left line
of the first tab and the tab panel's left border do not align on Redmond and Metal and their lighting/shadow
are inconsistent"; "Hovering over a tab in ISE generates a dreadful experience ... the hovered state is
simply not themed"; "the hover should not cause the texts on the dialog tabs to be turning all uppercase".
- One tab rule set for every strip (Sheer dialogs, jQuery UI, editor tabs, ISE script tabs, Read-Variable):
  open tab raised, taller, bold, joined to its page; others lower.
- Style `.scTab_Hover` and `.scTabActive_Hover` like their resting classes.
- The strip aligns tabs to its bottom, so a taller open tab grows upward. To cover the page's top edge
  (black line plus white bevel) the open tab needs the height and `top: 2px`. Measure: tab bottom below
  the bevel line.
- Sitecore shifts the open tab `left: -1px`; shift the page 1px too. The token layer's grey inner
  `.scTabPage` border covered the theme's highlight: keep the 1px, make it transparent, and repeat the
  tab's two-column bevel on the page edge.
- 10.4 gives `.scTabActive` a fixed 40px height: reset to auto. Tab pages are dialog grey in classic themes.

**Fields.** "I don't think any of the themes is benefitting from the double frame around the field content
... remove the inner frame". Date, time and item pickers are a table around an input with its own frame,
forced to 35px on 10.5. The table is the field (`table.scCombobox` in the shared layer); the input has no
frame; the drop-down sits behind one divider. Leftover 10.5 rounded corners next to square themed controls
(tree search, language and version boxes, dialog Path input, context menus) are bugs. Radios and
checkboxes get the theme's own drawing ("should not be red").

**Ribbon buttons.** "For ribbon buttons with dropdown - the dropdown trigger should be aligned and filling
all the bottom"; "The frame around long buttons with dropdown ... is not painted large enough". Large combo
buttons (`.scRibbonToolbarLargeComboButtonTop`/`Bottom`): flat at rest; on hover two faces (command and
drop-down) that press separately, with the theme's combo arrow ("design D"). Hover frames enclose their
content: hover every button on every tab and measure. Security > Presets render as white square tiles;
style them like Home > Insert's list. The Insert gallery is a flat panel, not "too white".

**Window chrome.** "The window button changes did take on content editor and the dialogs, but not on apps
like SPE Console or ISE". Two kinds: `.scSystemButtons` (Content Editor, dialogs) and the standard frame's
`.standartWindowButtons` (Sitecore's spelling; ISE, Console, Workbox, Control Panel), positioned against the
whole window, so pin its height to the caption. Buttons on the left: "the window titlebar text needs to be
pushed to the right". On the right: "the buttons order should be reversed", "they nearly touch the window
border" (Cupertino: 9px inset, 8px apart, centred). Copenhagen: "still too tall and not attached to the top"
(a segmented strip hanging from the top edge). Inactive windows are marked only on the taskbar entry, so a
`dom.js` mirrors it (`data-sct-window`). Rounded title bars over a square frame: "some white artifacts
between the titlebar and the sides of the frame" (Whistler; the gaps had four separate causes, so fixing
one is not enough). Zoom into both top corners at 1.25x on both window kinds.

**The ISE's window title.** "On Redmond theme ISE does not show the script title." SPE's `ise.js` fits
the title (`#WindowCaption`) into the room the `.standartWindowButtons` box leaves, through
`--spe-title-max` and `--spe-title-inset`. A theme that stretches that box across the whole bar (buttons
on both sides of the title) leaves it 0px. Either keep the box to one side, or override both variables on
`#WindowCaption` and keep the title clear with the caption's own padding. A stretched box also needs
`pointer-events: none` (and `auto` on its images), or it covers the title and the bar no longer drags.
Window frames drawn on the iframe (border, outline, shadow) resize through `frameResize()` in `content.js`.
Desktop windows show Sitecore's restore image while maximized (`syncMaxButton()`): draw a restore glyph.

**Title bars over the Content Editor, Media Library and Workbox** (2026-10-25 and 26, every Recreation and
Modern theme): "give the engine the window's title, then give Whistler, Chicago, Redmond 3.11, Redwood, Santa
Clara and Warp proper title bars"; "the titlebar buttons on CE are too low - looks like they are on the
ribbon" (Mountain View, Graphite, Sun Valley, Cupertino); "you're not drawing the titlebar icons there on all
the windows (on this theme even CE should have it)" (Chicago, Whistler, Metal). Each took one commit per
theme, all with the same recipe (SKILL.md section 6, `chicago/shell.css` lines after "Under the bar"). The
Workbox's buttons float in its caption strip: give the strip `position: relative` and the buttons
`position: absolute; float: none` to place them on the bar. Modern themes draw the bar on the tabs' surface,
title at the left, buttons flush in the top right corner. On macOS themes the lights push the ribbon right;
with the tabs centred, the menu button sits against the tab pill (`anchor-name`, inside `@supports`).

**Glass frames** (Longhorn, Tahoe): "double rounded - once inside the titlebar and another time in the
border"; "when the window is not active the titlebar looks like it's got the frosting applied twice"; "you've
made only the Content Editor translucent, other window types like ISE or Recycle bin should have more
translucency too"; "make the ribbon similarly transparent on the other windows". Longhorn's real Aero: the
Desktop blurs and tints behind each iframe, the frame is the iframe's own see-through border on the sides and
bottom with a 1px dark line on top, and inside the window the layers are clear for the caption's height and
opaque below it, so only the caption shows the glass. Whistler's version of one surface: the iframe's
transparent 4px border over a background that is Luna's caption gradient down to the caption's height and the
frame's blue below.

**Textured panels** (Cheetah): "the background under the field should be transparent and showing the
background of the content"; the bar over the fields "very light gray look out of place ... should be shrunk to
the size of the Search box and also have brushed steel"; the status bar "should only be high enough to contain
the pill"; "if the titlebar touches the ribbon ... there should be a seamless handoff ... just like there is on
Content Editor" then "doesn't seem to be working on ISE": a standard window's ribbon is inside the window's
own iframe, and `:has()` does not see into a frame, so `.standardWindowCaption:has(+ ... .scRibbon)` matched
nothing; the theme's `dom.js` marks the iframe instead. The generated map paints `.scEditorSections`,
`#EditorTabs` and the status bar in flat app colours; a textured theme takes each one off. A brushed-metal or
grain texture is a seeded PNG from the generator (`glyphs/brushed-metal.png`), not hairline gradients.

**Dialogs.** "I've noticed the dialogs have a bar of different color just above the titlebar": jQuery UI's
15px title strip sits above the dialog page's header; colour it like the dialog (or lay it over the header).
It came back on four of the themes built on 2026-10-23 ("several themes still have the differently colored
bar on top of the modal titlebars for windows like `Show-ListView -Modal`"), because nobody opened a modal
ListView. There the header is `.ui-dialog > .ui-dialog-titlebar + .DialogHeader`, straight inside the jQuery
dialog, so `.scDialogHeader .DialogHeader` rules miss it; a non-modal ListView never shows the strip. Open
`Show-ListView -Modal` from the ISE (take the SPE lock, close it after). jQuery UI rounds
all four corners of the title bar (square the bottom two). 10.4 writes inline `margin` on the close button and
pins the button pane with `!important`; 10.5's `Dialogs.css` pins the title bar buttons' `top` and `right`
with `!important` (Sun Valley's buttons stayed put until the override matched it). Focus frames: "should not be visible on dialog open" (`:focus-visible`).
SPE's help (?) is placed for a 64px footer: "goes off the screen ... and too low"; centre it on the buttons.

**Overlays.** "The overlay background ... should only form a faint tint"; "Some themes like Metal or
Redmond do not have any background translucent tint". The modal host page body stays transparent; the
overlay tints 12% (Metal, Redmond) to 30% (Sitecore's grey).

**Platform soul.** "The launchpad is incredibly similar on all of the themes. Please give the feel and the
soul of the targeted platform." Cupertino: macOS Launchpad (blurred wallpaper, frosted folders, 72px
squircles, translucent menu bar), Dock, translucent menus, System Settings Control Panel. Redmond: Program
Manager (child windows tiled, navy active caption, 32px icons), a WfW logon dialog, the start menu as a
Program Manager window. Metal: a Swing desktop pane of internal frames sized to content. A Recolour theme
keeps Sitecore's layout on purpose. Fake controls (dead caption buttons, menu bars) are worse than none.

**A redrawn Launchpad loses tiles and breaks at other widths.** "Chicago launchpad is Missing Forms Also it
adds scrollbars unnecessarily": one padding rule pushed the Marketing Applications group under the header
and made the page 8px taller than the window. Count the groups and tiles against Native's. "On Blueprint the
panels listing apps - render below the Analytics panel": above 1570px Sitecore moves Analytics into a
right-hand column, and Blueprint's full-width groups no longer fit beside it. The shots run at 1300px, so
also run them with `--width 1920`. The Custom Analytics heading and the paragraph under it both carry
`.sc-text-title`: a theme styling `.sc-text-title` as a heading turns the description into one too. Select the
heading as `.col-md-12 > .sc-text-title`.

**Start menu.** "The left panel in the Start menu is all white going all the way to the bottom - this looks
bad"; "Start menu jitters even on mouse over on items". Size list boxes to their items; hover never
changes a row's box size; keep the source's rule order when porting. "the panel around All Applications in
Start menu should be transparent, not white, just like the items above it": Sitecore sets All Applications
under the right-hand column (the left one spans both rows), so it takes that column's material.
"The launchpad and logoff icons on Whistler theme are a poor choice ... the 9 squares ... a key icon. Use icons
from Sitecore but not from the office family but rather from the older icons which are more XP like."

**Segmented tabs** (Cheetah): "should show the tabs as long/divided pill (like the ribbon tabs) rather than set
of pills on the dialogs like the Kitchen Sink or the ISE editor selector", then "The first and last one looks
correct, the ones in the middle do not": Sitecore wraps each tab of a `.scTabstrip` in its own `<nobr>`, so
`:first-child` and `:last-child` on the tabs match every tab. Select the ends as `.scTabstrip >
nobr:first-of-type > .scTab` (and `:last-of-type`, `:only-of-type`); check a strip of three or more tabs.

## 5. Sitecore and environment facts that cost rounds

- The taskbar grows on every Content Editor mode switch: Sitecore removes entries on `unload`, which
  current Chrome no longer fires. `engine.js` (`syncTaskbar`) dedupes under every theme; it came back
  twice while each theme's `dom.js` carried its own copy, so never move it back into a theme.
  `sct-verify`'s `taskbar.cjs` checks it.
- Experience Editor strips switch with jQuery `hide()`/`show()`: never set `display` on `.sc-strip`.
- **The EE website must never change colour.** "when I click on the Hero carousel component - the component
  beneath it turns dark". Sitecore's dialog host, `/sitecore/shell/Controls/JqueryModalDialogs.html`, is a
  fixed, full-window iframe at `z-index: -1` behind the website. A frame whose `color-scheme` differs from
  its host page's gets an opaque canvas, so a dark theme's `color-scheme` there painted every gap in the
  page dark once selecting a rendering made the page lay itself out again. `content.js` stores the host's
  surface in `data-sct-modal-host`; on `"ee"` the frame keeps `color-scheme: normal`. Any frame laid over
  the website needs the same care, and so does every chrome element Sitecore fades over it
  (`.scChromeOverlay` keeps Sitecore's `#dfdfdf`).
- **EE floating toolbars** (renderings and fields) are `.scChromeControls` inside `.scChromeToolbar`, built
  by script on selection. "the content with the buttons never reverse colors". The generator's `ee`
  filter had lost its backslashes (`[w-]`, `[^s>+~]`), so it dropped every sc selector with an "s" after
  the prefix. Check what a filter actually keeps, not just that it runs. The toolbars' dropdown arrows are
  `menudropdown_black9x8.png` and take the glyph filter. To check them, click a rendering and a field in
  the EE: they don't exist until then.
- Never touch a child frame's `contentDocument` before its `load` (stopped the EE ribbon theming in Chrome).
- **Elements a `dom.js` adds must survive Sitecore's own scripts.** The Desktop's onload handler
  (`scWindowManagerInitialize`) calls `className.indexOf` on every element; an SVG's `className` is an
  `SVGAnimatedString`, so Phosphor's glitch filter made the Desktop throw "ctl.className.indexOf is not a
  function" on both versions. Add SVG only after `load`, and only for as long as it is needed. `shots.cjs`
  reports page errors; compare with Native before blaming the theme.
- **`dom.js` also runs in the Sitecore module** (`sitecore/`, built by `npm run build:sitecore`): no extension
  APIs, no `Array.from` (Prototype.js replaces it). See AGENTS.md.
- **Chromium reports `prefers-reduced-motion: reduce` inside Remote Desktop**, which is how many people work,
  so Phosphor's scan-line rolled in Firefox and stood still in Chrome and Edge. A theme's signature motion
  keeps a slow, faint version under reduced motion; flicker, flashes and bursts stop. Check both
  (`page.emulateMedia({ reducedMotion })`).
- **Sitecore 10.0 to 10.3 get 10.4's themes** (`data-sct-version="10.4"`, the real release in
  `data-sct-legacy`). Their markup lacks some 10.4 classes: gallery menu rows are a classless `tr`, time picker
  items any link in `ul.scTimePicker` (no `scGalleryMenuItem`, `timePickerItem`). A selector on those classes
  also matches the older markup, in the CSS and in the theme's generator.
- **SPE versions differ.** SPE up to 8.0 Beta 2 boxes each status bar panel in white with a silver frame; newer
  SPE draws them transparent. The user found a shared rule for the old look "especially harmful in the
  translucent themes" once the installs moved on. Check what the current stock map (`gen-area-map`) gives
  before adding a rule for a look the install no longer has.
- The ISE clipboard `textarea` must stay hidden.
- SPEAK `.sc-chunk` is `border-box`: use `content-box` or the caption loses 4px.
- `#Startbar` has no `.scStartbar` class.
- A generated port of a whole old stylesheet came out at 516 KB per frame; prune rules for classes 10.x
  never renders.

## 6. Process: what made the user repeat themselves

- **Wrong URLs.** Sitecore opens Launchpad at `/sitecore/shell/sitecore/client/Applications/Launchpad` and
  the Desktop at bare `/sitecore/shell`; a day of Launchpad work was invisible because tests used tidied
  URLs. Use the paths in coverage.md.
- **Stale extension.** "I suspect I am not seeing the final product in Chrome yet". Reload the extension
  after any JS change; a tab that switched themes live keeps the old CSS (close it, open a new one).
- **Environment first.** Edge had the host on Native, Dark Reader was on, another session changed the
  theme mid-check. See AGENTS.md "Before blaming the code".
- **Claimed but not measured.** The Redmond tab line, the Filter box and "crisp" glyphs were each reported
  fixed and were not. Measure pixel edges at 1.25x; read the screenshot you just took, not an older one.
- **Narrow fixes.** A fix for the tree box only, when every glyph used the failing technique; a fix in one
  theme when all token themes had the bug; a shared-layer fix that missed the non-token Sitecore 10.4
  theme (generated by `tools/css-diff.mjs`, which must carry `!important` where 10.5's value does).
- **One version.** 10.4 differs: floated tab groups, fixed `.scTabActive` height, inline dialog-button
  styles, the CSP, different ribbon padding. Check both every time, and say when a sign-in blocked one.
- **Patching in layers instead of porting the source.** Copenhagen took four "still wrong" rounds until the
  6.6 stylesheets were ported by a generator. If the source's CSS or images exist, port them.
- **Only screenshots, never interactions.** The 18 themes built by agents on 2026-10-23 all used this skill
  and passed `shots.cjs`. What the user found afterwards were all things the shots never do: maximize a
  window (the restore glyph), drag its frame (resize), open a menu (scrollbars), switch Content Editor modes
  (taskbar entries), open a modal ListView (the title strip), the ISE's title and toggles, a wide window
  (Launchpad), the Desktop's page errors. Run `windows.cjs`, `menus.cjs` and `taskbar.cjs` as well as the
  shots, and drive the rest by hand.
- **Density not measured.** Whistler and Chicago both came back for "way too much padding in the ribbon",
  with the table in section 2 in the skill. Measure the ribbon band, strip and chunk paddings and compare them
  with Copenhagen's on the same tab before saying a ribbon is done.
- **The same workaround in every theme built in parallel.** The 16 themes of 2026-10-25 were built by
  separate sessions; each carried its own fix for the ISE path colour, the no-children spacer, the Launchpad's
  min-height and the pale ribbon glyphs, and five later commits moved them into the shared layer. Grep the
  other themes' folders before writing a workaround (SKILL.md section 5).
- **One window kind fixed.** Translucency, the title-to-ribbon hand-off and title bar icons were each done on
  the Content Editor first and came back for the ISE, the Recycle Bin, the Workbox or the Media Library. Open
  every window kind before saying a window rule is done.
- **The same layout on both versions.** "on Sitecore 10.5 the theme has unnecessary margins around the content
  area and the items tree ... They should not be dependent on which version of sitecore they are running."
  Compare tree, editor, section and pager positions between the two versions' shots.
- **Shared checkout.** Generators and theme files are edited by several sessions: commit only your hunks
  through a private index and regenerate from HEAD plus your hunks to prove the diff is yours.
