# Themes

A theme is a folder here, named after its id (lower-case letters and digits). Adding one changes nothing
else in the project: drop the folder in, run `npm run themes` (the builds run it too, and `npm test` fails
until you do), reload the extension.

`themes.js` is generated from these folders by `tools/themes.mjs`. Never edit it by hand.

## The folder

| File | Needed | What it does |
|---|---|---|
| `theme.json` | yes | Name, description, picker group, versions, the popup's miniature. See below. |
| `tokens.css` | for a token theme | Sets every `--sct-*` colour role in [`../surfaces/tokens.json`](../surfaces/tokens.json) under `html[data-sct-theme="<id>"]`. Its presence switches on the shared map of Sitecore's UI (`../surfaces/<area>.gen.css` and `<area>.css`), which paints Sitecore with those roles. |
| `<area>.css` | no | The theme's own rules for one area: `shell` (Desktop, Content Editor, Sheer UI dialogs), `login`, `speak` (SPEAK apps and the Experience Editor's ribbon), `launchpad`, `ee` (the Experience Editor's chrome around the website), `admin` (`/sitecore/admin`). Loaded after the shared map and `tokens.css`. |
| `bar.css` | no | The theme's look for the site's postfix in Sitecore's top bar (`sct-bar-postfix`). Loaded on every area, after [`../surfaces/bar.css`](../surfaces/bar.css). |
| other `*.css` | no | Shared by every area, loaded before the area file (fonts, variables). Alphabetical unless `theme.json` lists them in `shared`. |
| `dom.js` | no | A DOM module for state CSS cannot see (an inactive window, a clock). See [`../lib/engine.js`](../lib/engine.js) for its interface and [`../lib/dom-kit.js`](../lib/dom-kit.js) for the helpers every change must go through. |
| `glyphs/` | no | Images the CSS loads as `url("sct-ext:themes/<id>/glyphs/...")`, so they load under any page's CSP. |
| `preview*.jpg` | no | The popup's screenshot, made by `node tools/previews.cjs <id>`: `preview.jpg` on the theme's main version, `preview-<version>.jpg` on the others, each with a `-dark` twin for a theme that follows the OS. Without one, the popup draws the miniature large. |

Everything the CSS selects is scoped by `<html>`'s attributes: `data-sct-theme="<id>"`, `data-sct-surface`
(the area), `data-sct-version` (`10.4` or `10.5`), and `data-sct-tokens` on token themes.

## theme.json

```json
{
  "name": "Guardrail",
  "description": "Shows which environment you're on, follows your light or dark setting",
  "category": "everyday",
  "order": 60,
  "versions": ["10.4", "10.5"],
  "appearance": "auto",
  "controls": ["env"],
  "preview": ["#c62828", "#ffffff", "#2b2b2b"],
  "swatch": { "desk": "#d9dde3", "bar": "#2b2b2b", "win": "#ffffff", "border": "#c62828", "cap": "#c62828", "tree": "#ffffff", "ed": "#f4f4f4", "sel": "#fde3e3" }
}
```

| Field | Required | Meaning |
|---|---|---|
| `name`, `description` | yes | Shown in the popup and the README's table. Describe the look; name no OS or product (store reviewers reject that). |
| `versions` | yes | Sitecore UI versions the theme is written for: `10.4` (which 10.0 to 10.3 also get) and `10.5`. |
| `preview` | yes | Three colours: panel, accent, chrome. The accent tints the tab icon when a site asks for the theme's own. |
| `swatch` | yes | The popup's miniature of the Desktop. Fields are listed at the top of [`../popup/swatch.js`](../popup/swatch.js). |
| `swatchFor` | no | `{ "10.4": { ...swatch } }` where the theme looks different on that version. |
| `category` | no | The picker group: `everyday`, `modern`, `retro`, `creative`, or a new id (it gets its own group, named after the id). Without one, the theme sits in the top group with Native. |
| `order` | no | Position within the group, lowest first; themes without one follow, by name. |
| `appearance` | no | `"auto"` for a theme with light and dark looks under `prefers-color-scheme`. A site can pin it to Light or Dark. |
| `hue` | no | `true` lets a site turn the palette round the colour wheel: `tokens.css` redefines its colours under `[data-sct-hue]` from `--sct-hue`. |
| `controls` | no | Extra per-site settings the popup shows for this theme: `"env"` (the site's environment, as `data-sct-env`), `"phase"` (a pinned time of day, as `data-sct-phase-pin`). |
| `shared` | no | The other CSS files' order, when alphabetical is wrong. |

`npm run themes` checks the required fields and says which file is wrong.

## Writing one

Use the `sct-new-theme` skill (`.claude/skills/sct-new-theme/`): it covers measuring a reference, the
build order and every pitfall earlier themes hit. Start from the nearest existing theme.
