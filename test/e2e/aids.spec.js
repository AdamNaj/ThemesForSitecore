// The accessibility aids runner (engine.js) and its aids, on a fixture page that runs the engine with a fake host.
const { test, expect } = require("@playwright/test");
const { fixtureServer } = require("./helpers");

const PORT = 4930;
const URL = `http://localhost:${PORT}/sitecore/shell/aids.html`;
let server;
test.beforeAll(async () => (server = await fixtureServer(PORT)));
test.afterAll(() => server.close());

const titles = (page) => page.evaluate(() => [...document.querySelectorAll("iframe")].map((f) => f.getAttribute("title")));
const NAMED = ["Content Editor", "Mine", null, "Sitecore: Bar"];
const UNNAMED = [null, "Mine", null, null];
// a setting change, as the host reports it
const change = (page, kind, set) => page.evaluate(([k, s]) => (Object.assign(fake, s), fake.fire(k)), [kind, set]);
const ready = (page) => page.waitForFunction(() => SCT.engine && document.documentElement.dataset.sctSurface === "shell" && document.readyState === "complete");

test("an always-on aid names frames on a themed site, not under Native", async ({ page }) => {
  await page.goto(`${URL}?theme=fjord`);
  await ready(page);
  await expect.poll(() => titles(page)).toEqual(NAMED);
  await change(page, "theme", { theme: "native" });
  await expect.poll(() => titles(page)).toEqual(UNNAMED);
});

test("a need turns it on under Native; switched off it stays off on a themed site", async ({ page }) => {
  await page.goto(URL);
  await ready(page);
  await change(page, "accessibility", { site: { accessibility: { needs: ["screen-reader"] } } });
  await expect.poll(() => titles(page)).toEqual(NAMED);
  await change(page, "accessibility", { site: { accessibility: { aids: { "frame-titles": false } } } });
  await change(page, "theme", { theme: "fjord" });
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.sctTheme)).toBe("fjord");
  expect(await titles(page)).toEqual(UNNAMED);
});

test("running again changes nothing; stopping restores the page exactly", async ({ page }) => {
  await page.goto(URL);
  await ready(page);
  const before = await page.evaluate(() => document.body.innerHTML);
  await change(page, "theme", { theme: "fjord" });
  await expect.poll(() => titles(page)).toEqual(NAMED);
  await change(page, "accessibility", {});
  const once = await page.evaluate(() => document.body.innerHTML);
  await change(page, "accessibility", {});
  await page.waitForTimeout(100);
  expect(await page.evaluate(() => document.body.innerHTML)).toBe(once);
  await page.evaluate(() => SCT.engine.unload());
  expect(await page.evaluate(() => document.body.innerHTML)).toBe(before);
});

test("a frame added later is named on the next pass", async ({ page }) => {
  await page.goto(`${URL}?theme=fjord`);
  await ready(page);
  await page.evaluate(() => {
    const f = document.createElement("iframe");
    f.id = "late";
    f.src = "/sitecore/shell/Controls/Rich%20Text%20Editor/Preview.aspx?id=1";
    document.body.append(f);
  });
  await expect.poll(() => page.evaluate(() => document.getElementById("late").title)).toBe("Rich text preview");
});

test("a theme switch keeps the aids' changes, and the theme's", async ({ page }) => {
  await page.goto(`${URL}?theme=fjord`);
  await ready(page);
  await expect.poll(() => titles(page)).toEqual(NAMED);
  await change(page, "theme", { theme: "chicago" });
  await expect.poll(() => page.evaluate(() => !!document.getElementById("sct-chicago-clock"))).toBe(true);
  expect(await titles(page)).toEqual(NAMED);
});

test("an aid that throws is switched off alone", async ({ page }) => {
  const warnings = [];
  page.on("console", (m) => m.type() === "warning" && warnings.push(m.text()));
  await page.goto(`${URL}?boom&theme=fjord`);
  await ready(page);
  await expect.poll(() => titles(page)).toEqual(NAMED);
  expect(await page.evaluate(() => document.body.hasAttribute("data-boom"))).toBe(false);
  expect(warnings.filter((w) => w.includes("boom"))).toHaveLength(1);
});

// adds an iframe with this src and returns its title once the aids have had a pass
const addFrame = async (page, src) => {
  const id = await page.evaluate((s) => {
    const f = document.createElement("iframe");
    f.id = `f${Math.random().toString(36).slice(2)}`;
    f.setAttribute("src", s);
    document.body.append(f);
    return f.id;
  }, src);
  await page.waitForTimeout(150);
  return page.evaluate((i) => document.getElementById(i).getAttribute("title"), id);
};

test("a frame whose src changes is renamed", async ({ page }) => {
  await page.goto(`${URL}?theme=fjord`);
  await ready(page);
  await expect.poll(() => titles(page)).toEqual(NAMED);
  await page.evaluate(() => document.querySelector("iframe").setAttribute("src", "/sitecore/shell/Controls/Rich%20Text%20Editor/Preview.aspx"));
  await expect.poll(async () => (await titles(page))[0]).toBe("Rich text preview");
});

test("frames outside Sitecore's own pages are left alone", async ({ page }) => {
  await page.goto(`${URL}?theme=fjord`);
  await ready(page);
  expect(await addFrame(page, "https://www.youtube.com/embed/abc123")).toBe(null);
  expect(await addFrame(page, "/en/products/page")).toBe(null);
  expect(await addFrame(page, "javascript:0")).toBe(null);
});

test("a Sheer UI dialog is named after its control", async ({ page }) => {
  await page.goto(`${URL}?theme=fjord`);
  await ready(page);
  expect(await addFrame(page, "/sitecore/shell/default.aspx?xmlcontrol=RichText.InsertLink&la=en")).toBe("Sitecore: Insert Link");
});

test("frames come back named after Sitecore replaces the markup", async ({ page }) => {
  await page.goto(`${URL}?theme=fjord`);
  await ready(page);
  await page.evaluate(() => {
    const box = document.createElement("div");
    box.id = "box";
    document.body.append(box);
    box.innerHTML = '<iframe src="/sitecore/shell/Applications/Content%20Editor.aspx"></iframe>';
  });
  await expect.poll(() => page.evaluate(() => document.querySelector("#box iframe").title)).toBe("Content Editor");
  await page.evaluate(() => (document.getElementById("box").innerHTML = '<iframe src="/sitecore/shell/Controls/JqueryModalDialogs.html"></iframe>'));
  await expect.poll(() => page.evaluate(() => document.querySelector("#box iframe").title)).toBe("Dialog");
});
