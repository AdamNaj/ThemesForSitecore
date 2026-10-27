const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

test("packaged builds ship with the dev hooks switched off", async () => {
  const { stage } = await import("../../tools/build.mjs");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sct-stage-"));
  stage(dir);
  const dev = fs.readFileSync(path.join(dir, "lib", "dev.js"), "utf8");
  assert.match(dev, /devHooks = false/);
  assert.ok(fs.existsSync(path.join(dir, "manifest.json")));
  fs.rmSync(dir, { recursive: true, force: true });
});

test("every file a built-in theme lists exists, on every surface", () => {
  const themes = require("../../extension/themes/themes.js");
  const { sources } = require("../../extension/lib/files.js");
  for (const t of themes) {
    for (const surface of ["shell", "speak", "launchpad", "login", "ee", "admin"]) {
      for (const f of sources(t.id, surface).files) assert.ok(fs.existsSync(path.join(__dirname, "..", "..", "extension", f)), `${t.id} ${surface}: ${f}`);
    }
  }
});

test("the Sitecore bundle parses, has the dev hooks off and its host last", async () => {
  const { bundle } = await import("../../tools/build-sitecore.mjs");
  const js = bundle();
  new Function(js); // throws on a syntax error
  assert.match(js, /devHooks = false/);
  assert.ok(js.lastIndexOf("SCT.startEngine = function") < js.lastIndexOf("The Sitecore module's host"));
});

test("every aid has its module, in the content scripts and the Sitecore bundle", async () => {
  const { AIDS } = require("../../extension/lib/settings.js");
  const { bundle } = await import("../../tools/build-sitecore.mjs");
  const js = bundle();
  const background = fs.readFileSync(path.join(__dirname, "..", "..", "extension", "background.js"), "utf8");
  const files = background.match(/function contentFiles\(\) \{[\s\S]*?\n\}/)[0];
  assert.match(files, /const aids = Object\.keys\(SCT\.settings\.AIDS\)\.map\(\(id\) => `lib\/aids\/\$\{id\}\.js`\)/);
  // after the DOM kit that registers them, before the engine that runs them
  const list = files.match(/return \[.*\]/)[0];
  const at = (s) => list.indexOf(s);
  assert.ok(at("lib/dom-kit.js") < at("...aids") && at("...aids") < at("lib/engine.js"), list);
  for (const id of Object.keys(AIDS)) {
    assert.ok(fs.existsSync(path.join(__dirname, "..", "..", "extension", "lib", "aids", `${id}.js`)), id);
    assert.ok(js.includes(`SCT.registerAid("${id}"`), id);
    assert.ok(js.indexOf(`SCT.registerAid("${id}"`) < js.indexOf("SCT.startEngine = function"), id);
  }
});

test("Light and Dark leave no colour-scheme query in a theme that follows the OS", () => {
  const themes = require("../../extension/themes/themes.js");
  const { sources, withMode } = require("../../extension/lib/files.js");
  const css = "@media (prefers-color-scheme: dark) { a { color: red } } @media (prefers-color-scheme:light){b{}} html { color-scheme: light dark }";
  assert.equal(withMode(css, "dark"), "@media all { a { color: red } } @media not all{b{}} html { color-scheme: dark }");
  assert.equal(withMode(css, "light"), "@media not all { a { color: red } } @media all{b{}} html { color-scheme: light }");
  assert.equal(withMode(css, undefined), css);
  for (const t of themes.filter((t) => t.appearance === "auto")) {
    for (const surface of ["shell", "speak", "launchpad", "login", "ee", "admin"]) {
      for (const f of sources(t.id, surface).files) {
        const text = fs.readFileSync(path.join(__dirname, "..", "..", "extension", f), "utf8");
        assert.doesNotMatch(withMode(text, "dark"), /prefers-color-scheme|color-scheme:\s*light\s+dark/, `${t.id} ${f}`);
      }
    }
  }
});

test("the manifest's description fits the Chrome Web Store's 132 characters", () => {
  const { description } = require("../../extension/manifest.json");
  assert.ok(description.length <= 132, `${description.length} characters`);
});
