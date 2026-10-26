const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const ROOT = path.join(__dirname, "..", "..");
const SWATCH = { desk: "#000", win: "#111", border: "#222", cap: "#333", tree: "#444", ed: "#555", sel: "#666" };

function folder(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sct-themes-"));
  for (const [f, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true });
    fs.writeFileSync(path.join(dir, f), text);
  }
  return dir;
}

test("themes.js and the README's table are generated from the theme folders: run npm run themes", async () => {
  const { registry, readme } = await import("../../tools/themes.mjs");
  assert.equal(fs.readFileSync(path.join(ROOT, "extension/themes/themes.js"), "utf8"), registry());
  const text = fs.readFileSync(path.join(ROOT, "README.md"), "utf8");
  assert.equal(text, readme(text));
});

test("a dropped-in folder is a theme: its files say what it uses", async () => {
  const { catalog } = await import("../../tools/themes.mjs");
  const json = (o) => JSON.stringify({ name: "X", description: "d", versions: ["10.5"], preview: ["#000", "#111", "#222"], swatch: SWATCH, ...o });
  const dir = folder({
    "native/theme.json": json({ name: "Native", order: 0 }),
    "zed/theme.json": json({ name: "Zed", category: "neon" }),
    "zed/tokens.css": "", "zed/shell.css": "", "zed/login.css": "", "zed/dom.js": "", "zed/bar.css": "",
    "zed/fonts.css": "", "zed/a.css": "", "zed/preview.jpg": "", "zed/preview-dark.jpg": "", "zed/notes.txt": "",
    "abc/theme.json": json({ name: "Abc", category: "retro", shared: ["b.css", "a.css"] }),
    "abc/a.css": "", "abc/b.css": "",
    "empty/readme.md": "",
  });
  const { categories, themes } = catalog(dir);
  assert.deepEqual(themes.map((t) => t.id), ["native", "abc", "zed"]);
  const zed = themes[2];
  assert.equal(zed.usesTokens, true);
  assert.equal(zed.hasDom, true);
  assert.equal(zed.bar, true);
  assert.deepEqual(zed.areas, ["shell", "login"]);
  assert.deepEqual(zed.shared, ["a.css", "fonts.css"]);
  assert.deepEqual(zed.previews, ["", "-dark"]);
  assert.equal("order" in zed, false);
  assert.deepEqual(themes[1].shared, ["b.css", "a.css"]);
  assert.deepEqual(themes[0], { ...themes[0], usesTokens: false, hasDom: false, bar: false, areas: [], shared: [], previews: [] });
  assert.deepEqual(categories.at(-1), { id: "neon", name: "Neon" });
  fs.rmSync(dir, { recursive: true, force: true });
});

test("a broken theme.json names the theme and what is wrong", async () => {
  const { catalog } = await import("../../tools/themes.mjs");
  const cases = [
    [{ "Bad-Id/theme.json": "{}" }, /folder name/],
    [{ "x/theme.json": "{ nope" }, /x\/theme.json/],
    [{ "x/theme.json": JSON.stringify({ name: "X", description: "d", versions: ["9.0"], preview: [], swatch: {} }) }, /versions/],
    [{ "x/theme.json": JSON.stringify({ name: "X", description: "d", versions: ["10.4"], preview: ["#0", "#1", "#2"], swatch: SWATCH, shared: ["gone.css"] }) }, /shared/],
  ];
  for (const [files, message] of cases) {
    const dir = folder(files);
    assert.throws(() => catalog(dir), message);
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
