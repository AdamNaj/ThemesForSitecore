// The CSS files for one theme in one area, in cascade order, plus an imported theme's own CSS.
// Shared by the extension's background and the Sitecore module's host.
(function (root) {
  const SCT = (root.SCT = root.SCT || {});
  const builtIns = () => SCT.themes || (typeof require === "function" ? require("../themes/themes.js") : []);

  // The generated map from Sitecore's stylesheets, then the hand-tuned map that wins over it.
  const areaMap = (surface) => [`surfaces/${surface}.gen.css`, `surfaces/${surface}.css`];

  // Every theme's look for the site's postfix in Sitecore's top bar, and the Sitecore Extensions database name moved aside.
  const BAR = "surfaces/bar.css";

  function sources(themeId, surface, imported) {
    if (themeId === "native") return { files: [], css: "" };
    if (themeId.startsWith("import:")) {
      const t = (imported || {})[themeId];
      if (!t) return { files: [], css: "" };
      return { files: t.usesTokens ? [...areaMap(surface), BAR] : [BAR], css: t.css };
    }
    const theme = builtIns().find((t) => t.id === themeId);
    if (!theme) return { files: [], css: "" };
    const files = [
      ...(theme.usesTokens ? [...areaMap(surface), `themes/${theme.id}/tokens.css`] : []),
      ...theme.shared.map((f) => `themes/${theme.id}/${f}`),
      ...(theme.areas.includes(surface) ? [`themes/${theme.id}/${surface}.css`] : []),
      BAR,
      ...(theme.bar ? [`themes/${theme.id}/bar.css`] : []),
    ];
    return { files, css: "" };
  }

  // A site set to Light or Dark (storage.sync `modes`) gets that half of a theme that follows the OS: its
  // prefers-color-scheme queries become always or never true, and `color-scheme: light dark` picks the one.
  function withMode(css, mode) {
    if (mode !== "light" && mode !== "dark") return css;
    return css
      .replace(/@media\s*\(\s*prefers-color-scheme\s*:\s*(light|dark)\s*\)/g, (_, m) => (m === mode ? "@media all" : "@media not all"))
      .replace(/color-scheme\s*:\s*light\s+dark/g, `color-scheme: ${mode}`);
  }

  SCT.files = { sources, withMode };
  if (typeof module !== "undefined") module.exports = SCT.files;
})(globalThis);
