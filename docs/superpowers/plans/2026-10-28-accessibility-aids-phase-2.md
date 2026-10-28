# Accessibility aids phase 2 (keyboard) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A keyboard user reaches the tree in a few presses, moves through the ribbon, tree, menus and dialogs with the keys they expect, and always sees where focus is.

**Architecture:** Seven aids in `extension/lib/aids/`, each listed in `AIDS` (needs only, none always-on) and the module's `Aids`, tested on the phase 1 fixtures through `aidCase`. Key handlers are one delegated `keydown` listener per document through `ctx.listen`, acting only when `!e.defaultPrevented`.

**Tech Stack:** as phase 1.

**Spec:** `docs/superpowers/specs/2026-10-27-accessibility-aids-design.md` (Section 1 "Keyboard only", Section 2 "Sitecore first", Section 4 phase 2).

## What Sitecore 10.4 already does (survey, 2026-10-28)

The spec was written before this was known; each aid fills only the gap:
- Tree: Up, Down, Left, Right, Home, End, Space and Delete (`scContentEditor.onTreeKeyDown`). Shift+F10 and the Menu key open the context menu (the browser's `contextmenu` event). Missing: Enter, type-ahead.
- Ribbon tabs: roving tabindex with arrows, Home, End, Enter, Space. Missing: the toolbar below them is 22 Tab stops.
- Editor tabs and section captions: arrow keys already.
- Menus (`table.scMenu[role=menu]`, `tr[role=menuitem]`): Up, Down, Home, End, Enter, Space, Escape once focus is inside. Missing: opening a menu leaves focus on the opener.
- Dialogs (jQuery UI 1.13 in `JqueryModalDialogs.html`): `role=dialog` and `aria-modal=true` already; labelled by an empty title span, and focus is lost when one closes.

## Global Constraints

- Sitecore first: never `stopPropagation`, act only when `!e.defaultPrevented`, never on a key Sitecore handles (the list above).
- Phase 1's rules: two aids never write the same attribute of an element; everything through the kit; idempotent passes under 4 ms.
- Elements of our own are owned custom elements (`<sct-skip>`), styled by the aid's own `css` with the theme's tokens and system colours as fallback.
- Cross-frame state goes through DOM attributes, never objects on another window (content scripts run in isolated worlds).

## Review Focus

1. A roving toolbar after Sitecore re-renders the ribbon (item change): exactly one button of the visible strip has `tabindex=0`. Pinned in Task 2.
2. Type-ahead with a node collapsed: only visible items match. Pinned in Task 3.
3. A menu opened by mouse also takes focus, and closing it with Escape returns focus to the opener. Pinned in Task 4.
4. A dialog closed while its opener's frame was re-rendered: focus goes to the newest still-connected element, never throws. Pinned in Task 5.
5. F6 on a page with one region does nothing harmful (focus stays). Pinned in Task 6.

---

### Task 1: `focus-ring` (CSS; needs keyboard, low-vision; surfaces null)

- Engine: `<html data-sct-needs="...">` lists the site's needs (space-separated), removed with the rest on stop.
- `css`: `:focus-visible{outline:2px solid var(--sct-focus-ring,Highlight)!important;outline-offset:1px!important}`; under `:root[data-sct-needs~="low-vision"]` the width is 3px.
- Test "focus-ring: a visible ring, thicker for low vision": keyboard need, Tab to the Save button, computed `outline-style` solid and width 2px; with low-vision too, 3px; with no need, the page's own.

### Task 2: `ribbon-toolbar` (needs keyboard; surfaces shell)

- Each `.scRibbonToolbarStrip` holding controls gets `role="toolbar"` and `aria-labelledby` the navigator tab whose `aria-controls` names it.
- Its controls (`a[href], button, img[role=button], [tabindex]`, not inputs or selects) get `tabindex="-1"` except one with `0`: the last one focused there, else the first visible.
- Left and Right move to the previous or next visible control and wrap; Home and End go to the first and last; the moved-to control takes `tabindex=0`. Keys from inputs, selects and textareas are left alone.
- Test "ribbon-toolbar: one Tab stop, arrows inside": fixture strip of four controls; Tab from the nav tab lands on the first, Right twice lands on the third, Tab leaves the strip, Shift+Tab comes back to the third; markup replaced, still one `tabindex=0`.

### Task 3: `tree-keys` (needs keyboard; surfaces shell)

- Enter on a focused tree node link clicks it (Sitecore's Space does the same).
- Typing letters (no Ctrl, Alt or Meta; buffer reset after 700 ms) focuses the next visible node whose text starts with them, from the one after the focused node, wrapping.
- Test "tree-keys: Enter opens, letters find": fixture tree of four nodes, one collapsed with children; Enter clicks (counted), "c" then "o" focuses "Content", a hidden child never matches.

### Task 4: `menus` (needs keyboard; surfaces shell)

- When a `.scPopup` holding `[role=menu]` appears and focus is outside it, the first visible `[role=menuitem]` gets `tabindex="-1"` and focus; the element focused before is remembered.
- When that popup leaves the page, focus goes back to the remembered element if it is still connected.
- Test "menus: focus moves into a menu and back": fixture button that appends a popup; focus is on its first item; removing the popup returns focus to the button.

### Task 5: `dialogs` (needs keyboard, screen-reader; surfaces shell)

- In a dialog host document: each `.ui-dialog[role=dialog]` whose `aria-labelledby` points at an empty title gets that title's `aria-label` from its frame's title without the "Sitecore: " prefix (frame-titles names the frame), else "Dialog".
- Every document records its last focused element as `data-sct-focus="<Date.now()>"` (one element per document, kept off the kit's undo log; removed on revert).
- When a dialog host loses its last `.ui-dialog`, it finds, across `top` and its same-origin frames, the newest connected `[data-sct-focus]` outside dialog hosts and focuses it (its window first).
- Test "dialogs: named, and focus comes back": fixture host page with a `.ui-dialog` and an iframe titled "Sitecore: Copy to"; the title gets "Copy to"; focus a button in the top page, remove the dialog, the button has focus again.

### Task 6: `regions` (needs keyboard; surfaces shell, speak, launchpad, admin)

- Regions: `[role=banner], [role=navigation], [role=main], [role=region], [role=search], header, nav, main` in document order, visible, not nested in another region.
- `<sct-skip>` as the body's first child: one button per region, "Skip to <its name>", visually hidden until focused (aid `css`).
- F6 and Shift+F6 move focus to the first focusable element of the next or previous region (or the region itself with `tabindex=-1` through the kit), wrapping, within the document.
- Test "regions: skip links and F6": on the CE fixture the first Tab stop is "Skip to Content tree"; Enter on it focuses the tree; F6 from the tree goes to the editor; Shift+F6 back.

### Task 7: `targets` (CSS; needs keyboard, low-vision; surfaces null)

- `css`: images and small controls Sitecore draws at 16px take 4px of padding and -4px of margin, so they hit at 24px without moving anything: `img[onclick], img[role=button], .scContentTreeNodeGlyph, .scRibbonPanelUp, .scRibbonPanelDown, .scRibbonPanelOpen, .scEditorSectionCaptionGlyph`; `.scRibbonToolbarSmallButton` and `.scRibbonToolbarLargeComboButtonBottom` get `min-height:24px` with a matching negative block margin.
- Test "targets: small controls hit at 24px": on the CE fixture with the keyboard need, the bounding boxes of `.scRibbonPanelUp` and the tree glyph are at least 24 by 24 and their neighbours did not move.

### Task 8: Live

- axe baseline (target-size must drop in the "needs" scenario), `SCT_A11Y_UPDATE=1`, commit.
- A live keyboard check on specm with the keyboard need: Tab 1 is the skip link, Enter reaches the tree, Enter on a node opens it, Shift+F10 opens its menu and focus is in it, Escape returns; Copy to opens, Cancel returns focus to the button.
- Taskbar check for every theme on 10.4.
- Spec: phase 2 done, and the corrections above (Sitecore's own keys) in Section 1.
