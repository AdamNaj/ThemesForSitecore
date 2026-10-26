// Opens each kind of Sitecore menu, one at a time, and scans and screenshots it while it is open: menus only
// exist while open, so shots.cjs --scan never sees them. Exits 1 if a menu scrolls while it still has room to
// grow (a `scroll` finding, see scan.cjs; popups are also checked for a sub-pixel overflow, which shows a
// scrollbar at some zoom levels and click positions), or if a menu could not be opened twice running.
// usage: node .claude/skills/sct-verify/menus.cjs --themes notebook,cupertino [--versions 10.5,10.4]
//          [--scale 1.25] [--out test-results/verify] [--only tree,start] [--colours olive]
// Menus: the Content Editor tree's context menu and its Insert fly-out, ribbon drop-downs (Edit's gallery,
// Duplicate's menu), the Insert gallery's "more" pop-up, the language and version galleries; the Desktop's
// start menu and a fly-out, and the taskbar's context menu on a running app (the Workbox).
// A menu's findings are the ones that appear while it is open and not before, so the page's own show only once.
// Uses a copy of .auth/profile (the shared sign-in), never the profile itself.
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const ROOT = path.join(__dirname, "..", "..", "..");
const { extensionCopy, launchWithExtension } = require(path.join(ROOT, "test/e2e/helpers.js"));
const { HOSTS, IDENTITY, PROFILE } = require(path.join(ROOT, "test/e2e/sitecore-env.js"));
const CATALOG = require(path.join(ROOT, "extension/themes/themes.js"));
const { scanPage } = require("./scan.cjs");

const arg = (name, def) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : def;
};
const themes = arg("themes", "").split(",").filter(Boolean);
const versions = arg("versions", "10.5,10.4").split(",");
const out = path.resolve(ROOT, arg("out", "test-results/verify"));
const scale = Number(arg("scale", "1"));
const only = arg("only", "").split(",").filter(Boolean);
const colours = arg("colours", null); // the sites' colour scheme, for themes that offer one (Whistler's olive, silver)
if (!themes.length) {
  console.error("pass --themes id[,id...] (ids from extension/themes/themes.js)");
  process.exit(2);
}

const CE = "/sitecore/shell/Applications/Content%20Editor.aspx?sc_bw=1";
const DESKTOP = "/sitecore/shell";
// .click() on the element itself: Sitecore's handlers read the event, and hidden start menu rows can't be clicked by Playwright
const jsClick = (page, sel, text) => page.evaluate(([s, t]) => {
  const el = [...document.querySelectorAll(s)].find((e) => !t || new RegExp(t, "i").test(e.textContent));
  if (el) el.click();
  return !!el;
}, [sel, text || ""]);
const startMenu = (page) => page.locator("#StartButton").click();
// each menu: the page it lives on and how to open it
const MENUS = [
  { name: "tree", page: CE, open: (p) => p.locator(".scContentTreeNode > a").first().click({ button: "right" }) },
  { name: "tree-insert", page: CE, open: async (p) => {
    await p.locator(".scContentTreeNode > a").first().click({ button: "right" });
    await p.waitForTimeout(500);
    // Insert is the first row that opens a fly-out (its class is scGalleryMenuItem_Hover when the menu opens under the mouse)
    await p.locator(".scPopup:visible tr[onclick*=showPopup]").first().click();
  } },
  { name: "ribbon-edit", page: CE, open: (p) => p.locator(".scRibbonToolbarLargeComboButtonBottom").first().click() },
  { name: "ribbon-duplicate", page: CE, open: (p) => p.locator("a[id$='_menu_button']").first().click() },
  { name: "gallery-insert", page: CE, open: (p) => p.locator("img.scRibbonPanelOpen").first().click() },
  { name: "language", page: CE, open: (p) => p.locator(".scEditorHeaderVersionsLanguage").first().click() },
  { name: "version", page: CE, open: (p) => p.locator(".scEditorHeaderVersionsVersion").first().click() },
  { name: "desktop", page: DESKTOP, open: (p) => p.locator("#Desktop").click({ button: "right", position: { x: 600, y: 300 } }) },
  { name: "start", page: DESKTOP, open: startMenu },
  { name: "start-flyout", page: DESKTOP, open: async (p) => {
    await startMenu(p);
    await p.waitForTimeout(500);
    await p.locator(".scPopup:visible .scStartMenuRightFolder").filter({ hasText: "Development Tools" }).first().click();
  } },
  // the Workbox is opened before the page's own findings are taken, so its window doesn't count as the menu's
  { name: "taskbar", page: DESKTOP, prep: async (p) => {
    await jsClick(p, "tr[onclick*=RunShortcut]", "Workbox");
    await p.locator(".scActiveApplication, .scInactiveApplication").first().waitFor({ timeout: 15000 });
    await p.waitForTimeout(2500);
  }, open: async (p) => {
    const app = p.locator(":is(.scActiveApplication, .scInactiveApplication) .scStartBarApplication").first();
    // Cupertino and Sun Valley draw their own Dock over the taskbar, which has no context menu
    if (!(await app.click({ button: "right", trial: true, timeout: 3000 }).then(() => true, () => false))) return "skip";
    await app.click({ button: "right" });
  } },
].filter((m) => !only.length || only.includes(m.name));

const close = async (page) => {
  await page.keyboard.press("Escape").catch(() => {});
  await page.evaluate(() => {
    if (window.scContent && scContent.closeGallery) scContent.closeGallery(null, false, "menus.cjs");
    if (window.scForm && scForm.browser) scForm.browser.closePopups("menus.cjs");
  }).catch(() => {});
  await page.waitForTimeout(300);
  return !(await page.locator(".scPopup:visible, .scGalleryFrame").count());
};

// Runs in each frame: open popups that show a scrollbar (or overflow) although their content would fit in the
// window. A sub-pixel overflow shows a whole scrollbar while scrollHeight still equals clientHeight, so this
// looks for the scrollbar itself (the browser runs without --hide-scrollbars) and at fractional heights.
function popupScroll() {
  return [...document.querySelectorAll(".scPopup")].filter((p) => p.offsetHeight).flatMap((p) => {
    const cs = getComputedStyle(p);
    const bar = p.offsetWidth - p.clientWidth - parseFloat(cs.borderLeftWidth) - parseFloat(cs.borderRightWidth);
    const content = [...p.children].reduce((h, c) => h + c.getBoundingClientRect().height, 0);
    const inner = p.getBoundingClientRect().height - parseFloat(cs.borderTopWidth) - parseFloat(cs.borderBottomWidth) - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    const fits = content + (p.offsetHeight - inner) <= document.body.clientHeight;
    const over = Math.max(p.scrollHeight - p.clientHeight, content - inner);
    return /auto|scroll/.test(cs.overflowY) && (bar > 0 || over > 0.05) && fits
      ? [{ kind: "scroll", what: `div#${p.id}.scPopup${p.querySelector(".scStartMenu") ? " (start menu)" : ""}`, detail: `${over.toFixed(2)}px too short, scrollbar ${bar}px (max-height ${p.style.maxHeight})`, url: location.pathname, count: 1 }]
      : [];
  });
}

function copyProfile() {
  const dest = fs.mkdtempSync(path.join(os.tmpdir(), "sct-menus-profile-"));
  const skip = /[\\/](Cache|Code Cache|GPUCache|Service Worker)([\\/]|$)|[\\/]Singleton[^\\/]*$/;
  fs.cpSync(PROFILE, dest, { recursive: true, filter: (src) => !skip.test(src) });
  return dest;
}

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const origins = [...Object.values(HOSTS), ...IDENTITY];
  const ext = extensionCopy(origins.map((o) => `${o}/*`));
  const profileDir = copyProfile();
  const { context, worker } = await launchWithExtension(ext, profileDir, {
    deviceScaleFactor: scale, viewport: { width: 1300, height: 760 }, ignoreDefaultArgs: ["--hide-scrollbars"], // show scrollbars as the user's Chrome does
  });
  const page = await context.newPage();
  const scratch = await context.newPage();
  const findings = [], problems = [], scrolling = [];
  const key = (f) => `${f.kind}|${f.url}|${f.what}|${f.detail}`;
  for (const version of versions) {
    for (const theme of themes) {
      if (!(CATALOG.find((t) => t.id === theme)?.versions || [version]).includes(version)) {
        console.log(`${version} ${theme}: not supported on this version, skipped`);
        continue;
      }
      await worker.evaluate(([t, o, c]) => chrome.storage.sync.set({ overrides: Object.fromEntries(o.map((x) => [x, t])), schemes: c ? Object.fromEntries(o.map((x) => [x, c])) : {} }), [theme, origins, colours]);
      let loaded = null, before = new Set();
      for (let i = 0, retried = false; i < MENUS.length; i++) {
        const menu = MENUS[i];
        const label = `${version} ${theme} ${scale}x ${menu.name}`;
        try {
          if (loaded !== menu.page) {
            await page.goto(HOSTS[version] + menu.page, { waitUntil: "domcontentloaded", timeout: 60000 });
            await page.waitForLoadState("load", { timeout: 30000 }).catch(() => {});
            await page.waitForTimeout(2000);
            if (/\/Account\/Login|\/sitecore\/login/i.test(page.url())) throw new Error("landed on the login page; re-copy .auth/profile or ask the user to run node test/e2e/login.mjs");
            loaded = menu.page;
            before = null;
          }
          if (menu.prep) await menu.prep(page);
          if (!before || menu.prep) before = new Set((await scanPage(page, scratch, scale)).map(key));
          if (menu.prep) loaded = null; // the app stays open: start the next menu on a fresh page
          if ((await menu.open(page)) === "skip") {
            console.log(`${label}: not on this theme, skipped`);
            continue;
          }
          // not networkidle: the Desktop keeps polling, so it would always wait for its timeout
          await page.waitForTimeout(1200);
          for (const f of page.frames()) await f.waitForLoadState("load", { timeout: 5000 }).catch(() => {});
          // hover the newest menu's first enabled row, as a person would: hover styles can change a row's size
          const row = page.locator(".scPopup:visible").last().locator("tr.scGalleryMenuItem, .scStartMenuRightFolder").first();
          if (await row.count()) await row.hover({ timeout: 2000 }).catch(() => {});
          await page.waitForTimeout(200);
          const file = path.join(out, `${version}-${theme}${colours ? `-${colours}` : ""}-${scale}x-menu-${menu.name}.png`);
          await page.screenshot({ path: file });
          const found = (await scanPage(page, scratch, scale)).filter((f) => !before.has(key(f)));
          // scan.cjs skips a 1px overflow, but a popup that overflows by 1px still shows a whole scrollbar
          for (const frame of page.frames()) found.push(...(await frame.evaluate(popupScroll).catch(() => [])));
          console.log(`${label} -> ${path.relative(ROOT, file)}`);
          for (const f of found) {
            findings.push({ version, theme, scale, menu: menu.name, ...f });
            if (f.kind === "scroll") scrolling.push(`${label}: ${f.what} ${f.detail}`);
            console.log(`  SCAN ${f.kind} x${f.count} ${f.url} ${f.what}: ${f.detail}${f.sample ? ` "${f.sample}"` : ""}`);
          }
        } catch (e) {
          // a slow sign-in can drop a click: try the menu once more on a fresh page
          if (!retried) { retried = true; i--; loaded = null; await close(page); continue; }
          problems.push(`${label}: ${e.message.split("\n")[0]}`);
        }
        retried = false;
        if (!(await close(page))) loaded = null; // something stayed open: reload before the next menu
      }
    }
  }
  const file = path.join(out, `scan-menus-${themes.join("_")}-${scale}x.json`);
  fs.writeFileSync(file, JSON.stringify(findings, null, 1));
  await context.close();
  fs.rmSync(profileDir, { recursive: true, force: true });
  console.log(`\nSCAN: ${findings.length} menu findings in ${path.relative(ROOT, file)}. Fix each or say why it is fine.`);
  if (problems.length) console.log(`\nPROBLEMS (${problems.length}):\n- ${problems.join("\n- ")}`);
  console.log(scrolling.length ? `\nMENUS THAT SCROLL WITH ROOM TO GROW (${scrolling.length}):\n- ${scrolling.join("\n- ")}` : "\nNo menu scrolls needlessly. Now read the screenshots.");
  process.exit(problems.length || scrolling.length ? 1 : 0);
})();
