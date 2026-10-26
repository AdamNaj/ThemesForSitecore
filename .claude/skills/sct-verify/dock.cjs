// The Desktop's taskbar or dock stays above every non-modal window, as in stock Sitecore, and a dock that does
// not span the screen floats over the windows, which run on underneath it.
// For each theme: opens the Content Editor as a Desktop window, maximizes it, then
//   - every functional part of the bar (start button, window buttons, search, database selector) and the top
//     bar's account items must be hit by elementFromPoint as themselves, not as the window;
//   - where those parts span less than 85% of the screen (a dock), the window must show beside them, at the
//     dock's height: windows render under the dock, not cut off above it.
// usage: node .claude/skills/sct-verify/dock.cjs --themes all|id[,id...] [--versions 10.5,10.4] [--width 1300]
// Uses a copy of .auth/profile (the shared sign-in), never the profile itself. One launch for every theme.
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
const pick = arg("themes", "");
const themes = pick === "all" ? CATALOG.map((t) => t.id) : pick.split(",").filter(Boolean);
const versions = arg("versions", "10.5,10.4").split(",");
const width = Number(arg("width", "1300"));
if (!themes.length) {
  console.error("pass --themes all or id[,id...] (ids from extension/themes/themes.js)");
  process.exit(2);
}

// Runs in the Desktop with one maximized window: what covers each functional part, and beside a dock.
function measure(winId) {
  const win = document.getElementById(winId);
  const visible = (e) => {
    if (!e) return false;
    const r = e.getBoundingClientRect(), s = getComputedStyle(e);
    return r.width > 2 && r.height > 2 && s.visibility !== "hidden" && s.display !== "none";
  };
  const parts = [
    ["start button", document.querySelector("#StartButton, .scStartButton")],
    ["window button", document.querySelector('#StartbarApplications td[id^="startbar_application_"]')],
    ["search", document.querySelector("#SearchBox")],
    ["database selector", document.querySelector("#DatabaseSelector")],
    ["Log out", document.querySelector(".sc-globalHeader .sc-accountInformation > li")],
  ].filter(([, e]) => visible(e));
  // A part is covered only when the window (or the bare Desktop behind it) answers at its middle: a theme may
  // draw its own elements over Sitecore's (Cupertino's dock), which is not a covering.
  const desktop = document.getElementById("Desktop");
  const who = (hit) => (hit === win ? "the window" : hit ? hit.tagName.toLowerCase() + (hit.id ? "#" + hit.id : "") : "nothing");
  const windowArea = (hit) => !hit || hit === win || hit === desktop || hit === document.body || hit === document.documentElement || hit.id === "DesktopLinks" || (desktop && desktop.contains(hit) && !hit.closest(".scStartbar, #Startbar"));
  const covered = [];
  const rects = [];
  for (const [name, e] of parts) {
    const r = e.getBoundingClientRect();
    if (name !== "Log out") rects.push(r);
    // the middle, clamped into the viewport: a part may run past an edge
    const x = Math.min(innerWidth - 2, Math.max(1, r.left + r.width / 2));
    const y = Math.min(innerHeight - 2, Math.max(1, r.top + r.height / 2));
    const hit = document.elementFromPoint(x, y);
    if (hit !== e && !e.contains(hit) && windowArea(hit)) covered.push(`${name} at ${Math.round(x)},${Math.round(y)} is under ${who(hit)}`);
  }
  const box = rects.length && {
    left: Math.min(...rects.map((r) => r.left)), right: Math.max(...rects.map((r) => r.right)),
    top: Math.min(...rects.map((r) => r.top)), bottom: Math.max(...rects.map((r) => r.bottom)),
  };
  const out = { covered, parts: parts.map(([n]) => n), dock: false, beside: [] };
  // Beside the controls, at the bar's height: the bar's own background (a full-width bar), or the window running
  // on under a dock. The bare Desktop there means the window stops short of a dock.
  if (box && box.right - box.left < innerWidth * 0.85) {
    const y = (box.top + box.bottom) / 2;
    for (const x of [box.left - 24, box.right + 24]) {
      if (x < 4 || x > innerWidth - 4) continue;
      const hit = document.elementFromPoint(x, y);
      if (hit === win) out.dock = true;
      else if (windowArea(hit)) (out.dock = true), out.beside.push(`beside the dock at ${Math.round(x)},${Math.round(y)} shows ${who(hit)}, not the window`);
    }
  }
  const wr = win.getBoundingClientRect();
  out.window = `${Math.round(wr.left)},${Math.round(wr.top)} ${Math.round(wr.width)}x${Math.round(wr.height)}`;
  return out;
}

(async () => {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "sct-dock-profile-"));
  const skip = /[\\/](Cache|Code Cache|GPUCache|Service Worker)([\\/]|$)|[\\/]Singleton[^\\/]*$/;
  fs.cpSync(PROFILE, profile, { recursive: true, filter: (s) => !skip.test(s) });
  const origins = [...Object.values(HOSTS), ...IDENTITY];
  const { context, worker } = await launchWithExtension(extensionCopy(origins.map((o) => `${o}/*`)), profile, { viewport: { width, height: 760 } });
  const page = await context.newPage();
  const problems = [];
  for (const version of versions) {
    for (const theme of themes) {
      if (!(CATALOG.find((t) => t.id === theme)?.versions || [version]).includes(version)) continue;
      const label = `${version} ${theme}`;
      await worker.evaluate(([t, o]) => chrome.storage.sync.set({ overrides: Object.fromEntries(o.map((x) => [x, t])) }), [theme, origins]);
      await page.goto(HOSTS[version] + "/sitecore/shell", { waitUntil: "domcontentloaded", timeout: 90000 }).catch(() => {});
      await page.waitForTimeout(3500);
      if (/\/Account\/Login|\/sitecore\/login|LicenseOptions/i.test(page.url())) {
        console.error(`${label}: landed on ${page.url()}; stopping (sign in with node test/e2e/login.mjs, or wait for licence sessions to expire)`);
        process.exit(3);
      }
      const opened = await page.evaluate(() => {
        const tr = [...document.querySelectorAll("tr[onclick*=RunShortcut]")].find((r) => /^Content Editor$/i.test(r.textContent.trim()));
        if (tr) tr.click();
        return !!tr;
      });
      // a slow install takes a while to open the window: wait for its taskbar entry, up to 20 seconds
      const entry = () => page.evaluate(() => document.querySelector('#StartbarApplications td[id^="startbar_application_"]')?.id.slice("startbar_application_".length));
      let id = null;
      for (let s = 0; opened && !id && s < 20; s++) (await page.waitForTimeout(1000)), (id = await entry());
      if (id) await page.waitForTimeout(2000);
      if (!id) {
        problems.push(`${label}: the Content Editor did not open as a Desktop window`);
        continue;
      }
      // maximize toggles, and a window can open maximized from its saved state: ask the window manager
      const maximized = () => page.evaluate((w) => !!scManager.getWindowHandler(w)?.maximized, id);
      for (let i = 0; i < 2 && !(await maximized()); i++) {
        await page.evaluate((w) => scManager.maximize(w), id);
        await page.waitForTimeout(1500);
      }
      if (!(await maximized())) {
        problems.push(`${label}: the window would not maximize`);
        continue;
      }
      const m = await page.evaluate(measure, id);
      for (const c of m.covered) problems.push(`${label}: ${c}`);
      for (const b of m.beside) problems.push(`${label}: ${b}`);
      console.log(`${label}: ${m.dock ? "dock" : "full-width bar"}, window ${m.window}, checked ${m.parts.join(", ")}${m.covered.length + m.beside.length ? " - PROBLEM" : ""}`);
      await page.screenshot({ path: path.join(ROOT, "test-results", "dock", `${version}-${theme}.png`) }).catch(() => {});
      await page.evaluate((w) => scManager.close(w), id).catch(() => {});
      await page.waitForTimeout(1000);
    }
  }
  await context.close();
  fs.rmSync(profile, { recursive: true, force: true });
  console.log(problems.length ? `\nPROBLEMS (${problems.length}):\n- ${problems.join("\n- ")}` : "\nEvery bar stays above the windows.");
  process.exit(problems.length ? 1 : 0);
})();
