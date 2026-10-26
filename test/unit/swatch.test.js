const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const themes = require("../../extension/themes/themes.js");
const swatch = require("../../extension/popup/swatch.js");

const THEMES = path.join(__dirname, "..", "..", "extension", "themes");

test("every built-in theme draws a complete miniature", () => {
  for (const t of themes) {
    assert.ok(t.swatch, `${t.id} has a swatch spec`);
    // an outline theme (Blueprint) draws its panels as lines, so it has no panel fills
    const need = t.swatch.outline ? ["desk", "fg", "sel"] : ["desk", "win", "border", "cap", "tree", "ed", "sel"];
    for (const k of need) assert.ok(t.swatch[k], `${t.id}: swatch.${k}`);
    const svg = swatch(t.swatch, t.name);
    assert.match(svg, /^<svg [^>]*viewBox="0 0 54 36"/, t.id);
    assert.doesNotMatch(svg, /undefined|NaN|null/, `${t.id} draws every part`);
  }
});

test("a miniature's label is text, not markup", () => {
  const svg = swatch(themes[0].swatch, `<img src=x onerror="alert(1)">`);
  assert.doesNotMatch(svg, /<img/);
});

test("Native's miniature on 10.4 is Sitecore 10.4's look", () => {
  const native = themes.find((t) => t.id === "native");
  assert.deepEqual(globalThis.SCT.swatchSpec(native, "10.4"), themes.find((t) => t.id === "sitecore104").swatch);
  assert.equal(globalThis.SCT.swatchSpec(native, "10.5"), native.swatch);
});

test("an imported theme without a spec gets the plain miniature", () => {
  assert.ok(globalThis.SCT.swatchSpec({ id: "import:x" }).desk);
});

test("a theme's previews are files in its folder, for versions it runs on", () => {
  for (const t of themes) {
    for (const suffix of t.previews) {
      assert.ok(fs.existsSync(path.join(THEMES, t.id, `preview${suffix}.jpg`)), `${t.id}/preview${suffix}.jpg`);
      const version = /^-(\d+\.\d+)/.exec(suffix)?.[1];
      if (version) assert.ok(t.versions.includes(version), `${t.id}/preview${suffix}: ${t.id} runs on ${version}`);
    }
  }
});
