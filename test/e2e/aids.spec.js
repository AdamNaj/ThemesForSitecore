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

// Sitecore 10.4 and 10.5 make each strip a tabpanel: the toolbar goes inside it, round the strip's groups
const toolbar = () => {
  const strip = document.getElementById("RibbonX_Strip_Home");
  const bar = strip.querySelector(':scope > [role="toolbar"]');
  return bar && [strip.getAttribute("role"), bar.getAttribute("aria-labelledby"), bar.querySelectorAll(":scope > .chunk").length].join();
};

test("ribbon-toolbar: a toolbar inside Sitecore's tabpanel, made again after a re-render, undone exactly", async ({ page }) => {
  const check = () => page.evaluate(toolbar).then((t) => t === "tabpanel,RibbonX_Nav_Home,2");
  await aidCase(page, `${CE}?needs=keyboard`, { check });
  await aidCase(page, `${CE}?needs=keyboard`, {
    check,
    rerender: () => { const s = document.getElementById("RibbonX_Strip_Home"); s.innerHTML = new DOMParser().parseFromString(window.pristine, "text/html").getElementById("RibbonX_Strip_Home").innerHTML; },
  });
});

test("ribbon-toolbar: one Tab stop, arrows inside, back where you left it", async ({ page }) => {
  await page.goto(`${CE}?theme=fjord`);
  await ready(page);
  await change(page, "accessibility", { site: { accessibility: { needs: ["keyboard"] } } });
  const at = () => page.evaluate(() => { const a = document.activeElement; return a.id || a.className || a.textContent.trim(); });
  await expect.poll(() => page.evaluate(toolbar)).toBe("tabpanel,RibbonX_Nav_Home,2");
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
  await page.keyboard.press("ArrowDown"); // past the hidden submenu Sitecore's handler stalls on
  expect(await at()).toBe("MenuDelete");
  await page.keyboard.press("ArrowUp");
  expect(await at()).toBe("MenuInsert");
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

test("regions: skip links first, and F6 moves between the page's parts", async ({ page }) => {
  await page.goto(`${CE}?theme=fjord&needs=keyboard`);
  await ready(page);
  await expect.poll(() => page.evaluate(() => document.querySelectorAll("sct-skip button").length)).toBe(3);
  const at = () => page.evaluate(() => { const a = document.activeElement; return a.textContent.trim().slice(0, 40) || a.id || a.className; });
  const shown = () => page.evaluate(() => document.activeElement.getBoundingClientRect().width > 20);
  await page.keyboard.press("Tab");
  expect(await at()).toBe("Skip to the content editor ribbon");
  expect(await shown()).toBe(true); // hidden until focused
  await page.keyboard.press("Tab");
  expect(await at()).toBe("Skip to Content tree");
  await page.keyboard.press("Enter");
  expect(await page.evaluate(() => document.activeElement.getAttribute("role"))).toBe("tree");
  await page.keyboard.press("F6");
  expect(await page.evaluate(() => document.activeElement.id)).toBe("BContent"); // the editor's selected tab
  await page.keyboard.press("F6"); // round to the top bar
  expect(await page.evaluate(() => document.activeElement.className)).toBe("sc-global-logo");
  await page.keyboard.press("Shift+F6");
  expect(await page.evaluate(() => document.activeElement.id)).toBe("BContent");
  await page.keyboard.press("Shift+F6");
  await page.keyboard.press("Shift+F6");
  expect(await page.evaluate(() => document.activeElement.id)).toBe("RibbonX_Nav_Home"); // the ribbon, at its selected tab
});

test("targets: a near miss on a small icon reaches it, and no box changes", async ({ page }) => {
  await page.goto(`${CE}?theme=fjord`);
  await ready(page);
  const boxes = () => page.evaluate(() => [...document.querySelectorAll(".scContentTree *, #Section_Data *, .scComboboxDropDown, #CopyId")].map((e) => {
    const r = e.getBoundingClientRect();
    return `${r.left},${r.top},${r.width},${r.height}`;
  }).join(" "));
  await page.evaluate(() => {
    document.querySelectorAll("img").forEach((i) => { i.style.width = "16px"; i.style.height = "16px"; });
    window.glyph = 0;
    document.getElementById("Tree_Glyph_1").addEventListener("click", () => window.glyph++);
  });
  const glyph = await page.locator("#Tree_Glyph_1").boundingBox();
  const before = await boxes();
  await page.mouse.click(glyph.x - 3, glyph.y + 8); // 3px left of the expander: the tree row's own background
  expect(await page.evaluate(() => window.glyph)).toBe(0);
  await change(page, "accessibility", { site: { accessibility: { needs: ["keyboard"] } } });
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.sctNeeds)).toBe("keyboard");
  expect(await boxes()).toBe(before); // a theme's margins and padding stay as they were
  await page.mouse.click(glyph.x - 3, glyph.y + 8);
  expect(await page.evaluate(() => window.glyph)).toBe(1);
  // a control of its own beside an icon keeps its click
  await page.evaluate(() => (window.clicks = 0));
  const copy = await page.locator("#CopyId").boundingBox();
  await page.mouse.click(copy.x + 2, copy.y + copy.height / 2);
  expect(await page.evaluate(() => window.clicks)).toBe(1);
});

test("announcer: says the item, its warnings and validation, and that it saved, once each", async ({ page }) => {
  await page.goto(`${CE}?theme=fjord&needs=screen-reader`);
  await ready(page);
  const said = () => page.evaluate(() => document.querySelector("sct-announce")?.textContent);
  await expect.poll(() => page.evaluate(() => document.querySelectorAll("sct-announce[role=status][aria-live=polite]").length)).toBe(1);
  expect(await said()).toBe(""); // nothing on load
  // another item opens: Sitecore replaces the header
  await page.evaluate(() => (document.querySelector(".scEditorHeaderTitlePanel").innerHTML = '<a role="button" href="#" class="scEditorHeaderTitle">About</a>'));
  await expect.poll(said).toBe("About, English, version 1");
  await page.evaluate(() => (document.querySelector(".scEditorHeaderTitlePanel").innerHTML = '<a role="button" href="#" class="scEditorHeaderTitle">About</a>'));
  await page.waitForTimeout(150);
  expect(await said()).toBe("About, English, version 1"); // the same item again says nothing new
  // a warning, then validation
  await page.evaluate(() => document.getElementById("EditorPanel1").insertAdjacentHTML("afterbegin", '<div class="scEditorWarning"><div class="scEditorWarningTitle">The item is locked.</div><div class="scEditorWarningText">Ada has locked it.</div></div>'));
  await expect.poll(said).toBe("The item is locked. Ada has locked it.");
  await page.evaluate(() => (document.querySelector(".scValidationResult").innerHTML = '<img class="scValidationResultIcon" alt="The field Title must have a value.">'));
  await expect.poll(said).toBe("The field Title must have a value.");
  // Ctrl+S, then Sitecore renders the validator panel again
  await page.focus("#FIELD1");
  await page.keyboard.press("Control+s");
  await page.evaluate(() => (document.getElementById("ValidatorPanel1").outerHTML = '<div id="ValidatorPanel1" class="scValidatorPanel"><div class="scValidationResult"><img class="scValidationResultIcon" alt="Validation completed: No errors or warnings."></div></div>'));
  await expect.poll(said).toBe("Saved About");
  // a frame whose top has no region: nothing, no error
  expect(await page.evaluate(() => { const d = document.implementation.createHTMLDocument(""); SCT.announce(d, "x"); return "ok"; })).toBe("ok");
});

test("fields: described by their label, invalid while Sitecore marks them red", async ({ page }) => {
  await page.goto(`${CE}?theme=fjord&needs=screen-reader`);
  await ready(page);
  const field = () => page.evaluate(() => {
    const input = document.getElementById("FIELD1");
    const ids = (input.getAttribute("aria-describedby") || "").split(" ").filter(Boolean);
    return { invalid: input.getAttribute("aria-invalid"), described: ids.map((id) => { const el = document.getElementById(id); return el.getAttribute("aria-label") || el.textContent.trim(); }) };
  });
  await expect.poll(field).toEqual({ invalid: null, described: ["Up to 80 characters.", "Title - Please enter title of the item here:"] });
  // Sitecore's updateFieldMarkers: the marker's class and title, after its validator panel is rendered again
  const mark = (cls, title) => page.evaluate(([c, t]) => {
    const m = document.getElementById("FieldMarkerFIELD1");
    m.className = c;
    m.title = t;
    const p = document.getElementById("ValidatorPanel1");
    p.replaceWith(p.cloneNode(true));
  }, [cls, title]);
  await mark("scEditorFieldMarkerBarCellRed", "Title must have a value.");
  await expect.poll(field).toEqual({ invalid: "true", described: ["Up to 80 characters.", "Title - Please enter title of the item here:", "Title must have a value."] });
  await mark("scEditorFieldMarkerBarCellYellow", "Title is long.");
  await expect.poll(field).toEqual({ invalid: null, described: ["Up to 80 characters.", "Title - Please enter title of the item here:", "Title is long."] });
  await mark("scEditorFieldMarkerBarCell", "");
  await expect.poll(field).toEqual({ invalid: null, described: ["Up to 80 characters.", "Title - Please enter title of the item here:"] });
});

test("where-am-i: the item's path, language and version on one line", async ({ page }) => {
  await page.goto(`${CE}?theme=fjord&needs=low-vision`);
  await ready(page);
  const where = () => page.evaluate(() => document.querySelector(".scEditorHeaderTitlePanel sct-where")?.textContent);
  await expect.poll(where).toBe("/sitecore/content/Home · English · version 1"); // Quick Info's path: names, not display names
  // Sitecore renders the header again for another item
  await page.evaluate(() => (document.querySelector(".scEditorHeaderTitlePanel").innerHTML = '<a role="button" href="#" class="scEditorHeaderTitle">Home</a>'));
  await expect.poll(where).toBe("/sitecore/content/Home · English · version 1");
  // without Quick Info, the tree's path
  await page.evaluate(() => document.querySelector(".scEditorQuickInfo").remove());
  await expect.poll(where).toBe("/sitecore/Content · English · version 1");
  // no active node (search results): the item's name
  await page.evaluate(() => document.querySelector(".scContentTreeNodeActive").classList.replace("scContentTreeNodeActive", "scContentTreeNodeNormal"));
  await page.evaluate(() => document.querySelector(".scEditorHeaderTitlePanel").append(document.createElement("i")));
  await expect.poll(where).toBe("Home · English · version 1");
  expect(await page.evaluate(() => getComputedStyle(document.querySelector("sct-where")).whiteSpace)).toBe("nowrap");
});

test("not-just-colour: a red or yellow field says Error or Warning in words", async ({ page }) => {
  await page.goto(`${CE}?theme=fjord&needs=colour-vision`);
  await ready(page);
  const before = () => page.evaluate(() => getComputedStyle(document.querySelector(".scEditorFieldLabel"), "::before").content);
  const mark = (cls) => page.evaluate((c) => (document.getElementById("FieldMarkerFIELD1").className = c), cls);
  await expect.poll(() => page.evaluate(() => !!document.querySelector("style[data-sct-aids]"))).toBe(true);
  expect(await before()).toBe("none");
  await mark("scEditorFieldMarkerBarCellRed");
  expect(await before()).toBe('"Error: "');
  await mark("scEditorFieldMarkerBarCellYellow");
  expect(await before()).toBe('"Warning: "');
});

test("reduced-motion: animations and transitions end at once", async ({ page }) => {
  await page.goto(`${CE}?theme=fjord&needs=motion`);
  await ready(page);
  await expect.poll(() => page.evaluate(() => getComputedStyle(document.getElementById("Spinner")).animationIterationCount)).toBe("1");
  await expect.poll(() => page.evaluate(() => document.getElementById("Spinner").getAnimations().filter((a) => a.playState === "running").length)).toBe(0);
  expect(await page.evaluate(() => parseFloat(getComputedStyle(document.getElementById("Spinner")).transitionDuration))).toBeLessThan(0.001);
});

test("focus-mode: the field being edited stays bright, the rest fade", async ({ page }) => {
  await page.goto(`${CE}?theme=fjord&needs=reading`);
  await ready(page);
  await expect.poll(() => page.evaluate(() => !!document.querySelector("style[data-sct-aids]"))).toBe(true);
  // a second field, to fade
  await page.evaluate(() => document.querySelector(".scEditorFieldMarker").insertAdjacentHTML("afterend", '<table class="scEditorFieldMarker" id="Other"><tr><td class="scEditorFieldMarkerBarCell"></td><td class="scEditorFieldMarkerInputCell"><div class="scEditorFieldLabel">Text</div><iframe id="FIELD2"></iframe></td></tr></table>'));
  // the field, the other field, a section caption, the ribbon, the search box, an item, the selected item
  const opacity = () => page.evaluate(() => [".scEditorFieldMarker", "#Other", "#Section_Data", "#RibbonPanel", "#SearchPanel", "#Tree_Node_1", ".scContentTreeNodeActive"].map((q) => getComputedStyle(document.querySelector(q)).opacity).join(" "));
  expect(await opacity()).toBe("1 1 1 1 1 1 1");
  await page.focus("#FIELD1");
  await expect.poll(opacity).toBe("1 0.35 0.35 0.35 0.35 0.35 1"); // the tree and the ribbon fade too, but not where you are
  await page.evaluate(() => document.getElementById("FIELD2").contentDocument.body.focus()); // a rich text field is a frame
  await page.evaluate(() => document.getElementById("FIELD2").focus());
  await expect.poll(opacity).toBe("0.35 1 0.35 0.35 0.35 0.35 1");
  await page.evaluate(() => document.activeElement.blur());
  await expect.poll(opacity).toBe("1 1 1 1 1 1 1");
  await page.focus("#TreeSearch"); // in the tree: nothing fades
  await page.waitForTimeout(100);
  expect(await opacity()).toBe("1 1 1 1 1 1 1");
  // no :has(:focus-within) over the page: an element added anywhere would restyle all of it
  expect(await page.evaluate(() => /:has\([^)]*:focus-within/.test(document.querySelector("style[data-sct-aids]").textContent))).toBe(false);
});

test("sticky-header: the item's header stays in view while the fields scroll, fading at its foot", async ({ page }) => {
  await page.goto(`${CE}?theme=fjord&needs=reading`);
  await ready(page);
  await page.evaluate(() => {
    const panel = document.querySelector(".scEditorPanel");
    panel.style.cssText = "height:200px;overflow:auto";
    panel.insertAdjacentHTML("beforeend", '<div style="height:1200px"></div>');
    panel.scrollTop = 500;
  });
  const top = () => page.evaluate(() => Math.round(document.querySelector(".scEditorHeader").getBoundingClientRect().top - document.querySelector(".scEditorPanel").getBoundingClientRect().top));
  await expect.poll(top).toBe(0);
  expect(await page.evaluate(() => getComputedStyle(document.querySelector(".scEditorHeader")).maskImage)).toContain("linear-gradient");
  // edge to edge over the panel's padding, the title where the panel's padding put it
  const span = () => page.evaluate(() => {
    const panel = document.querySelector(".scEditorPanel"), h = panel.querySelector(".scEditorHeader"), p = panel.getBoundingClientRect(), r = h.getBoundingClientRect();
    return { left: Math.round(r.left - p.left - panel.clientLeft), width: Math.round(r.width - panel.clientWidth), title: Math.round(h.querySelector(".scEditorHeaderTitle").getBoundingClientRect().left - p.left - panel.clientLeft) };
  });
  await page.evaluate(() => (document.querySelector(".scEditorPanel").style.padding = "0 14px 0 22px"));
  await page.evaluate(() => document.querySelector(".scEditorPanel").scrollBy(0, 10)); // the aid looks again on a scroll
  await expect.poll(span).toEqual({ left: 0, width: 0, title: 22 });
  // a transition on the header (Reduced motion gives every element one) must not let each scroll add the padding again
  await page.evaluate(async () => {
    const panel = document.querySelector(".scEditorPanel");
    panel.querySelector(".scEditorHeader").style.transition = "padding 1s";
    for (let i = 0; i < 4; i++) { panel.scrollBy(0, 10); await new Promise((r) => setTimeout(r, 50)); }
  });
  await expect.poll(span).toEqual({ left: 0, width: 0, title: 22 });
  await change(page, "accessibility", { site: {} });
  await expect.poll(top).toBeLessThan(-400); // off: it scrolls away with the fields
});

test("sticky-header: the header's fill follows the panel from dark to light and back, so its title stays readable", async ({ page }) => {
  await page.goto(`${CE}?theme=fjord&needs=reading`);
  await ready(page);
  // a theme that leaves the header clear over a glass panel, dark first (as before the light CSS lands)
  const paint = (bg, fg) => page.evaluate(([b, f]) => {
    let s = document.getElementById("look");
    if (!s) document.head.append((s = Object.assign(document.createElement("style"), { id: "look" })));
    s.textContent = `.scEditorPanel{background:${b}} .scEditorHeader{background:transparent} .scEditorHeaderTitle{color:${f}}`;
  }, [bg, fg]);
  await paint("rgba(20, 20, 24, 0.85)", "#f5f5f7");
  await page.evaluate(() => {
    const panel = document.querySelector(".scEditorPanel");
    panel.style.cssText = "height:200px;overflow:auto";
    panel.insertAdjacentHTML("beforeend", '<div style="height:1200px"></div>');
  });
  // the title against the header's fill over the panel (the fields under it are blurred into the panel's colour)
  const contrast = () => page.evaluate(() => {
    const ctx = Object.assign(document.createElement("canvas"), { width: 1, height: 1 }).getContext("2d", { willReadFrequently: true });
    const px = (...cs) => {
      ctx.clearRect(0, 0, 1, 1);
      for (const c of ["#fff", ...cs]) (ctx.fillStyle = c), ctx.fillRect(0, 0, 1, 1);
      return [...ctx.getImageData(0, 0, 1, 1).data].slice(0, 3);
    };
    const lum = (rgb) => rgb.map((v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)).reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0);
    const css = (s) => getComputedStyle(document.querySelector(s));
    const bg = lum(px(css(".scEditorPanel").backgroundColor, css(".scEditorHeader").backgroundColor));
    const fg = lum(px(css(".scEditorHeaderTitle").color));
    return Math.round(((Math.max(bg, fg) + 0.05) / (Math.min(bg, fg) + 0.05)) * 10) / 10;
  });
  const scroll = (y) => page.evaluate((t) => (document.querySelector(".scEditorPanel").scrollTop = t), y);
  await scroll(300);
  await expect.poll(contrast).toBeGreaterThanOrEqual(4.5);
  // a theme switch with the item open and nothing scrolled: its CSS lands, then the host replies
  await paint("rgba(255, 255, 255, 0.84)", "#1d1d1f");
  await change(page, "theme", { theme: "native" });
  await expect.poll(contrast).toBeGreaterThanOrEqual(4.5);
  // the light CSS lands late (or the OS turns light) on the same header, and the fields scroll
  await paint("rgba(20, 20, 24, 0.85)", "#f5f5f7");
  await scroll(450);
  await expect.poll(contrast).toBeGreaterThanOrEqual(4.5);
  await paint("rgba(255, 255, 255, 0.84)", "#1d1d1f");
  await scroll(500);
  await expect.poll(contrast).toBeGreaterThanOrEqual(4.5);
  await paint("rgba(20, 20, 24, 0.85)", "#f5f5f7");
  await scroll(400);
  await expect.poll(contrast).toBeGreaterThanOrEqual(4.5);
});

test("item-info: the chips fill in after the item, the menus copy and open templates, Navigate asks only when pressed", async ({ page }) => {
  const asked = [];
  // Sitecore's version list (one version in master, none in web) and a template's Inheritance tab
  await page.route(/xmlcontrol=Gallery\.Versions/, (route) => {
    const db = /[?&]db=(\w+)/.exec(route.request().url())[1];
    asked.push(`versions ${db}`);
    const rows = db === "web" ? "" : '<tr><td><div class="versionNumSelected">1.</div></td><td><div>Modified <b>4/19/2026 6:21 PM</b> by <b>sitecore\\jsmith</b>.</div></td></tr>';
    route.fulfill({ contentType: "text/html", body: `<form action="/sitecore/shell/default.aspx?xmlcontrol=Gallery.Versions"><table>${rows}</table></form>` });
  });
  await page.route(/xmlcontrol=TemplateInheritance/, (route) => {
    asked.push("inheritance");
    const t = (id, name, path, bases = "") => `<a href="#" class="scTemplate" onclick='javascript:scForm.invoke("Load(\\"${id}\\")"); return false;'><img src="x.png">${name}<span class="scTemplatePath"> - ${path}</span></a><div class="scFields"></div><div class="scBaseTemplates">${bases}</div>`;
    const std = t("{1930BBEB-7805-471A-A3BE-4858AC7CF696}", "Standard template", "/sitecore/Templates/System/Templates/Standard template");
    route.fulfill({ contentType: "text/html", body: `<div id="TemplateList">${t("{11111111-1111-1111-1111-111111111111}", "_Page Base", "/sitecore/Templates/Project/Base/_Page Base", t("{22222222-2222-2222-2222-222222222222}", "_SEO", "/sitecore/Templates/Feature/SEO/_SEO", std))}${std}</div>` });
  });
  await page.goto(`${CE}?theme=fjord`);
  await ready(page);
  // the item as Sitecore keeps it, Quick Info's template row, and the Sheer messages the page posts
  await page.evaluate(() => {
    window.posted = [];
    window.scForm = { postEvent: (el, e, message) => (posted.push(message), false) };
    document.body.insertAdjacentHTML("beforeend", '<input type="hidden" id="__CurrentItem" value="sitecore://master/{110D559F-DEA5-42EA-9C1C-8A5DF7E70EF9}?lang=en&ver=1">');
    document.querySelector(".scEditorQuickInfo tbody, .scEditorQuickInfo").insertAdjacentHTML("beforeend", '<tr><td>Template:</td><td><a href="#" onclick="javascript:scForm.postRequest(\'\',\'\',\'\',\'shell:edittemplate\');return false">/sitecore/templates/Project/Page</a> - <input class="scEditorHeaderQuickInfoInputID" readonly value="{76036F5E-CBCE-46D1-AF0A-4143F9B557AA}"></td></tr>');
  });
  await change(page, "accessibility", { site: { accessibility: { aids: { "item-info": true } } } });
  const chips = () => page.evaluate(() => [...document.querySelectorAll("sct-item-chip")].map((c) => c.textContent.trim()));
  await expect.poll(chips).toEqual([expect.stringMatching(/^\d+ \w+ ago · jsmith$/), "Not published"]);
  expect(await page.evaluate(() => document.querySelector("sct-item-chip").title)).toBe("Modified 4/19/2026 6:21 PM by sitecore\\jsmith");
  expect(asked.sort()).toEqual(["versions master", "versions web"]);

  // Copy, from the keyboard: the item's and the template's names, paths and IDs; Enter copies and closes
  const copy = page.getByRole("button", { name: "Copy" });
  await copy.focus();
  await page.keyboard.press("ArrowDown");
  const menu = page.getByRole("menu", { name: "Copy" });
  await expect(menu.getByRole("menuitem")).toHaveText(["NameHome", "Path/sitecore/content/Home", "ID{110D559F-DEA5-42EA-9C1C-8A5DF7E70EF9}", "NamePage", "Path/sitecore/templates/Project/Page", "ID{76036F5E-CBCE-46D1-AF0A-4143F9B557AA}"]);
  await expect(menu.getByRole("menuitem").first()).toBeFocused();
  await page.keyboard.press("End");
  await expect(menu.getByRole("menuitem").last()).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(menu).toHaveCount(0);
  await expect(copy).toBeFocused();
  expect(await copy.getAttribute("aria-expanded")).toBe("false");

  // Navigate: its template, then the bases that are not Sitecore's own, nested; a pick loads it
  expect(asked).not.toContain("inheritance");
  await page.getByRole("button", { name: "Navigate" }).click();
  const nav = page.getByRole("menu", { name: "Navigate" });
  await expect(nav.getByRole("menuitem")).toHaveText(["PageProject", "_Page BaseProject/Base", "_SEOFeature/SEO"]);
  expect(await nav.getByRole("menuitem").evaluateAll((b) => b.map((x) => x.querySelector("span").style.paddingInlineStart))).toEqual(["", "12px", "24px"]);
  await nav.getByRole("menuitem").nth(2).click();
  await expect(nav).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => posted)).toEqual(["item:load(id={22222222-2222-2222-2222-222222222222})"]);
  // asked once per template
  await page.getByRole("button", { name: "Navigate" }).click();
  await expect(nav.getByRole("menuitem")).toHaveCount(3);
  expect(asked.filter((a) => a === "inheritance")).toHaveLength(1);

  await change(page, "accessibility", { site: {} });
  await expect.poll(() => page.evaluate(() => document.querySelectorAll("sct-item-info, sct-item-menu").length)).toBe(0);
});

test("reading-guide: a band on the pointer's line or the focused one, never in the way", async ({ page }) => {
  await page.goto(`${CE}?theme=fjord&needs=reading`);
  await ready(page);
  await expect.poll(() => page.evaluate(() => !!document.querySelector("sct-guide"))).toBe(true);
  const centre = () => page.evaluate(() => { const r = document.querySelector("sct-guide").getBoundingClientRect(); return Math.round(r.top + r.height / 2); });
  await page.mouse.move(400, 300);
  await expect.poll(centre).toBe(300);
  await page.focus("#FIELD1");
  const field = await page.evaluate(() => { const r = document.getElementById("FIELD1").getBoundingClientRect(); return Math.round(r.top + r.height / 2); });
  await expect.poll(centre).toBe(field);
  expect(await page.evaluate(() => getComputedStyle(document.querySelector("sct-guide")).pointerEvents)).toBe("none");
});

test("quiet-ribbon: hide a group you never use, and bring it back", async ({ page }) => {
  await page.goto(`${CE}?theme=fjord&needs=reading`);
  await ready(page);
  await page.evaluate(() => localStorage.removeItem("sct-quiet-ribbon"));
  const hide = page.getByRole("button", { name: "Hide the Write group" });
  await expect(hide).toHaveCount(1);
  const shown = () => page.evaluate(() => getComputedStyle(document.getElementById("ChunkWrite")).display !== "none");
  await hide.focus();
  await page.keyboard.press("Enter");
  await expect.poll(shown).toBe(false);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("sct-quiet-ribbon")))).toEqual(["ChunkWrite"]);
  // Sitecore renders the ribbon again: still quiet
  await page.evaluate(() => { const s = document.getElementById("RibbonX_Strip_Home"); s.innerHTML = s.innerHTML.replace(/ data-sct-quiet=""/g, ""); });
  await expect.poll(shown).toBe(false);
  await page.getByRole("button", { name: "Show 1 hidden group" }).click();
  await expect.poll(shown).toBe(true);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("sct-quiet-ribbon")))).toEqual([]);
  await expect(page.getByRole("button", { name: /Show \d hidden/ })).toHaveCount(0);
});

test("quiet-ribbon: without storage every group shows", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.addInitScript(() => { Storage.prototype.getItem = () => { throw new Error("blocked"); }; });
  await page.goto(`${CE}?theme=fjord&needs=reading`);
  await ready(page);
  await expect(page.getByRole("button", { name: "Hide the Write group" })).toHaveCount(1);
  expect(await page.evaluate(() => getComputedStyle(document.getElementById("ChunkWrite")).display)).not.toBe("none");
  expect(errors).toEqual([]);
});

test("command-palette: type a command or a path, Enter runs it", async ({ page }) => {
  await page.goto(`${CE}?theme=fjord&needs=keyboard`);
  await ready(page);
  await expect.poll(() => page.evaluate(() => !!document.querySelector("sct-skip"))).toBe(true);
  await page.focus("#FIELD1");
  const palette = page.getByRole("dialog", { name: "Commands" });
  const open = async () => {
    await page.keyboard.press("Control+Shift+Space");
    await expect(palette).toBeVisible();
  };
  await open();
  await page.keyboard.press("Control+Shift+Space"); // once more: still one
  await expect(palette).toHaveCount(1);
  const input = page.getByRole("combobox", { name: "Command or item path" });
  await expect(input).toBeFocused();
  // Sitecore marks the item changed when anything is typed in an input without this class, and then asks to save
  await expect(input).toHaveClass("scIgnoreModified");
  await page.keyboard.type("cop");
  await expect(page.getByRole("option").first()).toHaveText("Copy to · Operations");
  await expect(input).toHaveAttribute("aria-activedescendant", await page.getByRole("option").first().getAttribute("id"));
  await page.keyboard.press("Enter");
  await expect(palette).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => window.copied)).toBe(1);
  await expect(page.locator("#FIELD1")).toBeFocused(); // back where it was
  // a command on a closed tab, which Sitecore keeps as a comment: its tab opens, then it runs
  await open();
  await page.keyboard.type("publish");
  await expect(page.getByRole("option").first()).toHaveText("Publish");
  await page.keyboard.press("Enter");
  await expect.poll(() => page.evaluate(() => window.published)).toBe(1);
  await expect(page.locator("#RibbonX_Strip_Review")).toBeVisible();
  // the item goes through Sitecore's item:load message, not the tree's search box
  await page.evaluate(() => {
    window.posted = [];
    window.scForm = { postEvent: (el, e, message) => (posted.push(message), false) };
    document.body.insertAdjacentHTML("beforeend", '<input type="hidden" id="__CurrentItem" value="sitecore://master/{110D559F-DEA5-42EA-9C1C-8A5DF7E70EF9}?lang=en&ver=1">');
  });
  await open();
  await page.keyboard.type("/sitecore/content");
  await expect(page.getByRole("option").first()).toHaveText("Go to /sitecore/content");
  await page.keyboard.press("Enter");
  await expect.poll(() => page.evaluate(() => window.posted)).toEqual(["item:load(id=/sitecore/content)"]);
  expect(await page.evaluate(() => window.searched)).toBeUndefined();
  await open();
  await page.keyboard.press("Escape");
  await expect(palette).toHaveCount(0);
  // a page with no ribbon
  await page.goto(`${LAUNCHPAD}?theme=fjord&needs=keyboard`);
  await ready(page, "launchpad");
  await expect.poll(() => page.evaluate(() => !!document.querySelector("sct-skip"))).toBe(true);
  await open();
  await expect(palette).toContainText("No commands on this page");
});

test("shortcuts-help: Ctrl+/ lists Sitecore's shortcuts and ours", async ({ page }) => {
  await page.goto(`${CE}?theme=fjord&needs=keyboard`);
  await ready(page);
  await expect.poll(() => page.evaluate(() => !!document.querySelector("sct-skip"))).toBe(true);
  await page.focus("#FIELD1");
  await page.keyboard.press("Control+/");
  const help = page.getByRole("dialog", { name: "Keyboard shortcuts" });
  await expect(help).toBeVisible();
  const rows = await help.locator("tr").allInnerTexts();
  for (const row of ["Ctrl+S\tSave", "Alt+H\tHome tab", "Alt+F1\tShow the ribbon's key hints", "Ctrl+Shift+Space\tCommand palette", "F6\tNext part of the page"]) expect(rows).toContain(row);
  expect(rows.join("\n")).not.toContain("???");
  await page.keyboard.press("Escape");
  await expect(help).toHaveCount(0);
  await expect(page.locator("#FIELD1")).toBeFocused();
});

test("shortcuts-help: Ctrl+Minus on a layout where it sits at the US slash key still zooms", async ({ page }) => {
  await page.goto(`${CE}?theme=fjord&needs=keyboard`);
  await ready(page);
  await expect.poll(() => page.evaluate(() => !!document.querySelector("sct-skip"))).toBe(true);
  // a German keyboard: the key in the US slash position types "-"
  const prevented = await page.evaluate(() => {
    const e = new KeyboardEvent("keydown", { key: "-", code: "Slash", ctrlKey: true, bubbles: true, cancelable: true });
    document.body.dispatchEvent(e);
    return e.defaultPrevented;
  });
  expect(prevented).toBe(false);
  await expect(page.getByRole("dialog", { name: "Keyboard shortcuts" })).toHaveCount(0);
});

test("menus: focus inside an open submenu stays there", async ({ page }) => {
  await page.goto(`${CE}?theme=fjord&needs=keyboard`);
  await ready(page);
  await page.focus("#OpenMenu");
  await page.keyboard.press("Enter");
  await expect.poll(() => page.evaluate(() => document.activeElement.id)).toBe("MenuInsert");
  // Sitecore opens a submenu as a popup of its own beside the first, focus still on its parent item; the aid moves in
  await page.evaluate(() => {
    const sub = document.createElement("div");
    sub.className = "scPopup";
    sub.innerHTML = '<table class="scMenu" role="menu"><tbody><tr role="menuitem" id="SubItem"><td>Sample Item</td></tr></tbody></table>';
    document.forms[0].append(sub);
  });
  await expect.poll(() => page.evaluate(() => document.activeElement.id)).toBe("SubItem");
  // any later change to the page: focus does not move, not even to the parent menu and back (a screen reader says each)
  await page.evaluate(() => { window.moves = 0; document.addEventListener("focusin", () => window.moves++); document.body.append(document.createElement("i")); });
  await page.waitForTimeout(150);
  expect(await page.evaluate(() => [document.activeElement.id, window.moves])).toEqual(["SubItem", 0]);
});

test("names and aria-repair never take turns on one image's alt", async ({ page }) => {
  await page.goto(`${CE}?theme=fjord`);
  await ready(page);
  // a tab stop marked decorative inside a link that says the same: aria-repair names it, names must leave it
  await expect.poll(() => page.evaluate(() => document.getElementById("LockIcon").alt)).toBe("Lock");
  await page.evaluate(() => document.body.append(document.createElement("i")));
  await page.waitForTimeout(150);
  expect(await page.evaluate(() => document.getElementById("LockIcon").alt)).toBe("Lock");
});

test("ribbon-toolbar: a click in the strip leaves focus where it clicked", async ({ page }) => {
  await page.goto(`${CE}?theme=fjord&needs=keyboard`);
  await ready(page);
  await expect.poll(() => page.evaluate(toolbar)).toBe("tabpanel,RibbonX_Nav_Home,2");
  await page.focus("#RibbonX_Nav_Home");
  await page.keyboard.press("Tab"); // Save
  await page.keyboard.press("Tab"); // out
  await page.click(".scRibbonToolbarSmallButton");
  expect(await page.evaluate(() => document.activeElement.textContent.trim())).toBe("Copy to");
});

test("menus: Enter on Start goes to its first entry; arrows, Right into a folder, Left and Escape back out", async ({ page }) => {
  await page.goto(`${DESKTOP}?theme=fjord&needs=screen-reader`);
  await ready(page);
  const at = () => page.evaluate(() => document.activeElement.id);
  await expect.poll(() => page.evaluate(() => document.querySelector(".sc-global-logo").getAttribute("aria-label"))).toBe("Launchpad");
  await page.focus("#StartButton");
  await page.keyboard.press("Enter"); // Sitecore's Start has no key handler of its own
  await expect.poll(at).toBe("OptionCE");
  expect(await page.evaluate(() => [document.querySelector(".scStartMenu").getAttribute("role"), document.getElementById("Folder").getAttribute("aria-haspopup")])).toEqual(["menu", "menu"]);
  await page.keyboard.press("ArrowDown");
  expect(await at()).toBe("OptionML");
  await page.keyboard.press("End");
  expect(await at()).toBe("Folder");
  await page.keyboard.press("ArrowRight");
  await expect.poll(at).toBe("SubItem");
  await page.keyboard.press("ArrowLeft"); // the submenu closes, Start stays open
  await expect.poll(at).toBe("Folder");
  expect(await page.evaluate(() => document.querySelectorAll(".scPopup").length)).toBe(1);
  await page.keyboard.press("Escape");
  await expect.poll(at).toBe("StartButton");
  expect(await page.evaluate(() => document.querySelectorAll(".scPopup").length)).toBe(0);
});

test("tab-stops: no stop on the idle dialog frame, the splitter, the gutter or a field's label; Enter on Content goes to the first field", async ({ page }) => {
  await page.goto(`${DESKTOP}?theme=fjord&needs=screen-reader,keyboard`);
  await ready(page);
  const frame = () => page.evaluate(() => { const f = document.getElementById("jqueryModalDialogsFrame"); return [f.getAttribute("tabindex"), f.getAttribute("aria-hidden")]; });
  await expect.poll(frame).toEqual(["-1", "true"]);
  await page.evaluate(() => (document.getElementById("jqueryModalDialogsFrame").style.zIndex = "1000")); // a dialog comes up
  await expect.poll(frame).toEqual([null, null]);
  expect(await page.evaluate(() => [...document.querySelectorAll("sct-skip button")].map((b) => b.textContent))).toEqual(["Skip to Taskbar"]); // the Desktop is empty

  await page.goto(`${CE}?theme=fjord`);
  await ready(page);
  await page.evaluate(() => {
    document.getElementById("ContentTreePanel").insertAdjacentHTML("afterend", '<div class="splitter-bar"><a accesskey="" tabindex="0" id="Splitter"></a></div>');
    document.getElementById("Gutter2").innerHTML = '<a href="#" id="GutterIcon" title="Workflow: Draft"><img src="/sitecore/images/blank.gif" alt="Workflow: Draft"></a>';
    document.querySelector(".scEditorFieldMarker").insertAdjacentHTML("afterend", '<table class="scEditorFieldMarker"><tr><td class="scEditorFieldMarkerInputCell"><div class="scEditorFieldLabel"><a href="#" class="scEditorFieldLabelLink" id="CheckLabel">Hidden - Hide the item</a></div><div class="scCheckBox"><input id="Check" type="checkbox" class="scContentControlCheckbox"></div></td></tr></table>'
      + '<table><tr><td><input role="combobox" id="Combo" class="scComboboxEdit" readonly></td><td><img src="/sitecore/images/blank.gif" id="ComboArrow" class="scComboboxDropDown" alt="Show options" role="button" tabindex="0" onclick="void 0"></td></tr></table>');
  });
  await change(page, "accessibility", { site: { accessibility: { needs: ["screen-reader"] } } });
  const out = () => page.evaluate(() => ["Splitter", "GutterIcon", "CheckLabel", "ComboArrow"].map((id) => document.getElementById(id).tabIndex));
  await expect.poll(out).toEqual([-1, -1, -1, -1]);
  await page.focus("#BContent");
  await page.keyboard.press("Enter");
  expect(await page.evaluate(() => document.activeElement.id)).toBe("FIELD1");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab"); // the checkbox, then the drop-down: one stop each
  expect(await page.evaluate(() => document.activeElement.id)).toBe("Combo");
  await change(page, "accessibility", { site: {} }); // the stops come back
  await expect.poll(out).toEqual([0, 0, 0, 0]);
});
