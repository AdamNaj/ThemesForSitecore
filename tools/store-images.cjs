// Dev tool: the store listing's images in docs/. The two promo tiles (1400x560 marquee, 440x280 small) are drawn
// from the themes' previews (run tools/previews.cjs first); the 1280x800 screenshots are the Sitecore Desktop on
// the 10.5 host from sitecore.local.json, a Content Editor window open, under a few themes. Needs the .auth/profile
// sign-in (node test/e2e/login.mjs). Use an install with stock content only: these images are published.
// Usage: node tools/store-images.cjs [--promo] [--screens]   (neither: both)
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { chromium } = require("@playwright/test");
const ROOT = path.join(__dirname, "..");
const DOCS = path.join(ROOT, "docs");
const CATALOG = require(path.join(ROOT, "extension/themes/themes.js"));

const args = process.argv.slice(2);
const promo = !args.length || args.includes("--promo");
const screens = !args.length || args.includes("--screens");

// The looks the tiles fan out, back to front, and the screenshots' themes (with the colour scheme to show).
const FAN = ["chicago", "whistler", "sitecore6", "cheetah", "tahoe", "graphite"];
const SCREENS = [["tahoe", "light"], ["whistler", "light"], ["cheetah", "light"], ["sitecore6", "light"], ["sunvalley", "dark"]];
const count = CATALOG.filter((t) => t.id !== "native").length;
const img = (id) => pathToFileURL(path.join(ROOT, "extension/themes", id, "preview.jpg")).href;
const icon = pathToFileURL(path.join(ROOT, "extension/icons/icon.svg")).href;

const page = (w, h, body) => `<!doctype html><html><head><meta charset="utf-8"><style>
  html, body { margin: 0; width: ${w}px; height: ${h}px; overflow: hidden; }
  body { position: relative; background: radial-gradient(circle at 70% 30%, #262a3c, #12131a 70%); color: #fff;
    font-family: "Segoe UI Variable Display", "Segoe UI", system-ui, sans-serif; }
  .fan img { position: absolute; border-radius: 8px; box-shadow: 0 10px 40px rgba(0, 0, 0, 0.55), 0 0 0 1px rgba(255, 255, 255, 0.12); }
  h1 { margin: 0; font-weight: 700; letter-spacing: -0.02em; }
  p { margin: 0; color: #c9cbd6; }
</style></head><body>${body}</body></html>`;

const fan = (x, y, w, dx, dy, ids) => `<div class="fan">${ids.map((id, i) => `<img src="${img(id)}" style="left:${x + i * dx}px;top:${y + i * dy}px;width:${w}px">`).join("")}</div>`;

const marquee = page(1400, 560, `
  ${fan(600, 40, 640, 64, 44, FAN)}
  <img src="${icon}" style="position:absolute;left:84px;top:96px;width:104px">
  <h1 style="position:absolute;left:80px;top:212px;width:480px;font-size:88px;line-height:1">Themes for Sitecore</h1>
  <p style="position:absolute;left:84px;top:410px;width:470px;font-size:27px;line-height:1.35">${count} looks for the Sitecore Desktop and Content Editor, on Sitecore 10.0 to 10.5.</p>`);

const small = page(440, 280, `
  ${fan(214, 92, 250, 26, 22, FAN.slice(-4))}
  <img src="${icon}" style="position:absolute;left:24px;top:24px;width:52px">
  <h1 style="position:absolute;left:22px;top:90px;width:200px;font-size:36px;line-height:1.02">Themes for Sitecore</h1>
  <p style="position:absolute;left:24px;top:196px;width:180px;font-size:15px;line-height:1.35">${count} looks for Sitecore 10.0 to 10.5</p>`);

(async () => {
  if (promo) {
    const browser = await chromium.launch();
    for (const [html, w, h, name] of [[marquee, 1400, 560, "store-promo-marquee-1400x560.png"], [small, 440, 280, "store-promo-small-440x280.png"]]) {
      const p = await browser.newPage({ viewport: { width: w, height: h } });
      const file = path.join(os.tmpdir(), `sct-${name}.html`);
      fs.writeFileSync(file, html);
      await p.goto(pathToFileURL(file).href);
      await p.waitForTimeout(500);
      await p.screenshot({ path: path.join(DOCS, name) });
      fs.rmSync(file);
      console.log("docs/" + name);
    }
    await browser.close();
  }
  if (screens) {
    const { extensionCopy, launchWithExtension } = require(path.join(ROOT, "test/e2e/helpers.js"));
    const { HOSTS, IDENTITY, PROFILE } = require(path.join(ROOT, "test/e2e/sitecore-env.js"));
    const profile = fs.mkdtempSync(path.join(os.tmpdir(), "sct-store-profile-"));
    const skip = /[\\/](Cache|Code Cache|GPUCache|Service Worker)([\\/]|$)|[\\/]Singleton[^\\/]*$/;
    fs.cpSync(PROFILE, profile, { recursive: true, filter: (src) => !skip.test(src) });
    const origins = [...Object.values(HOSTS), ...IDENTITY];
    const { context, worker } = await launchWithExtension(extensionCopy(origins.map((o) => `${o}/*`)), profile, { viewport: { width: 1280, height: 800 } });
    const p = await context.newPage();
    for (const [i, [theme, scheme]] of SCREENS.entries()) {
      await worker.evaluate(([t, o]) => chrome.storage.sync.set({ overrides: Object.fromEntries(o.map((x) => [x, t])) }), [theme, origins]);
      await p.emulateMedia({ colorScheme: scheme });
      await p.goto(HOSTS["10.5"] + "/sitecore/shell", { waitUntil: "domcontentloaded" });
      await p.waitForTimeout(3000);
      if (/LicenseOptions/i.test(p.url())) throw new Error(`${HOSTS["10.5"]} is at its licence's user limit: wait for its sessions to time out`);
      await p.evaluate(() => [...document.querySelectorAll("tr[onclick*=RunShortcut]")].find((r) => /^Content Editor$/i.test(r.textContent.trim()))?.click());
      let id = null;
      for (let s = 0; !id && s < 20; s++) (await p.waitForTimeout(1000)), (id = await p.evaluate(() => document.querySelector('#StartbarApplications td[id^="startbar_application_"]')?.id.slice(21)));
      if (!id) throw new Error(`${theme}: the Content Editor did not open`);
      await p.waitForTimeout(3000);
      // a window on the desktop, so the theme's wallpaper, frame and taskbar show round it
      if (await p.evaluate((w) => !!scManager.getWindowHandler(w)?.maximized, id)) await p.evaluate((w) => scManager.maximize(w), id), await p.waitForTimeout(1200);
      await p.evaluate((w) => Object.assign(document.getElementById(w).style, { left: "70px", top: "40px", width: "1010px", height: "620px" }), id);
      await p.waitForTimeout(2000);
      const name = `store-screenshot-${i + 1}-${theme}.png`;
      await p.screenshot({ path: path.join(DOCS, name) });
      await p.evaluate((w) => scManager.close(w), id).catch(() => {});
      console.log("docs/" + name);
    }
    await context.close();
    fs.rmSync(profile, { recursive: true, force: true });
  }
})();
