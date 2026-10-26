// Beacon promises AAA: every token text pair at 7:1, not just the 4.5:1 tokens.test.js asks of all themes.
const test = require("node:test");
const assert = require("node:assert/strict");
const { contrastPairs } = require("../../extension/surfaces/tokens.json");
const { readTokens, contrast } = require("./tokens.test.js");

for (const [appearance, tokens] of Object.entries(readTokens("beacon"))) test(`beacon (${appearance}) passes WCAG AAA (7:1) for every contrast pair`, () => {
  const extra = [["--sct-muted-fg", "--sct-app-bg"], ["--sct-ribbon-chunk-caption-fg", "--sct-ribbon-chunk-bg"],
    ["--sct-titlebar-inactive-fg", "--sct-titlebar-inactive-bg"], ["--sct-tree-fg", "--sct-tree-hover-bg"],
    ["--sct-app-fg", "--sct-ribbon-button-pressed-bg"], ["--sct-ribbon-tab-fg", "--sct-ribbon-tab-bg"]];
  for (const [fg, bg] of [...contrastPairs, ...extra]) {
    const ratio = contrast(tokens.get(fg), tokens.get(bg));
    assert.ok(ratio >= 7, `${fg} on ${bg}: ${ratio.toFixed(2)}`);
  }
});
