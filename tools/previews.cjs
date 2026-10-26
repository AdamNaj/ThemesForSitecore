// Dev tool: the popup's theme previews. For each theme, the Content Editor on a Sitecore version the theme supports,
// cropped to the preview's 416x176 shape at twice its size, into extension/themes/<id>/preview.jpg (its main
// version) and preview-<version>.jpg (each other version); a theme whose appearance follows the OS also gets a
// -dark twin of each. Then it regenerates themes.js, which lists each theme's previews. Needs the .auth/profile
// sign-in (node test/e2e/login.mjs).
// Usage: node tools/previews.cjs [id ...]   (no ids: every built-in theme but Native's own look is captured too)
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const ROOT = path.join(__dirname, "..");
const { extensionCopy, launchWithExtension } = require(path.join(ROOT, "test/e2e/helpers.js"));
const { HOSTS, IDENTITY, PROFILE } = require(path.join(ROOT, "test/e2e/sitecore-env.js"));
const CATALOG = require(path.join(ROOT, "extension/themes/themes.js"));

const THEMES = path.join(ROOT, "extension/themes");
const PAGE = "/sitecore/shell/Applications/Content%20Editor.aspx?sc_bw=1";
const CLIP = { x: 0, y: 0, width: 832, height: 352 };
const ids = process.argv.slice(2);
const themes = ids.length ? CATALOG.filter((t) => ids.includes(t.id)) : CATALOG;

(async () => {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "sct-previews-profile-"));
  const skip = /[\\/](Cache|Code Cache|GPUCache|Service Worker)([\\/]|$)|[\\/]Singleton[^\\/]*$/;
  fs.cpSync(PROFILE, profile, { recursive: true, filter: (src) => !skip.test(src) });
  const origins = [...Object.values(HOSTS), ...IDENTITY];
  const { context, worker } = await launchWithExtension(extensionCopy(origins.map((o) => `${o}/*`)), profile, { viewport: { width: 1300, height: 760 } });
  const page = await context.newPage();
  for (const t of themes) {
    await worker.evaluate(([id, o]) => chrome.storage.sync.set({ overrides: Object.fromEntries(o.map((x) => [x, id])) }), [t.id, origins]);
    // every version the theme runs on: <id> on its main one (10.5 where supported), <id>-<version> on the others
    const main = t.versions.includes("10.5") ? "10.5" : t.versions[0];
    for (const version of t.versions.filter((v) => HOSTS[v])) {
      for (const scheme of t.appearance === "auto" ? ["light", "dark"] : ["light"]) {
        await page.emulateMedia({ colorScheme: scheme });
        await page.goto(HOSTS[version] + PAGE, { waitUntil: "domcontentloaded", timeout: 60000 });
        await page.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {});
        await page.waitForTimeout(2500);
        // never save Sitecore's licence page or a login page as a theme's preview
        const { surface, text } = await page.evaluate(() => ({ surface: document.documentElement.dataset.sctSurface, text: document.body ? document.body.innerText : "" }));
        if (/LicenseOptions/i.test(page.url()) || /maximum number of allowed users/i.test(text)) throw new Error(`${HOSTS[version]} is at its licence's user limit: wait for its sessions to time out`);
        if (/\/Account\/Login|\/sitecore\/login/i.test(page.url()) || surface === "login") throw new Error("signed out: run node test/e2e/login.mjs");
        const suffix = `${version === main ? "" : `-${version}`}${scheme === "dark" ? "-dark" : ""}`;
        const file = path.join(THEMES, t.id, `preview${suffix}.jpg`);
        await page.screenshot({ path: file, clip: CLIP, type: "jpeg", quality: 80 });
        console.log(`${t.id} ${version} ${scheme} -> ${path.relative(ROOT, file)} (${Math.round(fs.statSync(file).size / 1024)} KB)`);
      }
    }
  }
  await context.close();
  fs.rmSync(profile, { recursive: true, force: true });
  // the popup requests only the screenshots themes.js lists, so a theme without one draws its miniature instead
  require("node:child_process").execFileSync(process.execPath, [path.join(ROOT, "tools/themes.mjs")], { stdio: "inherit" });
})();
