// The extension's host for the page engine (lib/engine.js), in every frame of an enabled host: settings from
// extension storage, theme CSS swapped by the background.
(function () {
  const api = globalThis.browser ?? globalThis.chrome;
  const origin = location.origin;
  const VERSIONS = "sitecoreVersions";

  async function send(msg) {
    try {
      return await api.runtime.sendMessage(msg);
    } catch {
      return null;
    }
  }

  let onStorage = null;
  let leaving = false;

  // The extension leaves the frame (Disable, or a site found off): the engine unloads, then the Sitecore module, where
  // the site has it, takes over. Its loader is in the page already but stood back for the extension, so the background
  // runs the same script tag again in the page's own world (from here, the extension's CSP would block it).
  async function handOver() {
    leaving = true;
    if (SCT.engine && !SCT.engine.stopped) await SCT.engine.unload();
    if (document.querySelector("script[data-sct]")) await send({ type: "module-takeover" });
  }
  SCT.handOver = handOver;

  const engine = SCT.startEngine({
    alive() {
      try {
        return !!api.runtime.id;
      } catch {
        return false;
      }
    },
    async version() {
      return ((await api.storage.local.get(VERSIONS))[VERSIONS] || {})[origin] || null;
    },
    saveVersion(v) {
      api.storage.local.get(VERSIONS).then((r) => {
        const versions = r[VERSIONS] || {};
        if (versions[origin] !== v) api.storage.local.set({ [VERSIONS]: { ...versions, [origin]: v } });
      });
    },
    async site() {
      const { titles = {}, tints = {}, envs = {}, phases = {}, hues = {}, accessibility = {} } = await api.storage.sync.get(["titles", "tints", "envs", "phases", "hues", "accessibility"]);
      return { title: titles[origin], tint: tints[origin], env: envs[origin], phase: phases[origin], hue: hues[origin], accessibility: accessibility[origin] };
    },
    url: (path) => api.runtime.getURL(path),
    async theme(version) {
      const [sync, local] = await Promise.all([api.storage.sync.get("overrides"), api.storage.local.get("imported")]);
      const catalog = SCT.settings.catalog(local.imported || {});
      const id = SCT.settings.resolve({ ...SCT.settings.DEFAULTS, ...sync }, origin, version, catalog);
      return catalog.find((t) => t.id === id) || { id, name: "" };
    },
    async apply(msg) {
      const r = await send({ type: "frame-ready", ...msg });
      if (!r || !r.standDown) return r;
      // the site is off: Sitecore's own look here, and the page to the module
      if (!leaving) setTimeout(handOver);
      return { theme: "native", name: "", usesTokens: false, dev: false, mode: "" };
    },
    tokens: (id) => send({ type: "theme-tokens", theme: id }),
    listen(fn) {
      onStorage = (changes, area) => {
        if (area === "sync") {
          if (changes.overrides) fn("theme");
          if (changes.titles) fn("title");
          if (changes.tints) fn("tint");
          if (changes.envs) fn("env");
          if (changes.phases) fn("phase");
          if (changes.hues) fn("hue");
          if (changes.accessibility) fn("accessibility");
          if (changes.modes) fn("mode");
        }
        if (area === "local" && changes[VERSIONS]) fn("version", (changes[VERSIONS].newValue || {})[origin]);
        if (area === "local" && changes.imported) fn("imported", changes.imported.oldValue);
      };
      api.storage.onChanged.addListener(onStorage);
    },
    stop() {
      try {
        if (onStorage) api.storage.onChanged.removeListener(onStorage);
      } catch {
        // extension context already gone
      }
    },
  });

  // Dev installs only (the background checks): lets a page script reload the extension or change settings.
  if (engine && SCT.devHooks) {
    window.addEventListener("message", (e) => {
      // Firefox hands content scripts a wrapper; the page's own window is window.wrappedJSObject.
      const own = e.source === window || e.source === window.wrappedJSObject;
      if (!own || e.origin !== location.origin || !e.data) return;
      if (e.data.type === "sct-dev-reload") send({ type: "dev-reload" });
      if (e.data.type === "sct-dev-set") send({ type: "dev-set", values: e.data.values });
    });
  }
})();
