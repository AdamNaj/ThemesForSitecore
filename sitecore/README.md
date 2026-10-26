# Themes for Sitecore, deployed into Sitecore

The same themes as the browser extension, for people who cannot install browser extensions. The module adds
a theme loader to the pages of the Sitecore Content Management UIs. Each user picks a theme, and a hue or
environment where the theme has one, from the extension's logo in Sitecore's top bar, which opens the extension's own picker.
Its gear holds the rest of the popup's settings: title postfix, tab tint, light or dark, and the accessibility aids.

## Install

1. `npm run build:sitecore` (needs the .NET SDK and a Sitecore 10.4 webroot to compile against: `webroots.10.4`
   in `sitecore.local.json`, or pass its path). It writes `dist-sitecore/files/` and a zip of it. The one DLL runs on 10.4 and 10.5:
   Sitecore's assemblies are not strong-named, so its `Sitecore.Kernel` reference binds whichever the site has.
2. Copy `dist-sitecore/files/` over the CM webroot. It adds:
   - `bin/SitecoreThemes.dll`
   - `App_Config/Include/SitecoreThemes/SitecoreThemes.config`
   - `sitecore modules/SitecoreThemes/` (the loader, `sct.js`, the theme CSS and images, the picker's previews and the logo)
3. Optional: set the default theme, title postfix, tab tint, light or dark, environment and hue in the config file.
   They are where every user starts; each user can choose their own in the picker, and go back to these.

To remove it, delete those three. The patch runs only on Standalone and ContentManagement roles.

## Packages

`npm run package:sitecore` builds the module and packages the same files twice, versioned from
`package.json`:

- `dist-sitecore/themes-for-sitecore-<version>.zip`: a Sitecore package, files only (the module has no items).
  Install it with the Installation Wizard (Desktop: Start > Development Tools > Installation Wizard, or Control
  Panel > Administration > Install a package): upload it, or put it in `App_Data\packages` and choose it.
- `dist-sitecore/themes-for-sitecore-<version>.scwdp.zip`: a Web Deploy package for Azure and other msdeploy
  pipelines, laid out as Sitecore's module packages are (`Content/Website`, an `Application Path` parameter).
  Deploy it as an add-on package over an existing CM, or with msdeploy:
  `msdeploy -verb:sync -source:package=<file> -dest:iisApp=<site> -setParam:name="Application Path",value=<site> -enableRule:DoNotDeleteRule`.
  Keep DoNotDeleteRule: without it, a sync deletes every file in the site the package does not hold.

Building the second needs Web Deploy (`msdeploy.exe`, 3.6 or later) on the machine.

## How it works

- `ThemesProcessor` (`httpRequestBegin`, after `UserResolver`) wraps the response in a filter that writes
  `<script src="/sitecore modules/SitecoreThemes/sct.js" data-sct="{...}">` right after `<head>` of every 200
  `text/html` page under `/sitecore` and of `?sc_mode=edit` pages. `data-sct` carries the user's theme (a custom
  profile property, `SitecoreThemes.Theme`), the Sitecore version and the site settings.
- It also answers `POST /sitecore/shell/sitecore-themes/save` (any of `theme=<id>`, `hue=<0-359>` with
  `hueTheme=<id>`, `env=<prod|staging|qa|dev|sandbox|local|beta>` (empty for the config's),
  `phase=<dawn|day|dusk|night>` (empty for Auto), `title=<up to 40 characters>`, `tint=<|theme|#rrggbb>`,
  `mode=<|light|dark>`, `accessibility=<JSON or empty>`, `reset=1` (back to the config's title, tint, mode and
  environment), header `X-SCT: 1`), which the picker uses to save the user's choices to their profile
  (`SitecoreThemes.Theme`, `SitecoreThemes.Hue` as one hue per theme in JSON, `SitecoreThemes.Environment`,
  `SitecoreThemes.Phase`, and `SitecoreThemes.Title`, `.Tint` and `.Mode` stored as `v:<value>` so an empty
  choice of the user's own differs from none, `SitecoreThemes.Accessibility` as JSON).
- `sct.js` is built from the extension's shared files (`extension/lib/engine.js`, `detect.js`, `settings.js`,
  `files.js`, the colour maps, `themes/themes.js` and the themes' DOM modules), the popup's picker
  (`popup/picker.js`, `swatch.js`, `popup.css`), the settings shared with the popup (`popup/site-settings.js`)
  plus `host.js`. The engine
  decides which pages are Sitecore surfaces, exactly as it does in the extension.
- `host.js` fetches the theme's CSS and adopts it (`document.adoptedStyleSheets`), which cascades after the
  page's own stylesheets, as the extension's injected CSS does. A theme change reaches every open frame and tab
  over a `BroadcastChannel`.
- The logo and the picker live in closed shadow roots on hosts whose inline style resets everything, so no theme
  or page style reaches them. Opened, the logo becomes a tab and the picker hangs from it as one shape (one SVG
  outline), unfolding from the tab in 250ms and folding back into it (no motion under reduced motion). It opens in
  the top window, so the Experience Editor's short ribbon frame shows all of it.
- Sitecore's static pages, such as the modal dialog host (`JqueryModalDialogs.html`), never pass through the
  pipeline and are cached by browsers. Their parent frame adds the loader once they have loaded.
- Where the browser extension is installed and enabled for the site, it runs first and the module stays out of
  its way.

## Differences from the extension

- Settings are per user (the profile), not per site: the theme, hue, Guardrail's environment, Meridian's time of
  day, title postfix, tint, light or dark and the accessibility aids. The config's values hold until a user picks
  their own (accessibility starts off), and "Use the site's settings" goes back to them.
- No imported themes.
- Sitecore 10.4 and 10.5's Identity Server login page is a separate site, so the module cannot theme it.
- Pages carry no theme until the module is installed, and they reflect a new theme after a reload or through
  the picker's live switch.
