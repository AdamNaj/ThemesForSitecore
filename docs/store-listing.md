# Store listing

Paste-ready text for the Chrome Web Store and addons.mozilla.org (AMO). Build the packages with `npm run build` first.

| Store | Upload | Dashboard |
|---|---|---|
| Chrome Web Store | `dist/themes-for-sitecore-<v>-chrome.zip` | https://chrome.google.com/webstore/devconsole |
| Edge Add-ons (optional) | the same Chrome zip | https://partner.microsoft.com/dashboard/microsoftedge |
| AMO | `dist/themes-for-sitecore-<v>-firefox-listed.zip` | https://addons.mozilla.org/developers/addon/submit/ |

## Shared listing

**Name:** Themes for Sitecore

**Summary** (Chrome takes this from the manifest; AMO limit 250 characters):
39 themes for the Sitecore 10.0 to 10.5 Desktop and CM UIs: Sitecore's own looks, calm everyday palettes, modern and retro desktops, and creative looks.

**Category:** Chrome: Developer Tools. AMO: Appearance.

**Description:**

No OS or product names in the theme list: Chrome rejected a version for keyword stuffing (Yellow Argon) over eight "X: inspired by <product>" lines. Describe each look instead.

```text
Sitecore 10.5's white and purple Content Management UIs are bright for a full day of editing, and every environment looks the same. Themes for Sitecore re-skins the Sitecore Desktop and the CM UIs with a theme you pick for each Sitecore host, so your local install, staging and production never look alike.

39 themes, with a live preview of each in the popup:

Sitecore
• Debrightify: Sitecore's layout in a dark, low-glare palette
• Sitecore 10.4: the 10.4 look on 10.5
• Sitecore 10.5: the 10.5 look on 10.0 to 10.4
• Copenhagen: the Sitecore 6 and 7 look, with Tahoma, a blue-grey ribbon and the red orb

Everyday
• Beacon: high contrast for low vision and bright rooms, black and yellow or cream and rust to follow your light or dark setting
• Fjord: a calm Nordic palette that follows your light or dark setting
• Guardrail: shows which environment you're on, production, staging, QA, dev, sandbox, local or beta
• Compact: Sitecore's own colours at laptop density, shorter rows, a slimmer ribbon and labels beside fields
• Focus: quiet warm greys for long editing sessions, the field you edit stands out
• Solar: warm cream by day and deep teal by night, with the same eight accents in both
• Spectrum: colour-blind safe, every state carries a shape as well as a colour

Modern
• Cupertino: frosted sidebars, soft shadows and rounded controls, light or dark
• Sun Valley: translucent panels and rounded corners in a crisp current-desktop style, light or dark
• Tahoe: frosted glass windows over a wallpaper, pill tabs and buttons, light or dark
• Graphite: a near-black workspace of hairline layers with one violet accent
• Mountain View: tonal surfaces, pill indicators and rounded cards, light or dark
• Plasma: flat grey windows, centred titles and a sky-blue accent, light or dark

Retro
• Redmond 3.11: an early-90s desktop of grey bevels and navy title bars
• Chicago: mid-90s grey windows over a teal desktop
• Whistler: glossy blue title bars from the early 2000s
• Longhorn: tinted glass captions with a sheen, glossy buttons and a black taskbar with a round orb
• Sonata: platinum greys with lavender highlights
• Cheetah: pinstripes, brushed metal, blue gel buttons and traffic-light window controls, with a dock
• Menlo: yellow window tabs on light grey
• Redwood: black title bars and sharp grey bevels
• Santa Clara: chunky sand bevels, maroon window frames and a front panel of workspace buttons
• Warp: grey bevelled windows, blue title bars, a control bar along the top and notebook tabs
• Los Gatos: four colours, blue, white, black and orange
• Metal Steel: cool steel greys and periwinkle, a classic cross-platform toolkit look

Creative
• Blueprint: a technical drawing in white on cyanotype blue
• Notebook: graph paper, pen and sticky notes
• Meridian: dawn, day, dusk and night palettes that follow your clock
• Phosphor: a green-screen terminal
• Miami: synthwave neon over a sunset grid
• Bridge: a starship console of elbows and pills
• Dessau: primary colours, black rules and simple shapes
• Hometown: a late-nineties personal homepage, stars, bevels and all
• Pocket: a four-shade handheld screen with chunky pixels
• Riso: a two-ink risograph print in fluorescent pink and teal

Know where you are: give each site a postfix such as [DEV 10.5], shown in the browser tab and in Sitecore's top bar, and tint its tab icon. Themes with light and dark looks follow your system, or stay light or dark per site.

Themes cover the Content Editor, Desktop, Sheer UI dialogs, Sitecore PowerShell Extensions (ISE, dialogs, Show-ListView), Launchpad, SPEAK applications, the Experience Editor's ribbon and toolbars, the /sitecore/admin pages and the login screen. Website content in the Experience Editor is never touched, and Sitecore's behaviour doesn't change.

The extension has no access to any site until you enable it on a Sitecore host from the toolbar popup. You can also import your own theme as a CSS file.

Privacy: the extension collects no data. It only contacts the Sitecore hosts you enable.

Sitecore is a trademark of Sitecore Corporation A/S. This extension is not affiliated with Sitecore.
```

**Images:** `docs/store-promo-small-440x280.png` (Chrome's small promo tile), `docs/store-promo-marquee-1400x560.png` (its marquee) and `docs/store-screenshot-*.png` (1280x800; Chrome takes up to five, AMO's are optional). `node tools/store-images.cjs` remakes them all from the themes' previews (`node tools/previews.cjs` first) and the 10.5 host. Use a Sitecore with stock content only, never a client's.

## Chrome: Privacy practices tab

**Single purpose:** Changes the visual theme of the Sitecore Desktop and the other Sitecore Content Management (CM) UIs.

**Permission justifications:**

- `storage`: Saves the chosen theme per Sitecore host, the hosts' Sitecore versions, and any themes the user imports.
- `scripting`: Injects the theme stylesheet and a content script into Sitecore Content Management pages on hosts the user has enabled.
- `activeTab`: Lets the popup read the current tab's address so the user can enable the extension on that Sitecore host.
- Host permissions (`*://*/*`, optional): Sitecore runs on any domain, so there's no fixed host list. Nothing is granted at install time. The user grants access to one host at a time from the popup and can revoke it there.

**Remote code:** No. Imported themes are CSS files, checked in the popup and stored locally. No JavaScript or WebAssembly is fetched.

**Data usage:** tick none of the data types. Tick all three certifications (no selling, no unrelated use, no creditworthiness use).

**Privacy policy URL:** https://codality.net/themes-for-sitecore/privacy/ (use it on AMO too).

## AMO: Notes to reviewer

```text
The extension only styles Sitecore's Content Management UIs. Content scripts are registered at runtime for hosts the user grants through the popup (optional host permissions). The `*.gen.css` files under `extension/surfaces/` and the theme CSS are generated by the scripts in `tools/` (`node tools/build-*.{cjs,mjs}`) and are also checked in as written. `lib/dev.js` is replaced by a stub at packaging time (`tools/build.mjs`) to switch development hooks off. No minification or bundling is used.
```

**Source code:** AMO may ask for the sources of generated files. Upload a source zip made from a clean commit:

```bash
git archive -o dist/themes-for-sitecore-source.zip HEAD
```

**License:** pick one in the AMO form (it shows on the listing).
