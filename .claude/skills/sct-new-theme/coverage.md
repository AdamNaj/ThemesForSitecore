# Coverage: every place the user has had to point at

Check each line on 10.5 and 10.4 (the `hosts` in `sitecore.local.json`), at 1x and 1.25x, in each appearance the theme has,
in every frame. For each: resting, hover, pressed, selected, focus and disabled states where they exist.

## URLs, as Sitecore links them

- Desktop: `/sitecore/shell` (no trailing slash)
- Content Editor: `/sitecore/shell/Applications/Content%20Editor.aspx?sc_bw=1`, and as a Desktop window
- Launchpad: `/sitecore/shell/sitecore/client/Applications/Launchpad`
- Control Panel: from the Desktop (`/sitecore/shell/Applications/Control panel.aspx`) and from Launchpad
- Experience Editor: `/?sc_mode=edit`
- SPE Reports: `/sitecore/shell/Applications/PowerShell/PowerShellReports?sc_bw=1`
- Application Options (the best tab test): `/sitecore/shell/default.aspx?xmlcontrol=ChangeUserOptions`
- Admin: `/sitecore/admin/`, `/sitecore/admin/Jobs.aspx`, `/sitecore/admin/cache.aspx`
- Login: sign out once, or open the identity server's login page

`shots.cjs` covers the first set by default; add others with `--paths`. Dialogs, menus and hover states need
clicking: drive them in Playwright or the user's Chrome.

## Desktop

- [ ] Taskbar: start button, app buttons (active, inactive), tray search field, database label; no growth on CE mode switches; a long title ends in an ellipsis on a button that cannot grow (`taskbar.cjs`)
- [ ] Content Editor header with the Sitecore Extensions add-on: its "Search for fields" box shows the vector clear X (bar.css) centred at the field's right end, no bitmap or white frame
- [ ] Taskbar or dock above every non-modal window, maximized or dragged over it; a dock narrower than the screen floats over the windows, which run on beneath it (`dock.cjs`)
- [ ] Start menu: both columns, header with portrait, All Applications (in the right column's material), Log Off, open folder row, fly-outs; no jitter on hover; icons from the platform's era
- [ ] Every menu: ribbon drop-downs, context menus, fly-outs (`table.scMenu`); disabled rows; separators
- [ ] No menu shows a scrollbar unless it has run out of room to grow (`menus.cjs` with the scan opens them all)
- [ ] Desktop windows: caption, icon, buttons (`.standartWindowButtons`), active and inactive, maximised
- [ ] The Content Editor, Media Library and Workbox as Desktop windows: a title bar in the theme's style where its platform had one (`#CaptionTopLine`, `--sct-window-title`), the window's icon on it where the platform shows one (`--sct-window-icon`), buttons on the bar and not on the tab row, tabs starting at its foot, no frame band above it, inactive look
- [ ] Every window kind (Content Editor, ISE, Recycle Bin, Package Designer, Workbox, Media Library) gets the same treatment: translucency or texture, title bar icon, the title-to-ribbon hand-off
- [ ] Glass themes: one curve per corner, one frosting on inactive windows, opaque under reduced transparency
- [ ] The ISE's window title (the script's path) shows, and maximized windows show the restore glyph (`windows.cjs`)
- [ ] Window frames resize from every edge and corner; the title bar drags the window
- [ ] Modal overlay tint over the Desktop

## Content Editor

- [ ] Window caption and buttons (`.scSystemButtons`), standalone and as a Desktop window
- [ ] Ribbon: every tab (Home, Navigate, Review, Publish, Versions, Configure, Presentation, Security, View, Developer), tab band, chunks, captions, launchers
- [ ] Large, small and combo buttons (hover both faces), galleries (Insert, Security > Presets), disabled buttons, the collapse/expand toggle
- [ ] White icons (`shots.cjs --scan --white-icons`): tree, item header, ribbon and taskbar icons outlined wherever the panel is light; no `glyph` finding
- [ ] Tree: [+]/[-] glyphs at 1.25x, selection, hover, green and grey inline roots, gutters the window colour
- [ ] Tree search: field, buttons, options panel expanded (Name/Field inputs)
- [ ] Editor tabs (Content, Search), header buttons (Expand, Collapse, language, version)
- [ ] Quick Info, sections collapsed and expanded with their glyphs, validator bar
- [ ] Fields: single-line, multi-line, rich text preview, date and time pickers, droplists, treelists, multilists, checkboxes
- [ ] Search tab (bucket search): typed text, caret, placeholder, Search and Clear, filter pills, three result views, facets, paging
- [ ] The bar over the fields (`#EditorTabs`) at the search row's height, fields from its foot; sections as the source draws them (edge to edge on Sitecore 6 and Aqua)
- [ ] Status bar and bottom tabs (Content Editor, Media Library, Workbox): as tall as the pills plus equal padding
- [ ] The splitter between tree and editor; tree, editor, sections and pager on the same pixels on 10.4 and 10.5
- [ ] Sitecore Extensions add-on: field search X, ribbon toggle (user's Chrome only)

## Dialogs

- [ ] Copy To, Move To, Insert from Template, Publish Item (focus frame on open), Layout Details, Preview Date and Time
- [ ] jQuery UI title strip, header with description, body insets, footer buttons, SPE help (?)
- [ ] Tab strips: open tab joined, first tab aligned, hover not blank or uppercase (Application Options); segmented strips round only their two ends (three or more tabs)
- [ ] SPE Kitchen Sink (Read-Variable), every tab: textboxes, date and time with calendar and time list, checkboxes, radio groups, droplists, trees, multilists, item pickers, user/role picker, rule boxes, code fields. Press Cancel.
- [ ] Rule editor (Create rule): search magnifier not tiled, lists' scrollbars, condition triangles
- [ ] Scrollbars in list boxes and text areas

## SPE

- [ ] ISE: window caption path, ribbon (Home and Context tabs), script tabs with icons and close X, toggles left of the tabs, Ace editor and its scrollbars, Write-Progress overlay, clipboard textarea hidden
- [ ] Console: window, text, scrollbar
- [ ] Show-ListView, non-modal and `-Modal`: title bar (no band of another colour above it, no rounded notch), Filter box centred with its label, Page chunk, grid
- [ ] Reports: c3 charts' axes, labels, legend, grid, tooltip

## Other shell apps

- [ ] Media Library and its search, Workbox, Recycle Bin, Security Editor tiles, Access Viewer splitter and pane, User Manager grid and pager

## SPEAK, Launchpad, login, Experience Editor

- [ ] Shared header: every item on one centre line, glyphs visible, Log out and user readable
- [ ] Launchpad: the platform's metaphor, every group and tile Native shows, Custom Analytics, no clipped logo, no scrollbar, at 1300px and 1920px wide (Analytics moves right above 1570px)
- [ ] Control Panel (SPEAK) and its back button on both versions
- [ ] Login page and its placeholders
- [ ] EE ribbon (a `speak` frame): tabs, chunks sized like the CE ribbon, quickbar toggle, date chunk, breadcrumb with Go/Edit; the website untouched
- [ ] Forms list
- [ ] Admin pages: no swoosh, no white second row, SPE console in chrome colours

## Experience

- [ ] Page switches don't flash the stock look (first paint holds the theme's background)
- [ ] The applying-theme overlay shows the theme's colours (it reads `tokens.css`)
- [ ] Switching to Native and back leaves nothing behind (dom-kit reverts)
- [ ] No page errors the same page under Native doesn't throw (`shots.cjs` lists them)
- [ ] Animations with and without reduced motion; a non-zero hue on the page, if the theme has `hue: true`
- [ ] The site postfix in the top bar (`bar.css`), beside the Sitecore Extensions database name
