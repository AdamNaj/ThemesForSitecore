const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const themes = require("../../extension/themes/themes.js");
const { roles, nonColor, contrastPairs } = require("../../extension/surfaces/tokens.json");

const THEMES = path.join(__dirname, "..", "..", "extension", "themes");

// Declarations of the first html[...] block, and of the html[...] block inside a dark media query.
function readTokens(themeId) {
  const css = fs.readFileSync(path.join(THEMES, themeId, "tokens.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  const decls = (block) => new Map([...block.matchAll(/(--sct-[\w-]+)\s*:\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
  const dark = /@media\s*\(prefers-color-scheme:\s*dark\)\s*\{\s*html[^{]*\{([^}]*)\}/.exec(css);
  const withoutDark = dark ? css.replace(dark[0], "") : css;
  const light = /html\[data-sct-theme="[^"]+"\]\s*\{([^}]*)\}/.exec(withoutDark);
  const result = { light: decls(light ? light[1] : "") };
  if (dark) result.dark = new Map([...result.light, ...decls(dark[1])]);
  return result;
}

function luminance(hex) {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const tokenThemes = themes.filter((t) => t.usesTokens);

test("at least one theme uses tokens", () => {
  assert.ok(tokenThemes.length > 0);
  for (const t of tokenThemes) assert.ok(fs.existsSync(path.join(THEMES, t.id, "tokens.css")), `${t.id} has tokens.css`);
});

for (const theme of tokenThemes) {
  if (!fs.existsSync(path.join(THEMES, theme.id, "tokens.css"))) continue;
  const sets = readTokens(theme.id);
  for (const [appearance, tokens] of Object.entries(sets)) {
    test(`${theme.id} (${appearance}) defines every role as an opaque colour`, () => {
      for (const role of roles) {
        assert.ok(tokens.has(role), `${role} missing`);
        if (!nonColor.includes(role)) assert.match(tokens.get(role), /^#[0-9a-f]{6}$/i, `${role} = ${tokens.get(role)}`);
      }
    });

    test(`${theme.id} (${appearance}) passes WCAG AA for every contrast pair`, () => {
      for (const [fg, bg] of contrastPairs) {
        const ratio = contrast(tokens.get(fg), tokens.get(bg));
        assert.ok(ratio >= 4.5, `${fg} on ${bg}: ${ratio.toFixed(2)}`);
      }
    });
  }
}

module.exports = { readTokens, contrast };
