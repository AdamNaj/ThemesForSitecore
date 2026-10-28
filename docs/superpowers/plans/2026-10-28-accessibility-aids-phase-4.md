# Accessibility aids phase 4 (motion and reading) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Less movement for people it hurts, and less on screen for people it overwhelms.

**Architecture:** Four aids as in phases 1 to 3; two are CSS only. `quiet-ribbon` keeps its choice in the site's own `localStorage`, which content scripts and the Sitecore module both reach, so neither host's storage changes.

**Spec:** `docs/superpowers/specs/2026-10-27-accessibility-aids-design.md` (Section 1 `reduced-motion`, `focus-mode`, `reading-guide`, `quiet-ribbon`; Section 4 phase 4).

## Survey (2026-10-28)

- Ribbon groups: `.scRibbonToolbarStrip .chunk[role=group]`, each with a stable `id` and a `.caption` ("Write", "Edit", "Insert"...).
- Content Editor fields: `table.scEditorFieldMarker` per field (phase 3).

## Global Constraints

- Phases 1 to 3 hold. Motion: no aid of ours animates.
- Hidden is never removed: a quiet group is `display:none` through an attribute the kit writes, and comes back with one button.

## Review Focus

1. A theme's own animations (Chicago's clock, Meridian's phases) stop moving under `reduced-motion` but end in their final state. Pinned in Task 1 (an animated fixture element reaches its end at once).
2. Focus inside a rich text field (an iframe): `focus-mode` keeps that field bright. Pinned in Task 2.
3. `quiet-ribbon` with `localStorage` blocked (it throws): the ribbon shows everything, nothing breaks. Pinned in Task 4.
4. The reading guide never takes a click. Pinned in Task 3 (`pointer-events:none`).

---

### Task 1: `reduced-motion` (CSS; needs motion; surfaces null)

- `css`: every element and pseudo-element: `animation-duration:.01ms`, `animation-iteration-count:1`, `animation-delay:0s`, `transition-duration:.01ms`, `transition-delay:0s`, `scroll-behavior:auto`, all `!important`.
- Test: an element with a 10 s animation in the fixture has finished it at once (its computed `animation-duration` is `1e-05s` and `getAnimations()[0].playState` is "finished" or absent).

### Task 2: `focus-mode` (CSS; needs reading; surfaces shell)

- `css`: while a field of the editor has focus, the other fields and section captions of that editor fade to 35% opacity: `.scEditorPanel:has(.scEditorFieldMarker:focus-within) .scEditorFieldMarker:not(:focus-within), ... .scEditorSectionCaptionExpanded, ...Collapsed {opacity:.35}`.
- Test: focusing the Title input leaves its field at 1 and another field at 0.35; blur, all at 1.

### Task 3: `reading-guide` (needs reading; surfaces null, not ee)

- An owned `<sct-guide>`: a band across the frame, 1.6em high, centred on the pointer's line or on the focused element, `position:fixed; pointer-events:none`, the theme's accent at 15% (`color-mix`) or `Highlight` at 15%.
- Moves on `pointermove` and `focusin` (ctx.listen), at most once a frame.
- Test: moving the pointer to y=300 puts the band's centre at 300; focusing the Title input puts it on the input; `pointer-events` is none.

### Task 4: `quiet-ribbon` (needs reading; surfaces shell)

- Each ribbon group gets an owned `<sct-quiet>` button (×, "Hide the <caption> group"), shown on the group's hover or focus.
- Hidden ids live in `localStorage["sct-quiet-ribbon"]` (a JSON array; read and write in try/catch); a hidden group gets `data-sct-quiet` (kit) and `display:none`.
- A strip with hidden groups ends with an owned "Show N hidden" button that brings them back (clears their ids).
- Tests: hide "Write", it is gone and stays gone after the ribbon is rendered again; "Show 1 hidden" brings it back; with `localStorage` throwing, every group shows.

### Task 5: Live

- axe baseline, `SCT_A11Y_UPDATE=1`, commit.
- specm with the reading and motion needs: screenshots of focus mode on a field, the guide, a quiet group and its "Show" button.
- Spec: phase 4 done.
