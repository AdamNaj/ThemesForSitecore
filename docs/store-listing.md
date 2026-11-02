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
38 themes for the Sitecore 10.0 to 10.5 Desktop and CM UIs: Sitecore's own looks, calm everyday palettes, modern and retro desktops, and creative looks.

**Category:** Chrome: Developer Tools. AMO: Appearance.

**Description:**

Families, not a theme-by-theme list. Chrome rejected two versions for keyword stuffing (Yellow Argon): one over eight "X: inspired by <product>" lines, the next over Guardrail's line listing seven environment names. Name no OS or product, and list no run of options.

```text
Sitecore's back office is bright, and every environment looks the same. Themes for Sitecore gives the Sitecore 10.0 to 10.5 Desktop and Content Management UIs a look you choose for each Sitecore host, so a long day of editing is easier on the eyes and you always know where you are.

38 themes in five families, each with a live preview in the popup:
• Sitecore's own: today's layout in a dark, low-glare palette, or the look of an earlier version
• Everyday: calm, legible looks for long days, including high contrast ones
• Modern: rounded, current desktop styles that follow your light or dark setting
• Retro: faithful recreations of classic desktops from the 90s and 2000s
• Creative: a blueprint, a notebook, a green-screen terminal and more

Any theme can be tuned for each site: lighter or darker, softer or bolder, warmer or cooler.

Know where you are. The Guardrail theme marks every screen with the environment you set for the site, so production never looks like your dev box. Give a site a postfix such as [Prod] and it shows in the browser tab and in Sitecore's top bar: no more five identical "Desktop" tabs.

Accessibility built in: tell it what you need, such as a screen reader, the keyboard alone, low vision, colour vision, reading and focus, or less motion, and the matching aids switch on. Clear focus outlines, keyboard access to the ribbon, menus and dialogs, bigger click targets, spoken announcements, reading fonts and spacing, colour filters, errors marked by shape as well as colour, and a reading guide all work under every theme, and every theme keeps its text at WCAG AA contrast.

Small improvements for everyone, on by default: a command palette, type to search in the content tree and an item's fields, item details at a glance, an image preview you can size, and the Content and Experience Editors reopening where you left off. Each one can be switched off, and they work with or without a theme.

Themes cover the Content Editor, the Desktop and its dialogs, Launchpad, the Experience Editor's ribbon, the admin pages and the login screen. Your website content and Sitecore's behaviour are never changed.

Works in Chrome, Edge and Firefox. Rolling it out to a whole team? The same themes also come as a Sitecore module you install on your server.

The extension has no access to any site until you enable it on a Sitecore host from the toolbar popup.

Privacy: the extension collects no data. It only contacts the Sitecore hosts you enable.

Sitecore is a trademark of Sitecore Corporation A/S. This extension is not affiliated with Sitecore.
```

**Images:** `docs/store-promo-small-440x280.png` (Chrome's small promo tile), `docs/store-promo-marquee-1400x560.png` (its marquee) and `docs/store-screenshot-*.png` (1280x800; Chrome takes up to five, AMO's are optional). `node tools/store-images.cjs` remakes them all from the themes' previews (`node tools/previews.cjs` first) and the 10.5 host. Use a Sitecore with stock content only, never a client's.

## Chrome: Privacy practices tab

**Single purpose:** Changes the look and usability of the Sitecore Desktop and the other Sitecore Content Management (CM) UIs: visual themes, with accessibility aids and editing improvements for those same pages.

**Permission justifications:**

- `storage`: Saves the chosen theme per Sitecore host, the hosts' Sitecore versions, the user's accessibility needs, which aids and improvements are on, and the colour tuning per host.
- `scripting`: Injects the theme stylesheet and a content script, which runs the accessibility aids and editing improvements, into Sitecore Content Management pages on hosts the user has enabled.
- `activeTab`: Lets the popup read the current tab's address so the user can enable the extension on that Sitecore host.
- Host permissions (`*://*/*`, optional): Sitecore runs on any domain, so there's no fixed host list. Nothing is granted at install time. The user grants access to one host at a time from the popup and can revoke it there.

**Remote code:** No. No JavaScript, WebAssembly or CSS is fetched.

**Data usage:** tick none of the data types. Tick all three certifications (no selling, no unrelated use, no creditworthiness use).

**Privacy policy URL:** https://codality.net/themes-for-sitecore/privacy/ (use it on AMO too).

## AMO: Release notes

For the version being released, written for the people who install it, from the tag's changelog
(`git tag -l --format='%(contents)' v<v>`). Plain text; like the description, name no OS or product.

```text
0.7.0

- A new Tuning tab in Settings: make any theme brighter or darker and change its contrast, gamma, saturation and hue, for each site. Each slider has its own Reset.
- Errors in shapes, a new aid that comes with the Colour vision need: validation errors and warnings are marked by shape as well as colour, under every theme and with no theme.
- Section errors and warnings: each section's title bar shows how many of its fields have errors and warnings, even when the section is closed. Click a count to go to the field.
- Character limits: text fields show how many characters they hold, against their length limit where there is one, and how many are left or too many.
- Locked fields: a field you cannot edit shows a padlock and a faint hatch.
- Item info's Published pill now says which version is live, what is waiting to be published, and what the item's publishing settings hold back.
- Field errors and warnings keep their red and amber under every theme.
- Guardrail: menus show the hovered row in the environment's colour, in light and dark.
- Start menu folders no longer stay pressed after their submenu closes.
- A checked option in a menu, such as the content tree's gutter menu, shows a check mark in the menu's own colours instead of a filled row.
- The Spectrum theme is gone, now that its shapes work under every theme as the Errors in shapes aid. Sites set to Spectrum switch to no theme with the Colour vision need on.
- Imported themes are gone. A site set to an imported theme switches to no theme.
```

## AMO: Notes to reviewer

```text
The extension only styles Sitecore's Content Management UIs. Content scripts are registered at runtime for hosts the user grants through the popup (optional host permissions). The `*.gen.css` files under `extension/surfaces/` and the theme CSS are generated by the scripts in `tools/` (`node tools/build-*.{cjs,mjs}`) and are also checked in as written. `lib/dev.js` is replaced by a stub at packaging time (`tools/build.mjs`) to switch development hooks off. No minification or bundling is used. The innerHTML, outerHTML and insertAdjacentHTML calls the validator lists only insert the extension's own markup: constants in popup/site-settings.js (which popup/popup.js puts in place) and popup/picker.js, the overlay's style sheet in lib/engine.js, numbers-only SVG rectangles in themes/phosphor/dom.js, the SVG miniatures from popup/swatch.js, whose text (the theme's name) is escaped there, the tuning sliders in popup/site-settings.js, built from validated numbers, and the aids' own SVG icons and labels in lib/aids/item-info.js and lib/aids/section-toggle.js. Two calls parse Sitecore's own markup into inert containers that are never attached to the page: lib/aids/command-palette.js reads the ribbon's hidden tabs, which Sitecore keeps as HTML comments, into a <template>, and lib/aids/item-info.js reads the workflow menu's text inside a document made by DOMParser. Nothing else from pages or the network is inserted as HTML.
```

**Source code:** AMO asks for the sources of the generated files with every version. Upload `dist/themes-for-sitecore-<v>-source.zip`: `npm run build` makes it from HEAD (build from a clean commit), and the release workflow attaches it to every release.

**License:** pick one in the AMO form (it shows on the listing).
