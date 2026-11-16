const api = globalThis.browser ?? globalThis.chrome;
const $ = (sel) => document.querySelector(sel);

let origin = null;

// The Light/Dark pill shows on an enabled site whose theme has both looks (appearance "auto").
let siteEnabled = false, bothLooks = false;
const syncMode = () => ($("#mode").hidden = !(siteEnabled && bothLooks));

function show(id) {
  for (const s of ["#no-site", "#disabled", "#enabled"]) $(s).hidden = s !== id;
  // the settings are this site's, so they exist only once it is enabled
  $("#open-settings").hidden = !(siteEnabled = id === "#enabled");
  syncMode();
  if (id !== "#enabled") showSettings(false);
}

// The gear slides the picker out to the left and the settings in from the right; the back arrow (or Escape)
// returns. The view out of sight is inert, so Tab never lands in it.
function showSettings(on) {
  if (document.body.classList.contains("settings-open") === on) return;
  if (on) showTab(settingsTabs.firstElementChild);
  document.body.classList.toggle("settings-open", on);
  $("#main-view").inert = on;
  $("#settings-view").inert = !on;
  $("#open-settings").setAttribute("aria-expanded", String(on));
  (on ? $("#close-settings") : $("#open-settings")).focus({ preventScroll: true });
}

// The settings' pages, one at a time under their tabs.
const settingsTabs = $("#settings-tabs");
function showTab(tab) {
  for (const t of settingsTabs.children) {
    const on = t === tab;
    t.setAttribute("aria-selected", String(on));
    t.tabIndex = on ? 0 : -1;
    $(`#${t.getAttribute("aria-controls")}`).hidden = !on;
  }
}
settingsTabs.onclick = (e) => {
  const tab = e.target.closest('[role="tab"]');
  if (tab) showTab(tab);
};
// arrow keys, Home and End move between tabs and open the one they reach
settingsTabs.onkeydown = (e) => {
  const all = [...settingsTabs.children], i = all.indexOf(e.target);
  const to = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: all.length - 1 }[e.key];
  if (i < 0 || to === undefined) return;
  e.preventDefault();
  const tab = all[(to + all.length) % all.length];
  showTab(tab);
  tab.focus();
};
$("#open-settings").onclick = () => showSettings(true);
$("#close-settings").onclick = () => showSettings(false);
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && document.body.classList.contains("settings-open")) {
    e.preventDefault(); // the popup would close
    showSettings(false);
  }
});

async function currentOrigin() {
  const [tab] = await api.tabs.query({ active: true, currentWindow: true });
  try {
    const url = new URL(tab.url);
    return url.protocol === "https:" || url.protocol === "http:" ? url.origin : null;
  } catch {
    return null;
  }
}

async function setEnv(env) {
  const { envs = {} } = await api.storage.sync.get("envs");
  envs[origin] = env;
  await api.storage.sync.set({ envs });
}

// Auto (empty) follows the clock: the site's entry goes
async function setPhase(phase) {
  const { phases = {} } = await api.storage.sync.get("phases");
  if (phase) phases[origin] = phase;
  else delete phases[origin];
  await api.storage.sync.set({ phases });
}

// The theme's own scheme (empty): the site's entry goes
async function setScheme(scheme) {
  const { schemes = {} } = await api.storage.sync.get("schemes");
  if (scheme) schemes[origin] = scheme;
  else delete schemes[origin];
  await api.storage.sync.set({ schemes });
}

async function setHue(hue, theme) {
  const { hues = {} } = await api.storage.sync.get("hues");
  const site = SCT.settings.withHue(hues[origin], theme, hue);
  if (Object.keys(site).length) hues[origin] = site;
  else delete hues[origin];
  await api.storage.sync.set({ hues });
}

// What the picker draws for this site, and the host line under the popup's title.
async function load() {
  const [sync, local] = await Promise.all([
    api.storage.sync.get(["overrides", "hues", "envs", "phases", "schemes"]),
    api.storage.local.get(["sitecoreVersions"]),
  ]);
  const version = (local.sitecoreVersions || {})[origin] || null;
  $("#host").textContent = $("#settings-host").textContent = new URL(origin).host + (version ? ` · Sitecore ${version}` : "");
  return {
    version,
    catalog: SCT.settings.catalog(),
    theme: (sync.overrides || {})[origin],
    hue: (sync.hues || {})[origin],
    env: (sync.envs || {})[origin],
    phase: (sync.phases || {})[origin],
    scheme: (sync.schemes || {})[origin],
  };
}

async function setOverride(themeId) {
  const { overrides = {} } = await api.storage.sync.get("overrides");
  if (themeId !== "native") overrides[origin] = themeId;
  else delete overrides[origin];
  await api.storage.sync.set({ overrides });
}

// This site's own settings (site-settings.js draws them, shared with the Sitecore module): one map per kind in
// storage.sync, keyed by the site; the plain choice ("" or null) removes the site's entry.
const STORES = { title: "titles", tint: "tints", mode: "modes", accessibility: "accessibility", tuning: "tunings" };
// the site's Reduced motion aid stills the popup too (popup.css .still)
const still = (a) => document.body.classList.toggle("still", SCT.settings.enabledAids(SCT.settings.accessibility(a), { surface: null }).includes("reduced-motion"));
const siteStore = {
  async get(kind) {
    return ((await api.storage.sync.get(STORES[kind]))[STORES[kind]] || {})[origin];
  },
  async set(kind, value) {
    if (kind === "accessibility") still(value);
    const map = (await api.storage.sync.get(STORES[kind]))[STORES[kind]] || {};
    if (value) map[origin] = value;
    else delete map[origin];
    await api.storage.sync.set({ [STORES[kind]]: map });
  },
};
$("#mode").outerHTML = SCT.siteSettings.MODE_HTML;
$("#pane-title").innerHTML = SCT.siteSettings.TITLE_HTML;
$("#pane-access").innerHTML = SCT.siteSettings.ACCESS_HTML;
$("#pane-ui").innerHTML = SCT.siteSettings.UI_HTML;
$("#pane-tuning").innerHTML = SCT.siteSettings.TUNING_HTML;

// The DAM connector's pickers show Content Hub's own pages (detect.js), which take this site's theme once the browser
// lets the extension into Content Hub. Offered on a site that has the connector (its Rich Text Editor script; 404
// without it, a redirect to the login signed out), until allowed. The page asks, so the request carries its sign-in.
const CONTENT_HUB = { origins: ["https://*.sitecorecontenthub.cloud/*"] };
const DAM_SCRIPT = "/sitecore/shell/Controls/Rich Text Editor/Sitecore.Connector.ContentHub.DAM/Sitecore.Connector.ContentHub.DAM.Commands.js";
async function offerContentHub() {
  if (await api.permissions.contains(CONTENT_HUB)) return;
  const [tab] = await api.tabs.query({ active: true, currentWindow: true });
  const [{ result } = {}] = await api.scripting.executeScript({
    target: { tabId: tab.id },
    func: (path) => fetch(path, { method: "HEAD", redirect: "manual" }).then((r) => r.ok, () => false),
    args: [encodeURI(DAM_SCRIPT)],
  }).catch(() => []);
  if (!result) return;
  $("#contenthub").hidden = false;
  // the background registers the content scripts there when the grant lands (permissions.onAdded)
  $("#contenthub-allow").onclick = async () => {
    if (await api.permissions.request(CONTENT_HUB)) $("#contenthub").hidden = true;
  };
}

// the background's list of disabled sites wins over the permission, which Chrome can keep after Disable
const disabled = async () => (await api.storage.local.get("disabledOrigins")).disabledOrigins || [];
const isOn = async (o) => !(await disabled()).includes(o) && api.permissions.contains({ origins: [o + "/*"] });
const hostOf = (o) => new URL(o).host;

// A Sitecore site signs in on its Identity Server, a separate site the browser has to allow as well: the two are
// found here, { site, identity }, so that one prompt asks for both. On the Identity Server's login page its address
// names the site (detect.js signInSite). On a Sitecore page the identity server is the one, among the names installs
// usually give it (identityCandidates), whose discovery document the page can read and lists Sitecore's scope: the
// Identity Server lets only its own sites read it (AllowedCorsOrigins), so the page asks, not the popup. The click on
// the toolbar icon lets the popup into the tab for that (activeTab). One search per site and browser session, with
// time for an identity server that has gone idle to start.
async function findIdentity() {
  const [tab] = await api.tabs.query({ active: true, currentWindow: true });
  const here = new URL(tab.url).origin;
  const site = SCT.detect.signInSite(tab.url);
  if (site) return { site, identity: here };
  const surface = SCT.detect.surfaceFromUrl(tab.url);
  if (!surface || surface === "login" || surface === "contenthub") return null;
  const session = api.storage.session;
  const { identityFound = {} } = session ? await session.get("identityFound") : {};
  if (!(here in identityFound)) {
    const [{ result } = {}] = await api.scripting.executeScript({
      target: { tabId: tab.id },
      func: (hosts) => Promise.all(hosts.map((h) => fetch(h + "/.well-known/openid-configuration", { credentials: "omit", signal: AbortSignal.timeout(15000) })
        .then((r) => r.json()).then((d) => (d.scopes_supported.includes("sitecore.profile") ? h : null)).catch(() => null)))
        .then((found) => found.find(Boolean) || null),
      args: [SCT.detect.identityCandidates(here)],
    });
    identityFound[here] = result || null;
    if (session) await session.set({ identityFound });
  }
  return identityFound[here] ? { site: here, identity: identityFound[here] } : null;
}

// Asks the browser for the sites, both of a pair in one prompt, and switches them on. Called straight from a click:
// Firefox takes the request only then. The browser may close the popup while it asks; the background script picks up
// the grant either way, and learns the pair at the next sign-in.
async function grant(origins, pair) {
  if (!(await api.permissions.request({ origins: origins.map((o) => o + "/*") }))) return;
  if (pair) {
    const { identitySites = {} } = await api.storage.local.get("identitySites");
    await api.storage.local.set({ identitySites: { ...identitySites, [pair.identity]: pair.site } });
  }
  await api.storage.local.set({ disabledOrigins: (await disabled()).filter((o) => !origins.includes(o)) });
  await api.runtime.sendMessage({ type: "sync" }).catch(() => {});
  location.reload(); // drawn afresh: running main() again would mount every control a second time
}

// On an enabled site whose other half (its Identity Server, or from the login page its Sitecore site) is still off.
async function offerIdentity(here) {
  const pair = await findIdentity().catch(() => null);
  if (!pair) return;
  const other = pair.site === here ? pair.identity : pair.site;
  if (await isOn(other)) return;
  $("#identity-text").textContent = other === pair.identity ? `This site signs in at ${hostOf(other)}.` : `This page signs in to ${hostOf(other)}.`;
  $("#identity-allow").textContent = other === pair.identity ? "Theme the sign-in page too" : "Enable there too";
  $("#identity-allow").onclick = () => grant([other], pair);
  $("#identity").hidden = false;
}

async function main() {
  origin = await currentOrigin();
  if (!origin) return show("#no-site");
  $("#host").textContent = hostOf(origin);
  const here = origin;

  if (!(await isOn(here))) {
    show("#disabled");
    let pair = null;
    findIdentity().then((p) => {
      if (!(pair = p)) return;
      $("#enable-note").textContent = p.site === here
        ? `The browser asks you to allow this site and ${hostOf(p.identity)}, where it signs in.`
        : `The browser asks you to allow this page and ${hostOf(p.site)}, the site it signs in to.`;
    }, () => {});
    $("#enable").onclick = () => grant(pair ? [pair.site, pair.identity] : [here], pair);
    return;
  }

  // an Identity Server page shows the settings of the site it signs in to, which it follows (background.js siteOrigin)
  const [tab] = await api.tabs.query({ active: true, currentWindow: true });
  origin = (await api.runtime.sendMessage({ type: "site-origin", url: tab.url }).catch(() => null)) || origin;
  show("#enabled");
  still(await siteStore.get("accessibility"));
  SCT.picker.mount($("#picker"), {
    label: "Theme for this site", themes: "../themes/", load, setTheme: setOverride, setHue, setEnv, setPhase, setScheme,
    onTheme: (t) => ((bothLooks = t.appearance === "auto"), syncMode()),
  });
  SCT.siteSettings.mount(document, siteStore);
  offerContentHub();
  offerIdentity(here);
  // The background disables the site (background.js disableSite): the popup closes as soon as the page gets the focus,
  // F5 included, and would stop half-way.
  $("#disable").onclick = async () => {
    await api.runtime.sendMessage({ type: "disable", origin }).catch(() => {});
    location.reload(); // drawn afresh: running main() again would mount every control a second time
  };
}

main();
