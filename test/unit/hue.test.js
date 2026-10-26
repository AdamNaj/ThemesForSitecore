// Themes with a hue (themes.js `hue: true`) rotate their colour tokens round the OKLCH hue wheel when a site
// sets one: tokens.css redefines them under [data-sct-hue] with relative colours. These tests rotate the
// tokens the way the browser does and check the contrast pairs at every 30 degrees.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const themes = require("../../extension/themes/themes.js");
const { contrastPairs } = require("../../extension/surfaces/tokens.json");
const { readTokens, contrast } = require("./tokens.test.js");

const ROTATED = /^oklch\(from (#[0-9a-f]{6}) l c calc\(h \+ var\(--sct-hue\)\)\)$/i;

// The [data-sct-hue] blocks of a theme's tokens.css: { light, dark? } as Maps, like readTokens.
function readHueTokens(themeId) {
  const css = fs.readFileSync(path.join(__dirname, "..", "..", "extension", "themes", themeId, "tokens.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  const decls = (block) => new Map([...block.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
  const dark = /@media\s*\(prefers-color-scheme:\s*dark\)\s*\{\s*html[^{]*\[data-sct-hue\]\s*\{([^}]*)\}/.exec(css);
  const light = /html\[data-sct-theme="[^"]+"\]\[data-sct-hue\]\s*\{([^}]*)\}/.exec(dark ? css.replace(dark[0], "") : css);
  return { light: decls(light ? light[1] : ""), ...(dark && { dark: decls(dark[1]) }) };
}

// sRGB hex <-> OKLCH (Ottosson's OKLab), clipping out-of-gamut channels as browsers do when they paint.
const lin = (v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const enc = (v) => (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055);
function toOklch(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => lin(parseInt(hex.slice(i, i + 2), 16) / 255));
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return [L, Math.hypot(A, B), (Math.atan2(B, A) * 180) / Math.PI];
}
function fromOklch([L, C, H]) {
  const A = C * Math.cos((H * Math.PI) / 180), B = C * Math.sin((H * Math.PI) / 180);
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
  const rgb = [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s];
  return "#" + rgb.map((v) => Math.round(enc(Math.min(1, Math.max(0, v))) * 255).toString(16).padStart(2, "0")).join("");
}
const rotate = (hex, deg) => (deg ? fromOklch(((c) => [c[0], c[1], c[2] + deg])(toOklch(hex))) : hex);

test("rotating by 0 degrees round-trips a colour", () => {
  for (const hex of ["#4c6f9a", "#9a4a22", "#ffffff", "#2e3440"]) assert.equal(fromOklch(toOklch(hex)), hex);
});

const hueThemes = themes.filter((t) => t.hue);

// any theme may offer one; Fjord keeps the checks below exercised
test("Fjord offers a hue", () => {
  assert.ok(hueThemes.some((t) => t.id === "fjord"));
});

for (const theme of hueThemes) {
  const base = readTokens(theme.id);
  const hue = readHueTokens(theme.id);
  for (const appearance of Object.keys(base)) {
    // the hue block repeats every colour token of the base palette, rotated from the same colour
    test(`${theme.id} (${appearance}) rotates every colour token from its base value`, () => {
      assert.ok(hue[appearance], "hue block present");
      for (const [k, v] of base[appearance]) {
        if (!/^#[0-9a-f]{6}$/i.test(v)) continue;
        const m = ROTATED.exec(hue[appearance].get(k) || "");
        assert.ok(m, `${k} rotated`);
        assert.equal(m[1].toLowerCase(), v.toLowerCase(), `${k} rotates its base colour`);
      }
    });

    test(`${theme.id} (${appearance}) passes WCAG AA at every 30 degrees of hue`, () => {
      for (let deg = 0; deg < 360; deg += 30) {
        const token = (k) => {
          const m = ROTATED.exec(hue[appearance].get(k) || "");
          return m ? rotate(m[1], deg) : base[appearance].get(k);
        };
        for (const [fg, bg] of contrastPairs) {
          const ratio = contrast(token(fg), token(bg));
          assert.ok(ratio >= 4.5, `${deg}deg: ${fg} ${token(fg)} on ${bg} ${token(bg)}: ${ratio.toFixed(2)}`);
        }
      }
    });
  }
}

module.exports = { rotate };
