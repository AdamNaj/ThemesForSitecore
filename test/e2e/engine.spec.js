const { test, expect } = require("@playwright/test");
const { extensionCopy, launchWithExtension, fixtureServer } = require("./helpers");

const PORT = 4917;
const BASE = `http://localhost:${PORT}`;
const BASE104 = "http://localhost:4920";
let server, server104, context, worker;

test.beforeAll(async () => {
  server = await fixtureServer(PORT);
  server104 = await fixtureServer(4920, "site104");
  ({ context, worker } = await launchWithExtension(extensionCopy([`${BASE}/*`, `${BASE104}/*`])));
});

test.afterAll(async () => {
  await context?.close();
  server?.close();
  server104?.close();
});

const appBg = (page) => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--sct-app-bg").trim());
// both fixture sites get the same theme
const setTheme = (theme) => worker.evaluate(([t, o]) => chrome.storage.sync.set({ overrides: Object.fromEntries(o.map((x) => [x, t])) }), [theme, [BASE, BASE104]]);
const attrs = (page) => page.evaluate(() => ({ ...document.documentElement.dataset }));

test("tags a Sitecore frame and inserts its theme's CSS", async () => {
  await setTheme("debrightify"); // a site without a theme of its own is Native
  const page = await context.newPage();
  await page.goto(`${BASE}/sitecore/shell/default.aspx`);
  await expect.poll(() => attrs(page)).toMatchObject({ sctSurface: "shell", sctTheme: "debrightify", sctVersion: "10.5" });
  expect(await page.evaluate(() => document.documentElement.hasAttribute("data-sct-tokens"))).toBe(true);
  await expect.poll(() => appBg(page)).toBe("#1e1f22");
  await page.close();
});

test("leaves a non-Sitecore page alone", async () => {
  const page = await context.newPage();
  await page.goto(`${BASE}/index.html`);
  await page.waitForTimeout(500);
  expect(await attrs(page)).toEqual({});
  await page.close();
});

test("switches theme live when the site's theme changes, and back", async () => {
  const page = await context.newPage();
  await page.goto(`${BASE}/sitecore/shell/default.aspx`);
  await expect.poll(() => appBg(page)).toBe("#1e1f22");

  await setTheme("native");
  await expect.poll(() => attrs(page)).not.toHaveProperty("sctTheme");
  await expect.poll(() => appBg(page)).toBe("");

  await setTheme("debrightify");
  await expect.poll(() => appBg(page)).toBe("#1e1f22");
  await page.close();
});

test("another site's theme leaves this one Native", async () => {
  const page = await context.newPage();
  await page.goto(`${BASE}/sitecore/shell/default.aspx`);
  await worker.evaluate((origin) => chrome.storage.sync.set({ overrides: { [origin]: "cupertino" } }), BASE104);
  await expect.poll(() => appBg(page)).toBe("");
  await setTheme("debrightify");
  await expect.poll(() => appBg(page)).toBe("#1e1f22");
  await page.close();
});

test("caches the version from sitecore.version.xml", async () => {
  const page = await context.newPage();
  await page.goto(`${BASE}/sitecore/shell/default.aspx`);
  await expect.poll(() => worker.evaluate(() => chrome.storage.local.get("sitecoreVersions").then((r) => r.sitecoreVersions))).toMatchObject({ [BASE]: "10.5" });
  await page.close();
});

// Playwright's command-line extension does not survive runtime.reload(), so the handover is
// driven directly: a newer engine announces itself by writing its id on <html>.
test("an engine stands down when a newer engine takes the page", async () => {
  const page = await context.newPage();
  await page.goto(`${BASE}/sitecore/shell/default.aspx`);
  await expect.poll(() => attrs(page)).toMatchObject({ sctTheme: "debrightify" });

  await page.evaluate(() => (document.documentElement.dataset.sctEngine = "newer-engine"));
  await setTheme("native");
  await page.waitForTimeout(1000);
  expect((await attrs(page)).sctTheme).toBe("debrightify"); // the old engine no longer reacts

  await setTheme("debrightify");
  await page.close();
});

test("dev installs accept settings from a page message", async () => {
  const page = await context.newPage();
  await page.goto(`${BASE}/sitecore/shell/default.aspx`);
  await expect.poll(() => attrs(page)).toMatchObject({ sctTheme: "debrightify" });
  await page.evaluate(() => window.postMessage({ type: "sct-dev-set", values: { overrides: {}, evil: 1 } }, "*"));
  await expect.poll(() => attrs(page)).not.toHaveProperty("sctTheme");
  expect(await worker.evaluate(() => chrome.storage.sync.get(null))).not.toHaveProperty("evil");
  await setTheme("debrightify");
  await page.close();
});

test("a site's hue turns Fjord's tokens, and only under a theme that offers one", async () => {
  const page = await context.newPage();
  await setTheme("fjord");
  await page.goto(`${BASE}/sitecore/shell/default.aspx`);
  await expect.poll(() => attrs(page)).toMatchObject({ sctTheme: "fjord" });
  const hue = () => page.evaluate(() => [document.documentElement.dataset.sctHue, document.documentElement.style.getPropertyValue("--sct-hue")]);
  const bg = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  const own = await bg();
  await worker.evaluate((o) => chrome.storage.sync.set({ hues: { [o]: { fjord: 120, other: 200 } } }), BASE); // one per theme
  await expect.poll(hue).toEqual(["120", "120"]);
  await expect.poll(bg).not.toBe(own);
  await setTheme("debrightify");
  await expect.poll(hue).toEqual([undefined, ""]);
  await setTheme("fjord");
  await expect.poll(hue).toEqual(["120", "120"]);
  await worker.evaluate(() => chrome.storage.sync.remove("hues"));
  await expect.poll(hue).toEqual([undefined, ""]);
  await expect.poll(bg).toBe(own);
  await setTheme("debrightify");
  await page.close();
});

test("the site's postfix shows centred in Sitecore's top bar, and the add-on's database name moves aside", async () => {
  await setTheme("debrightify");
  const page = await context.newPage();
  await page.setViewportSize({ width: 1024, height: 600 });
  await page.goto(`${BASE}/sitecore/shell/globalheader.aspx`);
  await expect.poll(() => attrs(page)).toMatchObject({ sctTheme: "debrightify" });
  const bar = () => page.evaluate(() => {
    const p = document.querySelector(".sc-globalHeader > sct-bar-postfix[data-sct-owned]");
    const box = (el) => { const r = el.getBoundingClientRect(); return { l: r.left, r: r.right, cx: (r.left + r.right) / 2, cy: (r.top + r.bottom) / 2 }; };
    const range = document.createRange();
    range.selectNodeContents(document.querySelector(".sc-ext-dbName"));
    const db = range.getBoundingClientRect();
    return p && { text: p.textContent, count: document.querySelectorAll("sct-bar-postfix").length, p: box(p), db: { l: db.left, r: db.right }, logout: box(document.querySelector(".logout")) };
  });
  expect(await bar()).toBeNull(); // no postfix set

  await worker.evaluate((o) => chrome.storage.sync.set({ titles: { [o]: "  DEV   10.5 " } }), BASE);
  await expect.poll(async () => (await bar())?.text).toBe("DEV 10.5");
  let b = await bar();
  expect(b.count).toBe(1);
  expect(Math.abs(b.p.cx - 512)).toBeLessThan(1);
  expect(Math.abs(b.p.cy - 25)).toBeLessThan(1);
  expect(b.db.l).toBeGreaterThan(b.p.r); // right of the postfix
  expect(b.db.r).toBeLessThan(b.logout.l); // left of Log out

  // Native keeps the add-on's name in the middle and puts the postfix left of it
  await setTheme("native");
  await expect.poll(() => attrs(page)).not.toHaveProperty("sctTheme");
  await expect.poll(async () => (await bar()).p.r < (await bar()).db.l).toBe(true);
  expect(Math.abs(((await bar()).db.l + (await bar()).db.r) / 2 - 512)).toBeLessThan(1);

  await worker.evaluate(() => chrome.storage.sync.remove("titles"));
  await expect.poll(bar).toBeNull();
  expect(await page.evaluate(() => document.querySelectorAll("sct-bar-postfix, style[data-sct-bar]").length)).toBe(0);
  await setTheme("debrightify");
  await page.close();
});

test("the popup's hue slider turns the page, and the theme keeps it", async () => {
  const url = `${BASE}/sitecore/shell/default.aspx`;
  await setTheme("debrightify");
  const site = await context.newPage();
  await site.goto(url);
  const popup = await context.newPage();
  await popup.addInitScript((u) => (chrome.tabs.query = async () => [{ url: u, id: 1 }]), url); // the popup's site
  const errors = [];
  popup.on("pageerror", (e) => errors.push(String(e)));
  await popup.goto(`chrome-extension://${new URL(worker.url()).host}/popup/popup.html`);
  const hue = () => site.evaluate(() => [document.documentElement.dataset.sctTheme, document.documentElement.dataset.sctHue]);
  const pick = async (id) => {
    await popup.locator(`#themes input[value="${id}"]`).check({ force: true });
    await expect.poll(async () => (await hue())[0]).toBe(id);
  };
  const slide = (v) => popup.locator("#hue-range").evaluate((r, d) => {
    r.value = d;
    r.dispatchEvent(new Event("input"));
    r.dispatchEvent(new Event("change"));
  }, v);

  await pick("fjord");
  await slide(60);
  await expect.poll(hue).toEqual(["fjord", "60"]);
  await pick("debrightify");
  await expect(popup.locator("#hue")).toBeHidden();
  await expect.poll(hue).toEqual(["debrightify", undefined]);
  await pick("fjord");
  await expect.poll(hue).toEqual(["fjord", "60"]);
  expect(await popup.locator("#hue-range").inputValue()).toBe("60");
  expect(await worker.evaluate((o) => chrome.storage.sync.get("hues").then((s) => s.hues[o]), BASE)).toEqual({ fjord: 60 });
  expect(errors).toEqual([]);

  await worker.evaluate(() => chrome.storage.sync.remove("hues"));
  await setTheme("debrightify");
  await site.close();
  await popup.close();
});

test("the popup's time of day pins Meridian's phase, and Auto gives it back to the clock", async () => {
  const url = `${BASE}/sitecore/shell/default.aspx`;
  await setTheme("meridian");
  const site = await context.newPage();
  await site.goto(url);
  const popup = await context.newPage();
  await popup.addInitScript((u) => (chrome.tabs.query = async () => [{ url: u, id: 1 }]), url); // the popup's site
  const errors = [];
  popup.on("pageerror", (e) => errors.push(String(e)));
  await popup.goto(`chrome-extension://${new URL(worker.url()).host}/popup/popup.html`);
  const phase = () => site.evaluate(() => [document.documentElement.dataset.sctPhase, document.documentElement.dataset.sctPhasePin]);
  const pin = (v) => popup.locator(`#phase input[value="${v}"]`).check({ force: true });

  await expect(popup.locator("#phase")).toBeVisible();
  expect(await popup.locator('#phase input[value=""]').isChecked()).toBe(true);
  await pin("dusk");
  await expect.poll(phase).toEqual(["dusk", "dusk"]);
  await pin("night");
  await expect.poll(phase).toEqual(["night", "night"]);
  expect(await worker.evaluate((o) => chrome.storage.sync.get("phases").then((s) => s.phases[o]), BASE)).toBe("night");
  await pin("");
  await expect.poll(async () => (await phase())[1]).toBeUndefined();
  expect(["dawn", "day", "dusk", "night"]).toContain((await phase())[0]);
  expect(await worker.evaluate((o) => chrome.storage.sync.get("phases").then((s) => s.phases[o]), BASE)).toBeUndefined();
  await popup.locator('#themes input[value="debrightify"]').check({ force: true });
  await expect(popup.locator("#phase")).toBeHidden();
  expect(errors).toEqual([]);

  await worker.evaluate(() => chrome.storage.sync.remove("phases"));
  await setTheme("debrightify");
  await site.close();
  await popup.close();
});

test("popup loads without errors", async () => {
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  const id = new URL(worker.url()).host;
  await page.goto(`chrome-extension://${id}/popup/popup.html`);
  await expect(page.locator("#no-site")).toBeVisible();
  expect(errors).toEqual([]);
  await page.close();
});

test("applies an imported theme and swaps its CSS on update", async () => {
  const page = await context.newPage();
  await page.goto(`${BASE}/sitecore/shell/default.aspx`);
  const css = (bg) => `html[data-sct-theme="import:mine"] { --sct-app-bg: ${bg}; }`;
  const imported = (bg) => ({ "import:mine": { name: "Mine", versions: ["10.4", "10.5"], usesTokens: false, css: css(bg) } });

  await worker.evaluate((v) => chrome.storage.local.set({ imported: v }), imported("#123456"));
  await setTheme("import:mine");
  await expect.poll(() => appBg(page)).toBe("#123456");

  await worker.evaluate((v) => chrome.storage.local.set({ imported: v }), imported("#654321"));
  await expect.poll(() => appBg(page)).toBe("#654321");

  await setTheme("debrightify");
  await expect.poll(() => appBg(page)).toBe("#1e1f22");
  await page.close();
});

test("SPEAK selectors that start at <html> still match", async () => {
  // Forms puts .sc-flx on <html>; Sitecore's ".sc-flx .sc-list" must still be recoloured.
  const page = await context.newPage();
  await page.goto(`${BASE}/sitecore/client/Applications/FormsBuilder/Pages/Forms`);
  await expect.poll(() => page.evaluate(() => getComputedStyle(document.getElementById("list")).backgroundColor)).toBe("rgb(38, 40, 43)");
  await page.close();
});

test("a 10.4 host stays 10.4 after the page and the theme's own CSS load", async () => {
  const page = await context.newPage();
  await page.goto(`${BASE104}/sitecore/shell/default.aspx`);
  await page.waitForLoadState("load");
  await page.waitForTimeout(800);
  expect((await attrs(page)).sctVersion).toBe("10.4");
  const cached = await worker.evaluate(async (o) => {
    const all = await chrome.storage.local.get(null);
    return Object.values(all).find((v) => v && typeof v === "object" && o in v)?.[o];
  }, BASE104);
  expect(cached).toBe("10.4");
  await page.close();
});

test("a quick A, B, A switch ends on A with A's CSS in place", async () => {
  const page = await context.newPage();
  await page.goto(`${BASE}/sitecore/shell/default.aspx`);
  await expect.poll(() => appBg(page)).toBe("#1e1f22");
  await worker.evaluate(async (o) => {
    await chrome.storage.sync.set({ overrides: { [o]: "cupertino" } });
    await new Promise((r) => setTimeout(r, 5));
    await chrome.storage.sync.set({ overrides: { [o]: "debrightify" } });
  }, BASE);
  await page.waitForTimeout(1500);
  expect((await attrs(page)).sctTheme).toBe("debrightify");
  expect(await appBg(page)).toBe("#1e1f22");
  await page.close();
});

test("removing an imported token theme removes all of its CSS", async () => {
  const page = await context.newPage();
  await page.goto(`${BASE}/sitecore/shell/default.aspx`);
  const leak = () => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--leak").trim());
  await worker.evaluate(() => chrome.storage.local.set({ imported: { "import:leak": { name: "Leak", versions: ["10.4", "10.5"], usesTokens: true, css: ":root { --leak: yes; }" } } }));
  await setTheme("import:leak");
  await expect.poll(leak).toBe("yes");
  await worker.evaluate(() => chrome.storage.local.set({ imported: {} }));
  await expect.poll(leak).toBe("");
  await setTheme("debrightify");
  await page.close();
});

test("Redmond 3.11 leaves the Ace code editor's monospace font alone", async () => {
  const page = await context.newPage();
  await setTheme("workgroups311");
  await page.goto(`${BASE}/sitecore/shell/ace.html`);
  await expect.poll(() => attrs(page).then((a) => a.sctTheme)).toBe("workgroups311");
  expect(await page.evaluate(() => getComputedStyle(document.getElementById("line")).fontFamily)).toBe("monospace");
  await setTheme("debrightify");
  await page.close();
});

test("Sitecore's modal dialog frame stays see-through, so only its overlay tints the app", async () => {
  const page = await context.newPage();
  await page.goto(`${BASE}/sitecore/shell/Controls/JqueryModalDialogs.html`);
  await expect.poll(() => attrs(page).then((a) => a.sctTheme)).toBe("debrightify");
  await expect.poll(() => page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe("rgba(0, 0, 0, 0)");
  await page.close();
});

test("the ISE console's clipboard textarea stays invisible", async () => {
  const page = await context.newPage();
  await page.goto(`${BASE}/sitecore/shell/ace.html`);
  await expect.poll(() => attrs(page).then((a) => a.sctTheme)).toBe("debrightify");
  const look = await page.evaluate(() => {
    const cs = getComputedStyle(document.getElementById("clipboard"));
    return { bg: cs.backgroundColor, border: cs.borderTopWidth, shadow: cs.boxShadow };
  });
  expect(look).toEqual({ bg: "rgba(0, 0, 0, 0)", border: "0px", shadow: "none" });
  await page.close();
});

test("the ISE's Write-Progress overlay is opaque and uses the theme's panel text colour", async () => {
  const page = await context.newPage();
  await page.goto(`${BASE}/sitecore/shell/ace.html`);
  await expect.poll(() => attrs(page).then((a) => a.sctTheme)).toBe("debrightify");
  const look = await page.evaluate(() => {
    const cs = getComputedStyle(document.getElementById("ProgressOverlay"));
    const probe = document.body.appendChild(document.createElement("i"));
    probe.style.color = "var(--sct-panel-fg)";
    const panelFg = getComputedStyle(probe).color;
    probe.remove();
    return { opacity: cs.opacity, text: getComputedStyle(document.querySelector("#Progress h2")).color === panelFg };
  });
  expect(look).toEqual({ opacity: "1", text: true });
  await page.close();
});

test("dev messages from another window are ignored", async () => {
  const page = await context.newPage();
  await page.goto(`${BASE}/sitecore/shell/default.aspx`);
  await expect.poll(() => attrs(page)).toMatchObject({ sctTheme: "debrightify" });
  await page.evaluate(() => {
    const f = document.createElement("iframe");
    f.srcdoc = "<script>parent.postMessage({ type: 'sct-dev-set', values: { overrides: {} } }, '*')</script>";
    document.body.append(f);
  });
  await page.waitForTimeout(1500);
  expect((await attrs(page)).sctTheme).toBe("debrightify");
  await page.close();
});

test("token themes map a module's stylesheet and inline styles at run time, and Native takes it back", async () => {
  await setTheme("debrightify");
  const page = await context.newPage();
  await page.goto(`${BASE}/sitecore%20modules/Shell/LiveMap/report.html`);
  const look = (id) => page.evaluate((id) => {
    const cs = getComputedStyle(document.getElementById(id));
    return { bg: cs.backgroundColor, fg: cs.color };
  }, id);
  const panel = { bg: "rgb(38, 40, 43)", fg: "rgb(214, 216, 219)" }; // --sct-panel-bg, --sct-app-fg
  await expect.poll(() => look("panel")).toEqual(panel);
  await expect.poll(() => look("ink")).toEqual(panel);
  expect(await look("darkbox")).toEqual({ bg: "rgb(1, 36, 86)", fg: "rgb(255, 255, 255)" }); // already dark

  // HTML a script writes later is mapped too
  await page.evaluate(() => document.body.insertAdjacentHTML("beforeend", '<p id="late" style="background-color: white; color: black">Later</p>'));
  await expect.poll(() => look("late")).toEqual(panel);

  await setTheme("native");
  await expect.poll(() => look("ink")).toEqual({ bg: "rgb(255, 255, 255)", fg: "rgb(51, 51, 51)" });
  expect(await look("panel")).toEqual({ bg: "rgb(255, 255, 255)", fg: "rgb(51, 51, 51)" });
  expect(await page.evaluate(() => document.querySelectorAll("[data-sct-owned], [data-sct-ink]").length)).toBe(0);
  await setTheme("debrightify");
  await page.close();
});
