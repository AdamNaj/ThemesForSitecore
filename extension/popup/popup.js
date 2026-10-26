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
    api.storage.local.get(["imported", "sitecoreVersions"]),
  ]);
  const version = (local.sitecoreVersions || {})[origin] || null;
  $("#host").textContent = $("#settings-host").textContent = new URL(origin).host + (version ? ` · Sitecore ${version}` : "");
  return {
    version,
    catalog: SCT.settings.catalog(local.imported),
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
const STORES = { title: "titles", tint: "tints", mode: "modes", accessibility: "accessibility" };
const siteStore = {
  async get(kind) {
    return ((await api.storage.sync.get(STORES[kind]))[STORES[kind]] || {})[origin];
  },
  async set(kind, value) {
    const map = (await api.storage.sync.get(STORES[kind]))[STORES[kind]] || {};
    if (value) map[origin] = value;
    else delete map[origin];
    await api.storage.sync.set({ [STORES[kind]]: map });
  },
};
$("#mode").outerHTML = SCT.siteSettings.MODE_HTML;
$("#pane-title").innerHTML = SCT.siteSettings.TITLE_HTML;
$("#pane-access").innerHTML = SCT.siteSettings.ACCESS_HTML;

async function main() {
  origin = await currentOrigin();
  if (!origin) return show("#no-site");
  $("#host").textContent = new URL(origin).host;

  const pattern = { origins: [origin + "/*"] };
  // the background's list of disabled sites wins over the permission, which Chrome can keep after Disable
  const disabled = async () => (await api.storage.local.get("disabledOrigins")).disabledOrigins || [];
  if (!(await api.permissions.contains(pattern)) || (await disabled()).includes(origin)) {
    show("#disabled");
    $("#enable").onclick = async () => {
      // The browser may close the popup while it asks; the background script picks up the grant either way.
      if (!(await api.permissions.request(pattern))) return;
      await api.storage.local.set({ disabledOrigins: (await disabled()).filter((o) => o !== origin) });
      await api.runtime.sendMessage({ type: "sync" }).catch(() => {});
      location.reload(); // drawn afresh: running main() again would mount every control a second time
    };
    return;
  }

  show("#enabled");
  const { render } = SCT.picker.mount($("#picker"), {
    label: "Theme for this site", themes: "../themes/", load, setTheme: setOverride, setHue, setEnv, setPhase, setScheme,
    onTheme: (t) => ((bothLooks = t.appearance === "auto"), syncMode()),
  });
  SCT.siteSettings.mount(document, siteStore);
  // The background disables the site (background.js disableSite): the popup closes as soon as the page gets the focus,
  // F5 included, and would stop half-way.
  $("#disable").onclick = async () => {
    await api.runtime.sendMessage({ type: "disable", origin }).catch(() => {});
    location.reload(); // drawn afresh: running main() again would mount every control a second time
  };
  if (globalThis.SCTImportUI) {
    SCTImportUI.mount($("#import-body"), render, (n) => {
      $("#import-count").hidden = !n;
      $("#import-count").textContent = n;
    });
  }
}

main();
