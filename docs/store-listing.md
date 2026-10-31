# Store listing

Paste-ready text for the Chrome Web Store and addons.mozilla.org (AMO). Build the packages with `npm run build` first.

| Store | Upload | Dashboard |
|---|---|---|
| Chrome Web Store | `dist/themes-for-sitecore-<v>-chrome.zip` | https://chrome.google.com/webstore/devconsole |
| Edge Add-ons (optional) | the same Chrome zip | https://partner.microsoft.com/dashboard/microsoftedge |
| AMO | `dist/themes-for-sitecore-<v>-firefox-listed.zip` | https://addons.mozilla.org/developers/addon/submit/ |

AMO asks for four things with every version: the package, the source zip (`dist/themes-for-sitecore-<v>-source.zip`), the release notes and the notes to reviewer (both below). Rewrite the release notes for each release, before tagging it.

## Shared listing

**Name:** Themes for Sitecore

**Summary** (Chrome takes this from the manifest; AMO limit 250 characters):
39 themes for the Sitecore 10.0 to 10.5 Desktop and CM UIs: Sitecore's own looks, calm everyday palettes, modern and retro desktops, and creative looks.

**Category:** Chrome: Developer Tools. AMO: Appearance.

**Description:**

Families, not a theme-by-theme list. Chrome rejected two versions for keyword stuffing (Yellow Argon): one over eight "X: inspired by <product>" lines, the next over Guardrail's line listing seven environment names. Name no OS or product, and list no run of options.

```text
Sitecore's back office is bright, and every environment looks the same. Themes for Sitecore gives the Sitecore 10.0 to 10.5 Desktop and Content Management UIs a look you choose for each Sitecore host, so a long day of editing is easier on the eyes and you always know where you are.

39 themes in five families, each with a live preview in the popup:
• Sitecore's own: today's layout in a dark, low-glare palette, or the look of an earlier version
• Everyday: calm, legible looks for long days, including high contrast and colour-blind safe ones
• Modern: rounded, current desktop styles that follow your light or dark setting
• Retro: faithful recreations of classic desktops from the 90s and 2000s
• Creative: a blueprint, a notebook, a green-screen terminal and more

Know where you are. The Guardrail theme marks every screen with the environment you set for the site, so production never looks like your dev box. Give a site a postfix such as [Prod] and it shows in the browser tab and in Sitecore's top bar: no more five identical "Desktop" tabs.

Accessibility built in: tell it what you need, such as a screen reader, the keyboard alone, low vision, colour vision, reading and focus, or less motion, and the matching aids switch on. Clear focus outlines, keyboard access to the ribbon, menus and dialogs, bigger click targets, spoken announcements, reading fonts and spacing, colour filters and a reading guide all work under every theme, and every theme keeps its text at WCAG AA contrast.

Small improvements for everyone, on by default: a command palette, type to search in the content tree and an item's fields, item details at a glance, an image preview you can size, and the Content and Experience Editors reopening where you left off. Each one can be switched off, and they work with or without a theme.

Themes cover the Content Editor, the Desktop and its dialogs, Launchpad, the Experience Editor's ribbon, the admin pages and the login screen. Your website content and Sitecore's behaviour are never changed.

Works in Chrome, Edge and Firefox. Rolling it out to a whole team? The same themes also come as a Sitecore module you install on your server.

The extension has no access to any site until you enable it on a Sitecore host from the toolbar popup. You can also import your own theme as a CSS file.

Privacy: the extension collects no data. It only contacts the Sitecore hosts you enable.

Sitecore is a trademark of Sitecore Corporation A/S. This extension is not affiliated with Sitecore.
```

**Images:** `docs/store-promo-small-440x280.png` (Chrome's small promo tile), `docs/store-promo-marquee-1400x560.png` (its marquee) and `docs/store-screenshot-*.png` (1280x800; Chrome takes up to five, AMO's are optional). `node tools/store-images.cjs` remakes them all from the themes' previews (`node tools/previews.cjs` first) and the 10.5 host. Use a Sitecore with stock content only, never a client's.

## Chrome: Privacy practices tab

**Single purpose:** Changes the look and usability of the Sitecore Desktop and the other Sitecore Content Management (CM) UIs: visual themes, with accessibility aids and editing improvements for those same pages.

**Permission justifications:**

- `storage`: Saves the chosen theme per Sitecore host, the hosts' Sitecore versions, the user's accessibility needs and which aids and improvements are on, and any themes the user imports.
- `scripting`: Injects the theme stylesheet and a content script, which runs the accessibility aids and editing improvements, into Sitecore Content Management pages on hosts the user has enabled.
- `activeTab`: Lets the popup read the current tab's address so the user can enable the extension on that Sitecore host.
- Host permissions (`*://*/*`, optional): Sitecore runs on any domain, so there's no fixed host list. Nothing is granted at install time. The user grants access to one host at a time from the popup and can revoke it there.

**Remote code:** No. Imported themes are CSS files, checked in the popup and stored locally. No JavaScript or WebAssembly is fetched.

**Data usage:** tick none of the data types. Tick all three certifications (no selling, no unrelated use, no creditworthiness use).

**Privacy policy URL:** https://codality.net/themes-for-sitecore/privacy/ (use it on AMO too).

## AMO: Release notes

For the version being released, written for the people who install it, from the tag's changelog
(`git tag -l --format='%(contents)' v<v>`). Plain text; like the description, name no OS or product.

```text
0.6.0

- A new Accessibility tab in Settings: pick the needs that apply to you (screen reader, keyboard, low vision, colour vision, reading and focus, motion) and the matching aids switch on. Each aid can also be switched on or off by itself.
- The aids include clear focus outlines, keyboard access to the ribbon, menus and dialogs, skip links, bigger click targets, spoken announcements and field help for screen readers, errors shown in words, reduced motion, a focus mode and a reading guide.
- A new UI improvements tab, on by default for everyone: a command palette (Ctrl+Shift+Space), a list of the page's shortcuts (F1), type to search in the content tree and in an item's fields, item details and a copy menu in the editor header, the item's path under its name, a header that stays in view, Back, Forward, Expand all and Collapse all buttons, an image preview you can size, and the editors reopening where you left off.
- The accessibility aids and UI improvements work with no theme at all, too.
- The image and link pickers are themed, with a toolbar and caption in the theme's colours.
- The Content Hub DAM pickers can follow the Sitecore site's theme.
- The script editor's variable preview is themed.
- Warning bars, tree highlights and Experience Editor labels are easier to read under every theme.
- The popup's animations follow the Reduced motion aid.
```

## AMO: Notes to reviewer

```text
The extension only styles Sitecore's Content Management UIs. Content scripts are registered at runtime for hosts the user grants through the popup (optional host permissions). The `*.gen.css` files under `extension/surfaces/` and the theme CSS are generated by the scripts in `tools/` (`node tools/build-*.{cjs,mjs}`) and are also checked in as written. `lib/dev.js` is replaced by a stub at packaging time (`tools/build.mjs`) to switch development hooks off. No minification or bundling is used. The innerHTML, outerHTML and insertAdjacentHTML calls the validator lists only insert the extension's own markup: constants in popup/site-settings.js, popup/import-ui.js and popup/picker.js, the overlay's style sheet in lib/engine.js, numbers-only SVG rectangles in themes/phosphor/dom.js, and the SVG miniatures from popup/swatch.js, whose only user-supplied text (an imported theme's name) is escaped there (line 113). Nothing from pages or the network is inserted as HTML.
```

**Source code:** AMO asks for the sources of the generated files with every version. Upload `dist/themes-for-sitecore-<v>-source.zip`: `npm run build` makes it from HEAD (build from a clean commit), and the release workflow attaches it to every release.

**License:** pick one in the AMO form (it shows on the listing).
