# Content tab first: leave templates and the Media Library alone

## Why

Content tab first (`extension/lib/aids/content-tab.js`) switches every item that opens on an editor of its own to its
Content tab. Under `/sitecore/content` that saves a click on every folder and bucket. Under `/sitecore/templates` it
hides the Template Builder, which is the reason to open a template, and under `/sitecore/media library` it hides a
folder's thumbnails, which is often the reason to open a media folder.

## Goals

- Under `/sitecore/templates` (the root and everything under it): no switch. Every item opens on the tab Sitecore
  picks, as without the extension.
- Under `/sitecore/media library` (the root and everything under it), and in the standalone Media Library app: no
  switch. Folders open on their thumbnails, and every other media item on its stock tab too.
- Everywhere else (Content, Layouts, System, buckets): unchanged, still switches to Content once as the item loads.

## Non-goals

- A setting to pick which trees switch. The aid stays one on/off.
- Telling items apart by which editor they open on: a content folder and a media folder share the Folder editor.

## Anti-goals

- A visible delay or flicker before the switch where it still switches. No extra request to the server per item.

## Approaches

- **A. Skip by where the item lives (picked).** Read the item's path from the page; skip under the two roots. Fixed
  in code, a few lines, switch stays immediate.
- **B. Skip by editor.** Ruled out: cannot tell a content folder from a media folder.
- **C. A per-tree setting.** More UI and a new kind of aid setting; only worth it if people want different trees.
  A can grow into it later.

The user picked A.

## Design

- `content-tab.js` decides, per loaded item, whether the item sits under one of the two roots, and returns without
  switching (and without marking the tab seen, so nothing else changes) when it does.
- The standalone Media Library app (`ro=` in the Content Editor's address, as `ce-state.js` already reads it) is
  skipped outright.
- **Where the path comes from (builder's call, my proposal):** Quick Info's item path (item names, so
  `/sitecore/media library` whatever the UI language; compare case-insensitively), as `where-am-i.js` reads it; else
  the content tree's active node's ancestors, matched by the roots' item IDs in the tree nodes' ids
  (templates `{3C1715FE-6A13-4FCF-845F-DE308BA9741D}`, media library `{3D6658D8-A0BF-4E75-B3E2-D050FABCF4E1}`) rather
  than by display names, which are translated. When neither is on the page (a search result with no tree node), the
  aid switches as today.
- The hint in `settings.js` `AIDS["content-tab"]` and its section in `docs/ui-improvements.md` say it leaves templates
  and the Media Library on their own editors. The section's scene in `tools/aid-docs.cjs` moves from a media folder to
  a content folder, since a media folder no longer shows a difference; the shots and the stamp are regenerated.

## Left to the builder

- Whether Quick Info's path is in the page while another editor tab is active; if not, the tree is the source.
- One small unit test for the "under which root" decision.
- Verifying with `sct-verify` in the user's Chrome on specm: a content folder (switches), a template (stays on
  Builder), a template folder (stock tab), a media folder in the Content Editor and in the Media Library app (stays on
  thumbnails).
