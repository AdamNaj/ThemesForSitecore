// Desktop windows under each theme: opens the SPE ISE as a Desktop window (its title is the script's path,
// which SPE fits into the room the window buttons leave) and checks that
//   - the title shows: not empty, at least 40px wide, not clipped, nothing on top of it (so it drags the window);
//   - the window buttons show: every button image has a size;
//   - maximizing swaps the Maximize button to Sitecore's restore image (content.js syncMaxButton), except Native;
//   - the ISE's script tree and variables toggles (#TreeViewToggle, #VariablesToggle, left of the script tabs),
//     in the Desktop window and in the standalone ISE: each has a size and is on top at its centre
//     (elementFromPoint), no tab overlaps it, no strip or tab border runs through it, its centre is within
//     1.5px of the first tab's, and the first tab starts right of both (SPE's 52px reserve).
// It crops each title bar and toggle strip into --out for reading. Exits non-zero on any failure.
// usage: node .claude/skills/sct-verify/windows.cjs --themes redwood,sonata|all [--versions 10.5,10.4] [--scale 1.25] [--out test-results/windows]
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const ROOT = path.join(__dirname, "..", "..", "..");
const { extensionCopy, launchWithExtension } = require(path.join(ROOT, "test/e2e/helpers.js"));
const { HOSTS, IDENTITY, PROFILE } = require(path.join(ROOT, "test/e2e/sitecore-env.js"));
const CATALOG = require(path.join(ROOT, "extension/themes/themes.js"));

const arg = (name, def) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : def;
};
const themes = arg("themes", "") === "all" ? CATALOG.map((t) => t.id) : arg("themes", "").split(",").filter(Boolean);
const versions = arg("versions", "10.5,10.4").split(",");
const scale = Number(arg("scale", "1.25"));
const out = path.resolve(ROOT, arg("out", "test-results/windows"));
if (!themes.length) {
  console.error("pass --themes id[,id...] (ids from extension/themes/themes.js)");
  process.exit(2);
}

// Runs in the ISE's document. SPE pins both toggles (16px images, position: absolute) at the tab panel's
// top + 8px, left + 6px and + 28px from script, and reserves 52px left of the first tab for them.
const checkToggles = () => {
  const tab = document.querySelector("#Tabs .scTabstrip nobr:first-child > [role=tab]");
  const strip = document.querySelector("#Tabs .scTabstrip");
  if (!tab || !strip) return { problems: ["no script tab strip"] };
  const tb = tab.getBoundingClientRect(), tabMid = tb.top + tb.height / 2;
  const problems = [], offsets = [];
  // borders that draw a line across the toggles' column: the strip's own, and any tab's
  const lines = [];
  for (const el of [strip, ...strip.querySelectorAll("[role=tab]")]) {
    const s = getComputedStyle(el), b = el.getBoundingClientRect();
    if (parseFloat(s.borderBottomWidth) && s.borderBottomStyle !== "none") lines.push({ el: el === strip ? "strip" : "tab", y0: b.bottom - parseFloat(s.borderBottomWidth), y1: b.bottom, x0: b.left, x1: b.right });
    if (parseFloat(s.borderTopWidth) && s.borderTopStyle !== "none") lines.push({ el: el === strip ? "strip" : "tab", y0: b.top, y1: b.top + parseFloat(s.borderTopWidth), x0: b.left, x1: b.right });
  }
  let right = 0;
  for (const id of ["TreeViewToggle", "VariablesToggle"]) {
    const t = document.getElementById(id);
    if (!t) { problems.push(`#${id} missing`); continue; }
    const b = t.getBoundingClientRect(), s = getComputedStyle(t);
    right = Math.max(right, b.right);
    if (b.width < 4 || b.height < 4 || s.visibility !== "visible" || Number(s.opacity) < 0.3) { problems.push(`#${id} is invisible (${Math.round(b.width)}x${Math.round(b.height)}, ${s.visibility}, opacity ${s.opacity})`); continue; }
    const at = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
    if (at !== t) problems.push(`#${id} is covered by ${at ? at.tagName + (at.id ? "#" + at.id : "") + "." + at.className : "nothing (off screen)"}`);
    const over = [...strip.querySelectorAll("[role=tab]")].find((x) => { const r = x.getBoundingClientRect(); return r.left < b.right - 1 && r.right > b.left + 1 && r.top < b.bottom - 1 && r.bottom > b.top + 1; });
    if (over) problems.push(`#${id} overlaps the tab "${over.textContent.trim()}"`);
    const line = lines.find((l) => l.y1 > b.top + 0.5 && l.y0 < b.bottom - 0.5 && l.x0 < b.right && l.x1 > b.left);
    if (line) problems.push(`#${id}: a ${line.el} border runs through it (y ${line.y0.toFixed(1)})`);
    const off = b.top + b.height / 2 - tabMid;
    offsets.push(Math.round(off * 10) / 10);
    if (Math.abs(off) > 1.5) problems.push(`#${id} centre is ${off.toFixed(1)}px off the tabs' centre`);
  }
  if (tb.left < right + 2) problems.push(`the first tab starts at ${Math.round(tb.left - strip.getBoundingClientRect().left)}px, under the toggles (SPE reserves 52px)`);
  return { problems, offsets, tabH: Math.round(tb.height * 10) / 10, box: { x: strip.getBoundingClientRect().left, y: Math.min(tb.top, strip.getBoundingClientRect().top) - 4, h: strip.getBoundingClientRect().height + 8 } };
};

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "sct-windows-profile-"));
  const skip = /[\\/](Cache|Code Cache|GPUCache|Service Worker)([\\/]|$)|[\\/]Singleton[^\\/]*$/;
  fs.cpSync(PROFILE, profile, { recursive: true, filter: (s) => !skip.test(s) });
  const origins = [...Object.values(HOSTS), ...IDENTITY];
  const { context, worker } = await launchWithExtension(extensionCopy(origins.map((o) => `${o}/*`)), profile, { deviceScaleFactor: scale, viewport: { width: 1300, height: 760 } });
  const page = await context.newPage();
  const problems = [];
  for (const version of versions) {
    for (const theme of themes) {
      if (!(CATALOG.find((t) => t.id === theme)?.versions || [version]).includes(version)) continue;
      const label = `${version} ${theme}`;
      await worker.evaluate(([t, o]) => chrome.storage.sync.set({ overrides: Object.fromEntries(o.map((x) => [x, t])) }), [theme, origins]);
      // the toggles left of the script tabs, in an ISE frame; `where` names it in the report and the crop
      const toggles = async (frame, where) => {
        const r = await frame.evaluate(checkToggles).catch((e) => ({ problems: [String(e).split("\n")[0]] }));
        for (const p of r.problems) problems.push(`${label} ${where}: ${p}`);
        console.log(`${label} ${where}: toggles ${JSON.stringify(r.offsets)} off the tab centre, tab ${r.tabH}px${r.problems.length ? " - " + r.problems.join("; ") : ""}`);
        if (!r.box) return;
        const fe = await frame.frameElement().catch(() => null);
        const fb = fe ? await fe.boundingBox() : { x: 0, y: 0 };
        await page.screenshot({ path: path.join(out, `${version}-${theme}-toggles-${where}.png`), clip: { x: fb.x + r.box.x, y: Math.max(0, fb.y + r.box.y), width: 260, height: Math.max(20, r.box.h) } }).catch(() => {});
      };
      await page.goto(HOSTS[version] + "/sitecore/shell/Applications/PowerShell/PowerShellIse?sc_bw=1", { waitUntil: "domcontentloaded", timeout: 90000 }).catch(() => {});
      await page.waitForTimeout(6000);
      await toggles(page.mainFrame(), "standalone");
      await page.goto(HOSTS[version] + "/sitecore/shell", { waitUntil: "domcontentloaded", timeout: 90000 }).catch(() => {});
      await page.waitForTimeout(3500);
      // the start menu's rows are in the page while it is closed; their click runs RunShortcut
      const found = await page.evaluate(() => {
        const tr = [...document.querySelectorAll("tr[onclick*=RunShortcut]")].find((r) => /PowerShell ISE/i.test(r.textContent));
        if (tr) tr.click();
        return !!tr;
      });
      await page.waitForTimeout(9000);
      // the Desktop window is a wrapper page (xmlcontrol=Application) holding the title bar, the ISE inside it
      const inner = page.frames().find((f) => /PowerShellIse/i.test(f.url()));
      const win = inner && inner.parentFrame();
      if (!found || !win || win === page.mainFrame()) {
        problems.push(`${label}: the ISE did not open as a Desktop window`);
        continue;
      }
      const check = () => win.evaluate(() => {
        const title = document.querySelector("#WindowCaption");
        const res = { buttons: [...document.querySelectorAll(".standartWindowButtons img")].map((i) => ({ src: (i.getAttribute("src") || "").split("/").pop(), w: i.getBoundingClientRect().width })) };
        if (!title) return { ...res, title: null };
        const b = title.getBoundingClientRect();
        let clipped = false;
        for (let n = title.parentElement; n && n !== document.body; n = n.parentElement) {
          const s = getComputedStyle(n), nb = n.getBoundingClientRect();
          if (s.overflow !== "visible" && (b.left < nb.left - 1 || b.right > nb.right + 1 || b.top < nb.top - 1 || b.bottom > nb.bottom + 1)) clipped = true;
        }
        const at = b.width ? document.elementFromPoint(b.left + Math.min(8, b.width / 2), b.top + b.height / 2) : null;
        return { ...res, title: { text: title.textContent.trim(), w: Math.round(b.width), clipped, covered: !!at && at !== title && !title.contains(at), hidden: getComputedStyle(title).visibility !== "visible" } };
      });
      const r = await check();
      if (!r.title) problems.push(`${label}: no ISE title element`);
      else {
        const t = r.title;
        if (!t.text) problems.push(`${label}: the ISE title is empty`);
        if (t.w < 40) problems.push(`${label}: the ISE title is ${t.w}px wide`);
        if (t.clipped) problems.push(`${label}: the ISE title is clipped by its caption`);
        if (t.covered) problems.push(`${label}: something lies on top of the ISE title (it won't drag the window)`);
        if (t.hidden) problems.push(`${label}: the ISE title is hidden`);
      }
      if (r.buttons.length < 2 || r.buttons.some((b) => b.w < 1)) problems.push(`${label}: window buttons missing or zero-sized: ${JSON.stringify(r.buttons)}`);
      await toggles(inner, "window");
      const id = await win.evaluate(() => window.frameElement.id);
      const crop = async (name) => {
        const fb = await (await win.frameElement()).boundingBox();
        await page.screenshot({ path: path.join(out, `${version}-${theme}-${name}.png`), clip: { x: fb.x, y: fb.y, width: Math.min(900, fb.width), height: 44 } });
      };
      await crop("title");
      // maximize toggles; the restore image appears while the window fills the Desktop
      const maxed = await win.evaluate(() => window.frameElement.style.width === "100%");
      await page.evaluate((i) => scManager.maximize(i), id);
      await page.waitForTimeout(1200);
      const after = await check();
      const nowMax = !maxed;
      const restore = after.buttons.some((b) => /_restore/.test(b.src));
      if (theme !== "native" && nowMax !== restore) problems.push(`${label}: maximized=${nowMax} but the restore image is ${restore ? "shown" : "not shown"}`);
      await crop(nowMax ? "maximized" : "restored");
      await page.evaluate((i) => scManager.close(i), id).catch(() => {});
      await page.waitForTimeout(800);
      console.log(`${label}: title ${r.title ? `${r.title.w}px` : "none"}, ${r.buttons.length} buttons`);
    }
  }
  await context.close();
  fs.rmSync(profile, { recursive: true, force: true });
  console.log(problems.length ? `\nPROBLEMS (${problems.length}):\n- ${problems.join("\n- ")}` : "\nNo window problems found. Now read the crops.");
  process.exit(problems.length ? 1 : 0);
})();
