// Whistler's colour schemes (XP's Blue, Olive Green and Silver, and Luna): every scheme is offered by the picker,
// drawn by the theme and accepted by the Sitecore module, and each scheme's token block passes AA over Blue's tokens.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const settings = require("../../extension/lib/settings.js");
const { contrastPairs } = require("../../extension/surfaces/tokens.json");

const read = (f) => fs.readFileSync(path.join(__dirname, "..", "..", f), "utf8");

test("every colour scheme is offered by the picker, drawn by Whistler and accepted by the Sitecore module", () => {
  const picker = [...read("extension/popup/picker.js").matchAll(/name="scheme" value="(\w*)"/g)].map((m) => m[1]);
  // Blue, the theme's own, is the empty value
  assert.deepEqual(picker, ["", ...settings.SCHEMES]);
  const popup = read("extension/popup/popup.css");
  for (const scheme of picker) assert.ok(popup.includes(`#scheme label:has(input[value="${scheme}"]:checked)`), scheme);
  for (const scheme of settings.SCHEMES) {
    for (const area of ["shell", "speak", "launchpad"]) {
      assert.ok(read(`extension/themes/whistler/${area}.css`).includes(`[data-sct-scheme="${scheme}"] {`), `${area} ${scheme}`);
    }
  }
  assert.ok(read("sitecore/ThemesProcessor.cs").includes(`"^(${settings.SCHEMES.join("|")})?$"`));
});

function luminance(hex) {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const css = read("extension/themes/whistler/tokens.css").replace(/\/\*[\s\S]*?\*\//g, "");
const decls = (block) => new Map([...block.matchAll(/(--sct-[\w-]+)\s*:\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
const blue = decls(/html\[data-sct-theme="whistler"\]\s*\{([^}]*)\}/.exec(css)[1]);
for (const scheme of settings.SCHEMES) {
  test(`whistler ${scheme} passes WCAG AA for every contrast pair`, () => {
    const block = new RegExp(`html\\[data-sct-theme="whistler"\\]\\[data-sct-scheme="${scheme}"\\]\\s*\\{([^}]*)\\}`).exec(css);
    assert.ok(block, `no ${scheme} block`);
    const tokens = new Map([...blue, ...decls(block[1])]);
    for (const [fg, bg] of contrastPairs) {
      const ratio = contrast(tokens.get(fg), tokens.get(bg));
      assert.ok(ratio >= 4.5, `${fg} on ${bg}: ${ratio.toFixed(2)}`);
    }
  });
}
