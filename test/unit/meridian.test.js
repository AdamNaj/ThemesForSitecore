// Meridian keeps one token block per phase of the day. tokens.test.js reads only the first block (the
// default, which is the day phase); this checks every phase block on its own.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { roles, nonColor, contrastPairs } = require("../../extension/surfaces/tokens.json");

const css = fs.readFileSync(path.join(__dirname, "..", "..", "extension", "themes", "meridian", "tokens.css"), "utf8")
  .replace(/\/\*[\s\S]*?\*\//g, "");
const decls = (block) => new Map([...block.matchAll(/(--sct-[\w-]+)\s*:\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));

const base = /html\[data-sct-theme="meridian"\]\s*\{([^}]*)\}/.exec(css);
const phases = { day: base ? decls(base[1]) : new Map() };
for (const m of css.matchAll(/html\[data-sct-theme="meridian"\]\[data-sct-phase="(\w+)"\]\s*\{([^}]*)\}/g)) {
  phases[m[1]] = decls(m[2]);
}

function luminance(hex) {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

test("meridian has a block for every phase", () => {
  assert.deepEqual(Object.keys(phases).sort(), ["dawn", "day", "dusk", "night"]);
});

for (const [phase, tokens] of Object.entries(phases)) {
  test(`meridian ${phase} defines every role as an opaque colour`, () => {
    for (const role of roles) {
      assert.ok(tokens.has(role), `${role} missing`);
      if (!nonColor.includes(role)) assert.match(tokens.get(role), /^#[0-9a-f]{6}$/i, `${role} = ${tokens.get(role)}`);
    }
  });
  test(`meridian ${phase} passes WCAG AA for every contrast pair`, () => {
    for (const [fg, bg] of contrastPairs) {
      const ratio = contrast(tokens.get(fg), tokens.get(bg));
      assert.ok(ratio >= 4.5, `${fg} on ${bg}: ${ratio.toFixed(2)}`);
    }
  });
}
