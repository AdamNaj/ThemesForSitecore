// Runs against the local Sitecore installs, signed in through `node test/e2e/login.mjs`.
// Read-only: it opens, expands and cancels, and never saves anything.
const { test, expect } = require("@playwright/test");
const { HOSTS, IDENTITY, launchSitecore } = require("./sitecore-env");

const CATALOG = require("../../extension/themes/themes.js");
const THEMES = CATALOG.map((t) => t.id);
const supports = (theme, version) => CATALOG.find((t) => t.id === theme).versions.includes(version);
let context, worker;

test.beforeAll(async () => {
  ({ context, worker } = await launchSitecore());
});
test.afterAll(async () => context?.close());

// every Sitecore and Identity Server site gets the same theme
const ORIGINS = [...Object.values(HOSTS), ...IDENTITY];
const setTheme = (theme) => worker.evaluate(([t, o]) => chrome.storage.sync.set({ overrides: Object.fromEntries(o.map((x) => [x, t])) }), [theme, ORIGINS]);

// Every frame's <html> attributes, so tests can see what the engine did in nested dialogs.
const frameTags = (page) => Promise.all(page.frames().map((f) => f.evaluate(() => ({
  url: location.pathname, ...document.documentElement.dataset,
  owned: document.querySelectorAll("[data-sct-owned]").length,
  sctClasses: document.querySelectorAll('[class*="sct-"]').length,
})).catch(() => null)));

async function signedIn(page, host) {
  await page.goto(`${host}/sitecore/shell/Applications/Content%20Editor.aspx?sc_bw=1`);
  test.skip(/Account\/Login|sitecore\/login/i.test(page.url()), "Not signed in: run node test/e2e/login.mjs first");
  await page.waitForSelector(".scContentTree", { timeout: 30_000 });
}

for (const [version, host] of Object.entries(HOSTS)) {
  test.describe(`Sitecore ${version}`, () => {
    for (const theme of THEMES) {
      test(`${theme}: Content Editor, tree, dialog, live switch`, async () => {
        test.skip(!supports(theme, version), "theme does not support this version");
        await setTheme(theme);
        const page = await context.newPage();
        const errors = [];
        page.on("pageerror", (e) => errors.push(String(e)));
        await signedIn(page, host);

        const expected = theme === "native" ? undefined : theme;
        await expect.poll(() => page.evaluate(() => document.documentElement.dataset.sctTheme)).toBe(expected);
        await expect(page).toHaveScreenshot(`${version}-${theme}-content-editor.png`, { maxDiffPixelRatio: 0.02 });

        // Review Focus 1: a postback that re-renders part of the tree keeps the theme and the tree working.
        const before = await page.locator(".scContentTreeNode").count();
        await page.locator('.scContentTreeNode:has(> a span:text-is("Layout")) > img').first().click();
        await expect.poll(() => page.locator(".scContentTreeNode").count()).toBeGreaterThan(before);
        expect(await page.evaluate(() => document.documentElement.dataset.sctTheme)).toBe(expected);

        // Review Focus 3: the nested dialog frames get the theme too.
        await page.getByRole("button", { name: "Copy to" }).first().click();
        // The first dialog after a cold start can take a few seconds to load its frame.
        const copyFrame = async () => (await frameTags(page)).filter(Boolean).find((t) => /Copy%20to\.aspx|Copy to\.aspx/i.test(t.url));
        await expect.poll(copyFrame, { message: "Copy to dialog frame", timeout: 10000 }).toBeTruthy();
        await expect.poll(async () => (await copyFrame()).sctTheme).toBe(expected);
        const dialog = await copyFrame();
        expect(dialog.sctTheme).toBe(expected);
        await page.keyboard.press("Escape");

        // DOM module budget.
        const applyMs = Number(await page.evaluate(() => document.documentElement.dataset.sctApplyMs || 0));
        expect(applyMs).toBeLessThan(4);

        // Switching to Native leaves nothing behind in any frame.
        await setTheme("native");
        await page.waitForTimeout(1500);
        for (const t of (await frameTags(page)).filter(Boolean)) {
          expect(t.sctTheme, t.url).toBeUndefined();
          expect(t.owned, t.url).toBe(0);
          expect(t.sctClasses, t.url).toBe(0);
        }
        expect(errors.filter((e) => /scForm|Sitecore/i.test(e))).toEqual([]);
        await page.close();
      });

      test(`${theme}: Desktop and Launchpad`, async () => {
        test.skip(!supports(theme, version), "theme does not support this version");
        await setTheme(theme);
        const page = await context.newPage();
        await signedIn(page, host);
        await page.goto(`${host}/sitecore/shell/default.aspx`);
        await page.waitForSelector("#Startbar");
        await expect(page).toHaveScreenshot(`${version}-${theme}-desktop.png`, { maxDiffPixelRatio: 0.02 });
        await page.goto(`${host}/sitecore/client/Applications/Launchpad`);
        await page.waitForLoadState("networkidle");
        await expect(page).toHaveScreenshot(`${version}-${theme}-launchpad.png`, { maxDiffPixelRatio: 0.02 });
        await page.close();
      });
    }

    // Review Focus 2: website content in the Experience Editor looks the same under every theme.
    test("Experience Editor page content is untouched", async () => {
      const page = await context.newPage();
      await signedIn(page, host);
      const probe = () => page.evaluate(() => {
        const el = document.querySelector("main, #main, .container, body > div") || document.body;
        const cs = getComputedStyle(el);
        return { color: cs.color, background: cs.backgroundColor, font: cs.fontFamily, scheme: getComputedStyle(document.documentElement).colorScheme };
      });
      await setTheme("native");
      await page.goto(`${host}/?sc_mode=edit`);
      await page.waitForLoadState("networkidle");
      const baseline = await probe();
      for (const theme of THEMES.filter((t) => t !== "native" && supports(t, version))) {
        await setTheme(theme);
        await page.reload();
        await page.waitForLoadState("networkidle");
        expect(await probe(), theme).toEqual(baseline);
      }
      await page.close();
    });
  });
}

// The axe baseline (test/e2e/a11y-baseline.json): violations per Sitecore version, page, scenario and rule. A count
// may only go down; SCT_A11Y_UPDATE=1 writes what the installs show now, after a phase lowers it.
const A11Y_PAGES = {
  desktop: "/sitecore/shell",
  contentEditor: "/sitecore/shell/Applications/Content%20Editor.aspx?sc_bw=1",
  launchpad: "/sitecore/shell/sitecore/client/Applications/Launchpad",
  ee: "/?sc_mode=edit",
  admin: "/sitecore/admin",
};
// Native and Native with every need: the aids alone; Fjord: a token theme; Chicago: a theme with a DOM module
const A11Y_SCENARIOS = { native: ["native", false], needs: ["native", true], fjord: ["fjord", false], chicago: ["chicago", false] };

test("accessibility problems never grow", async () => {
  test.setTimeout(900_000);
  const { axeCounts } = require("./a11y");
  const file = require("node:path").join(__dirname, "a11y-baseline.json");
  const fs = require("node:fs");
  const update = process.env.SCT_A11Y_UPDATE === "1";
  const baseline = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : {};
  const { NEEDS } = require("../../extension/lib/settings.js");
  const { overrides, accessibility } = await worker.evaluate(() => chrome.storage.sync.get(["overrides", "accessibility"]));
  const counts = {};
  const page = await context.newPage();
  try {
    for (const [version, host] of Object.entries(HOSTS)) {
      await signedIn(page, host);
      for (const [scenario, [theme, needs]] of Object.entries(A11Y_SCENARIOS)) {
        await setTheme(theme);
        await worker.evaluate(([o, a]) => chrome.storage.sync.set({ accessibility: Object.fromEntries(o.map((x) => [x, a])) }), [ORIGINS, needs ? { needs: Object.keys(NEEDS) } : null]);
        for (const [name, path] of Object.entries(A11Y_PAGES)) {
          await page.goto(host + path, { waitUntil: "load" });
          await page.waitForTimeout(4000);
          const found = await axeCounts(page);
          ((counts[version] ||= {})[name] ||= {})[scenario] = found;
          if (update) continue;
          const known = baseline[version]?.[name]?.[scenario];
          expect(known, `${version} ${name} ${scenario}: no baseline, run with SCT_A11Y_UPDATE=1`).toBeTruthy();
          for (const [rule, n] of Object.entries(found)) {
            expect(n, `${version} ${name} ${scenario}: ${rule}`).toBeLessThanOrEqual(known[rule] ?? 0);
          }
        }
      }
    }
  } finally {
    await worker.evaluate(([o, a]) => chrome.storage.sync.set({ overrides: o || {}, accessibility: a || {} }), [overrides, accessibility]);
    await page.close();
  }
  if (update) fs.writeFileSync(file, JSON.stringify(counts, null, 2) + "\n");
});
