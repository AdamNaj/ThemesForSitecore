// The fixture pages' engine with a fake host: loads the engine's scripts and every aid in settings.js AIDS, in the
// content scripts' order, then starts the engine. A fixture page is its markup plus <script src="/aid-host.js">.
// ?theme=<id> is the theme apply() answers with; ?boom adds an always-on aid that changes the page and throws;
// ?css an always-on CSS-only aid.
(function () {
  const load = (src) => new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = `/ext/${src}`;
    s.onload = resolve;
    s.onerror = reject;
    document.head.append(s);
  });
  const before = ["lib/detect.js", "lib/settings.js", "themes/themes.js", "lib/dom-kit.js", "lib/color-map.js", "lib/live-map.js", "themes/chicago/dom.js"];

  (async () => {
    if (document.readyState === "loading") await new Promise((r) => document.addEventListener("DOMContentLoaded", r, { once: true }));
    window.pristine = document.body.innerHTML; // the whole page before any aid, for the exact-revert checks
    for (const f of before) await load(f);
    for (const id of Object.keys(SCT.settings.AIDS)) await load(`lib/aids/${id}.js`);
    await load("lib/engine.js");
    if (location.search.includes("boom")) {
      SCT.settings.AIDS.boom = { needs: ["screen-reader"], always: true, surfaces: null, name: "b", hint: "b" };
      SCT.registerAid("boom", { apply(ctx) { ctx.setAttr(document.body, "data-boom", "1"); throw new Error("boom"); } });
    }
    if (location.search.includes("css")) {
      SCT.settings.AIDS.paint = { needs: ["screen-reader"], always: true, surfaces: null, name: "p", hint: "p" };
      SCT.registerAid("paint", { css: "body{outline:3px solid red}" });
    }
    // fake.theme is the theme apply() answers with, fake.site what site() returns, fake.fire(kind) a setting change
    const fake = (window.fake = { site: {}, theme: new URLSearchParams(location.search).get("theme") || "native", listener: null, fire: (kind) => fake.listener && fake.listener(kind) });
    const entry = (id) => ({ id, name: id, usesTokens: id === "fjord" });
    SCT.startEngine({
      alive: () => true,
      version: async () => "10.4",
      saveVersion() {},
      site: async () => fake.site,
      url: (p) => `/ext/${p}`,
      theme: async () => entry(fake.theme),
      apply: async ({ off }) => {
        const id = off ? "native" : fake.theme;
        return { theme: id, name: id, usesTokens: id === "fjord", dev: true, mode: "" };
      },
      tokens: async () => "",
      listen: (fn) => (fake.listener = fn),
      stop() {},
    });
  })();
})();
