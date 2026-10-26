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
    api.storage.sync.get(["overrides", "hues", "envs", "phases"]),
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
  };
}

async function setOverride(themeId) {
  const { overrides = {} } = await api.storage.sync.get("overrides");
  if (themeId !== "native") overrides[origin] = themeId;
  else delete overrides[origin];
  await api.storage.sync.set({ overrides });
}

// The tab icon keeps its own light and shade and takes only the tint's hue and saturation (lib/engine.js drawIcon),
// so the tint is a hue at one saturation and lightness, or grey for a colourless icon. Still saved as #rrggbb.
const tintHex = (h, s = 0.75, l = 0.48) => {
  const f = (n) => {
    const k = (n + h / 30) % 12;
    return Math.round((l - s * Math.min(l, 1 - l) * Math.max(-1, Math.min(k - 3, 9 - k, 1))) * 255).toString(16).padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
};
// the hue of a saved colour (any colour the old picker saved), null for a grey
function hexHue(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b), d = max - Math.min(r, g, b);
  if (d < 0.04) return null;
  const h = max === r ? (g - b) / d : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return Math.round((h * 60 + 360) % 360);
}
const TINT_GREY = "#7a7a7a";
const TINT_SWATCHES = [...[4, 30, 48, 130, 188, 210, 255, 335].map((h) => tintHex(h)), TINT_GREY];

async function mountTint() {
  const range = $("#tint-hue");
  SCT.picker.paintTrack(range, (d) => tintHex(d));
  const pick = (value) => (document.querySelector(`#tint input[value="${value}"]`).checked = true);
  const { tints = {} } = await api.storage.sync.get("tints");
  const saved = tints[origin] || "";
  let colour = SCT.settings.tintColor(saved, null) || tintHex(+range.value);
  range.value = hexHue(colour) ?? range.value;
  pick(saved.startsWith("#") ? "color" : saved);

  const swatches = $("#tint-swatches");
  const mark = () => {
    const on = document.querySelector("#tint input:checked").value === "color";
    for (const b of swatches.children) b.setAttribute("aria-pressed", String(on && b.value === colour));
  };
  const write = async () => {
    const mode = document.querySelector("#tint input:checked").value;
    const { tints = {} } = await api.storage.sync.get("tints");
    if (mode) tints[origin] = mode === "color" ? colour : mode;
    else delete tints[origin];
    await api.storage.sync.set({ tints });
  };
  const save = SCT.picker.throttled(write);
  const choose = (c) => {
    colour = c;
    pick("color");
    mark();
  };
  for (const c of TINT_SWATCHES) {
    const b = document.createElement("button");
    b.value = c;
    b.style.background = c;
    b.title = c === TINT_GREY ? "Grey" : c;
    b.setAttribute("aria-label", c === TINT_GREY ? "Tint grey" : `Tint ${c}`);
    b.onclick = () => {
      if (c !== TINT_GREY) range.value = hexHue(c);
      choose(c);
      write();
    };
    swatches.append(b);
  }
  mark();
  range.oninput = () => (choose(tintHex(+range.value)), save());
  $("#tint").onchange = () => (mark(), write());
  range.onchange = write; // the slider's release: the popup can close before the throttled save
}

// Light or Dark for themes that follow the OS (storage.sync `modes`, applied by the background); none is System.
// The header's pill of icons, beside the gear.
async function mountMode() {
  const box = $("#mode");
  const { modes = {} } = await api.storage.sync.get("modes");
  (box.querySelector(`input[value="${modes[origin]}"]`) || box.querySelector("input")).checked = true;
  box.onchange = async () => {
    const value = box.querySelector("input:checked").value;
    const { modes = {} } = await api.storage.sync.get("modes");
    if (value) modes[origin] = value;
    else delete modes[origin];
    await api.storage.sync.set({ modes });
  };
}

// The site's accessibility aids (storage.sync `accessibility`, lib/settings.js): reading font, spacing, and a colour
// filter with its strength, which shows while a filter is on. All off removes the site's entry.
async function mountAccessibility() {
  const { accessibility = {} } = await api.storage.sync.get("accessibility");
  const saved = SCT.settings.accessibility(accessibility[origin]) || {};
  const range = $("#strength");
  range.value = saved.strength || 100;
  const pick = (n) => $(`#${n} input:checked`).value || null;
  const show = () => {
    $("#strength-row").hidden = !pick("vision");
    $("#strength-value").textContent = `${range.value}%`;
  };
  const write = async () => {
    const { accessibility = {} } = await api.storage.sync.get("accessibility");
    const next = SCT.settings.accessibility({ font: pick("font"), spacing: pick("spacing"), vision: pick("vision"), strength: +range.value });
    if (next) accessibility[origin] = next;
    else delete accessibility[origin];
    await api.storage.sync.set({ accessibility });
  };
  for (const name of ["font", "spacing", "vision"]) {
    const box = $(`#${name}`);
    box.querySelector(`input[value="${saved[name] || ""}"]`).checked = true;
    box.onchange = () => (show(), write());
  }
  const save = SCT.picker.throttled(write);
  range.oninput = () => (show(), save());
  range.onchange = write; // the slider's release: the popup can close before the throttled save
  show();
}

async function main() {
  origin = await currentOrigin();
  if (!origin) return show("#no-site");
  $("#host").textContent = new URL(origin).host;

  const pattern = { origins: [origin + "/*"] };
  if (!(await api.permissions.contains(pattern))) {
    show("#disabled");
    $("#enable").onclick = async () => {
      // The browser may close the popup while it asks; the background script picks up the grant either way.
      if (await api.permissions.request(pattern)) main();
    };
    return;
  }

  show("#enabled");
  const { render } = SCT.picker.mount($("#picker"), {
    label: "Theme for this site", themes: "../themes/", load, setTheme: setOverride, setHue, setEnv, setPhase,
    onTheme: (t) => ((bothLooks = t.appearance === "auto"), syncMode()),
  });
  const postfix = $("#title-postfix");
  postfix.value = ((await api.storage.sync.get("titles")).titles || {})[origin] || "";
  // saved on every keystroke: the popup can close before a change event fires
  postfix.oninput = async () => {
    const { titles = {} } = await api.storage.sync.get("titles");
    const value = postfix.value.trim();
    if (value) titles[origin] = value;
    else delete titles[origin];
    await api.storage.sync.set({ titles });
  };
  mountMode();
  mountTint();
  mountAccessibility();
  $("#disable").onclick = async () => {
    // The site's open tabs go back to Sitecore's own look first: once access is gone, the theme's CSS can no longer
    // be taken out. A frame that does not answer within a few seconds keeps its look until reloaded.
    const tabs = await api.tabs.query({ url: origin + "/*" });
    const unload = tabs.map((t) => api.scripting.executeScript({
      target: { tabId: t.id, allFrames: true },
      func: () => globalThis.SCT && SCT.engine && SCT.engine.unload && SCT.engine.unload(),
    }).catch(() => {}));
    await Promise.race([Promise.all(unload), new Promise((r) => setTimeout(r, 3000))]);
    await api.permissions.remove(pattern);
    show("#disabled");
  };
  if (globalThis.SCTImportUI) {
    SCTImportUI.mount($("#import-body"), render, (n) => {
      $("#import-count").hidden = !n;
      $("#import-count").textContent = n;
    });
  }
}

main();
