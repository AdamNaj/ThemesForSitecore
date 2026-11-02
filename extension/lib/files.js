// The CSS files for one theme in one area, in cascade order.
// Shared by the extension's background and the Sitecore module's host.
(function (root) {
  const SCT = (root.SCT = root.SCT || {});
  const builtIns = () => SCT.themes || (typeof require === "function" ? require("../themes/themes.js") : []);

  // The generated map from Sitecore's stylesheets, then the hand-tuned map that wins over it. Content Hub's
  // stylesheets are not on the local installs, so it has no generated map: live-map.js maps them in the page.
  const areaMap = (surface) => [...(surface === "contenthub" ? [] : [`surfaces/${surface}.gen.css`]), `surfaces/${surface}.css`];

  // A token theme's optional tokens and color-scheme reset, so its sheet wins them over an older one left in the tab.
  const APPEARANCE = "surfaces/appearance.css";

  // Every theme's look for the site's postfix in Sitecore's top bar, and the Sitecore Extensions database name moved aside.
  const BAR = "surfaces/bar.css";

  function sources(themeId, surface) {
    const theme = builtIns().find((t) => t.id === themeId);
    if (!theme) return { files: [] }; // Native too
    const files = [
      ...(theme.usesTokens ? [...areaMap(surface), APPEARANCE, `themes/${theme.id}/tokens.css`] : []),
      ...theme.shared.map((f) => `themes/${theme.id}/${f}`),
      ...(theme.areas.includes(surface) ? [`themes/${theme.id}/${surface}.css`] : []),
      BAR,
      ...(theme.bar ? [`themes/${theme.id}/bar.css`] : []),
    ];
    return { files };
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
