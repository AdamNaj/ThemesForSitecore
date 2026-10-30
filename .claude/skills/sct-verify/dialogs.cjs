// Opens the SPEAK dialogs that fields open (the media, link and item pickers) the way Sitecore does: from the Content
// Editor, in its jQuery dialog, at the shell URL the dialog replaces (Sitecore.Speak.Applications.config's overrides).
// Opened on their own, at /sitecore/client/..., they miss the dialog's title bar and were themed even while the real
// ones were not (2026-10-30). For each it checks every frame's surface, scans it (scan.cjs: text, light patches,
// glyphs such as the link tree's expanders), checks for a band of another colour between the title bar and the
// page under it, and screenshots it. Exits 1 on a problem, a band or a finding.
// usage: node .claude/skills/sct-verify/dialogs.cjs --themes losgatos,debrightify [--versions 10.5,10.4]
//          [--scale 1.25] [--scheme dark] [--out test-results/verify] [--only media,link] [--needs motion,keyboard|none]
// Each picker opens from the button of a field on Home (an Image field's Browse, a General Link field's Insert link,
// Insert email and Insert anchor) where Home has one, as people open them, and from a direct call where it has none.
// The accessibility needs default to all six, as on the user's sites: the Reduced motion aid's transitions once made
// jQuery UI size the pickers' frames to 35px, which a run without the aids never showed.
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
let themes = arg("themes", "").split(",").filter(Boolean);
if (themes.includes("all")) themes = CATALOG.map((t) => t.id);
const versions = arg("versions", "10.5,10.4").split(",");
const out = path.resolve(ROOT, arg("out", "test-results/verify"));
const scale = Number(arg("scale", "1"));
const scheme = arg("scheme", "light");
const only = arg("only", "").split(",").filter(Boolean);
const needs = arg("needs", "screen-reader,keyboard,low-vision,colour-vision,reading,motion").split(",").filter((n) => n && n !== "none");
if (!themes.length) {
  console.error("pass --themes id[,id...] or all (ids from extension/themes/themes.js)");
  process.exit(2);
}

// Home, where the fields that open the pickers are
const CE = "/sitecore/shell/Applications/Content%20Editor.aspx?sc_bw=1&fo=%7B110D559F-DEA5-42EA-9C1C-8A5DF7E70EF9%7D";
// select: a tree node to click once the dialog is up, so the link dialogs show their details panel
const DIALOGS = [
  { name: "media", url: "/sitecore/shell/default.aspx?xmlcontrol=Sitecore.Shell.Applications.Media.MediaBrowser", button: "contentimage:open" },
  { name: "link", url: "/sitecore/shell/Applications/Dialogs/Internal%20link.aspx", select: true, button: "contentlink:internallink" },
  { name: "item", url: "/sitecore/shell/Applications/Item%20browser.aspx", select: true },
  { name: "mail", url: "/sitecore/shell/Applications/Dialogs/Mail%20link.aspx", button: "contentlink:mailto" },
  { name: "anchor", url: "/sitecore/shell/Applications/Dialogs/Anchor%20link.aspx", button: "contentlink:anchorlink" },
].filter((d) => !only.length || only.includes(d.name));

// Runs in the jQuery dialog host frame: the title bar's box and colour, and the dialog's content frame.
function dialogBox() {
  const dlg = [...document.querySelectorAll(".ui-dialog")].find((d) => d.offsetHeight);
  if (!dlg) return null;
  const bar = dlg.querySelector(".ui-dialog-titlebar");
  const frame = dlg.querySelector("iframe");
  const r = (el) => { const b = el.getBoundingClientRect(); return { x: b.left, y: b.top, w: b.width, h: b.height }; };
  return { dialog: r(dlg), bar: bar && bar.offsetHeight ? r(bar) : null, frame: frame ? r(frame) : null };
}

// Decodes the screenshot on a blank page and reads one line of pixels, down a column (x) or along a row (y).
function column({ png, x, y0, y1, row, scale }) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = img.width; c.height = img.height;
      const g = c.getContext("2d");
      g.drawImage(img, 0, 0);
      const rows = [];
      for (let i = Math.round(y0 * scale); i < Math.round(y1 * scale); i++) rows.push([...g.getImageData(row ? i : Math.round(x * scale), row ? Math.round(x * scale) : i, 1, 1).data.slice(0, 3)]);
      resolve(rows);
    };
    img.src = `data:image/png;base64,${png}`;
  });
}

// A band: a run of 2 to 20 device rows, at the top of the dialog or between its title strip and the header under
// it, whose colour differs from the rows on both sides of it. Measured down three columns right of the title text,
// where only backgrounds are.
async function bands(page, scratch, host, box) {
  const off = await host.frameElement().then((e) => e.boundingBox());
  // the strip and the caption under it, down to where the frame starts: a band is a run there with another under it
  const top = off.y + box.dialog.y, bottom = off.y + (box.frame ? box.frame.y : box.dialog.y + 60);
  const png = (await page.screenshot()).toString("base64");
  await scratch.goto("about:blank");
  // the dialog's frame, read across its left edge halfway down: a run at the top in one of its colours is the frame
  const left = off.x + box.dialog.x;
  const frame = await scratch.evaluate(column, { png, x: off.y + box.dialog.y + box.dialog.h / 2, y0: left, y1: left + 12, row: true, scale });
  const same = (a, b) => a && b && Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]) <= 12;
  // a step of a few levels is a gradient's, not an edge
  const apart = (a, b) => !b || Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]) > 30;
  const found = new Set();
  for (const share of [0.45, 0.65, 0.85]) {
    const x = off.x + box.dialog.x + box.dialog.w * share;
    const rows = await scratch.evaluate(column, { png, x, y0: top, y1: bottom, scale });
    const runs = [];
    for (const row of rows) {
      const last = runs[runs.length - 1];
      if (last && same(last.c, row)) last.n++;
      else runs.push({ c: row, n: 1, at: runs.reduce((s, q) => s + q.n, 0) });
    }
    if (process.env.SCT_DEBUG) console.log("  runs", x, top, bottom, JSON.stringify(runs.map((r) => [r.at, r.n, r.c.join(",")])));
    for (let i = 0; i < runs.length; i++) {
      const r = runs[i];
      const prev = runs.slice(0, i).reverse().find((q) => q.n > 2), next = runs.slice(i + 1).find((q) => q.n > 2);
      if (r.n < 2 || r.n > 20 * scale) continue;
      // a frame line or shadow at the very top is 1-2px and darker or lighter than both: only bands of 3px or more count
      if (r.at < 12 * scale && frame.some((c) => same(c, r.c))) continue;
      // a colour that comes back further on is a pattern (Guardrail's warning stripes), not a band
      if (runs.some((q, j) => Math.abs(j - i) > 1 && q.n >= 2 && same(q.c, r.c))) continue;
      if (r.n >= 3 * scale && apart(r.c, prev?.c) && next && apart(r.c, next.c)) {
        found.add(`${Math.round(r.n / scale)}px band rgb(${r.c.join(", ")}) at ${Math.round(r.at / scale)}px from the dialog's top, ${prev ? `between rgb(${prev.c.join(", ")}) and` : "above"} rgb(${next.c.join(", ")})`);
      }
    }
  }
  return [...found];
}

function copyProfile() {
  const dest = fs.mkdtempSync(path.join(os.tmpdir(), "sct-dialogs-profile-"));
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
    deviceScaleFactor: scale, colorScheme: scheme, viewport: { width: 1300, height: 760 }, ignoreDefaultArgs: ["--hide-scrollbars"],
  });
  const page = await context.newPage();
  const scratch = await context.newPage();
  const findings = [], problems = [];
  const key = (f) => `${f.kind}|${f.url}|${f.what}|${f.detail}`;
  for (const version of versions) {
    for (const theme of themes) {
      if (!(CATALOG.find((t) => t.id === theme)?.versions || [version]).includes(version)) {
        console.log(`${version} ${theme}: not supported on this version, skipped`);
        continue;
      }
      await worker.evaluate(([t, o, n]) => chrome.storage.sync.set({
        overrides: Object.fromEntries(o.map((x) => [x, t])),
        // the Reading guide's band follows the pointer, which rests where the field's button was: off, or the band check
        // reports the guide
        accessibility: n.length ? Object.fromEntries(o.map((x) => [x, { needs: n, aids: { "reading-guide": false } }])) : {},
      }), [theme, origins, needs]);
      for (const d of DIALOGS) {
        const label = `${version} ${theme} ${scale}x ${d.name}`;
        try {
          // a fresh Content Editor per dialog: closing one leaves the host frame in whatever state its theme left it
          await page.goto(HOSTS[version] + CE, { waitUntil: "domcontentloaded", timeout: 60000 });
          await page.waitForLoadState("load", { timeout: 30000 }).catch(() => {});
          await page.waitForTimeout(1500);
          if (/\/Account\/Login|\/sitecore\/login|LicenseOptions/i.test(page.url())) throw new Error(`landed on ${new URL(page.url()).pathname}; re-copy .auth/profile, or wait for Sitecore's sessions to time out`);
          const before = new Set((await scanPage(page, scratch, scale)).map(key));
          const clicked = d.button && (await page.evaluate((b) => {
            const a = [...document.querySelectorAll("a.scContentButton")].find((x) => (x.getAttribute("onclick") || "").includes(`'${b}(`));
            if (a) a.click();
            return !!a;
          }, d.button));
          if (!clicked) await page.evaluate((u) => scForm.showModalDialog(u, null, "dialogWidth:1100px;dialogHeight:640px"), d.url);
          // jQuery UI moves the iframe into its dialog, which loads it again: wait for a live frame with SPEAK's markup
          const deadline = Date.now() + 30000;
          let inner = null;
          while (!inner && Date.now() < deadline) {
            for (const f of page.frames().filter((f) => f.url().toLowerCase().includes(d.url.toLowerCase()))) {
              if (await f.evaluate(() => document.readyState === "complete" && !!document.querySelector("[data-sc-id]")).catch(() => false)) inner = f;
            }
            if (!inner) await page.waitForTimeout(500);
          }
          if (!inner) throw new Error("the dialog's frame never showed a SPEAK page");
          await page.waitForTimeout(2500); // SPEAK renders its trees and lists after load
          if (d.select) {
            // a tree longer than the dialog, as on a real site: the page must not scroll under its fixed title row
            for (let i = 0; i < 4; i++) {
              const more = await inner.evaluate(() => {
                const shut = document.querySelectorAll(".dynatree-node.dynatree-has-children:not(.dynatree-expanded) > .dynatree-expander");
                shut.forEach((e) => e.click());
                return shut.length && document.querySelectorAll(".dynatree-node").length < 40;
              });
              await page.waitForTimeout(1500);
              if (!more) break;
            }
            const node = inner.locator(".dynatree-title, .dynatree-node a").nth(1);
            if (await node.count()) { await node.click({ timeout: 3000 }).catch(() => {}); await page.waitForTimeout(1500); }
          }
          // a frame jQuery UI sized while it misread the frame's height (2026-10-30: 35px)
          const tall = await inner.evaluate(() => innerHeight);
          if (tall < 300) problems.push(`${label}: the dialog's frame is ${tall}px tall: collapsed`);
          const scrolls = await inner.evaluate(() => document.scrollingElement.scrollHeight - innerHeight);
          if (scrolls > 1 && theme !== "native") problems.push(`${label}: the page scrolls ${scrolls}px inside the dialog, its scrollbar down the frame past the title row`);
          const host = page.frames().find((f) => /JqueryModalDialogs\.html/i.test(f.url()));
          const attrs = await inner.evaluate(() => ({ surface: document.documentElement.dataset.sctSurface, theme: document.documentElement.dataset.sctTheme }));
          if (attrs.surface !== "speak") problems.push(`${label}: the dialog's frame is ${attrs.surface || "unthemed"}, not speak`);
          if (theme !== "native" && attrs.theme !== theme) problems.push(`${label}: the dialog's frame has theme ${attrs.theme}`);
          const file = path.join(out, `${version}-${theme}-${scale}x-dialog-${d.name}.png`);
          await page.screenshot({ path: file });
          console.log(`${label} -> ${path.relative(ROOT, file)}`);
          const box = host ? await host.evaluate(dialogBox) : null;
          if (!box) problems.push(`${label}: no jQuery dialog found`);
          else if (theme !== "native") for (const b of await bands(page, scratch, host, box)) {
            findings.push({ version, theme, scale, dialog: d.name, kind: "band", what: ".ui-dialog", detail: b, count: 1 });
            console.log(`  SCAN band ${b}`);
          }
          // only the dialog's frames: the overlay dims the page under it, and that page has its own runs
          const mine = new Set([await host.evaluate(() => location.pathname), await inner.evaluate(() => location.pathname)]);
          // the content between the title and the buttons scrolls for the expanded tree; the room it could grow
          // into is under the fixed buttons
          const scrolling = (f) => f.kind === "scroll" && /section\.sc-dialogContent$/.test(f.what);
          for (const f of (await scanPage(page, scratch, scale)).filter((f) => mine.has(f.url) && !before.has(key(f)) && !scrolling(f))) {
            findings.push({ version, theme, scale, dialog: d.name, ...f });
            console.log(`  SCAN ${f.kind} x${f.count} ${f.url} ${f.what}: ${f.detail}${f.sample ? ` "${f.sample}"` : ""}`);
          }
        } catch (e) {
          problems.push(`${label}: ${e.message.split("\n")[0]}`);
        }
      }
    }
  }
  const file = path.join(out, `scan-dialogs-${themes.length > 4 ? `${themes.length}-themes` : themes.join("_")}-${versions.join("_")}-${scale}x.json`);
  fs.writeFileSync(file, JSON.stringify(findings, null, 1));
  await context.close();
  fs.rmSync(profileDir, { recursive: true, force: true });
  console.log(`\nSCAN: ${findings.length} dialog findings in ${path.relative(ROOT, file)}. Fix each or say why it is fine.`);
  if (problems.length) console.log(`\nPROBLEMS (${problems.length}):\n- ${problems.join("\n- ")}`);
  process.exit(problems.length || findings.length ? 1 : 0);
})();
