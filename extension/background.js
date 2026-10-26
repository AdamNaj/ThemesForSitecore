// Chrome runs this file as a service worker; Firefox loads the libraries first via background.scripts.
if (typeof importScripts === "function") importScripts("lib/dev.js", "lib/detect.js", "lib/settings.js", "themes/themes.js", "lib/files.js");

const api = globalThis.browser ?? globalThis.chrome;
const SCRIPT_ID = "sct";

function contentFiles() {
  const domModules = SCT.themes.filter((t) => t.hasDom).map((t) => `themes/${t.id}/dom.js`);
  return ["lib/dev.js", "lib/detect.js", "lib/settings.js", "themes/themes.js", "lib/dom-kit.js", "lib/color-map.js", "lib/live-map.js", ...domModules, "lib/engine.js", "content.js"];
}

// Sites the user disabled from the popup. Chrome can keep a host it granted at runtime after the extension gives the
// permission back, so this list, not the permission alone, says a site is off.
async function disabledOrigins() {
  return (await api.storage.local.get("disabledOrigins")).disabledOrigins || [];
}

async function enabledOn(origin) {
  return (await api.permissions.contains({ origins: [origin + "/*"] })) && !(await disabledOrigins()).includes(origin);
}

async function grantedOrigins() {
  const { origins = [] } = await api.permissions.getAll();
  const off = (await disabledOrigins()).map((o) => o + "/*");
  return origins.filter((o) => /^https?:\/\//.test(o) && !off.includes(o));
}

// One registration change at a time: a Disable and an Enable in quick succession, or the permission events and the
// popup's own request, would otherwise interleave and leave a stale registration behind.
let syncing = Promise.resolve();
function syncRegistration() {
  return (syncing = syncing.then(register, register));
}

async function register() {
  const matches = await grantedOrigins();
  const existing = await api.scripting.getRegisteredContentScripts({ ids: [SCRIPT_ID] }).catch(() => []);
  if (existing.length) await api.scripting.unregisterContentScripts({ ids: [SCRIPT_ID] });
  if (!matches.length) return [];
  await api.scripting.registerContentScripts([
    { id: SCRIPT_ID, matches, js: contentFiles(), allFrames: true, runAt: "document_start", persistAcrossSessions: true },
  ]);
  return matches;
}

async function injectOpenTabs(matches) {
  if (!matches.length) return;
  const tabs = await api.tabs.query({ url: matches });
  for (const tab of tabs) {
    await api.scripting.executeScript({ target: { tabId: tab.id, allFrames: true }, files: contentFiles() }).catch(() => {});
  }
}

const fileCache = new Map();
async function fileText(file, dev) {
  if (dev) return fetch(api.runtime.getURL(file)).then((r) => r.text());
  if (!fileCache.has(file)) fileCache.set(file, fetch(api.runtime.getURL(file)).then((r) => r.text()));
  return fileCache.get(file);
}

// Firefox resolves root-relative url()s in injected files against the extension's own origin.
// Injecting the text with those URLs pointed at the frame's origin works the same everywhere,
// and recomputing the same text later lets removeCSS match it exactly.
const absolutize = (css, origin) => css.replace(/url\(\s*(['"]?)\/(?!\/)/g, `url($1${origin}/`)
  // a theme's own images (web_accessible_resources): sct-ext:<path> is the extension's URL for <path>
  .replace(/url\(\s*(['"]?)sct-ext:/g, `url($1${api.runtime.getURL("")}`);

async function cssFor(themeId, surface, imported, origin, dev, mode) {
  const { files, css } = SCT.files.sources(themeId, surface, imported);
  const parts = await Promise.all(files.map((f) => fileText(f, dev)));
  const text = [...parts, css].filter(Boolean).join("\n");
  return text ? absolutize(SCT.files.withMode(text, mode), origin) : "";
}

async function isDevInstall() {
  if (!SCT.devHooks) return false;
  const self = await api.management.getSelf().catch(() => null);
  return !!self && self.installType === "development";
}

// Disable on a site, from the popup, done here so that closing the popup (a click into the page, F5) can't stop it
// half-way. The site is off from the first step: then the registration is rebuilt, so a reload meets no content
// script; the open tabs go back to Sitecore's own look and to the Sitecore module where the site has it (a frame
// that does not answer within a few seconds keeps its look until reloaded); and the permission goes last, since
// taking a theme's CSS out of a tab needs it.
async function disableSite(origin) {
  const off = await disabledOrigins();
  if (!off.includes(origin)) await api.storage.local.set({ disabledOrigins: [...off, origin] });
  await syncRegistration();
  const tabs = await api.tabs.query({ url: origin + "/*" });
  const unload = tabs.map((t) => api.scripting.executeScript({
    target: { tabId: t.id, allFrames: true },
    // older content scripts only unload
    func: () => globalThis.SCT && (SCT.handOver ? SCT.handOver() : SCT.engine && SCT.engine.unload && SCT.engine.unload()),
  }).catch(() => {}));
  await Promise.race([Promise.all(unload), new Promise((r) => setTimeout(r, 3000))]);
  await api.permissions.remove({ origins: [origin + "/*"] }).catch(() => {});
}

async function onFrameReady(msg, sender) {
  const origin = new URL(sender.url).origin;
  // a frame on a site that is off (Disable, a stale registration): Native, so the theme's CSS comes out, and the frame
  // stands down so the Sitecore module, where the site has it, can take the page
  const standDown = !(await enabledOn(origin));
  if (standDown) msg = { ...msg, off: true };
  const [sync, local] = await Promise.all([
    api.storage.sync.get(["overrides", "modes"]),
    api.storage.local.get(["imported"]),
  ]);
  const imported = local.imported || {};
  const settings = { ...SCT.settings.DEFAULTS, ...sync };
  const mode = (sync.modes || {})[origin] || "";
  const theme = msg.off ? "native" : SCT.settings.resolve(settings, origin, msg.version, SCT.settings.catalog(imported));
  const target = { tabId: sender.tab.id, frameIds: [sender.frameId] };
  const dev = await isDevInstall();

  // a new mode changes the CSS text too, so the old text (in the old mode) comes out
  const changed = theme !== msg.previous || msg.previousEntry || (msg.previousMode || "") !== mode;
  if (msg.previous && changed) {
    // After an imported theme is updated or removed, its old entry says what has to come out.
    const before = msg.previousEntry ? { ...imported, [msg.previous]: msg.previousEntry } : imported;
    const old = await cssFor(msg.previous, msg.surface, before, origin, dev, msg.previousMode);
    if (old) await api.scripting.removeCSS({ target, css: old }).catch(() => {});
  }
  if (changed) {
    const css = await cssFor(theme, msg.surface, imported, origin, dev, mode);
    if (css) await api.scripting.insertCSS({ target, css }).catch(() => {});
  }
  const entry = SCT.settings.catalog(imported).find((t) => t.id === theme);
  return { theme, name: entry ? entry.name : "", usesTokens: !!(entry && entry.usesTokens), dev, mode, standDown };
}

// A theme's token declarations, so a page can draw its "Applying theme" window before the CSS swaps.
async function tokensCss(themeId, origin) {
  const mode = ((await api.storage.sync.get("modes")).modes || {})[origin];
  if (themeId.startsWith("import:")) {
    const t = ((await api.storage.local.get("imported")).imported || {})[themeId];
    return t && t.usesTokens ? SCT.files.withMode(t.css, mode) : "";
  }
  const theme = SCT.themes.find((t) => t.id === themeId);
  if (!theme || !theme.usesTokens) return "";
  return SCT.files.withMode(await fileText(`themes/${themeId}/tokens.css`, await isDevInstall()), mode);
}

api.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.type === "frame-ready") {
    onFrameReady(msg, sender).then(sendResponse, (e) => sendResponse({ error: String(e) }));
    return true;
  }
  if (msg && msg.type === "module-takeover") {
    // in the page's world, where the page's CSP lets its own loader run again (content.js handOver)
    api.scripting.executeScript({
      target: { tabId: sender.tab.id, frameIds: [sender.frameId] },
      world: "MAIN",
      // Only the module's own loader runs again: same origin, its path, and nothing but its src and settings copied,
      // so markup injected into a page can't use this to get a script of its choosing run.
      func: () => {
        const tag = document.querySelector("script[data-sct]");
        if (!tag || !tag.src || document.documentElement.dataset.sctEngine) return;
        const url = new URL(tag.src, location.href);
        if (url.origin !== location.origin || !/^\/sitecore(%20| )modules\/SitecoreThemes\/sct\.js$/i.test(url.pathname)) return;
        const again = document.createElement("script");
        again.src = url.href;
        again.dataset.sct = tag.dataset.sct;
        tag.after(again);
      },
    }).then(() => sendResponse(true), () => sendResponse(false));
    return true;
  }
  if (msg && msg.type === "disable" && typeof msg.origin === "string" && /^https?:\/\/[^/]+$/.test(msg.origin)) {
    disableSite(msg.origin).then(() => sendResponse(true), () => sendResponse(false));
    return true;
  }
  if (msg && msg.type === "sync") {
    syncRegistration().then(() => sendResponse(true), () => sendResponse(false));
    return true;
  }
  if (msg && msg.type === "theme-tokens") {
    tokensCss(String(msg.theme), new URL(sender.url).origin).then(sendResponse, () => sendResponse(""));
    return true;
  }
  if (msg && msg.type === "dev-reload") {
    isDevInstall().then((dev) => dev && api.runtime.reload());
  }
  if (msg && msg.type === "dev-set") {
    const allowed = ["overrides", "titles", "tints", "envs", "phases", "schemes", "hues", "modes", "accessibility"];
    const values = Object.fromEntries(Object.entries(msg.values || {}).filter(([k]) => allowed.includes(k)));
    isDevInstall().then((dev) => dev && api.storage.sync.set(values));
  }
  return false;
});

async function resync() {
  await injectOpenTabs(await syncRegistration());
}

// Older versions kept a theme for all sites; it moves onto each enabled site that had none of its own.
async function migrateDefaultTheme() {
  const sync = await api.storage.sync.get(["defaultTheme", "overrides"]);
  if (!("defaultTheme" in sync)) return;
  const origins = (await grantedOrigins()).map((p) => p.replace(/\/\*$/, "")).filter((o) => !o.includes("*"));
  await api.storage.sync.set({ overrides: SCT.settings.migrate(sync, origins) });
  await api.storage.sync.remove("defaultTheme");
}

async function migrateSoftlight() {
  const next = SCT.settings.migrateSoftlight(await api.storage.sync.get(["overrides", "modes", "hues"]));
  if (next) await api.storage.sync.set(next);
}

api.runtime.onInstalled.addListener(() => migrateDefaultTheme().catch(() => {}).then(migrateSoftlight).catch(() => {}).then(resync));
api.runtime.onStartup.addListener(syncRegistration);
api.permissions.onAdded.addListener(async ({ origins = [] }) => {
  // a site granted again is on again
  const back = origins.map((o) => o.replace(/\/\*$/, ""));
  const off = await disabledOrigins();
  if (off.some((o) => back.includes(o))) await api.storage.local.set({ disabledOrigins: off.filter((o) => !back.includes(o)) });
  await resync();
});
api.permissions.onRemoved.addListener(syncRegistration);
