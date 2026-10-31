// The ISE's variable preview under each theme: SPE shows a variable's value in Ace's tooltip while the pointer
// rests on a variable the ISE's session has defined. It only exists while hovered, and scan.cjs leaves the
// editor out, so shots.cjs never sees it. This runs a script in the standalone ISE (no dialogs), hovers a
// defined variable and an undefined one, and checks that
//   - the preview shows;
//   - on a token theme it is not Ace's own light grey box (#f5f5f5 in a grey frame);
//   - every piece of text in it (the type band, names, values) reaches 4.5:1 against what is behind it.
// Sitecore's own looks (Native and the non-token themes) keep SPE's preview and are only screenshotted.
// It crops each preview into --out for reading. Exits non-zero on any failure.
// usage: node .claude/skills/sct-verify/varpreview.cjs --themes redwood,sonata|all [--versions 10.5,10.4] [--scale 1.25] [--out test-results/varpreview]
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
const out = path.resolve(ROOT, arg("out", "test-results/varpreview"));
if (!themes.length) {
  console.error("pass --themes id[,id...] (ids from extension/themes/themes.js)");
  process.exit(2);
}

// no Read-Variable or Show-Result: a dialog left open hangs the sign-in's session (AGENTS.md)
const SCRIPT = "$item = Get-Item master:/content/home\n$item.Name\n$nothing";

// Runs in the ISE. The open preview's box, whether it is Ace's own, and each text part below 4.5:1.
const inspect = () => {
  const tip = [...document.querySelectorAll(".ace_tooltip")].find((t) => t.offsetWidth);
  if (!tip) return null;
  const rgba = (s) => (/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?/.exec(s) || []).slice(1).map((v, i) => (v === undefined ? (i === 3 ? 1 : 0) : +v));
  const lum = ([r, g, b]) => [r, g, b].map((v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)).reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0);
  const ratio = (a, b) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);
  const behind = (el) => {
    for (let n = el; n; n = n.parentElement) {
      const c = rgba(getComputedStyle(n).backgroundColor);
      if (c[3] >= 0.6) return c;
    }
    return [255, 255, 255, 1];
  };
  const low = [];
  const walk = document.createTreeWalker(tip, NodeFilter.SHOW_TEXT);
  for (let t = walk.nextNode(); t; t = walk.nextNode()) {
    if (!t.textContent.trim()) continue;
    const el = t.parentElement, fg = rgba(getComputedStyle(el).color), r = ratio(fg, behind(el));
    if (r < 4.5) low.push(`${el.className || el.tagName.toLowerCase()} "${t.textContent.trim().slice(0, 24)}" ${r.toFixed(2)}:1`);
  }
  const s = getComputedStyle(tip), b = tip.getBoundingClientRect();
  return {
    aces: s.backgroundColor === "rgb(245, 245, 245)" && s.borderTopColor === "rgb(128, 128, 128)",
    low: [...new Set(low)],
    box: { x: b.left, y: b.top, w: b.width, h: b.height },
  };
};

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "sct-varpreview-profile-"));
  const skip = /[\\/](Cache|Code Cache|GPUCache|Service Worker)([\\/]|$)|[\\/]Singleton[^\\/]*$/;
  fs.cpSync(PROFILE, profile, { recursive: true, filter: (s) => !skip.test(s) });
  const origins = [...Object.values(HOSTS), ...IDENTITY];
  const { context, worker } = await launchWithExtension(extensionCopy(origins.map((o) => `${o}/*`)), profile, { deviceScaleFactor: scale, viewport: { width: 1300, height: 760 } });
  const page = await context.newPage();
  const problems = [];
  for (const version of versions) {
    for (const theme of themes) {
      const entry = CATALOG.find((t) => t.id === theme);
      if (!(entry?.versions || [version]).includes(version)) continue;
      const label = `${version} ${theme}`;
      await worker.evaluate(([t, o]) => chrome.storage.sync.set({ overrides: Object.fromEntries(o.map((x) => [x, t])) }), [theme, origins]);
      await page.goto(HOSTS[version] + "/sitecore/shell/Applications/PowerShell/PowerShellIse?sc_bw=1", { waitUntil: "domcontentloaded", timeout: 90000 }).catch(() => {});
      await page.waitForTimeout(6000);
      if (!/PowerShellIse/i.test(page.url())) {
        problems.push(`${label}: the ISE did not open (${page.url()}); a license limit or an expired sign-in`);
        continue;
      }
      // the visible script tab gets the script; ise:execute runs it in the ISE's session. The ISE keeps a tab's
      // text across visits, so the tab gets its own text back afterwards.
      const own = await page.evaluate((src) => {
        const ed = ace.edit([...document.querySelectorAll(".aceCodeEditor")].find((e) => e.offsetWidth).id);
        const was = ed.getValue();
        ed.setValue(src, 1);
        scForm.postRequest("", "", "", "ise:execute");
        return was;
      }, SCRIPT);
      await page.waitForTimeout(5000);
      for (const [name, re] of [["defined", /^\$item$/], ["undefined", /^\$nothing$/]]) {
        const at = await page.evaluate((src) => {
          const re = new RegExp(src);
          const ed = [...document.querySelectorAll(".aceCodeEditor")].find((e) => e.offsetWidth);
          const t = [...ed.querySelectorAll(".ace_line span")].find((s) => re.test(s.textContent.trim()));
          if (!t) return null;
          const b = t.getBoundingClientRect();
          return { x: b.left + b.width / 2, y: b.top + b.height / 2 };
        }, re.source);
        if (!at) { problems.push(`${label}: no ${name} variable token in the editor`); continue; }
        // two moves, as a hand makes: Ace reads the token under the last one
        await page.mouse.move(at.x, at.y);
        await page.mouse.move(at.x + 2, at.y);
        await page.waitForTimeout(1500);
        const r = await page.evaluate(inspect);
        if (!r) { problems.push(`${label}: no preview over the ${name} variable`); continue; }
        const stock = theme === "native" || !entry?.usesTokens;
        if (!stock) {
          if (r.aces) problems.push(`${label} ${name}: the preview is Ace's own light grey box, not themed`);
          for (const l of r.low) problems.push(`${label} ${name}: ${l}`);
        }
        console.log(`${label} ${name}: ${stock ? "stock look" : r.aces ? "UNTHEMED" : "themed"}${r.low.length ? `, ${r.low.length} below 4.5:1` : ""}`);
        await page.screenshot({ path: path.join(out, `${version}-${theme}-${name}.png`), clip: { x: Math.max(0, r.box.x - 60), y: Math.max(0, r.box.y - 50), width: Math.min(r.box.w + 120, 600), height: Math.min(r.box.h + 60, 500) } });
      }
      await page.mouse.move(5, 5);
      await page.evaluate((was) => ace.edit([...document.querySelectorAll(".aceCodeEditor")].find((e) => e.offsetWidth).id).setValue(was, -1), own);
      await page.waitForTimeout(500);
    }
  }
  await context.close();
  fs.rmSync(profile, { recursive: true, force: true });
  console.log(problems.length ? `\nPROBLEMS (${problems.length}):\n- ${problems.join("\n- ")}` : "\nNo variable preview problems found. Now read the crops.");
  process.exit(problems.length ? 1 : 0);
})();
