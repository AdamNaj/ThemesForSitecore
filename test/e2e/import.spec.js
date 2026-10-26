const { test, expect } = require("@playwright/test");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const fixture = pathToFileURL(path.join(__dirname, "fixtures", "import.html")).href;
const META = "/* @sct-theme\nid: my-theme\nname: My theme\nversions: 10.4, 10.5\n*/\n";

async function parse(page, text) {
  return page.evaluate((t) => SCT.importTheme.parse(t), text);
}

test.beforeEach(async ({ page }) => {
  await page.goto(fixture);
});

const rejected = [
  ["remote url()", "a{background:url(https://x.test/y.png)}"],
  ["protocol-relative URL()", 'a{background:URL("//x.test/y")}'],
  ["escaped url token", "a{background:u\\72l(http://x.test/z)}"],
  ["image-set string", 'a{background-image:image-set("https://x.test/y.png" 1x)}'],
  ["@import", '@import "https://x.test/x.css";\na{color:red}'],
  ["remote @font-face", "@font-face{font-family:x;src:url(https://x.test/f.woff2)}"],
  ["remote url inside @media", "@media screen{a{background:url(http://x.test/q)}}"],
  ["backslash protocol-relative url", 'a{background:url("/\\\\x.test/y")}'],
  ["tab-split protocol-relative url", 'a{background:url("/\\9/x.test/y")}'],
  ["src() function", 'a{background-image:src("https://x.test/y")}'],
  ["URL string smuggled through a custom property into image-set()", 'html{--x:"https://x.test/y"} a{background-image:image-set(var(--x) 1x)}'],
  ["escaped url token inside a custom property", "html{--x:u\\72l(https://x.test/y)} a{background:var(--x)}"],
  ["var() inside image-set()", "a{background-image:image-set(var(--y) 1x)}"],
  ["escaped url token in a var() fallback", "a{background:var(--nope, u\\72l(https://x.test/y))}"],
  ["@property initial-value smuggling a URL", '@property --x{syntax:"*";inherits:false;initial-value:"https://x.test/y"} a{background-image:image-set(var(--x) 1x)}'],
  ["@function returning a URL", '@function --u(){result:"https://x.test/y"} a{background-image:image-set(--u() 1x)}'],
  ["remote URL in any string", 'a{content:"https://x.test/y"}'],
  ["other scheme", "a{background:url(javascript:alert(1))}"],
];

// Blocked means rejected, or dropped by the CSS parser so it never reaches the stored CSS.
for (const [label, css] of rejected) {
  test(`blocks ${label}`, async ({ page }) => {
    const r = await parse(page, META + css);
    if (r.ok) expect(r.theme.css).not.toMatch(/x\.test|javascript:/);
    else expect(r.error.length).toBeGreaterThan(0);
  });
}

test("rejects (not just drops) a plain remote url()", async ({ page }) => {
  const r = await parse(page, META + "a{background:url(https://x.test/y.png)}");
  expect(r.ok).toBe(false);
  expect(r.error).toContain("x.test");
});

test("rejects a file without the metadata block", async ({ page }) => {
  const r = await parse(page, "a{color:red}");
  expect(r).toEqual({ ok: false, error: expect.stringContaining("@sct-theme") });
});

test("rejects an id that isn't lowercase letters, digits and dashes", async ({ page }) => {
  const r = await parse(page, META.replace("my-theme", "My Theme") + "a{color:red}");
  expect(r.ok).toBe(false);
  expect(r.error).toContain("id");
});

test("rejects more than 1 MB of CSS", async ({ page }) => {
  const big = META + "a{color:red}\n".repeat(90_000);
  const r = await parse(page, big);
  expect(r.ok).toBe(false);
  expect(r.error).toContain("1 MB");
});

test("accepts data: and root-relative URLs and re-serializes the CSS", async ({ page }) => {
  const css = META + "/* comment */\na{background:url(data:image/png;base64,AAAA)}\nb{background:url('/sitecore/shell/x.png')}";
  const r = await parse(page, css);
  expect(r.ok).toBe(true);
  expect(r.theme).toMatchObject({ id: "import:my-theme", name: "My theme", versions: ["10.4", "10.5"], usesTokens: false });
  expect(r.theme.css).not.toContain("comment");
  expect(r.theme.css).toContain("/sitecore/shell/x.png");
});

test("reads usesTokens from the metadata", async ({ page }) => {
  const r = await parse(page, META.replace("*/", "usesTokens: true\n*/") + 'html[data-sct-theme="import:my-theme"]{--sct-app-bg:#000000}');
  expect(r.ok).toBe(true);
  expect(r.theme.usesTokens).toBe(true);
});

test("allows quoted font names in custom properties", async ({ page }) => {
  const r = await parse(page, META + 'html{--sct-font-family:"Segoe UI", Tahoma, sans-serif}');
  expect(r.ok).toBe(true);
});
