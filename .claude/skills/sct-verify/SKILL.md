---
name: sct-verify
description: Verify a Themes for Sitecore change before calling it done - unit tests, live-page screenshots per theme and Sitecore version, every frame checked, and a pass in the user's real browser. Use after any change to the extension's code, CSS, themes or detection, and whenever the user reports that something does not load or looks wrong.
---

# Verify a Themes for Sitecore change

A change is verified when it works **in the user's real browser on the URLs they open**, for every
theme and Sitecore version it touches. Playwright alone is not enough: on 2026-10-21 two regressions
passed it and broke in the user's Chrome.

## 0. If the user reported a problem, rule out the environment first

Before reading any code, check (see "Before blaming the code" in `AGENTS.md`):

1. Which browser, host and page? Ask only if you cannot tell.
2. That browser's theme setting for the host. Chrome: open the page in the user's Chrome and read
   `document.documentElement.dataset.sctTheme`. Edge: read the `storage.sync` values from a copy of its
   profile folder (`AGENTS.local.md` names it; copy the folder plus `Local State` to your scratchpad and
   launch Edge on it with Playwright, `channel: "msedge"`), or ask the user to open the popup.
3. Other page-styling extensions (Dark Reader, Stylus; `AGENTS.local.md` lists the user's). Check their
   settings folders under the profile for the host name.
4. Whether the extension was reloaded since content scripts or CSS changed (stale dev install).
5. Whether the Sitecore sign-in is hung (pages never reach DOMContentLoaded): a hung SPE script.

Report what you found before changing code.

## 1. Scope

Write down, in one line each:

- the surfaces the change affects (`shell`, `speak`, `launchpad`, `login`, `ee`, `admin`);
- the themes (all token themes if you touched `surfaces/`, `lib/`, `content.js` or `background.js`);
- the versions (10.5 and 10.4 unless the change is version-gated).

## 2. Static checks

```bash
npm test
```

All tests must pass. Also run `node --check` on any JS file you edited, and `npm run lint` if you
changed the manifest.

## 3. Live pages, every frame

```bash
node .claude/skills/sct-verify/shots.cjs --themes <ids> --versions 10.5,10.4
```

It copies `.auth/profile`, loads the real entry URLs (the desktop at bare `/sitecore/shell`, the
Content Editor, Launchpad through the shell path, the Experience Editor, the admin pages, SPE Reports),
checks every frame's `data-sct-*` attributes, lists uncaught page errors, and screenshots each page into
`test-results/verify/`. Add `--paths` for pages the change touches that are not in the default list.
The window is 1300px wide; `--width 1920` checks the Launchpad's wide layout (Analytics moves right above
1570px).

For any visual change also pass `--scale 1.25 --scan`. `--scale 1.25` renders at the user's
devicePixelRatio, where glyphs garble and 1px edges land on different device pixels. `--scan` checks
every themed frame for text and placeholders below AA against the colour behind them, light patches in a
dark theme, small glyphs whose rendered pixels barely differ from their background, and needless
scrollbars (`scroll`: a menu or page that scrolls for a few pixels while it could still grow).
Icons can be white (Sitecore's `OfficeWhite` set, which scripts and items pick) or black, and vanish on a
panel of their own colour; the default pages show none. Add `--white-icons` to swap every item and command
icon for a white one before the scan: a `glyph` finding on an icon (`stands out 1.00:1`) means the theme's
own `filter` there has replaced the halo `surfaces/bar.css` gives them. Run it for every theme a change
to icons, panels or their filters touches.
Desktop windows need opening too: `node .claude/skills/sct-verify/windows.cjs --themes <ids>` opens the
SPE ISE as a Desktop window and fails if its title (the script's path) is empty, narrow, clipped or covered,
if a window button has no size, or if maximizing doesn't swap in the restore image. In that window and in the
standalone ISE it also checks the script tree and variables toggles left of the script tabs: each visible and
on top, no tab over it, no strip or tab border through it, its centre within 1.5px of the first tab's, and the
first tab right of both (SPE's 52px reserve). `--themes all` runs every theme.
The taskbar or dock must stay above every non-modal window, as in stock Sitecore:
`node .claude/skills/sct-verify/dock.cjs --themes <ids>` maximizes a Desktop window and fails when it covers the start
button, a window button, the search box, the database selector or the top bar's Log out, or, for a dock narrower
than the screen, when the window does not show beside the dock (windows run on under a dock). Screenshots go
to `test-results/dock/`. Run it for every theme that moves or reshapes the taskbar or the Desktop area.
The taskbar must keep one entry per window: `node .claude/skills/sct-verify/taskbar.cjs --themes <ids>` switches
a Desktop Content Editor to the Media Library, the Workbox and back, then closes it, and fails on a duplicate or
orphaned entry. Current Chrome and Edge never fire `unload`, which Sitecore removes entries from, so the
script blocks `unload` listeners; without that Playwright never shows the bug. Run it for every theme you
touch, and with `--themes all` after any change to `engine.js` or a theme's `dom.js`. This bug has come back
twice; the fix lives in `engine.js` (`syncTaskbar`), never in a theme. The same run gives the first entry a title
too long for any button and fails when it runs past the button or is cut off without an ellipsis: text that
cannot fit a control that cannot grow ends in "...", never mid-letter (`bar.css` does it for every theme).
Menus only exist while open: `node .claude/skills/sct-verify/menus.cjs --themes <ids>` opens each kind
(context menus, ribbon drop-downs, start menu and fly-outs, taskbar menus, galleries) and scans each. It prints `SCAN`
lines and writes `scan-<themes>.json`. Fix each finding or say why it is fine (a disabled control, a colour icon on
a selection). It can't judge text over images, gradients, filters or translucent bars, so read those in
the screenshots.

- A non-zero exit lists frame problems. Fix them before going on.
- **Read every screenshot** of a page your change touches. Look for light patches in dark themes,
  dark-on-dark text, misaligned controls, and anything that looks like a different theme.
- If pages land on the login screen, re-copy the profile (the script does this each run); if it
  persists, ask the user to run `node test/e2e/login.mjs`.
- **Experience Editor changes:** click a rendering and then a field before judging. The floating
  toolbars only exist once something is selected, and selecting re-lays out the page, which is when
  the 2026-10-23 dark-gap bug appeared. The website around the selection must look exactly as on Native.
- The scanner measures glyph boxes without overflow clipping, so a tree row scrolled under a pane's
  edge can show up as a false finding. Shots run with the OS's light or dark setting; for Cupertino,
  check both appearances (Playwright's `colorScheme` launch option).

For changes to detection, the engine or the CSS pipeline, also run the Sitecore e2e suite:

```bash
npx playwright test test/e2e/sitecore.spec.js
```

## 4. The user's real browser

Chrome (through Claude in Chrome):

1. Open a Sitecore page in a new tab and post `{type: "sct-dev-reload"}` to reload the extension.
2. Reload the page (stale tabs keep old content scripts and stale CSS).
3. For each page in scope: read `data-sct-surface`/`-theme` on the top document **and** on every
   same-origin frame (`document.querySelectorAll("iframe")`), and take a screenshot.
4. Do not change the user's theme settings. If you must (`sct-dev-set` replaces the whole overrides
   map), record the old values first and restore them.

Edge: you cannot drive it. Tell the user to reload the extension at `edge://extensions` and reload
the tab, and say which pages to look at.

## 5. Report

State plainly:

- what passed, where (unit, Playwright with the version and themes, the user's Chrome);
- what you could not check (Edge, Firefox, a theme or version) and why;
- anything you changed in the user's environment (files on the Sitecore installs, settings).

Never say "works" for a browser or version you did not check.
