const test = require("node:test");
const assert = require("node:assert/strict");
const { parseColor, role, rewrite, ruleDecls, scoped } = require("../../extension/lib/color-map.js");
const { isStock, splitSelectors } = require("../../extension/lib/live-map.js");

test("parseColor reads hex, named, rgb and hsl colours", () => {
  assert.deepEqual(parseColor("#fff"), { r: 255, g: 255, b: 255, a: 1 });
  assert.deepEqual(parseColor("#FF000080"), { r: 255, g: 0, b: 0, a: 128 / 255 });
  assert.deepEqual(parseColor("white"), { r: 255, g: 255, b: 255, a: 1 });
  assert.deepEqual(parseColor("rgb(255, 255, 255)"), { r: 255, g: 255, b: 255, a: 1 });
  assert.deepEqual(parseColor("rgba(0, 0, 0, 0.5)"), { r: 0, g: 0, b: 0, a: 0.5 });
  assert.equal(parseColor("transparent").a, 0);
  const red = parseColor("hsl(0, 100%, 50%)");
  assert.deepEqual([red.r, red.g, red.b].map(Math.round), [255, 0, 0]);
  assert.equal(parseColor("#12345"), null);
  assert.equal(parseColor("currentcolor"), null);
});

test("role maps greys by lightness and keeps status colours", () => {
  assert.equal(role("#ffffff", "bg"), "var(--sct-panel-bg)");
  assert.equal(role("rgb(255, 255, 255)", "bg"), "var(--sct-panel-bg)");
  assert.equal(role("#f0f0f0", "bg"), "var(--sct-app-bg)");
  assert.equal(role("#cccccc", "bg"), "var(--sct-raised-bg)");
  assert.equal(role("#333", "bg"), "var(--sct-chrome-bg)");
  assert.equal(role("#000", "fg"), "var(--sct-app-fg)");
  assert.equal(role("#999", "fg"), "var(--sct-muted-fg)");
  assert.equal(role("#ddd", "border"), "var(--sct-border)");
  assert.equal(role("#555", "border"), "var(--sct-border-strong)");
  assert.equal(role("#6e3fff", "bg"), "var(--sct-accent)"); // brand hue
  assert.equal(role("#e8e0ff", "bg"), "var(--sct-selected-bg)");
  assert.equal(role("#6e3fff", "fg"), "var(--sct-link)");
  assert.equal(role("#cc0000", "fg"), null); // errors stay red
  assert.equal(role("#fdecec", "bg"), "color-mix(in srgb, #fdecec 25%, var(--sct-panel-bg))");
  assert.equal(role("rgba(0, 0, 0, 0.3)", "bg"), "color-mix(in srgb, var(--sct-app-fg) 30%, transparent)");
  assert.equal(role("transparent", "bg"), null);
});

test("rewrite turns declarations into themed ones", () => {
  assert.deepEqual(rewrite("background", "#fff url(x.png) no-repeat"), [["background-color", "var(--sct-panel-bg)"]]);
  assert.deepEqual(rewrite("background-image", "linear-gradient(#fff, #eee)"), [
    ["background-image", "none"], ["background-color", "var(--sct-panel-bg)"],
  ]);
  // an icon on a gradient keeps the icon
  assert.deepEqual(rewrite("background", "url(i.png), linear-gradient(#fff, #eee)"), [["background-color", "var(--sct-panel-bg)"]]);
  assert.deepEqual(rewrite("background-image", "url(i.png)"), []);
  // a sized gradient is a divider line (SPE's status bar), not a fill
  assert.deepEqual(rewrite("background", "linear-gradient(silver, silver) no-repeat left center / 1px 12px"), [
    ["background", "linear-gradient(var(--sct-border), var(--sct-border)) no-repeat left center / 1px 12px"],
  ]);
  assert.deepEqual(rewrite("border", "1px solid #ccc"), [["border-color", "var(--sct-border)"]]);
  assert.deepEqual(rewrite("border-color", "#ccc #333"), [["border-color", "var(--sct-border) var(--sct-border-strong)"]]);
  assert.deepEqual(rewrite("text-shadow", "0 1px 0 #fff"), [["text-shadow", "none"]]);
  assert.deepEqual(rewrite("color", "var(--x)"), []);
  assert.deepEqual(rewrite("width", "#fff"), []);
});

test("ruleDecls keeps !important and puts text on accents in accent-fg", () => {
  assert.deepEqual(ruleDecls([["Color", "#fff", false], ["background-color", "#6e3fff", true]]), [
    "color: var(--sct-accent-fg)", "background-color: var(--sct-accent) !important",
  ]);
  assert.deepEqual(ruleDecls([["color", "#fff", false]]), ["color: var(--sct-chrome-fg)"]);
});

test("scoped keeps the selector inside :is() and pseudo-elements outside", () => {
  const p = ":where(html[data-sct-tokens])";
  assert.equal(scoped(p, ".a > b"), `${p} :is(.a > b)`);
  assert.equal(scoped(p, ".a::before"), `${p} :is(.a)::before`);
  assert.equal(scoped(p, "html.x .a"), `${p}.x .a`);
  assert.equal(scoped(p, ":root"), p);
});

test("splitSelectors ignores commas inside parentheses and strings", () => {
  assert.deepEqual(splitSelectors('.a, :is(.b, .c) d, [title="x,y"]'), [".a", " :is(.b, .c) d", ' [title="x,y"]']);
});

test("isStock matches the files the generator maps and nothing else", () => {
  const cm = "https://cm.local";
  assert.ok(isStock(`${cm}/sitecore/shell/Themes/Standard/Default/Content%20Manager.css`));
  assert.ok(isStock(`${cm}/sitecore/shell/client/Speak/Assets/css/speak-default-theme.css`));
  assert.ok(isStock(`${cm}/sitecore/shell/Controls/Lib/jQuery/jQueryUI/1.13.2/smoothness/jquery-ui.min.css`));
  assert.ok(isStock(`${cm}/sitecore%20modules/PowerShell/Styles/ListView.css?v=1`));
  assert.ok(isStock(`${cm}/sitecore/admin/Admin.css`));
  assert.ok(isStock(`${cm}/sitecore/shell/Themes/Standard/Default/WebFramework.css`));
  assert.ok(!isStock(`${cm}/sitecore/admin/lib/vendor.css`));
  assert.ok(!isStock(`${cm}/sitecore%20modules/PowerShell/Styles/jquery.terminal.css`));
  assert.ok(!isStock(`${cm}/sitecore/shell/client/Speak/Assets/lib/ui/1.1/deps/NVD3/nv.d3.css`));
  assert.ok(!isStock(`${cm}/sitecore/shell/Controls/Lib/jQuery/jScrollPane/jquery.jscrollpane.css`));
  assert.ok(!isStock(`${cm}/sitecore%20modules/Shell/MyModule/styles.css`));
  assert.ok(!isStock(null));
});

test("paints: grey SVG fills and strokes follow the theme, data colours stay", () => {
  const { paints } = require("../../extension/lib/live-map.js");
  const st = (decls) => ({ getPropertyValue: (p) => decls[p] || "", getPropertyPriority: () => "" });
  assert.deepEqual(paints(st({ fill: "none", stroke: "#000" }), ".c3 path"), ["stroke: var(--sct-border-strong)"]);
  assert.deepEqual(paints(st({ fill: "#000" }), ".c3-gauge-value"), ["fill: var(--sct-app-fg)"]);
  assert.deepEqual(paints(st({ fill: "#fff", stroke: "#d3d3d3" }), ".c3-legend-background"), [
    "fill: var(--sct-panel-bg)", "stroke: var(--sct-border)",
  ]);
  assert.deepEqual(paints(st({ fill: "#fff" }), ".c3-chart-arc text"), []); // white labels on data slices
  assert.deepEqual(paints(st({ fill: "#4682b4" }), ".c3-region"), []); // a data hue
});
