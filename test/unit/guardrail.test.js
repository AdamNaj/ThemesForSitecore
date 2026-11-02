// Guardrail paints its accents in the site's environment colour, one block of hex tokens per environment and half
// (tokens.css). tokens.test.js checks only the default (production) halves: this checks every environment in both.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { roles, nonColor, contrastPairs } = require("../../extension/surfaces/tokens.json");
const { contrast } = require("./tokens.test.js");

const css = fs.readFileSync(path.join(__dirname, "..", "..", "extension", "themes", "guardrail", "tokens.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
// where the dark media queries start and end
const darkRanges = [...css.matchAll(/@media \(prefers-color-scheme: dark\)\s*\{/g)].map((m) => {
  let depth = 1, i = m.index + m[0].length;
  for (; depth && i < css.length; i++) depth += css[i] === "{" ? 1 : css[i] === "}" ? -1 : 0;
  return [m.index, i];
});
// the declarations of every block with exactly this selector, in the light part (outside dark media queries) or the dark one
function decls(selector, dark) {
  const out = new Map();
  const esc = selector.replace(/[[\]"=]/g, "\\$&");
  for (const m of css.matchAll(new RegExp(`(^|\\n)\\s*${esc}\\s*\\{([^}]*)\\}`, "g"))) {
    if (darkRanges.some(([a, b]) => m.index > a && m.index < b) !== dark) continue;
    for (const [, k, v] of m[2].matchAll(/(--sct-[\w-]+)\s*:\s*([^;]+);/g)) out.set(k, v.trim());
  }
  return out;
}
const base = 'html[data-sct-theme="guardrail"]';
const ENVS = ["prod", ...[...css.matchAll(/data-sct-env="(\w+)"\]\s*\{/g)].map((m) => m[1]).filter((v, i, a) => a.indexOf(v) === i)];

for (const env of ENVS) {
  for (const dark of [false, true]) {
    const sel = `${base}[data-sct-env="${env}"]`;
    const tokens = new Map([...decls(base, false), ...(dark ? decls(base, true) : []), ...decls(sel, false), ...(dark ? decls(sel, true) : [])]);
    test(`guardrail ${env} (${dark ? "dark" : "light"}): every role, every contrast pair at 4.5:1, the selection border at 3:1`, () => {
      for (const role of roles) if (!nonColor.includes(role)) assert.match(tokens.get(role) || "", /^#[0-9a-f]{6}$/i, `${role}`);
      for (const [fg, bg] of contrastPairs) {
        const r = contrast(tokens.get(fg), tokens.get(bg));
        assert.ok(r >= 4.5, `${fg} on ${bg}: ${r.toFixed(2)}`);
      }
      for (const bg of ["--sct-tree-bg", "--sct-panel-bg"]) {
        const r = contrast(tokens.get("--sct-tree-selected-border"), tokens.get(bg));
        assert.ok(r >= 3, `--sct-tree-selected-border on ${bg}: ${r.toFixed(2)}`);
      }
    });
  }
}
