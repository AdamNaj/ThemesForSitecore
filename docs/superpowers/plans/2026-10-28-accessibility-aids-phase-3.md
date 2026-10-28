# Accessibility aids phase 3 (telling people what happened) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A screen reader user hears which item they are on, that it saved, its warnings and its validation; a colour-blind user sees validation state as text, not only colour; everyone with the low-vision or reading need sees where they are.

**Architecture:** Four aids. `announcer` owns one live region in the top document; any aid in any frame speaks through `SCT.announce(doc, text)` (in `dom-kit.js`), which writes into that region if it is there. Fixtures as in phases 1 and 2.

**Spec:** `docs/superpowers/specs/2026-10-27-accessibility-aids-design.md` (Section 1 `announcer`, `fields`, `where-am-i`, `not-just-colour`; Section 4 phase 3).

## What Sitecore 10.4 already does (survey, 2026-10-28)

- Content Editor fields: `td.scEditorFieldMarkerInputCell` holds `div.scEditorFieldLabel` ("Title - Please enter title...", its help in `title`) and the control, which Sitecore names already (`aria-label="Title field "`).
- Validation: `td#FieldMarker<control id>` beside each field; `updateFieldMarkers` sets its class (`scEditorFieldMarkerBarCellRed`, `...Yellow`, `...Grey`, or plain) and its `title` to the message. The validator panel's icon has an alt ("Validation completed: No errors or warnings.").
- Warnings: `.scEditorWarning` with `.scEditorWarningTitle` and `.scEditorWarningText`.
- The item: `.scEditorHeaderTitle` (its name), `.scEditorHeaderVersionsLanguage` and `.scEditorHeaderVersionsVersion` (buttons), the active tree node and its ancestors (its path).

## Global Constraints

- Phases 1 and 2's constraints hold.
- Announcements are polite, short, and never repeated for an unchanged state; the live region is visually hidden.
- The live suite stays read-only: saving is tested on fixtures only.

## Review Focus

1. Switching items quickly: one announcement per item that settles, not one per re-render. Pinned in Task 1 (same item twice says nothing).
2. A field whose marker goes from red back to plain loses `aria-invalid` and its error description. Pinned in Task 2.
3. `where-am-i` when the tree has no active node (search results): it shows the editor's item name, no path. Pinned in Task 3.
4. A frame without the announcer's top document (cross-origin top): `SCT.announce` does nothing and never throws. Pinned in Task 1.

---

### Task 1: `announcer` (needs screen-reader; surfaces shell)

- `SCT.announce(doc, text)` in `dom-kit.js`: finds `sct-announce` in `doc.defaultView.top.document` (catching cross-origin), sets its text (clearing first when the text repeats, so it is said again).
- The aid, in the top document: an owned `<sct-announce role="status" aria-live="polite">`, visually hidden.
- In every document it runs in, each pass compares with the last: a new `.scEditorHeaderTitle` text says "<name>, <language>, version <n>"; a new `.scEditorWarning` says its title and text; a validator icon alt that changed and is not the "no errors" one says it; after Ctrl+S or a click on a ribbon button titled "Save (Ctrl+S)", the next new validator panel says "Saved <name>".
- Tests on the CE fixture: the region exists once in the top document; changing the header title announces it; the same title again announces nothing; Ctrl+S then a replaced validator panel announces "Saved Home"; `SCT.announce` in a frame whose top has no region does nothing.

### Task 2: `fields` (needs screen-reader; surfaces shell)

- Each control in a `.scEditorFieldMarkerInputCell` (`input:not([type=hidden]), select, textarea, iframe, [contenteditable=true]`) is described by its field's label (`aria-describedby`; the label gets an id `sct-label-<control id>` through the kit when it has none), so the help text is read.
- Its marker `#FieldMarker<id>`: red makes the control `aria-invalid="true"`; red or yellow with a title adds the marker to the description, the marker taking its title as `aria-label`; plain takes both back.
- Tests on the CE fixture: the Title input is described by its label; a red marker with a title makes it invalid and described by the message; back to plain, neither.

### Task 3: `where-am-i` (needs low-vision, reading; surfaces shell)

- An owned `<sct-where>` at the end of `.scEditorHeaderTitlePanel`: "/sitecore/content/Home · English · version 1", from the active tree node's ancestors and the header's language and version buttons; the name alone without an active node.
- Its own `css`: one line, 12px, muted (`var(--sct-text-muted, GrayText)`), ellipsis.
- Tests on the CE fixture: the line reads the path, language and version; with no active node, the name.

### Task 4: `not-just-colour` (CSS; needs colour-vision; surfaces shell)

- A field whose marker is red gets "Error: " before its label, yellow "Warning: " (`::before`, bold, in the label's own colour), so the state is text as well as colour.
- Test on the CE fixture with a red marker: the label's `::before` content is "Error: ".

### Task 5: Live

- axe baseline, `SCT_A11Y_UPDATE=1`, commit.
- specm, screen-reader need: open two items, the region says each; a warning item (a locked or workflow item if the install has one) says its warning.
- Spec: phase 3 done.
