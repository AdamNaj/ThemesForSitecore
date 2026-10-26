// Works out which theme a Sitecore host gets.
(function (root) {
  const SCT = (root.SCT = root.SCT || {});
  const builtIns = () => SCT.themes || (typeof require === "function" ? require("../themes/themes.js") : []);

  const DEFAULTS = { overrides: {} };

  function catalog(imported) {
    const extra = Object.entries(imported || {}).map(([id, t]) => ({
      id, name: t.name, versions: t.versions, usesTokens: !!t.usesTokens, hasDom: false, imported: true,
    }));
    return builtIns().concat(extra);
  }

  // The Sitecore UI a version serves, which themes are written for: 10.0 to 10.3 serve 10.4's, less its
  // keyboard-focus rules and with older SPEAK stylesheets (the generated maps cover them under data-sct-legacy).
  function uiVersion(version) {
    return /^10\.[0-3]$/.test(version || "") ? "10.4" : version || null;
  }

  // A site without a theme of its own gets Native.
  function resolve(settings, origin, version, cat) {
    const s = settings || DEFAULTS;
    const v = uiVersion(version) || "10.5";
    const theme = cat.find((t) => t.id === (s.overrides || {})[origin]);
    return theme && theme.versions.includes(v) ? theme.id : "native";
  }

  // Settings saved before themes were per site only: the old default becomes each enabled site's own theme.
  function migrate(settings, origins) {
    const overrides = { ...(settings.overrides || {}) };
    if (settings.defaultTheme && settings.defaultTheme !== "native") {
      for (const o of origins) overrides[o] ??= settings.defaultTheme;
    }
    return overrides;
  }

  // The page's title with the site's postfix, swapping out the postfix added before (applied).
  function withPostfix(title, postfix, applied) {
    let base = title;
    if (applied && title === applied) base = "";
    else if (applied && title.endsWith(" " + applied)) base = title.slice(0, -applied.length - 1);
    return [base, postfix].filter(Boolean).join(" ");
  }

  // The favicon's tint: none (off), the theme's accent ("theme"), or a colour of the site's own.
  // ponytail: the accent is the theme's second preview swatch; imported themes have none, so no tint
  function tintColor(setting, theme) {
    if (setting === "theme") return (theme && theme.preview && theme.preview[1]) || null;
    return /^#[0-9a-f]{6}$/i.test(setting || "") ? setting : null;
  }

  // A site's environment, per site in storage.sync `envs`; themes such as Guardrail draw it from data-sct-env.
  const ENVS = ["prod", "staging", "qa", "dev", "sandbox", "local", "beta"];

  // A site's time of day for Meridian, per site in storage.sync `phases`; none follows the clock.
  const PHASES = ["dawn", "day", "dusk", "night"];

  // A site's colour scheme for Whistler (XP's Blue, Olive Green or Silver), per site in storage.sync `schemes`; none
  // is the theme's own (Luna, the Luna Element skin's deeper blue).
  const SCHEMES = ["blue", "olive", "silver"];

  // A site's hue, per site and theme in storage.sync `hues` ({ fjord: 40 }), for themes that offer one (themes.js
  // `hue`): degrees round the colour wheel, 1 to 359. Anything else, 0 included, keeps the theme's own colours.
  // A bare number (saved before hues were per theme, or the Sitecore module's) applies to every theme.
  function hue(value, theme) {
    const v = value && typeof value === "object" ? value[theme] : value;
    return Number.isInteger(v) && v > 0 && v < 360 ? v : null;
  }

  // The hues with one theme's set (0 removes it); a bare number saved before is dropped.
  function withHue(hues, theme, value) {
    const next = hues && typeof hues === "object" ? { ...hues } : {};
    if (value) next[theme] = value;
    else delete next[theme];
    return next;
  }

  // Softlight was Fjord's light palette turned half way round the colour wheel. Its sites become Fjord in Light
  // mode at that hue, plus any hue the site had given Softlight. Null when no site used it.
  const SOFTLIGHT_HUE = 180;
  function migrateSoftlight({ overrides = {}, modes = {}, hues = {} }) {
    const sites = Object.keys(overrides).filter((o) => overrides[o] === "softlight");
    if (!sites.length) return null;
    const next = { overrides: { ...overrides }, modes: { ...modes }, hues: { ...hues } };
    for (const o of sites) {
      next.overrides[o] = "fjord";
      next.modes[o] = "light";
      const turned = (SOFTLIGHT_HUE + (hue(hues[o], "softlight") || 0)) % 360;
      next.hues[o] = withHue(withHue(hues[o], "softlight", 0), "fjord", turned);
    }
    return next;
  }

  // A site's accessibility aids, per site in storage.sync `accessibility` ({ font, spacing, vision, strength }), under
  // every theme and Native: a font drawn for readers with low vision or dyslexia (extension/fonts, SIL OFL), wider
  // letter and word spacing, and a colour filter for a colour vision deficiency at a strength of 1 to 100.
  const FONTS = {
    hyperlegible: { name: "Atkinson Hyperlegible", files: ["AtkinsonHyperlegible-Regular.ttf", "AtkinsonHyperlegible-Bold.ttf"] },
    opendyslexic: { name: "OpenDyslexic", files: ["OpenDyslexic-Regular.woff2", "OpenDyslexic-Bold.woff2"] },
  };

  // Daltonization (Fidaner, Lin and Ozguven): what a viewer loses (the colour less its simulation) is moved into the
  // channels they still see. Simulations from Machado, Oliveira and Fernandes 2009 at full severity, in linear RGB,
  // where feColorMatrix works by default. Each is one fixed matrix, so the whole filter is one matrix too.
  const VISIONS = {
    protanopia: { sim: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]], shift: "redgreen" },
    deuteranopia: { sim: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.01182, 0.04294, 0.968881]], shift: "redgreen" },
    tritanopia: { sim: [[1.255528, -0.076749, -0.178779], [-0.078411, 0.930809, 0.147602], [0.004733, 0.691367, 0.3039]], shift: "blue" },
  };
  // where the lost difference goes: red-green losses into green and blue, blue-yellow losses into red and green
  const SHIFTS = { redgreen: [[0, 0, 0], [0.7, 1, 0], [0.7, 0, 1]], blue: [[1, 0, 0.7], [0, 1, 0.7], [0, 0, 0]] };

  // null when everything is off
  function accessibility(value) {
    const v = value && typeof value === "object" ? value : {};
    const font = Object.hasOwn(FONTS, v.font) ? v.font : null;
    const spacing = v.spacing === "wide" ? "wide" : null;
    const vision = Object.hasOwn(VISIONS, v.vision) ? v.vision : null;
    const strength = vision ? (Number.isInteger(v.strength) && v.strength > 0 && v.strength <= 100 ? v.strength : 100) : null;
    return font || spacing || vision ? { font, spacing, vision, strength } : null;
  }

  // The 3x3 correction for a vision at a strength (1 to 100): I + s * shift * (I - sim).
  function visionMatrix(vision, strength) {
    const { sim, shift } = VISIONS[vision];
    const m = SHIFTS[shift];
    const s = strength / 100;
    return [0, 1, 2].map((r) => [0, 1, 2].map((c) =>
      (r === c ? 1 : 0) + s * [0, 1, 2].reduce((sum, k) => sum + m[r][k] * ((k === c ? 1 : 0) - sim[k][c]), 0)));
  }
  // as feColorMatrix's values: four rows of five, alpha untouched
  const visionValues = (vision, strength) =>
    [...visionMatrix(vision, strength).map((row) => [...row.map((x) => +x.toFixed(5)), 0, 0]), [0, 0, 0, 1, 0]].flat().join(" ");

  // Icon fonts and code editors keep their own: Sitecore's .si and .sic and Glyphicons draw icons, Ace (SPE's ISE)
  // and jQuery Terminal (SPE's Console) measure their monospace characters.
  const KEEP = ".si,.sic,.glyphicon,.ace_editor,.ace_editor *,.terminal,.terminal *,pre,code,kbd,samp";
  // A frame's CSS for accessibility(), url(path) giving a packaged file's address; the colour filter is the SVG filter
  // #sct-vision the engine adds beside it. In a layer, its !important wins over every unlayered !important of the
  // page's and the theme's, whatever their specificity.
  // ponytail: no line-height; Sitecore's rows and ribbons have fixed heights that taller lines would clip
  function accessibilityCss(a, url) {
    if (!a || !(a.font || a.spacing || a.vision)) return "";
    const font = a.font && FONTS[a.font];
    const family = font && `"SCT ${font.name}"`;
    return [
      ...(font ? font.files.map((f, i) => `@font-face{font-family:${family};src:url("${url(`fonts/${f}`)}");font-weight:${i ? "600 900" : "100 599"}}`) : []),
      "@layer sct-accessibility{",
      ...(font ? [`:root[data-sct-font] :not(${KEEP}){font-family:${family},sans-serif!important}`] : []),
      ...(a.spacing ? [`:root[data-sct-spacing] :not(${KEEP}){letter-spacing:.06em!important;word-spacing:.16em!important}`] : []),
      ...(a.vision ? [":root[data-sct-vision]{filter:url(#sct-vision)!important}"] : []),
      "}",
    ].join("\n");
  }

  SCT.settings = {
    DEFAULTS, ENVS, PHASES, SCHEMES, FONTS, VISIONS, catalog, uiVersion, resolve, migrate, withPostfix, tintColor, hue, withHue, migrateSoftlight,
    accessibility, accessibilityCss, visionMatrix, visionValues,
  };
  if (typeof module !== "undefined") module.exports = SCT.settings;
})(globalThis);
