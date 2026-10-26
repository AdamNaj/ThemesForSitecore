const test = require("node:test");
const assert = require("node:assert/strict");
const settings = require("../../extension/lib/settings.js");
const themes = require("../../extension/themes/themes.js");

const ORIGIN = "https://cm.example.test";
const catalog = settings.catalog({});

test("Native comes first, themes without a category next, then each category's themes together", () => {
  const ids = globalThis.SCT.categories.map((c) => c.id);
  assert.equal(themes[0].id, "native");
  for (const t of themes) if (t.category) assert.ok(ids.includes(t.category), `${t.id}: ${t.category}`);
  const order = themes.filter((t) => t.category).map((t) => ids.indexOf(t.category));
  assert.deepEqual(order, [...order].sort((a, b) => a - b), "themes are listed category by category");
  assert.ok(themes.findIndex((t) => t.category) > themes.findLastIndex((t) => !t.category));
});

test("defaults pick Native", () => {
  assert.deepEqual(settings.DEFAULTS, { overrides: {} });
  assert.equal(settings.resolve(undefined, ORIGIN, "10.4", catalog), "native");
});

test("a site gets its own theme, other sites stay Native", () => {
  const s = { overrides: { [ORIGIN]: "workgroups311" } };
  assert.equal(settings.resolve(s, ORIGIN, "10.5", catalog), "workgroups311");
  assert.equal(settings.resolve(s, "https://other", "10.5", catalog), "native");
});

test("Sitecore 10.4 theme on a 10.4 host resolves to native", () => {
  const s = { overrides: { [ORIGIN]: "sitecore104" } };
  assert.equal(settings.resolve(s, ORIGIN, "10.4", catalog), "native");
  assert.equal(settings.resolve(s, ORIGIN, "10.5", catalog), "sitecore104");
});

test("10.0 to 10.3 get 10.4's themes", () => {
  for (const v of ["10.0", "10.1", "10.2", "10.3"]) assert.equal(settings.uiVersion(v), "10.4");
  assert.equal(settings.uiVersion("10.5"), "10.5");
  assert.equal(settings.uiVersion("9.3"), "9.3");
  assert.equal(settings.uiVersion(null), null);
  const s = { overrides: { [ORIGIN]: "workgroups311" } };
  assert.equal(settings.resolve(s, ORIGIN, "10.2", catalog), "workgroups311");
  assert.equal(settings.resolve(s, ORIGIN, "9.3", catalog), "native");
  assert.equal(settings.resolve({ overrides: { [ORIGIN]: "sitecore104" } }, ORIGIN, "10.1", catalog), "native");
});

test("unknown theme falls back to native", () => {
  assert.equal(settings.resolve({ overrides: { [ORIGIN]: "gone" } }, ORIGIN, "10.5", catalog), "native");
});

test("unknown version is treated as 10.5", () => {
  const s = { overrides: { [ORIGIN]: "sitecore104" } };
  assert.equal(settings.resolve(s, ORIGIN, null, catalog), "sitecore104");
});

test("an old default theme moves onto enabled sites that had none of their own", () => {
  const old = { defaultTheme: "cupertino", overrides: { [ORIGIN]: "sitecore6" } };
  assert.deepEqual(settings.migrate(old, [ORIGIN, "https://other"]), { [ORIGIN]: "sitecore6", "https://other": "cupertino" });
  assert.deepEqual(settings.migrate({ defaultTheme: "native" }, [ORIGIN]), {});
});

test("imported themes join the catalog and respect their versions", () => {
  const imported = { "import:mine": { name: "Mine", versions: ["10.4"], usesTokens: true, css: "" } };
  const cat = settings.catalog(imported);
  const entry = cat.find((t) => t.id === "import:mine");
  assert.deepEqual(entry, { id: "import:mine", name: "Mine", versions: ["10.4"], usesTokens: true, hasDom: false, imported: true });
  const s = { overrides: { [ORIGIN]: "import:mine" } };
  assert.equal(settings.resolve(s, ORIGIN, "10.5", cat), "native");
  assert.equal(settings.resolve(s, ORIGIN, "10.4", cat), "import:mine");
});

test("the title postfix is added once and swapped when it changes", () => {
  const p = settings.withPostfix;
  assert.equal(p("Content Editor", "[DEV]", ""), "Content Editor [DEV]");
  assert.equal(p("Content Editor [DEV]", "[DEV]", "[DEV]"), "Content Editor [DEV]");
  assert.equal(p("Content Editor [DEV]", "[QA]", "[DEV]"), "Content Editor [QA]");
  assert.equal(p("Content Editor [DEV]", "", "[DEV]"), "Content Editor");
  assert.equal(p("Launchpad", "[DEV]", "[DEV]"), "Launchpad [DEV]");
  assert.equal(p("", "[DEV]", ""), "[DEV]");
  assert.equal(p("[DEV]", "[QA]", "[DEV]"), "[QA]");
});

test("the favicon tint is off, the theme's accent, or the site's own colour", () => {
  const cupertino = themes.find((t) => t.id === "cupertino");
  assert.equal(settings.tintColor(undefined, cupertino), null);
  assert.equal(settings.tintColor("theme", cupertino), "#0071e3");
  assert.equal(settings.tintColor("theme", { id: "import:x" }), null);
  assert.equal(settings.tintColor("#2F9E44", cupertino), "#2F9E44");
  assert.equal(settings.tintColor("red;background:url(x)", cupertino), null);
});

test("a site's hue is 1 to 359 degrees; anything else keeps the theme's colours", () => {
  assert.equal(settings.hue(40), 40);
  assert.equal(settings.hue(359), 359);
  for (const v of [undefined, 0, 360, -20, 12.5, "40", "40);color:red"]) assert.equal(settings.hue(v), null);
});

test("each theme keeps its own hue; a bare number applies to every theme", () => {
  const hues = { fjord: 40, other: 200 };
  assert.equal(settings.hue(hues, "fjord"), 40);
  assert.equal(settings.hue(hues, "other"), 200);
  assert.equal(settings.hue({ fjord: 40 }, "other"), null);
  assert.equal(settings.hue(120, "other"), 120);
  assert.deepEqual(settings.withHue(120, "fjord", 40), { fjord: 40 });
  assert.deepEqual(settings.withHue(hues, "fjord", 0), { other: 200 });
  assert.deepEqual(hues, { fjord: 40, other: 200 }); // a copy, the saved map untouched
});

test("Softlight's sites become Fjord in Light mode, turned to warm paper", () => {
  assert.equal(settings.migrateSoftlight({ overrides: { a: "fjord" } }), null);
  const next = settings.migrateSoftlight({
    overrides: { a: "softlight", b: "softlight", c: "softlight", d: "beacon" },
    modes: { d: "dark" },
    hues: { b: { softlight: 30, fjord: 90 }, c: 200 },
  });
  assert.deepEqual(next.overrides, { a: "fjord", b: "fjord", c: "fjord", d: "beacon" });
  assert.deepEqual(next.modes, { a: "light", b: "light", c: "light", d: "dark" });
  assert.deepEqual(next.hues, { a: { fjord: 180 }, b: { fjord: 210 }, c: { fjord: 20 } });
});

test("every environment is offered by the picker, drawn by Guardrail and accepted by the Sitecore module", () => {
  const fs = require("node:fs");
  const file = (f) => require("node:path").join(__dirname, "..", "..", f);
  const read = (f) => fs.readFileSync(file(f), "utf8");
  // the picker's markup moved from popup.html into picker.js, shared with the Sitecore module
  const markup = fs.existsSync(file("extension/popup/picker.js")) ? "extension/popup/picker.js" : "extension/popup/popup.html";
  const picker = [...read(markup).matchAll(/name="env" value="(\w+)"/g)].map((m) => m[1]);
  assert.deepEqual(picker, settings.ENVS);
  const tokens = read("extension/themes/guardrail/tokens.css");
  const popup = read("extension/popup/popup.css");
  for (const env of settings.ENVS) {
    // prod is the default, drawn without the attribute
    if (env !== "prod") assert.ok(tokens.includes(`[data-sct-env="${env}"]`), env);
    assert.ok(popup.includes(`input[value="${env}"]:checked`), env);
  }
  if (fs.existsSync(file("sitecore/ThemesProcessor.cs"))) {
    assert.ok(read("sitecore/ThemesProcessor.cs").includes(`"^(${settings.ENVS.join("|")})?$"`));
  }
});

test("a site's accessibility aids: unknown values are off, every font is packaged and offered", () => {
  const fs = require("node:fs");
  const ext = (f) => require("node:path").join(__dirname, "..", "..", "extension", f);
  assert.equal(settings.accessibility(undefined), null);
  assert.equal(settings.accessibility({ font: "comic", spacing: "huge", vision: "x-ray" }), null);
  assert.deepEqual(settings.accessibility({ font: "opendyslexic" }), { font: "opendyslexic", spacing: null, vision: null, strength: null });
  // a filter without a valid strength runs at full strength
  assert.equal(settings.accessibility({ vision: "tritanopia", strength: 0 }).strength, 100);
  assert.equal(settings.accessibility({ vision: "tritanopia", strength: 40 }).strength, 40);
  assert.equal(settings.accessibilityCss(null, String), "");
  const spacing = settings.accessibilityCss({ spacing: "wide" }, String);
  assert.ok(spacing.includes("letter-spacing") && !spacing.includes("@font-face") && !spacing.includes("filter"));
  assert.ok(settings.accessibilityCss({ vision: "protanopia", strength: 100 }, String).includes("filter:url(#sct-vision)"));
  const popup = fs.readFileSync(ext("popup/popup.html"), "utf8");
  for (const [id, font] of Object.entries(settings.FONTS)) {
    const css = settings.accessibilityCss({ font: id }, (p) => `x:/${p}`);
    // icons keep their icon font
    assert.ok(css.includes(":not(.si,.sic,.glyphicon,"));
    for (const f of font.files) {
      assert.ok(fs.existsSync(ext(`fonts/${f}`)), f);
      assert.ok(css.includes(`url("x:/fonts/${f}")`), f);
    }
    assert.ok(popup.includes(`name="font" value="${id}"`), id);
  }
  for (const id of Object.keys(settings.VISIONS)) assert.ok(popup.includes(`name="vision" value="${id}"`), id);
});

test("the colour filter pulls apart the colours each vision confuses, and does nothing at strength 0", () => {
  const mul = (m, v) => m.map((r) => r.reduce((a, x, i) => a + x * v[i], 0));
  const clamp = (v) => v.map((x) => Math.min(1, Math.max(0, x)));
  const seen = (sim, v) => clamp(mul(sim, v));
  const dist = (a, b) => Math.hypot(...a.map((x, i) => x - b[i]));
  const steps = [0, 0.25, 0.5, 0.75, 1];
  const grid = steps.flatMap((r) => steps.flatMap((g) => steps.map((b) => [r, g, b])));
  for (const [id, { sim }] of Object.entries(settings.VISIONS)) {
    assert.equal(settings.visionValues(id, 0), "1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 1 0", id);
    const fix = settings.visionMatrix(id, 100);
    let before = 0, after = 0;
    for (let i = 0; i < grid.length; i++) for (let j = i + 1; j < grid.length; j++) {
      const [a, b] = [grid[i], grid[j]];
      if (dist(seen(sim, a), seen(sim, b)) > 0.35 * dist(a, b)) continue; // a pair this viewer barely tells apart
      before += dist(seen(sim, a), seen(sim, b));
      after += dist(seen(sim, clamp(mul(fix, a))), seen(sim, clamp(mul(fix, b))));
    }
    // measured: 3.8x protanopia, 2.1x deuteranopia, 2.8x tritanopia
    assert.ok(after > 2 * before, `${id}: ${(after / before).toFixed(2)}x`);
  }
});
