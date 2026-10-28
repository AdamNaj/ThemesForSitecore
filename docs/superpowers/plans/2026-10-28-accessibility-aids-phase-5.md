# Accessibility aids phase 5 (new tools) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Run any ribbon command, or go to any item, by typing; see every shortcut in one place.

**Architecture:** Two aids sharing one dialog helper, `SCT.aidDialog(ctx, { label, build })` in `dom-kit.js`: an owned `<sct-dialog role="dialog" aria-modal="true">`, focus in on open, Escape and a click outside close it, focus goes back to where it was. Each works in the frame where its key is pressed: a command runs by clicking Sitecore's own button in that frame.

**Spec:** `docs/superpowers/specs/2026-10-27-accessibility-aids-design.md` (Section 1 `command-palette`, `shortcuts-help`, `session-warning`; Section 3 on shortcuts; Section 4 phase 5).

## Survey (2026-10-28): shortcuts and the session

- Alt+F1 is Sitecore's: `scSitecore.onKeyDown` shows and hides the ribbon's key hints with it. Shortcut help takes **Ctrl+/** instead (the usual key for shortcut help; SPE's ISE editor uses it to comment a line and takes it first, so there it stays the editor's).
- Ctrl+Shift+Space: nothing in Sitecore 10.4, Chrome, Edge or Firefox; the palette keeps it.
- Ribbon buttons carry their shortcut in `aria-keyshortcuts` ("Ctrl+S", "F2", "Ctrl+Shift+Alt+Up"; "???" where none), the ribbon's tabs in `accesskey` (Alt+H, Alt+N...).
- The tree's search box (`#TreeSearch`, its button `.scSearchButton`) takes an item path or ID and opens it.
- `session-warning` is dropped: Sitecore pings `/sitecore/service/keepalive.aspx` 30 s before the session would time out (`scKeepAlive`, every `SessionTimeout` - 30 s) for as long as a Sitecore page is open, so the timeout the aid would warn about does not happen.

## Global Constraints

- Phases 1 to 4 hold. A shortcut acts only when `!e.defaultPrevented`, so an editor that takes the key (Ace) keeps it.
- The dialogs pass axe: named, modal, a combobox with a listbox for the palette.

## Review Focus

1. The palette on a page without a ribbon (Launchpad): it opens and says there are no commands, rather than not opening. Pinned in Task 2.
2. Two quick presses of the key: one dialog. Pinned in Task 1.
3. A command whose button Sitecore re-rendered while the palette was open: the click goes to the button found by its label at run time. Pinned in Task 2.

---

### Task 1: `SCT.aidDialog` (in dom-kit.js)

- `SCT.aidDialog(ctx, { label, build(dialog, close) })` returns `close`; a second call while one is open focuses the open one.
- Owned `<sct-dialog role="dialog" aria-modal="true" aria-label=label>` on the body, `build` fills it; focus goes to its first control; Escape, or a click outside it, closes it and gives focus back.
- Its base look goes in the CSS of each aid that uses it (Canvas/CanvasText, the theme's tokens where there are any).
- Tests through Task 2's and 3's aids.

### Task 2: `command-palette` (needs keyboard; surfaces shell, speak, launchpad)

- Ctrl+Shift+Space opens "Commands": an input (`role=combobox`, `aria-expanded`, `aria-controls`, `aria-activedescendant`) and a `role=listbox` of up to 12 options.
- Options: every ribbon button of the page (`.scRibbonToolbarStrip` `a[href], [role=button]`) by its name (aria-label, else text, else title), with its group's caption ("Save · Write"), de-duplicated; then "Go to <typed text>" when the text starts with "/" or "{".
- Typing filters (case-insensitive, words in any order); Up and Down move; Enter runs: a button is found again by its name and clicked, "Go to" types the text into `#TreeSearch` and clicks `.scSearchButton`.
- Tests: Ctrl+Shift+Space opens it with focus in the input; "cop" lists "Copy to · Operations"; Enter clicks it (counted); "/sitecore/content" offers Go to, which fills the search box and clicks its button; Escape closes and focus is back; on Launchpad it says "No commands on this page".

### Task 3: `shortcuts-help` (needs keyboard; surfaces shell, speak, launchpad, admin)

- Ctrl+/ opens "Keyboard shortcuts": Sitecore's (each ribbon button's `aria-keyshortcuts` but "???", each ribbon tab's `accesskey` as Alt+<key>, Alt+F1 for the ribbon's key hints) and ours (Ctrl+Shift+Space, Ctrl+/, F6, typing in the tree) as a two-column table.
- Tests: Ctrl+/ opens it; it lists "Ctrl+S Save" and "Alt+H Home" from the fixture and "F6"; Escape closes it.

### Task 4: Live and wrap-up

- axe baseline, `SCT_A11Y_UPDATE=1`, commit.
- specm: Ctrl+Shift+Space, "copy", Enter opens Copy to (then Cancel); Ctrl+/ lists the shortcuts.
- Spec: phase 5 done; `session-warning` dropped with the reason above; the shortcut keys in Section 3; the popup's key line (Section 3 item 4) in `site-settings.js`.
