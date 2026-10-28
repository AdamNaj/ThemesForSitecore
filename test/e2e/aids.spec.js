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
const ready = (page, surface = "shell") => page.waitForFunction((s) => window.SCT?.engine && document.documentElement.dataset.sctSurface === s && document.readyState === "complete", surface);

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

test("a CSS-only aid's rules are in the page while it runs, and gone after", async ({ page }) => {
  await page.goto(`${URL}?css&theme=fjord`);
  await ready(page);
  const css = () => page.evaluate(() => document.querySelector("style[data-sct-aids]")?.textContent || null);
  await expect.poll(css).toContain("body{outline:3px solid red}");
  expect(await css()).toMatch(/^@layer sct-accessibility\{/);
  await change(page, "theme", { theme: "native" });
  await expect.poll(css).toBe(null);
});

// One aid fixture, the way every aid is held to the spec's section 5: themed, check() holds; another pass changes
// nothing; after rerender() (Sitecore replacing the markup) check() holds again; unloading the engine leaves the
// body exactly as it was.
async function aidCase(page, url, { surface = "shell", check, rerender }) {
  await page.goto(`${url}${url.includes("?") ? "&" : "?"}theme=fjord`);
  await ready(page, surface);
  const before = await page.evaluate(() => window.pristine);
  await expect.poll(check).toBe(true);
  const once = await page.evaluate(() => document.body.innerHTML);
  await change(page, "accessibility", {});
  await page.waitForTimeout(100);
  expect(await page.evaluate(() => document.body.innerHTML)).toBe(once);
  if (rerender) {
    await page.evaluate(rerender);
    await expect.poll(check).toBe(true);
    await page.evaluate(() => SCT.engine.unload());
    return;
  }
  await page.evaluate(() => SCT.engine.unload());
  expect(await page.evaluate(() => document.body.innerHTML)).toBe(before);
}

const CE = `http://localhost:${PORT}/sitecore/shell/Applications/ce-aids.html`;
// a tree of nodes as Sitecore renders them after an expand: the same shape, new elements
const EXPANDED = () => {
  const tree = document.querySelector(".scContentTree");
  tree.innerHTML = tree.innerHTML.replace('aria-expanded="false"', 'aria-expanded="true"').replace(/role="treeitem"/g, 'role="group"').replace(/ role="group"(?=>)/g, "");
};

test("aria-repair: tree items, the ribbon's tablist and labelled images", async ({ page }) => {
  await aidCase(page, CE, {
    check: () => page.evaluate(() => {
      const $ = (s) => document.querySelector(s);
      const items = [...document.querySelectorAll(".scContentTree a")];
      return items.length === 5 && items.every((a) => a.getAttribute("role") === "treeitem")
        && $("#Tree_Node_1 + div").getAttribute("role") === "group"
        && $("#Gutter1").getAttribute("role") === null
        && $(".scRibbon").getAttribute("role") === "region" && $(".scRibbon").getAttribute("aria-label") === "The content editor ribbon"
        && $(".scRibbonNavigatorButtonsGroupButtons").getAttribute("role") === "tablist"
        && $(".scRibbonNavigatorButtonsGroupButtons").getAttribute("aria-label") === "Ribbon tabs"
        && $("#Section_Data_Glyph").alt === "Data";
    }),
    rerender: EXPANDED,
  });
});

const LAUNCHPAD = `http://localhost:${PORT}/sitecore/client/Applications/Launchpad-aids.html`;
const ADMIN = `http://localhost:${PORT}/sitecore/admin/aids.html`;
// every image has an alt (a name or "" for decoration), and every control a name
const allNamed = () => [...document.querySelectorAll("img")].every((i) => i.hasAttribute("alt") || i.hasAttribute("aria-labelledby"))
  && [...document.querySelectorAll("a, button, [role=button], [role=tab], select, input:not([type=hidden])")].every((el) =>
    (el.getAttribute("aria-label") || el.getAttribute("aria-labelledby") || el.labels?.length || (el.tagName === "IMG" && el.alt) || el.textContent.trim() || el.title || [...el.querySelectorAll("img")].some((i) => i.alt)));

test("names: images, icon buttons and clickable parts in the Content Editor", async ({ page }) => {
  await aidCase(page, CE, {
    check: () => page.evaluate((all) => {
      const $ = (s) => document.querySelector(s);
      return eval(all)() && $("#FieldMarker1 img").alt === "" && $("#Titled").alt === "Lock state"
        && $(".scRibbonPanelUp").alt === "Scroll up" && $(".scRibbonPanelOpen").alt === "More options"
        && $(".scComboboxDropDown").alt === "Show options" && $("#BTAddNewSearch").getAttribute("aria-label") === "New search"
        && $(".bucketSearch").getAttribute("aria-label") === "Search"
        && $("#FIELD2_unselected").getAttribute("aria-label") === "Available items" && $("#FIELD2_selected").getAttribute("aria-label") === "Selected items"
        && $("#CopyId").getAttribute("role") === "button" && $("#CopyId").tabIndex === 0
        && $(".scRibbonPanelUp").getAttribute("role") === "button"
        && $("#Section_Data").getAttribute("role") === null && $("#RibbonPanel").getAttribute("role") === null; // they hold a control already
    }, `(${allNamed})`),
    rerender: () => (document.querySelector("#Section_Data_controls td").innerHTML += ""),
  });
});

test("names: a made button answers Enter and Space once, and never a key Sitecore handled", async ({ page }) => {
  await page.goto(`${CE}?theme=fjord`);
  await ready(page);
  await expect.poll(() => page.evaluate(() => document.getElementById("CopyId").getAttribute("role"))).toBe("button");
  await page.focus("#CopyId");
  await page.keyboard.press("Enter");
  await page.keyboard.press(" ");
  expect(await page.evaluate(() => window.clicks)).toBe(2);
  await page.evaluate(() => document.getElementById("CopyId").addEventListener("keydown", (e) => e.preventDefault()));
  await page.keyboard.press("Enter");
  expect(await page.evaluate(() => window.clicks)).toBe(2);
});

test("names: Launchpad's logo, tiles and portrait", async ({ page }) => {
  await aidCase(page, LAUNCHPAD, {
    surface: "launchpad",
    check: () => page.evaluate((all) => eval(all)() && document.querySelector(".sc-global-logo").getAttribute("aria-label") === "Launchpad"
      && [...document.querySelectorAll(".sc-launchpad img")].every((i) => i.alt === "") && document.getElementById("globalHeaderUserPortrait").alt === "", `(${allNamed})`),
  });
});

test("names: the admin pages' icons beside their text", async ({ page }) => {
  await aidCase(page, ADMIN, {
    surface: "admin",
    check: () => page.evaluate((all) => eval(all)() && [...document.querySelectorAll(".tools img")].every((i) => i.alt === ""), `(${allNamed})`),
  });
});

const DESKTOP = `http://localhost:${PORT}/sitecore/shell/desktop-aids.html`;
const landmark = (s) => { const el = document.querySelector(s); return el && [el.getAttribute("role"), el.getAttribute("aria-label")].join(":"); };

test("landmarks: the tree, the editor, the Desktop and Launchpad", async ({ page }) => {
  await aidCase(page, CE, {
    check: () => page.evaluate((l) => (l = eval(l), l("#ContentTreePanel") === "navigation:Content tree" && l("#ContentEditor") === "main:Item editor"), `(${landmark})`),
  });
  await aidCase(page, DESKTOP, {
    check: () => page.evaluate((l) => (l = eval(l), l("#Desktop") === "main:Desktop" && l("#Startbar") === "region:Taskbar"), `(${landmark})`),
  });
  await aidCase(page, LAUNCHPAD, {
    surface: "launchpad",
    // one banner: the page has one already
    check: () => page.evaluate((l) => (l = eval(l), l(".sc-applicationHeader") === ":" && l(".sc-launchpad") === "main:Launchpad"), `(${landmark})`),
  });
  await aidCase(page, ADMIN, {
    surface: "admin",
    check: () => page.evaluate((l) => (l = eval(l), l("mat-toolbar") === "banner:"), `(${landmark})`),
  });
});

test("lang: Sitecore's UI language, never over the page's own", async ({ page }) => {
  const lang = () => page.evaluate(() => document.documentElement.getAttribute("lang"));
  await page.goto(`${DESKTOP}?theme=fjord`); // no cookie: the form's lang_da class
  await ready(page);
  await expect.poll(lang).toBe("da");
  await page.evaluate(() => (document.cookie = "shell#lang=de; path=/"));
  await page.goto(`${CE}?theme=fjord&sc_lang=fr`); // the cookie wins over the address and the form
  await ready(page);
  await expect.poll(lang).toBe("de");
  await page.evaluate(() => SCT.engine.unload());
  expect(await lang()).toBe(null);
  await page.goto(`${ADMIN}?theme=fjord`); // the page says en itself
  await ready(page, "admin");
  await page.waitForTimeout(200);
  expect(await lang()).toBe("en");
});

test("forced-colors: selections and the themes' glyphs stay visible with High Contrast on", async ({ page }) => {
  const look = () => page.evaluate(() => {
    const probe = document.createElement("i");
    probe.style.cssText = "background:Highlight;forced-color-adjust:none";
    document.body.append(probe);
    const highlight = getComputedStyle(probe).backgroundColor;
    probe.remove();
    const s = (q) => getComputedStyle(document.querySelector(q));
    return { tree: s("#Tree_Node_2").backgroundColor === highlight, tab: s("#RibbonX_Nav_Home").backgroundColor === highlight,
      editorTab: s("#BContent").backgroundColor === highlight, glyph: s(".sc-global-logo").forcedColorAdjust, text: s("#Section_Data").forcedColorAdjust };
  });
  await page.emulateMedia({ forcedColors: "active" });
  await page.goto(`${CE}?theme=fjord`);
  await ready(page);
  await expect.poll(look).toEqual({ tree: true, tab: true, editorTab: true, glyph: "none", text: "auto" });
  await page.emulateMedia({ forcedColors: "none" });
  expect(await look()).toMatchObject({ tree: false, tab: false, editorTab: false });
});

test("focus-ring: a visible ring, thicker for low vision", async ({ page }) => {
  await page.goto(`${CE}?theme=fjord`);
  await ready(page);
  const ring = async () => {
    await page.focus(".scRibbonToolbarLargeButton");
    return page.evaluate(() => { const s = getComputedStyle(document.activeElement); return `${s.outlineStyle} ${s.outlineWidth}`; });
  };
  const before = await ring();
  await change(page, "accessibility", { site: { accessibility: { needs: ["keyboard"] } } });
  await expect.poll(ring).toBe("solid 2px");
  expect(await page.evaluate(() => document.documentElement.dataset.sctNeeds)).toBe("keyboard");
  await change(page, "accessibility", { site: { accessibility: { needs: ["keyboard", "low-vision"] } } });
  await expect.poll(ring).toBe("solid 3px");
  await change(page, "accessibility", { site: {} });
  await expect.poll(ring).toBe(before);
  expect(await page.evaluate(() => document.documentElement.dataset.sctNeeds)).toBe(undefined);
});

test("ribbon-toolbar: one Tab stop, arrows inside, back where you left it", async ({ page }) => {
  await page.goto(`${CE}?theme=fjord`);
  await ready(page);
  await change(page, "accessibility", { site: { accessibility: { needs: ["keyboard"] } } });
  const at = () => page.evaluate(() => { const a = document.activeElement; return a.id || a.className || a.textContent.trim(); });
  await expect.poll(() => page.evaluate(() => document.getElementById("RibbonX_Strip_Home").getAttribute("role"))).toBe("toolbar");
  expect(await page.evaluate(() => document.getElementById("RibbonX_Strip_Home").getAttribute("aria-labelledby"))).toBe("RibbonX_Nav_Home");
  await page.focus("#RibbonX_Nav_Home");
  await page.keyboard.press("Tab");
  expect(await at()).toBe("scRibbonToolbarLargeButton");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  expect(await at()).toBe("scRibbonPanelOpen");
  await page.keyboard.press("End");
  expect(await at()).toBe("scRibbonToolbarSmallButton");
  await page.keyboard.press("ArrowRight"); // wraps
  expect(await at()).toBe("scRibbonToolbarLargeButton");
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowLeft");
  expect(await at()).toBe("scRibbonPanelOpen");
  await page.keyboard.press("Tab"); // out in one press
  expect(await at()).toBe("TreeSearch");
  await page.keyboard.press("Shift+Tab"); // back in, where it was
  expect(await at()).toBe("scRibbonPanelOpen");
  await page.keyboard.press("Shift+Tab");
  expect(await at()).toBe("RibbonX_Nav_Home");
});

test("tree-keys: typing letters finds the next visible item", async ({ page }) => {
  await page.goto(`${CE}?theme=fjord`);
  await ready(page);
  await change(page, "accessibility", { site: { accessibility: { needs: ["keyboard"] } } });
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.sctNeeds)).toBe("keyboard");
  const at = () => page.evaluate(() => document.activeElement.textContent.trim());
  await page.focus("#Tree_Node_1");
  await page.keyboard.type("m");
  expect(await at()).toBe("Media Library");
  await page.waitForTimeout(800); // a pause starts a new search
  await page.keyboard.type("co"); // two letters typed together search for "co"
  expect(await at()).toBe("Content"); // wraps past the end; the hidden "Cobalt" never matches
  await page.waitForTimeout(800);
  await page.keyboard.type("l");
  expect(await at()).toBe("Layout");
  await page.keyboard.press("Control+l"); // a shortcut is not a letter
  expect(await at()).toBe("Layout");
});

test("menus: focus moves into a menu that opens, and back to its opener when it closes", async ({ page }) => {
  await page.goto(`${CE}?theme=fjord`);
  await ready(page);
  await change(page, "accessibility", { site: { accessibility: { needs: ["keyboard"] } } });
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.sctNeeds)).toBe("keyboard");
  const at = () => page.evaluate(() => document.activeElement.id || document.activeElement.tagName);
  await page.focus("#OpenMenu");
  await page.keyboard.press("Enter");
  await expect.poll(at).toBe("MenuInsert");
  await page.keyboard.press("Escape");
  await expect.poll(() => page.evaluate(() => !!document.querySelector(".scPopup"))).toBe(false);
  await expect.poll(at).toBe("OpenMenu");
});

test("dialogs: named from their frame, and focus comes back to the opener when one closes", async ({ page }) => {
  await page.goto(`${CE}?theme=fjord&needs=keyboard`);
  await ready(page);
  await page.focus("#OpenMenu"); // the opener, in the page under the dialog
  await page.evaluate(() => {
    const f = document.createElement("iframe");
    f.id = "jqueryModalDialogsFrame";
    f.src = "/sitecore/shell/aidhost/Controls/JqueryModalDialogs.html?theme=fjord&needs=keyboard";
    document.body.append(f);
  });
  const host = () => page.frames().find((f) => f.url().includes("/aidhost/"));
  await expect.poll(() => host()?.evaluate(() => document.getElementById("ui-id-1").getAttribute("aria-label")).catch(() => null)).toBe("Copy to");
  await host().focus("#DialogOk"); // focus moves into the dialog
  await host().evaluate(() => document.querySelector(".ui-dialog").remove()); // and the dialog closes
  await expect.poll(() => page.evaluate(() => document.activeElement.id)).toBe("OpenMenu");
});
