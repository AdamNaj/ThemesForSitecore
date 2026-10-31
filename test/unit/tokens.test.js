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

// color-mix(in srgb, a p, b)
function mix(a, b, p) {
  const ch = (hex, i) => parseInt(hex.slice(i, i + 2), 16);
  return "#" + [1, 3, 5].map((i) => Math.round(ch(a, i) * p + ch(b, i) * (1 - p)).toString(16).padStart(2, "0")).join("");
}

// the status colours surfaces/shell.css mixes into .scMessageBar
const messageTints = { warning: "#fce99c", error: "#f8c9c4", information: "#cfe3f7" };

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

    // surfaces/shell.css and ee.css tint the message and notification bars with their status colour over the
    // panel, under the panel's (Content Editor) or app's (Experience Editor) text: a dark or saturated panel
    // passes on its own and fails once tinted, and then sets --sct-<state>-bg
    test(`${theme.id} (${appearance}) keeps message bar text at WCAG AA`, () => {
      for (const [state, tint] of Object.entries(messageTints)) {
        const bg = tokens.get(`--sct-${state}-bg`) || mix(tint, tokens.get("--sct-panel-bg"), 0.28);
        for (const fg of ["--sct-panel-fg", "--sct-app-fg"]) {
          const ratio = contrast(tokens.get(fg), bg);
          assert.ok(ratio >= 4.5, `${fg} on the ${state} bar (${bg}): ${ratio.toFixed(2)}; set --sct-${state}-bg`);
        }
      }
    });

    // surfaces/shell.css redraws the content tree's inline green as a mix of green and the app's text
    test(`${theme.id} (${appearance}) keeps the tree's green at WCAG AA`, () => {
      const green = tokens.get("--sct-green-fg") || mix("#008000", tokens.get("--sct-app-fg"), 0.55);
      for (const bg of ["--sct-tree-bg", "--sct-app-bg"]) {
        const ratio = contrast(green, tokens.get(bg));
        assert.ok(ratio >= 4.5, `${green} on ${bg}: ${ratio.toFixed(2)}; set --sct-green-fg`);
      }
    });
  }
}

module.exports = { readTokens, contrast };
