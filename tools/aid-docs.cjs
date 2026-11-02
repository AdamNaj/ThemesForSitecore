// docs/accessibility.md's and docs/ui-improvements.md's generated parts: for every accessibility aid and UI improvement
// (settings.js AIDS; the improvements, ui: true, on the second page) and reading setting, what
// changes when it is on, shot off and on in the live 10.4 Content Editor (or, for an aid with nothing to see, what a
// screen reader is given), written between its <!-- shots:<id> --> markers, and its section stamped with a hash of
// the aid's code (<!-- aid:<id> <hash> -->), which test/unit/docs.test.js checks. The prose around them is written
// by hand. Uses a copy of .auth/profile, one browser for the whole run.
// usage: node tools/aid-docs.cjs [id ...]          (none: every aid and setting)
//        node tools/aid-docs.cjs --stamp [id ...]  (stamps only: the prose changed, the pictures did not)
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
// the page a scene's section is on (by its id, or the aid it shows), and its pictures' folder beside it
const PAGES = ["accessibility", "ui-improvements"];
const pageOf = (id) => (AIDS[(SCENES[id] && SCENES[id].aid) || id]?.ui ? "ui-improvements" : "accessibility");
const DOC = (page) => path.join(ROOT, "docs", `${page}.md`);
const IMAGES = (page) => path.join(ROOT, "docs", page);
const { AIDS, NEEDS } = require(path.join(ROOT, "extension/lib/settings.js"));

// what an aid's section says about it: a change to either means the section needs a look
function stamp(id) {
  const code = fs.readFileSync(path.join(ROOT, "extension/lib/aids", `${id}.js`), "utf8").replace(/\r\n/g, "\n");
  return crypto.createHash("sha1").update(code + JSON.stringify(AIDS[id])).digest("hex").slice(0, 10);
}

const HOME = "{110D559F-DEA5-42EA-9C1C-8A5DF7E70EF9}";
const MEDIA = "{3D6658D8-A0BF-4E75-B3E2-D050FABCF4E1}";
const SYSTEM = "{13D6D6C6-C50B-4BBD-B331-2B04F1A58F21}";
const CE = (item) => `/sitecore/shell/Applications/Content%20Editor.aspx?sc_bw=1&fo=${encodeURIComponent(item)}`;
// three groups of the Home strip, on 10.4
const QUIET = ["C28353D7ACFCA49B5B344C3A97415C89B", "C373217F6FC5C4BEBB5D9435B8C37D539", "CB91973ACF8C344B7AB8ED6E3ADF4CF7A"];

// stock 10.4's /sitecore/media library/Default Website/cover, put in Home's first Image field through its Browse button
// and the media browser's result, as a pick does; never saved
const COVER = "{04DAD0FD-DB66-4070-881F-17264CA257E1}";
async function pickImage(page) {
  await page.evaluate(() => [...document.querySelectorAll("a.scContentButton")].find((a) => (a.getAttribute("onclick") || "").includes("contentimage:open(")).click());
  for (let i = 0; i < 30; i++) {
    await page.waitForTimeout(1000);
    const host = page.frames().find((f) => /JqueryModalDialogs/i.test(f.url()));
    const picked = host && (await host.evaluate((id) => {
      if (!document.querySelector(".ui-dialog iframe")) return false;
      window.top.returnValue = id;
      window.top.dialogClose();
      return true;
    }, COVER).catch(() => false));
    if (picked) break;
  }
  await page.waitForTimeout(3000);
  await page.locator(".scContentControlImagePane").first().scrollIntoViewIfNeeded();
}

const focusFirstField = (page) => page.locator(".scEditorFieldMarker input.scContentControl").first().focus();
const focusTree = (page) => page.locator(".scContentTreeNodeActive").first().focus();

// One scene per aid or setting. path: the page; setup(page): what to do before looking; then one of
// shot: where to clip (a selector, around which `pad` px; the clip found with it on frames the off shot too, unless
// `own`: each state its own, for a setting that moves things), theme: the site's theme (Native, Sitecore's own look, by default),
// also: other aids on in both states, one this aid works through; aid: the aid a second scene of it shows
// aria: a selector whose accessibility tree is shown, attrs: [selector, attributes] in every frame, focus: where
// focus is, text: a selector's text, none: why there is nothing to show. access: a reading setting's value.
const SCENES = {
  "frame-titles": { path: CE(MEDIA), attrs: ["iframe", ["src", "title"]] },
  "aria-repair": { path: CE(HOME), aria: "#ContentTreeInnerPanel", lines: 10 },
  names: { path: CE(HOME), attrs: ["#BTAddNewSearch, .scEditorQuickInfo input", ["id", "class", "aria-label"]] },
  landmarks: { path: CE(HOME), attrs: ["#ContentTreePanel, #ContentEditor", ["id", "role", "aria-label"]] },
  lang: { path: CE(HOME), run: () => [`<html${document.documentElement.lang ? ` lang="${document.documentElement.lang}"` : ""}>`] },
  "forced-colors": { path: CE(HOME), media: { forcedColors: "active" }, shot: "#ContentTreeInnerPanel, #EditorTabs, .scRibbonNavigatorButtonsGroupButtons", max: [760, 380] },
  "focus-ring": { none: "Stock Sitecore and most themes already outline most focused elements, so a picture of one shows no change: this aid makes sure every one does, under every theme, and 3px wide with the Low vision need." },
  "ribbon-toolbar": { path: CE(HOME), setup: (page) => page.locator(".scRibbonToolbarLargeButton").first().focus(), focus: true, aria: ".scRibbonToolbarStrip >> visible=true", lines: 6 },
  "tree-keys": { path: CE(SYSTEM), setup: async (page) => { await page.locator(".scContentTreeNodeActive").first().click(); await page.waitForTimeout(1200); await page.keyboard.press("ArrowRight"); await page.waitForTimeout(2000); await page.keyboard.type("te"); }, shot: ".scContentTreeContainer", max: [300, 560] },
  menus: { none: "Menu focus moves keyboard focus, which a still picture cannot show: open a ribbon drop-down with Enter, and with the aid on its first item has focus." },
  dialogs: { path: CE(HOME), setup: async (page) => { await focusTree(page); await page.keyboard.press("F2"); await page.waitForTimeout(3000); }, attrs: [".ui-dialog-title", ["id", "aria-label"]], after: async (page) => { await page.keyboard.press("Escape"); await page.waitForTimeout(1000); } },
  "tab-stops": {
    path: CE(HOME),
    also: ["names"], // which makes the arrows buttons
    run: () => [...document.querySelectorAll(".splitter-bar > a, .scEditorFieldLabel a, img.scComboboxDropDown")].filter((el) => !el.matches("img") || el.closest("tr")?.querySelector("input[role=combobox]")).slice(0, 5)
      .map((el) => `${el.parentElement.matches(".splitter-bar") ? "the splitter" : el.matches("img") ? "a drop-down's arrow" : `the label "${el.textContent.trim().replace(/ - .*/, "")}"`}: ${el.tabIndex < 0 ? "no Tab stop" : "a Tab stop"}`),
  },
  regions: { path: CE(HOME), also: ["landmarks"], setup: async (page) => { await page.evaluate(() => document.activeElement?.blur()); await page.keyboard.press("Tab"); }, shot: "sct-skip", pad: 8, max: [420, 200] },
  targets: { none: "Bigger targets changes where a click lands, which a still picture cannot show: nothing on screen moves or looks different. Click just left of or below a tree expander, and the item expands." },
  announcer: { path: CE(HOME), setup: async (page) => { await page.locator('a[id^="Tree_Node_"]', { hasText: /^Content$/ }).first().click(); await page.waitForTimeout(3000); }, text: "sct-announce" },
  fields: {
    path: CE(HOME),
    run: () => [...document.querySelectorAll(".scEditorFieldMarkerInputCell")].slice(0, 3).map((cell) => {
      const c = cell.querySelector("input, textarea, iframe, select");
      const desc = (c?.getAttribute("aria-describedby") || "").split(/\s+/).filter(Boolean).map((id) => document.getElementById(id)?.textContent.trim()).filter(Boolean);
      return `${c?.getAttribute("aria-label") || c?.title || c?.id}: ${desc.length ? `described as "${desc.join(" ")}"` : "no description"}`;
    }),
  },
  // the same aid in the editor: a click where nothing takes focus, then letters
  "field-search": { aid: "tree-keys", title: "Type to search, in the editor", path: CE(HOME), setup: async (page) => { const r = await page.locator(".scEditorPanel").first().boundingBox(); await page.mouse.click(r.x + r.width - 30, r.y + 60); await page.keyboard.type("dis"); }, shot: "#ContentEditor", max: [760, 620] },
  "where-am-i": { path: CE(HOME), shot: ".scEditorHeader", pad: 6, max: [700, 140] },
  "not-just-colour": {
    path: CE(HOME),
    // a field as Sitecore marks one that fails validation
    setup: (page) => page.evaluate(() => { const td = document.querySelector(".scEditorFieldMarkerBarCell"); td.className = "scEditorFieldMarkerBarCellRed"; td.title = "Title must not be empty."; }),
    caption: "The field is marked as Sitecore marks one that fails validation.",
    shot: ".scEditorFieldMarker", pad: 6, max: [700, 120],
  },
  "state-shapes": {
    path: CE(HOME),
    // the first two fields marked as Sitecore marks an error and a warning
    setup: (page) => page.evaluate(() => {
      const [error, warning] = document.querySelectorAll(".scEditorFieldMarkerBarCell");
      error.className = "scEditorFieldMarkerBarCellRed";
      warning.className = "scEditorFieldMarkerBarCellYellow";
    }),
    caption: "Title marked as Sitecore marks an error, Text as it marks a warning.",
    shot: ".scEditorFieldMarker:has(td:is(.scEditorFieldMarkerBarCellRed, .scEditorFieldMarkerBarCellYellow))", pad: 6, max: [760, 330],
  },
  "reduced-motion": { none: "Motion does not show in a still picture: with the aid on, Sitecore's and the theme's animations and transitions jump straight to their end." },
  "focus-mode": { path: CE(HOME), setup: focusFirstField, shot: "#RibbonPanel, :focus", pad: 20, max: [1000, 440] },
  "sticky-header": { path: CE(HOME), setup: (page) => page.evaluate(() => (document.querySelector(".scEditorPanel").scrollTop = 420)), shot: ".scEditorPanel", max: [760, 300] },
  "item-info": {
    path: CE(HOME),
    // on: the pills filled in and the Navigate menu open below them
    setup: async (page) => {
      if (!(await page.waitForSelector("sct-item-info", { timeout: 5000 }).catch(() => null))) return;
      await page.waitForFunction(() => !document.querySelector("sct-item-status[aria-busy]"), null, { timeout: 15000 });
      await page.locator("sct-item-actions button").nth(1).click();
      await page.waitForFunction(() => document.querySelector("sct-item-menu") && !document.querySelector("sct-item-menu sct-item-note"), null, { timeout: 15000 });
    },
    shot: ".scEditorHeader, sct-item-menu", pad: 6, max: [900, 330], after: (page) => page.keyboard.press("Escape"),
  },
  "content-tab": { path: CE(MEDIA), shot: "#EditorTabs", padBelow: 220, max: [700, 260] },
  "ce-state": { none: "Remember Content Editor state changes where the Content Editor opens, which a still picture cannot show: close it on an item, open it again from the Launchpad or the Desktop, and it is back on that item." },
  "ee-state": { none: "Remember Experience Editor state changes which page the Experience Editor opens on, which a still picture cannot show: leave it on a page, open it again from the Launchpad, and it is back on that page." },
  "section-toggle": { path: CE(HOME), shot: "#EditorTabs", padBelow: 220, max: [800, 300] },
  "image-preview": {
    path: CE(HOME),
    setup: async (page) => { await page.evaluate(() => localStorage.setItem("sct-image-preview", JSON.stringify({ mode: "cover", height: 220 }))); await pickImage(page); },
    caption: "On, the preview dragged to 220px and set to Fill.",
    own: true, shot: ".scContentControlImagePane", pad: 6, max: [900, 360],
    after: (page) => page.evaluate(() => localStorage.removeItem("sct-image-preview")),
  },
  // Home's Title, on Sample Item, has stock 10.4's Max Length 40 rule on its Validator Bar; typed past it, never saved
  "field-length": {
    path: CE(HOME),
    setup: async (page) => {
      const title = page.getByRole("textbox", { name: "Title field" });
      await page.waitForSelector("[data-sct-length]", { timeout: 8000 }).catch(() => {});
      await title.click();
      await page.keyboard.press("End");
      await page.keyboard.type(", version 10.4");
    },
    caption: "On, the title typed two characters past its Max Length 40 rule.",
    shot: ".scEditorFieldMarker:has(input[aria-label^='Title field'])", pad: 6, max: [900, 120],
  },
  // Home's Title typed past its Max Length 40 rule, validated on leaving the field, then its Data section closed
  // (opened again after, since Sitecore keeps the user's closed sections); never saved
  "section-issues": {
    path: CE(HOME),
    setup: async (page) => {
      await page.getByRole("textbox", { name: "Title field" }).click();
      await page.keyboard.press("End");
      await page.keyboard.type(", version 10.4 and some more words");
      await page.locator(".scEditorHeader").first().click();
      await page.waitForSelector(".scEditorFieldMarkerBarCellRed", { timeout: 15000 }).catch(() => {});
      await page.locator(".scEditorSectionCaptionExpanded[id^='Section_Data']").click();
      await page.waitForTimeout(600);
    },
    caption: "The Data section closed, its Title typed past its Max Length 40 rule.",
    shot: "[id^='Section_Data']", pad: 6, max: [900, 80],
    after: (page) => page.locator(".scEditorSectionCaptionCollapsed[id^='Section_Data']").click(),
  },
  // Home as Sitecore draws an item someone else has locked: its warning (Sitecore's markup) and its fields read-only
  "locked-fields": {
    path: CE(HOME),
    setup: (page) => page.evaluate(() => {
      document.querySelector("[id^='Section_']").insertAdjacentHTML("beforebegin", '<div class="scEditorWarning"><table><tr><td><img src="/sitecore/shell/themes/standard/Images/warning_yellow.png" width="32" height="32"></td><td><div class="scEditorWarningTitle">You cannot edit this item because Editor has locked it.</div><div class="scEditorWarningHelp">An administrator can unlock it.</div></td></tr></table></div>');
      for (const input of document.querySelectorAll(".scEditorSections input.scContentControl")) input.readOnly = true;
    }),
    caption: "Home drawn as Sitecore draws an item someone else has locked.",
    shot: ".scEditorWarning, .scEditorFieldMarker:has(input[readonly])", pad: 6, max: [1100, 260],
  },
  "reading-guide": { path: CE(HOME), setup: async (page) => { const r = await page.locator(".scEditorFieldLabel").first().boundingBox(); await page.mouse.move(r.x + 20, r.y + r.height / 2); await page.waitForTimeout(300); }, shot: ".scEditorFieldLabel", pad: 80, max: [700, 200] },
  "quiet-ribbon": { path: CE(HOME), setup: async (page) => { await page.evaluate((ids) => localStorage.setItem("sct-quiet-ribbon", JSON.stringify(ids)), QUIET); await page.reload({ waitUntil: "domcontentloaded" }); await settle(page); await page.locator(".scRibbonToolbarStrip .chunk >> visible=true").first().hover(); }, shot: "#RibbonPanel", max: [800, 160] },
  "command-palette": { path: CE(HOME), setup: async (page) => { await focusTree(page); await page.keyboard.press("Control+Shift+Space"); await page.waitForTimeout(500); await page.keyboard.type("publish"); }, shot: "sct-dialog", pad: 12, after: (page) => page.keyboard.press("Escape") },
  "shortcuts-help": { path: CE(HOME), setup: async (page) => { await focusTree(page); await page.keyboard.press("F1"); await page.waitForTimeout(500); }, shot: "sct-dialog", pad: 12, after: (page) => page.keyboard.press("Escape") },
  // the reading settings, beside the aids
  "font-hyperlegible": { title: "Atkinson Hyperlegible", access: { font: "hyperlegible" }, path: CE(HOME), own: true, shot: ".scEditorFieldMarker", pad: 50, max: [700, 200] },
  "font-opendyslexic": { title: "OpenDyslexic", access: { font: "opendyslexic" }, path: CE(HOME), own: true, shot: ".scEditorFieldMarker", pad: 50, max: [700, 200] },
  spacing: { title: "Wide spacing", access: { spacing: "wide" }, path: CE(HOME), own: true, shot: ".scEditorFieldMarker", pad: 50, max: [700, 200] },
  vision: { title: "Colour filter", access: { vision: "deuteranopia", strength: 100 }, path: CE(HOME), caption: "Deuteranopia at full strength. To someone without the deficiency the picture looks shifted; to someone with it, colours that ran together come apart.", shot: "#RibbonPanel, #ContentTreeInnerPanel", max: [760, 360] },
};

async function settle(page) {
  await page.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(2500);
}

// the clip round a scene's elements, kept inside the page and within its max size
async function clipOf(page, s) {
  const r = await page.evaluate((sel) => {
    const rects = [...document.querySelectorAll(sel)].map((e) => e.getBoundingClientRect()).filter((b) => b.width && b.height);
    if (!rects.length) return null;
    return { l: Math.min(...rects.map((b) => b.left)), t: Math.min(...rects.map((b) => b.top)), r: Math.max(...rects.map((b) => b.right)), b: Math.max(...rects.map((b) => b.bottom)), w: innerWidth, h: innerHeight };
  }, s.shot);
  if (!r) throw new Error(`nothing matches ${s.shot}`);
  const pad = s.pad || 0;
  const x = Math.max(0, Math.floor(r.l - pad));
  const y = Math.max(0, Math.floor(r.t - pad));
  const [mw, mh] = s.max || [760, 420];
  const width = Math.min(mw, r.w - x, Math.ceil(r.r + pad - x));
  const height = Math.min(mh, r.h - y, Math.ceil(r.b + pad + (s.padBelow || 0) - y));
  return { x, y, width, height };
}

// what a screen reader is given: the attributes of the matching elements, in every frame
async function attrsOf(page, [selector, names]) {
  const lines = [];
  for (const frame of page.frames()) {
    const found = await frame.evaluate(([sel, names]) => [...document.querySelectorAll(sel)].slice(0, 6).map((el) => {
      const parts = names.filter((n) => el.hasAttribute(n)).map((n) => {
        let v = el.getAttribute(n);
        if (n === "src") v = decodeURIComponent(v.split("?")[0]).split("/").pop();
        if (n === "class") v = v.split(/\s+/)[0];
        return `${n}="${v}"`;
      });
      return `<${el.tagName.toLowerCase()}${parts.length ? " " + parts.join(" ") : ""}>`;
    }), [selector, names]).catch(() => []);
    lines.push(...found);
  }
  return lines;
}

async function look(page, s, clip, file) {
  if (s.shot) {
    clip = clip || (await clipOf(page, s));
    await page.screenshot({ path: file, clip });
    return { clip, image: path.basename(file), width: clip.width };
  }
  const lines = [];
  if (s.focus) lines.push(`Focus: ${await page.evaluate(() => { const a = document.activeElement; const role = a.getAttribute("role") || a.tagName.toLowerCase(); const name = (a.getAttribute("aria-label") || a.alt || a.title || a.textContent || "").replace(/\s+/g, " ").trim().slice(0, 40); return a === document.body ? "nowhere (the page)" : `${role} "${name}"`; })}`);
  if (s.aria) lines.push(...(await page.locator(s.aria).first().ariaSnapshot()).split("\n").slice(0, s.lines || 12));
  if (s.attrs) lines.push(...(await attrsOf(page, s.attrs)));
  if (s.text) lines.push(`Said: ${(await page.evaluate((sel) => document.querySelector(sel)?.textContent.trim(), s.text)) || "nothing"}`);
  if (s.run) lines.push(...(await page.evaluate(s.run)));
  return { lines };
}

const SURFACES = { shell: "the Desktop and Content Editor", speak: "SPEAK apps", launchpad: "the Launchpad", admin: "/sitecore/admin", login: "the login pages", ee: "the Experience Editor" };
const list = (xs) => (xs.length > 1 ? `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}` : xs[0]);

function facts(id) {
  const aid = AIDS[id];
  if (!aid) return "";
  const needs = list(aid.needs.map((n) => NEEDS[n]));
  const where = `**Where:** ${aid.surfaces ? list(aid.surfaces.map((x) => SURFACES[x])) : "every page"}`;
  if (aid.ui) return `**On:** ${aid.always ? "by default, under every theme and Native" : "once switched on under UI improvements"} · ${where}`;
  const runs = aid.always ? "by default, under every theme and Native" :`with the ${needs} need${aid.needs.length > 1 ? "s" : ""}, or on its own under Fine-tune`;
  return `**Need:** ${needs} · **On:** ${runs} · ${where}`;
}

function block(id, s, off, on) {
  const out = [facts(id)].filter(Boolean);
  if (s.none) out.push(`_${s.none}_`);
  else if (on.image) {
    const name = s.title || AIDS[id].name;
    const img = (r, state) => `![${name}, ${state}](${pageOf(id)}/${r.image})`;
    if (on.width <= 380) out.push(`| Off | On |\n|---|---|\n| ${img(off, "off")} | ${img(on, "on")} |`);
    else out.push(`**Off**\n\n${img(off, "off")}\n\n**On**\n\n${img(on, "on")}`);
  } else {
    out.push(`**Off**\n\n\`\`\`text\n${off.lines.join("\n") || "(nothing)"}\n\`\`\`\n\n**On**\n\n\`\`\`text\n${on.lines.join("\n") || "(nothing)"}\n\`\`\``);
  }
  if (s.caption) out.push(`_${s.caption}_`);
  return out.join("\n\n");
}

function write(doc, id, body) {
  const re = new RegExp(`<!-- shots:${id} -->[\\s\\S]*?<!-- /shots:${id} -->`);
  if (!re.test(doc)) throw new Error(`docs/${pageOf(id)}.md has no <!-- shots:${id} --> block`);
  doc = doc.replace(re, () => `<!-- shots:${id} -->\n${body}\n<!-- /shots:${id} -->`);
  if (AIDS[id]) {
    const mark = new RegExp(`<!-- aid:${id}( [0-9a-f]*)? -->`);
    if (!mark.test(doc)) throw new Error(`docs/${pageOf(id)}.md has no <!-- aid:${id} --> stamp`);
    doc = doc.replace(mark, `<!-- aid:${id} ${stamp(id)} -->`);
  }
  return doc;
}

async function main() {
  const args = process.argv.slice(2);
  const stampOnly = args.includes("--stamp");
  const ids = args.filter((a) => !a.startsWith("--"));
  const todo = ids.length ? ids : Object.keys(SCENES);
  for (const id of todo) if (!SCENES[id]) throw new Error(`no scene for ${id}; add one to SCENES`);
  const docs = Object.fromEntries(PAGES.map((p) => [p, fs.readFileSync(DOC(p), "utf8")]));
  if (stampOnly) {
    // the stamp, and the facts line at the top of its pictures, which come from AIDS alone
    for (const id of todo.filter((i) => AIDS[i])) {
      const p = pageOf(id);
      docs[p] = docs[p].replace(new RegExp(`<!-- aid:${id}( [0-9a-f]*)? -->`), `<!-- aid:${id} ${stamp(id)} -->`)
        .replace(new RegExp(`(<!-- shots:${id} -->\n)(?:\\*\\*(?:Need|On):\\*\\*.*)`), (m, open) => open + facts(id));
    }
    for (const p of PAGES) fs.writeFileSync(DOC(p), docs[p]);
    return;
  }
  const { extensionCopy, launchWithExtension } = require(path.join(ROOT, "test/e2e/helpers.js"));
  const { HOSTS, IDENTITY, PROFILE } = require(path.join(ROOT, "test/e2e/sitecore-env.js"));
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "sct-aid-docs-"));
  const skip = /[\\/](Cache|Code Cache|GPUCache|Service Worker)([\\/]|$)|[\\/]Singleton[^\\/]*$/;
  fs.cpSync(PROFILE, profile, { recursive: true, filter: (src) => !skip.test(src) });
  const origins = [...Object.values(HOSTS), ...IDENTITY];
  const { context, worker } = await launchWithExtension(extensionCopy(origins.map((o) => `${o}/*`)), profile, { viewport: { width: 1100, height: 700 } });
  const page = await context.newPage();
  for (const p of PAGES) fs.mkdirSync(IMAGES(p), { recursive: true });
  const failed = [];
  for (const id of todo) {
    const s = SCENES[id];
    try {
      const shots = {};
      if (!s.none) {
        // on first: the clip found with it on frames the off shot too
        for (const state of ["on", "off"]) {
          const access = s.access ? (state === "on" ? s.access : {}) : { aids: { ...Object.fromEntries((s.also || []).map((a) => [a, true])), [s.aid || id]: state === "on" } };
          await worker.evaluate(([o, a, t]) => chrome.storage.sync.set({ overrides: Object.fromEntries(o.map((x) => [x, t])), accessibility: Object.fromEntries(o.map((x) => [x, a])) }), [origins, access, s.theme || "native"]);
          await page.emulateMedia({ forcedColors: s.media?.forcedColors || "none" });
          await page.goto(HOSTS["10.4"] + s.path, { waitUntil: "domcontentloaded", timeout: 60000 });
          await settle(page);
          if (/\/Account\/Login|\/sitecore\/login/i.test(page.url())) throw new Error("landed on the login page: ask the user to run node test/e2e/login.mjs");
          if (s.setup) await s.setup(page);
          await page.waitForTimeout(400);
          shots[state] = await look(page, s, !s.own && shots.on && shots.on.clip, path.join(IMAGES(pageOf(id)), `${id}-${state}.png`));
          if (s.after) await s.after(page);
        }
      }
      docs[pageOf(id)] = write(docs[pageOf(id)], id, block(id, s, shots.off, shots.on));
      console.log(`${id}: done`);
    } catch (e) {
      failed.push(`${id}: ${e.message.split("\n")[0]}`);
    }
  }
  await context.close();
  for (const p of PAGES) fs.writeFileSync(DOC(p), docs[p]);
  if (failed.length) {
    console.error(`not shot:\n  ${failed.join("\n  ")}`);
    process.exitCode = 1;
  }
}

if (require.main === module) main();
module.exports = { stamp, SCENES, pageOf };
