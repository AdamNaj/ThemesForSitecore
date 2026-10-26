// Screenshots the pages people actually open, per theme and Sitecore version, and checks every frame.
// usage: node .claude/skills/sct-verify/shots.cjs --themes metalsteel,debrightify [--versions 10.5,10.4]
//          [--paths "/sitecore/shell,/?sc_mode=edit"] [--out test-results/verify] [--scale 1.25] [--scan] [--scheme dark]
//          [--width 1920] [--env beta] [--white-icons] [--font opendyslexic] [--spacing wide]
//          [--vision protanopia] [--strength 60]
// Uses a copy of .auth/profile (the shared sign-in), never the profile itself.
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
const themes = arg("themes", "").split(",").filter(Boolean);
const versions = arg("versions", "10.5,10.4").split(",");
const out = path.resolve(ROOT, arg("out", "test-results/verify"));
const scale = Number(arg("scale", "1"));
const scheme = arg("scheme", "light"); // the OS appearance, for themes that follow it
const width = Number(arg("width", "1300")); // Launchpad moves Analytics to a right-hand column above 1570px
const scan = process.argv.includes("--scan");
const env = arg("env", null); // the sites' environment, for themes that draw it (Guardrail)
// the sites' accessibility aids (lib/settings.js accessibility): every frame but the Experience Editor's website shows the
// font and spacing, only the top document the colour filter
const access = { font: arg("font", null), spacing: arg("spacing", null), vision: arg("vision", null), strength: Number(arg("strength", "100")) };
// every item and command icon swapped for a white one (OfficeWhite's home, at the icon's size), so --scan finds
// white icons that vanish on a light panel: scripts and items pick that set, the default pages never show it
const whiteIcons = process.argv.includes("--white-icons");
const { scanPage } = require("./scan.cjs");
// The entry points as Sitecore links them, not tidied versions of them.
const PATHS = arg("paths", [
  "/sitecore/shell",
  "/sitecore/shell/Applications/Content%20Editor.aspx?sc_bw=1",
  "/sitecore/shell/sitecore/client/Applications/Launchpad",
  "/?sc_mode=edit",
  "/sitecore/admin/",
  "/sitecore/admin/Jobs.aspx",
  "/sitecore/shell/Applications/PowerShell/PowerShellReports?sc_bw=1",
].join(",")).split(",");
if (!themes.length) {
  console.error("pass --themes id[,id...] (ids from extension/themes/themes.js)");
  process.exit(2);
}

function copyProfile() {
  // one copy per run, so parallel runs (one agent per theme) don't delete each other's profile
  const dest = fs.mkdtempSync(path.join(os.tmpdir(), "sct-verify-profile-"));
  const skip = /[\\/](Cache|Code Cache|GPUCache|Service Worker)([\\/]|$)|[\\/]Singleton[^\\/]*$/;
  fs.cpSync(PROFILE, dest, { recursive: true, filter: (src) => !skip.test(src) });
  return dest;
}

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const ext = extensionCopy([...Object.values(HOSTS), ...IDENTITY].map((o) => `${o}/*`));
  // --scale 1.25 renders as the user's Chrome does: fractional device pixels are where glyphs garble
  const profileDir = copyProfile();
  const { context, worker } = await launchWithExtension(ext, profileDir, { deviceScaleFactor: scale, colorScheme: scheme, viewport: { width, height: 760 } });
  const page = await context.newPage();
  // a theme's dom.js can break Sitecore's own scripts (Phosphor's SVG threw in the Desktop's onload walk)
  let errors = [];
  page.on("pageerror", (e) => errors.push(e.message.split("\n")[0]));
  const scratch = scan ? await context.newPage() : null;
  const findings = [];
  const problems = [];
  for (const version of versions) {
    const host = HOSTS[version];
    for (const theme of themes) {
      // a theme that does not support this version falls back to Native, which is correct
      if (!(CATALOG.find((t) => t.id === theme)?.versions || [version]).includes(version)) {
        console.log(`${version} ${theme}: not supported on this version, skipped`);
        continue;
      }
      const origins = [...Object.values(HOSTS), ...IDENTITY];
      await worker.evaluate(([t, o, e, r]) => chrome.storage.sync.set({
        overrides: Object.fromEntries(o.map((x) => [x, t])), envs: e ? Object.fromEntries(o.map((x) => [x, e])) : {},
        accessibility: r.font || r.spacing || r.vision ? Object.fromEntries(o.map((x) => [x, r])) : {},
      }), [theme, origins, env, access]);
      for (const p of PATHS) {
        const label = `${version} ${theme} ${p}`;
        errors = [];
        try {
          await page.goto(host + p, { waitUntil: "domcontentloaded", timeout: 60000 });
        } catch (e) {
          problems.push(`${label}: did not load (${e.message.split("\n")[0]}). A hung SPE session or an expired sign-in?`);
          continue;
        }
        await page.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {});
        await page.waitForTimeout(2500);
        for (const e of new Set(errors)) problems.push(`${label}: page error "${e}" (if Native throws it too, it is Sitecore's)`);
        if (/\/Account\/Login|\/sitecore\/login/i.test(page.url())) {
          problems.push(`${label}: landed on the login page; re-copy .auth/profile or ask the user to run node test/e2e/login.mjs`);
          continue;
        }
        const frames = (await Promise.all(page.frames().map((f) => f.evaluate(() => {
          const x = document.documentElement.dataset;
          // a reading font blocked by the page (its CSP) shows as a face in error
          const faces = [...document.fonts].filter((f) => f.family.includes("SCT ")).map((f) => f.status);
          return { url: location.pathname, surface: x.sctSurface || null, theme: x.sctTheme || null, engine: !!x.sctEngine, env: x.sctEnv || null,
            font: x.sctFont || null, spacing: x.sctSpacing || null, vision: x.sctVision || null, top: window === top, faces };
        }).catch(() => null)))).filter(Boolean);
        for (const f of frames) {
          // the engine ran but never got its theme: the 2026-10-21 ribbon regression looked exactly like this
          if (f.engine && f.surface && theme !== "native" && !f.theme) problems.push(`${label}: frame ${f.url} has surface ${f.surface} but no theme`);
          if (f.theme && f.theme !== theme) problems.push(`${label}: frame ${f.url} shows ${f.theme}, expected ${theme}`);
          if (env && f.theme && f.env !== env) problems.push(`${label}: frame ${f.url} has environment ${f.env}, expected ${env}`);
          const reads = f.engine && f.surface && f.surface !== "ee";
          if (reads && (f.font !== access.font || f.spacing !== access.spacing)) problems.push(`${label}: frame ${f.url} has font ${f.font} and spacing ${f.spacing}, expected ${access.font} and ${access.spacing}`);
          // only the top document filters: a frame filtering again under it would be corrected twice
          const filters = f.engine && f.surface && f.top ? access.vision : null;
          if (f.vision !== filters) problems.push(`${label}: frame ${f.url} has colour filter ${f.vision}, expected ${filters}`);
          if (f.surface === "ee" && (f.font || f.spacing)) problems.push(`${label}: the Experience Editor's website got the reading font or spacing`);
          if (f.faces.includes("error")) problems.push(`${label}: frame ${f.url} could not load the reading font (${f.faces.join(", ")})`);
        }
        const top = frames[0] || {};
        if (/^\/sitecore\//i.test(new URL(page.url()).pathname) && !top.surface) problems.push(`${label}: top document not detected as a surface`);
        if (whiteIcons) {
          for (const f of page.frames()) {
            // /-/icon/ renders any icon; /temp/iconcache/ only serves the ones Sitecore has already cached
            await f.evaluate(() => document.querySelectorAll("img").forEach((i) => {
              const m = /\/(?:temp\/iconcache|-\/icon)\/[^/]+\/(16x16|24x24|32x32|48x48)\//i.exec(i.src);
              if (m) i.src = `/-/icon/OfficeWhite/${m[1]}/home.png`;
            })).catch(() => {});
          }
          await page.waitForTimeout(1500);
        }
        const file = path.join(out, `${version}-${theme}${env ? `-${env}` : ""}${whiteIcons ? "-white" : ""}${access.font ? `-${access.font}` : ""}${access.spacing ? `-${access.spacing}` : ""}${access.vision ? `-${access.vision}${access.strength}` : ""}-${p.replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "") || "root"}.png`);
        await page.screenshot({ path: file });
        console.log(`${label}\n  ${frames.map((f) => `${f.url} surface=${f.surface || "-"} theme=${f.theme || "-"}${f.font || f.spacing || f.vision ? ` font=${f.font} spacing=${f.spacing} vision=${f.vision} faces=${f.faces.join("/")}` : ""}`).join("\n  ")}\n  -> ${path.relative(ROOT, file)}`);
        if (scan) {
          const found = await scanPage(page, scratch, scale);
          for (const f of found) findings.push({ version, theme, path: p, ...f });
          for (const f of found) console.log(`  SCAN ${f.kind} x${f.count} ${f.url} ${f.what}: ${f.detail}${f.sample ? ` "${f.sample}"` : ""}`);
        }
      }
    }
  }
  if (scan) {
    const file = path.join(out, `scan-${themes.length > 4 ? `${themes.length}-themes` : themes.join("_")}.json`);
    fs.writeFileSync(file, JSON.stringify(findings, null, 1));
    console.log(`\nSCAN: ${findings.length} findings in ${path.relative(ROOT, file)}. Fix each or say why it is fine.`);
  }
  await context.close();
  fs.rmSync(profileDir, { recursive: true, force: true });
  console.log(problems.length ? `\nPROBLEMS (${problems.length}):\n- ${problems.join("\n- ")}` : "\nNo frame problems found. Now read the screenshots.");
  process.exit(problems.length ? 1 : 0);
})();
