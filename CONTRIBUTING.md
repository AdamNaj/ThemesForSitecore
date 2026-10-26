# Contributing

Thanks for helping. Bug reports, new themes and fixes are all welcome.

## Reporting a bug

Open an issue with the bug form. The details that make a theme bug reproducible:

- the Sitecore version (10.0 to 10.5) and the page (Content Editor, a dialog, Launchpad, the Experience Editor...)
- the browser, and whether you use the extension or the Sitecore-deployed module
- the theme, and its light or dark setting if it has one
- a screenshot, and any other extension that restyles pages (Dark Reader, Stylus...)

Never post screenshots with a client's content or credentials in them.

## Setting up

You need Node 22 or later.

```bash
npm install
npm test
```

Load `extension/` unpacked in Chrome or Edge (`chrome://extensions`, Developer mode, **Load unpacked**), open a
Sitecore site and enable the extension there from its toolbar popup.

To run the live suites, the preview and store-image tools and the stylesheet generators, point the tools at your
own installs: copy `sitecore.example.json` to `sitecore.local.json` (gitignored) and fill it in, then sign in once
with `node test/e2e/login.mjs`. Use installs with stock or demo content only: previews and store images are
published.

## Adding a theme

A theme is one folder, `extension/themes/<id>/`, and adding one touches nothing outside it.
[extension/themes/README.md](extension/themes/README.md) describes the files; `npm run themes` regenerates the
registry and the README's theme table from the folders.

If you use Claude Code, the `sct-new-theme` skill in `.claude/skills/` walks through a theme from design to
verification, and its `pitfalls.md` lists every correction earlier themes needed. The rules that matter most:

- **Draw your own images.** Never copy Sitecore's, an operating system's or anyone's image files, logos or icons
  into the extension; draw glyphs as CSS, SVG of your own, or generate them with a tool in `tools/`.
- **The same look on Sitecore 10.4 and 10.5.** Check the theme on both; never style one version only.
- **Every surface.** The Content Editor, the Desktop and its windows, dialogs, Launchpad, the login page, the
  Experience Editor's chrome and `/sitecore/admin`.
- **Generated files are never edited by hand:** `extension/surfaces/*.gen.css`, `extension/themes/themes.js`, and a
  theme stylesheet written by a `tools/build-*-css.*` generator (change the generator and run it).

## Before you open a pull request

```bash
npm test
node tools/themes.mjs --check
npm run lint
```

`npm run lint` reports a few known manifest warnings; it should report no errors. For a visual change, add
screenshots of the theme on Sitecore 10.4 and 10.5 to the pull request.

Keep one theme or one fix per pull request, with a descriptive title. Please write hyphens rather than en or em
dashes in files.

## License

Contributions are licensed under the Apache License 2.0, the project's license (see [LICENSE](LICENSE)). You keep the
copyright on your contribution.
