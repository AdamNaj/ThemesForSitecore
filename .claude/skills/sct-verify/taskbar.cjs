// Desktop taskbar entries under each theme. Sitecore drops a window's taskbar entry from its unload event,
// which current Chrome and Edge no longer fire; Playwright's Chromium still does, so this script ignores
// unload listeners (as the user's browsers do) and then:
//   - opens the Content Editor from the start menu and switches it to the Media Library, the Workbox, back to
//     the Content Editor and to the Media Library again (the pager at the foot of its tree);
//   - after each switch, fails if a window has more than one entry, or an entry's window is gone;
//   - closes the window and fails if its entry stays.
// engine.js (syncTaskbar) keeps the taskbar right under every theme; Native keeps Sitecore's behaviour, so
// its counts are printed but not judged (they show the bug the check guards against).
// usage: node .claude/skills/sct-verify/taskbar.cjs --themes debrightify,cupertino|all [--versions 10.5,10.4]
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
if (!themes.length) {
  console.error("pass --themes id[,id...] (ids from extension/themes/themes.js, or native)");
  process.exit(2);
}

// Runs in the Desktop: each taskbar entry's window id, caption, and whether that window still exists.
const entries = () => [...document.querySelectorAll('#StartbarApplications td[id^="startbar_application_"]')].map((c) => {
  const id = c.id.slice("startbar_application_".length);
  return { id, title: c.textContent.trim(), live: !!document.getElementById(id) };
});

(async () => {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "sct-taskbar-profile-"));
  const skip = /[\\/](Cache|Code Cache|GPUCache|Service Worker)([\\/]|$)|[\\/]Singleton[^\\/]*$/;
  fs.cpSync(PROFILE, profile, { recursive: true, filter: (s) => !skip.test(s) });
  const origins = [...Object.values(HOSTS), ...IDENTITY];
  const { context, worker } = await launchWithExtension(extensionCopy(origins.map((o) => `${o}/*`)), profile, { viewport: { width: 1300, height: 760 } });
  // current Chrome and Edge never call unload listeners; Sitecore adds its own through addEventListener
  await context.addInitScript(() => {
    const add = EventTarget.prototype.addEventListener;
    EventTarget.prototype.addEventListener = function (type, ...rest) {
      if (type === "unload" && this === window) return;
      return add.call(this, type, ...rest);
    };
  });
  const page = await context.newPage();
  const problems = [];
  for (const version of versions) {
    for (const theme of themes) {
      if (!(CATALOG.find((t) => t.id === theme)?.versions || [version]).includes(version)) continue;
      const label = `${version} ${theme}`;
      const judge = theme !== "native";
      await worker.evaluate(([t, o]) => chrome.storage.sync.set({ overrides: Object.fromEntries(o.map((x) => [x, t])) }), [theme, origins]);
      await page.goto(HOSTS[version] + "/sitecore/shell", { waitUntil: "domcontentloaded", timeout: 90000 }).catch(() => {});
      await page.waitForTimeout(3500);
      if (/\/Account\/Login|\/sitecore\/login/i.test(page.url())) {
        problems.push(`${label}: landed on the login page; ask the user to run node test/e2e/login.mjs`);
        continue;
      }
      // the start menu's rows are in the page while it is closed; their click runs RunShortcut
      const opened = await page.evaluate(() => {
        const tr = [...document.querySelectorAll("tr[onclick*=RunShortcut]")].find((r) => /^Content Editor$/i.test(r.textContent.trim()));
        if (tr) tr.click();
        return !!tr;
      });
      await page.waitForTimeout(8000);
      const counts = [];
      const check = async (step) => {
        const list = await page.evaluate(entries);
        counts.push(`${step} ${list.length}`);
        if (!judge) return list;
        const ids = list.map((e) => e.id);
        const twice = ids.filter((id, i) => ids.indexOf(id) !== i);
        if (twice.length) problems.push(`${label} after ${step}: ${list.length} entries, window ${twice[0]} listed more than once (${list.map((e) => e.title).join(", ")})`);
        const dead = list.filter((e) => !e.live);
        if (dead.length) problems.push(`${label} after ${step}: entries for closed windows (${dead.map((e) => e.title).join(", ")})`);
        return list;
      };
      const first = opened ? await check("opening the Content Editor") : [];
      if (!first.length) {
        problems.push(`${label}: the Content Editor did not open as a Desktop window`);
        continue;
      }
      for (const to of ["Media Library", "Workbox", "Content Editor", "Media Library"]) {
        let clicked = false;
        for (const f of page.frames()) {
          clicked = await f.evaluate((t) => {
            const a = [...document.querySelectorAll('a[onclick*="SwitchTo"]')].find((e) => e.textContent.trim() === t);
            if (a) a.click();
            return !!a;
          }, to).catch(() => false);
          if (clicked) break;
        }
        if (!clicked) {
          problems.push(`${label}: no "${to}" button at the foot of the window's tree`);
          break;
        }
        await page.waitForTimeout(6000);
        await check(`switching to ${to}`);
      }
      await page.evaluate((id) => scManager.close(id), first[0].id).catch(() => {});
      await page.waitForTimeout(1500);
      await check("closing the window");
      console.log(`${label}: entries ${counts.join(", ")}${judge ? "" : " (Sitecore's own behaviour, not judged)"}`);
    }
  }
  await context.close();
  fs.rmSync(profile, { recursive: true, force: true });
  console.log(problems.length ? `\nPROBLEMS (${problems.length}):\n- ${problems.join("\n- ")}` : "\nNo taskbar problems found.");
  process.exit(problems.length ? 1 : 0);
})();
