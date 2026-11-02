// The extension's host for the page engine (lib/engine.js), in every frame of an enabled host: settings from
// extension storage, theme CSS swapped by the background.
(function () {
  const api = globalThis.browser ?? globalThis.chrome;
  const VERSIONS = "sitecoreVersions";

  async function send(msg) {
    try {
      return await api.runtime.sendMessage(msg);
    } catch {
      return null;
    }
  }

  // The site whose settings this frame follows: its own, or for a Content Hub page in a DAM picker the Sitecore site
  // in the tab, which only the background can see
  let origin = location.origin;
  const ready = SCT.detect.surfaceFromUrl(location.href) === "contenthub"
    ? send({ type: "site-origin" }).then((o) => (origin = o || origin))
    : Promise.resolve();

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
      await ready;
      return ((await api.storage.local.get(VERSIONS))[VERSIONS] || {})[origin] || null;
    },
    saveVersion(v) {
      api.storage.local.get(VERSIONS).then((r) => {
        const versions = r[VERSIONS] || {};
        if (versions[origin] !== v) api.storage.local.set({ [VERSIONS]: { ...versions, [origin]: v } });
      });
    },
    async site() {
      await ready;
      const { titles = {}, tints = {}, envs = {}, phases = {}, schemes = {}, hues = {}, accessibility = {}, tunings = {} } = await api.storage.sync.get(["titles", "tints", "envs", "phases", "schemes", "hues", "accessibility", "tunings"]);
      return { title: titles[origin], tint: tints[origin], env: envs[origin], phase: phases[origin], scheme: schemes[origin], hue: hues[origin], accessibility: accessibility[origin], tuning: tunings[origin] };
    },
    url: (path) => api.runtime.getURL(path),
    async theme(version) {
      await ready;
      const sync = await api.storage.sync.get("overrides");
      const catalog = SCT.settings.catalog();
      const id = SCT.settings.resolve({ ...SCT.settings.DEFAULTS, ...sync }, origin, version, catalog);
      return catalog.find((t) => t.id === id) || { id, name: "" };
    },
    async apply(msg) {
      const r = await send({ type: "frame-ready", ...msg });
      // the site is off: the background answered with Sitecore's own look (and took the theme's CSS out); the
      // page goes to the module
      if (r && r.standDown && !leaving) setTimeout(handOver);
      return r;
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
          if (changes.schemes) fn("scheme");
          if (changes.hues) fn("hue");
          if (changes.accessibility) fn("accessibility");
          if (changes.tunings) fn("tuning");
          if (changes.modes) fn("mode");
        }
        if (area === "local" && changes[VERSIONS]) fn("version", (changes[VERSIONS].newValue || {})[origin]);      };
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
