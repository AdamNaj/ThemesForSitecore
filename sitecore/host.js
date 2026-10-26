// The Sitecore module's host for the page engine (extension/lib/engine.js). The module writes this script into
// Sitecore's pages with the user's settings on the tag (SitecoreThemes.ThemesProcessor); the theme's CSS is
// fetched from the module's folder and adopted by the frame, which puts it after the page's own stylesheets
// as the extension's injected CSS is. Frames and tabs hear about a change over a BroadcastChannel.
(function () {
  const html = document.documentElement;
  // the extension got here first (its content script runs at document_start) and owns the page
  if (html.dataset.sctEngine) return;

  const cfg = JSON.parse(document.currentScript.dataset.sct);
  const ref = (file) => `${cfg.base}${file}?v=${cfg.stamp}`;
  const catalog = SCT.settings.catalog();
  const resolve = (version) => SCT.settings.resolve({ overrides: { [location.origin]: cfg.theme } }, location.origin, version, catalog);
  const entry = (id) => catalog.find((t) => t.id === id) || { id, name: "" };
  const text = (file) => fetch(ref(file)).then((r) => (r.ok ? r.text() : ""), () => "");
  const channel = new BroadcastChannel("sct");
  let sheet = null;
  let onChange = null;
  let button = null; // the logo's host in the top bar
  let logo = null; // the logo's button, in its shadow root
  let topBar = null; // Sitecore's top bar the logo sits in
  let footers = null; // watches for start menu footers to add the picker's entry to
  let panel = null; // the open picker: { host, render }
  // the settings a user changes in the picker, which open frames and tabs follow at once
  const KINDS = ["theme", "hue", "env", "phase", "scheme", "title", "tint", "mode", "accessibility"];

  function adopt(next) {
    const rest = document.adoptedStyleSheets.filter((s) => s !== sheet);
    document.adoptedStyleSheets = next ? [...rest, next] : rest;
    sheet = next;
  }

  const engine = SCT.startEngine({
    alive: () => true,
    version: async () => cfg.version,
    saveVersion() {}, // the server knows its own version
    site: async () => ({ title: cfg.title, tint: cfg.tint, env: cfg.env, phase: cfg.phase, scheme: cfg.scheme, hue: cfg.hue, accessibility: cfg.accessibility }),
    url: (file) => `${cfg.base}${file}`, // the reading fonts, in the module's folder
    theme: async (version) => entry(resolve(version)),
    async apply({ surface, version, previous, previousMode }) {
      const theme = resolve(version);
      const mode = cfg.mode || "";
      if (theme !== previous || mode !== (previousMode || "")) {
        let next = null;
        if (theme !== "native") {
          const parts = await Promise.all(SCT.files.sources(theme, surface).files.map(text));
          next = new CSSStyleSheet();
          // sct-ext:<path> is a theme's own image, in the module's folder; Light or Dark fixes a theme that follows
          // the system to one of its looks
          next.replaceSync(SCT.files.withMode(parts.join("\n"), mode).replace(/url\(\s*(['"]?)sct-ext:/g, `url($1${cfg.base}`));
        }
        adopt(next);
      }
      const e = entry(theme);
      return { theme, name: e.name, usesTokens: !!e.usesTokens, dev: false, mode };
    },
    tokens: async (id) => (entry(id).usesTokens ? text(`themes/${id}/tokens.css`) : ""),
    listen(fn) {
      onChange = fn;
      channel.onmessage = (e) => {
        const m = e.data || {};
        if (!KINDS.includes(m.type) || m[m.type] === cfg[m.type]) return;
        cfg[m.type] = m[m.type];
        fn(m.type);
        panel?.render();
      };
    },
    // The browser extension took the page over (it was reloaded or enabled while the page was open): the
    // module undoes everything it added and stays out of the way, in this frame and the frames it would load into.
    stop() {
      channel.close();
      adopt(null);
      close();
      button?.remove();
      footers?.disconnect();
      document.removeEventListener("click", onEntry, true);
      for (const entry of document.querySelectorAll(".sct-themes-entry")) entry.remove();
      document.removeEventListener("load", loadInto, true);
    },
  });
  if (!engine) return;

  // The picker's choices are saved to the user's profile, so new pages load with them, and open frames and
  // tabs switch at once.
  async function save(fields, kind) {
    const r = await fetch(cfg.save, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", "X-SCT": "1" },
      body: new URLSearchParams(fields),
    }).catch(() => null);
    if (!r || !r.ok) return;
    let kinds = [kind];
    if (kind === "hue") cfg.hue = SCT.settings.withHue(cfg.hue, fields.hueTheme, +fields.hue);
    else if (kind === "accessibility") cfg.accessibility = SCT.settings.accessibility(fields.accessibility ? JSON.parse(fields.accessibility) : null);
    else if (kind === "reset") {
      // back to the config's: the server cleared the user's own title, tint, mode and environment
      Object.assign(cfg, cfg.defaults);
      kinds = ["title", "tint", "mode", "env"];
    } else Object.assign(cfg, fields);
    for (const k of kinds) {
      channel.postMessage({ type: k, [k]: cfg[k] });
      onChange(k);
    }
  }

  // The picker's settings view reads and writes the user's own values through these (site-settings.js).
  const siteStore = {
    get: (kind) => cfg[kind],
    set: (kind, value) => save({ [kind]: kind === "accessibility" ? (value ? JSON.stringify(value) : "") : value || "" }, kind),
  };

  // The logo and the picker are drawn in closed shadow roots on hosts whose inline style resets everything
  // (inline !important beats any theme rule), so neither the page nor a theme reaches them: the picker looks as
  // the extension's popup does, in its own light or dark.
  function isolated(doc, tag, style, markup) {
    const host = doc.createElement(tag);
    host.setAttribute("data-sct-owned", "");
    host.style.cssText = `all:initial!important;display:block!important;${style}`;
    const root = host.attachShadow({ mode: "closed" });
    root.innerHTML = markup;
    return { host, root };
  }
  const pin = (el, props) => Object.entries(props).forEach(([k, v]) => el.style.setProperty(k, v, "important"));

  // The top window this frame can reach: the picker opens there, so a frame as short as the Experience
  // Editor's ribbon still shows all of it.
  function topWindow() {
    let w = window;
    try {
      while (w !== w.parent && w.parent.document) w = w.parent;
    } catch {
      // a parent from another origin
    }
    return w;
  }

  const BARS = ".sc-globalHeader, .sc-flx-global-header";
  const SS = SCT.siteSettings; // the settings' markup and controls, shared with the extension's popup
  const ICON = ref("icons/icon.svg");

  // The logo sits beside Sitecore's account links in the top bar: left of Log out where they sit on the right,
  // after them where a theme moves them to the left (Sonata). It shrinks to fit a thin bar.
  function addButton() {
    const bar = document.querySelector(BARS);
    if (!bar) return;
    topBar = bar;
    const { host, root } = isolated(document, "sct-themes-button", "position:absolute!important;z-index:3!important;transform:translateY(-50%)!important;",
      `<style>
button{all:unset;box-sizing:border-box;display:flex;align-items:center;justify-content:center;width:var(--size);height:var(--size);border-radius:6px;cursor:pointer}
button:hover,button[aria-expanded="true"]{background:rgba(128,128,128,.25)}
button:focus-visible{outline:2px solid #5319e0;outline-offset:1px}
img{display:block;width:var(--logo);height:var(--logo)}
</style><button type="button" title="Themes for Sitecore" aria-label="Themes for Sitecore" aria-haspopup="dialog" aria-expanded="false"><img alt="" src="${ICON}"></button>`);
    button = host;
    bar.append(host);
    const btn = (logo = root.querySelector("button"));
    // keeps the focus where it is: a press here never blurs the window the picker opens in
    btn.addEventListener("mousedown", (e) => e.preventDefault());
    // detail 0: Enter or Space, so the focus follows into the picker
    btn.addEventListener("click", (e) => (panel ? close() : open({ btn, keyboard: e.detail === 0 })));
    const place = () => {
      const b = bar.getBoundingClientRect();
      const size = b.height >= 34 ? 28 : Math.max(18, Math.round(b.height) - 2);
      // their outer edges on screen: themes reorder them (Sonata draws Log out after the name it precedes)
      const links = [...bar.querySelectorAll(".sc-accountInformation > li")].filter((li) => li.offsetWidth).map((li) => li.getBoundingClientRect());
      let x = b.right - 260 - size;
      if (links.length) {
        const left = Math.min(...links.map((r) => r.left)), right = Math.max(...links.map((r) => r.right));
        x = (left + right) / 2 < (b.left + b.right) / 2 ? right + 12 : left - 12 - size;
      }
      const o = (host.offsetParent || html).getBoundingClientRect();
      pin(host, { left: `${x - o.left}px`, top: `${b.top + b.height / 2 - o.top}px`, "--size": `${size}px`, "--logo": `${Math.min(20, size - 4)}px` });
      bar.style.setProperty("--sct-logo-room", `${size + 12}px`); // bar.css keeps the database name clear of it
    };
    place();
    new ResizeObserver(place).observe(bar);
    window.addEventListener("resize", place);
  }

  // Themes that hide the top bar on the Desktop (Whistler, Copenhagen) mark their start menu's footer with
  // data-sct-menu-footer; the picker gets an entry there, dressed like the footer's own links (a copy of the
  // one with an icon).
  function addMenuEntries() {
    for (const footer of document.querySelectorAll("[data-sct-menu-footer]")) {
      const like = footer.querySelector("a:has(img)");
      if (!like || footer.querySelector(".sct-themes-entry")) continue;
      const entry = like.cloneNode(false);
      entry.removeAttribute("id");
      entry.classList.add("sct-themes-entry");
      entry.href = "#";
      entry.title = "Themes for Sitecore";
      const icon = like.querySelector("img").cloneNode(false);
      icon.src = ICON;
      entry.append(icon, "Themes");
      footer.prepend(entry);
    }
  }

  // Sitecore shows a copy of the start menu (in a popup), so the entry's clicks are taken on the document
  function onEntry(e) {
    const entry = e.target.closest && e.target.closest(".sct-themes-entry");
    if (!entry) return;
    e.preventDefault();
    open({ menu: entry.closest(".scStartMenu") || entry });
    window.scForm?.browser?.closePopups?.("sct"); // Sitecore's own way to close the start menu
  }

  // Open from the logo, the logo becomes a tab and the picker hangs from it as the tab's content: one shape,
  // one outline (the SVG path below), in the panel's own light or dark. The tab covers the logo, from just above
  // it to the bar's bottom edge; the panel starts at that edge, square where the tab joins it and curving into
  // the tab on the other side. The tab sits at the panel's right, or at its left where a logo near the screen's
  // left edge leaves no room (Sonata). Open from a start menu, the picker takes the menu's place, a plain panel.
  const TAB_R = 8, PANEL_R = 12, FILLET = 8, WIDTH = 440;
  const MOTION = { duration: 250, easing: "cubic-bezier(.2, .8, .2, 1)" };
  const PANEL_CSS = `:host{--tab-h:0px;--tab-w:40px}
svg.shape{position:absolute;left:0;top:0;overflow:visible;pointer-events:none;filter:drop-shadow(0 10px 24px rgba(0,0,0,.28))}
svg.shape path{fill:var(--bg);stroke:var(--line);stroke-width:1}
.tab{all:unset;position:absolute;right:0;top:0;width:var(--tab-w);height:var(--tab-h);display:flex;justify-content:center;
  align-items:flex-start;padding-top:var(--logo-top);box-sizing:border-box;cursor:pointer;border-radius:${TAB_R}px ${TAB_R}px 0 0}
.left .tab{right:auto;left:0}
.menu .tab{display:none}
.tab:focus-visible{outline:2px solid var(--accent);outline-offset:-3px}
.tab img{display:block;width:var(--logo);height:var(--logo)}
.sct-panel{position:relative;margin-top:var(--tab-h);background:none;color-scheme:light dark;text-align:left;overflow:auto;
  max-height:var(--max-h);border-radius:0 0 ${PANEL_R}px ${PANEL_R}px}
.menu .sct-panel{border-radius:${PANEL_R}px}
.sct-panel header img{display:block}
.wrap{position:relative;display:flow-root} /* keeps .sct-panel's margin inside it */
:is(#picker,#settings)[hidden]{display:none}
.settings-head{display:flex;align-items:center;gap:8px;margin:2px 0 4px}
.settings-head h2{margin:0;font-size:14px;color:var(--fg)}
#settings h3{margin:12px 4px 6px;font-size:12px;font-weight:600;color:var(--muted)}
.reset{display:flex;flex-direction:column;align-items:flex-start;gap:4px;margin:14px 4px 4px}
.reset button{padding:5px 10px;border:1px solid var(--line);border-radius:6px;background:var(--panel);color:var(--fg);font:inherit;cursor:pointer}
.reset button:hover{background:var(--hover)}
.reset button:focus-visible{outline:2px solid var(--accent);outline-offset:1px}
.reset small{color:var(--muted)}`;

  // The panel unfurls from the tab (or from the start menu's corner) and folds back into it: the shape is
  // revealed from there while the picker settles in. Nothing moves for people who ask for reduced motion.
  function unfurl(p, closing) {
    if (p.win.matchMedia("(prefers-reduced-motion: reduce)").matches) return null;
    const { th, tw, side } = p.g;
    const shut = side === "menu" ? `inset(calc(100% - 44px) calc(100% - 160px) 0 0 round ${PANEL_R}px)`
      : side === "left" ? `inset(0 calc(100% - ${tw}px) calc(100% - ${th}px) 0 round ${TAB_R}px ${TAB_R}px 0 0)`
      : `inset(0 0 calc(100% - ${th}px) calc(100% - ${tw}px) round ${TAB_R}px ${TAB_R}px 0 0)`;
    const opened = "inset(-40px -40px -40px -40px round 0)"; // room for the drop shadow
    const order = (a, b) => (closing ? [b, a] : [a, b]);
    const from = side === "menu" ? "translateY(8px) scale(.96)" : "translateY(-8px) scale(.96)";
    p.body.animate(order({ opacity: 0, transform: from }, { opacity: 1, transform: "none" }), MOTION);
    return p.wrap.animate(order({ clipPath: shut }, { clipPath: opened }), MOTION);
  }

  // the outline round the tab (tw wide, th tall, at the right) and the panel below it, in a box W x H;
  // th 0 is the panel alone
  function shape(W, H, th, tw) {
    const R = PANEL_R;
    if (!th) return `M${R},0 L${W - R},0 Q${W},0 ${W},${R} L${W},${H - R} Q${W},${H} ${W - R},${H} L${R},${H} Q0,${H} 0,${H - R} L0,${R} Q0,0 ${R},0 Z`;
    const x = W - tw, r = TAB_R, f = FILLET;
    return `M${x},${r} Q${x},0 ${x + r},0 L${W - r},0 Q${W},0 ${W},${r} L${W},${H - R} Q${W},${H} ${W - R},${H} L${R},${H}`
      + ` Q0,${H} 0,${H - R} L0,${th + R} Q0,${th} ${R},${th} L${x - f},${th} Q${x},${th} ${x},${th - f} Z`;
  }

  // a box in this frame's viewport, in the top window's
  function inTop(el, win) {
    const r = el.getBoundingClientRect();
    let dx = 0, dy = 0;
    for (let w = window; w !== win; w = w.parent) {
      const f = w.frameElement;
      const fr = f.getBoundingClientRect();
      (dx += fr.left + f.clientLeft), (dy += fr.top + f.clientTop);
    }
    return { left: r.left + dx, top: r.top + dy, right: r.right + dx, bottom: r.bottom + dy };
  }

  // where the panel goes, in the top window: under the logo as its tab, or in the start menu's place
  function geometry(at, win) {
    if (at.menu) {
      const m = inTop(at.menu, win);
      return { side: "menu", th: 0, tw: 0, pos: { left: `${Math.max(8, m.left)}px`, bottom: `${win.innerHeight - m.bottom}px` }, room: m.bottom - 8 };
    }
    const b = inTop(at.btn, win);
    const size = b.bottom - b.top, img = Math.min(20, size - 4);
    const tabTop = Math.max(0, b.top - 6);
    const th = Math.max(b.bottom + 2, inTop(topBar, win).bottom) - tabTop;
    const tw = size + 12, mid = (b.left + b.right) / 2;
    const side = mid + tw / 2 - WIDTH < 8 ? "left" : "right";
    const pos = side === "left" ? { left: `${mid - tw / 2}px` } : { right: `${win.innerWidth - mid - tw / 2}px` };
    const vars = { "--tab-h": `${th}px`, "--tab-w": `${tw}px`, "--logo": `${img}px`, "--logo-top": `${b.top + (size - img) / 2 - tabTop}px` };
    return { side, th, tw, pos: { top: `${tabTop}px`, ...pos, ...vars }, room: win.innerHeight - tabTop - th - 8 };
  }

  function open(at) {
    const win = topWindow();
    const doc = win.document;
    doc.querySelector("sct-themes-panel")?.remove(); // another frame's picker
    const g = geometry(at, win);
    const { host, root } = isolated(doc, "sct-themes-panel", "position:fixed!important;z-index:2147483647!important;",
      `<style>${SCT.pickerCss}\n${PANEL_CSS}</style>
<div class="wrap ${g.side}"><svg class="shape" aria-hidden="true"><path/></svg>
<button class="tab" type="button" title="Themes for Sitecore" aria-label="Close Themes for Sitecore" aria-expanded="true"><img alt="" src="${ICON}"></button>
<div class="sct-panel" role="dialog" aria-label="Themes for Sitecore">
  <header><img src="${ICON}" alt="" width="32" height="32"><div><h1>Themes for Sitecore</h1><p id="host" class="muted"></p></div>
    ${SS.MODE_HTML}
    <button id="open-settings" class="icon-button" type="button" title="Settings" aria-label="Settings" aria-controls="settings" aria-expanded="false">${SS.GEAR_SVG}</button></header>
  <div id="picker"></div>
  <div id="settings" hidden>
    <div class="settings-head"><button id="close-settings" class="icon-button" type="button" title="Back to the themes" aria-label="Back to the themes">${SS.BACK_SVG}</button><h2>Your settings</h2></div>
    <h3>Tab and icon</h3>${SS.TITLE_HTML}
    <h3>Accessibility</h3>${SS.ACCESS_HTML}
    <div class="reset"><button id="reset" type="button">Use the site's settings</button>
      <small>The title postfix, tint, light or dark and environment this Sitecore starts everyone with</small></div>
  </div>
</div></div>`);
    const body = root.querySelector(".sct-panel");
    pin(host, { ...g.pos, "--max-h": `${g.room}px` });
    root.querySelector("#host").textContent = `${location.host} · Sitecore ${cfg.version}`;
    const svg = root.querySelector("svg");
    const draw = () => {
      const W = body.offsetWidth, H = g.th + body.offsetHeight;
      svg.setAttribute("width", W);
      svg.setAttribute("height", H);
      // half-pixel inset keeps the 1px outline on whole pixels
      svg.setAttribute("viewBox", `-0.5 -0.5 ${W} ${H}`);
      const path = svg.querySelector("path");
      path.setAttribute("d", shape(W - 1, H - 1, g.th, g.tw));
      // the tab on the left: the same outline, mirrored
      if (g.side === "left") path.setAttribute("transform", `translate(${W - 1},0) scale(-1,1)`);
    };
    new ResizeObserver(draw).observe(body);
    const tab = root.querySelector(".tab");
    tab.addEventListener("click", close);
    const { render } = SCT.picker.mount(root.querySelector("#picker"), {
      label: "Your theme",
      themes: `${cfg.base}themes/`,
      load: async () => ({ version: cfg.version, catalog, theme: cfg.theme, hue: cfg.hue, env: cfg.env, phase: cfg.phase, scheme: cfg.scheme }),
      setTheme: (id) => save({ theme: id }, "theme"),
      setHue: (hue, theme) => save({ hue: String(hue), hueTheme: theme }, "hue"),
      setEnv: (env) => save({ env }, "env"),
      setPhase: (phase) => save({ phase }, "phase"),
      setScheme: (scheme) => save({ scheme }, "scheme"),
      // the Light or Dark pill shows while the theme has both looks
      onTheme: (t) => (root.querySelector("#mode").hidden = t.appearance !== "auto"),
    });
    // the gear swaps the themes for the user's own settings and back again, as does the back arrow
    const views = (on) => {
      root.querySelector("#picker").hidden = on;
      root.querySelector("#settings").hidden = !on;
      root.querySelector("#open-settings").setAttribute("aria-expanded", String(on));
      root.querySelector(on ? "#close-settings" : "#open-settings").focus({ preventScroll: true });
    };
    root.querySelector("#open-settings").onclick = () => views(root.querySelector("#settings").hidden);
    root.querySelector("#close-settings").onclick = () => views(false);
    const mountSettings = () => SS.mount(root, siteStore);
    mountSettings();
    root.querySelector("#reset").onclick = async () => {
      await save({ reset: "1" }, "reset");
      mountSettings(); // the controls show the site's values again
      render();
    };
    doc.documentElement.append(host); // outside <body>, which themes and the switch's blur may filter
    const wrap = root.querySelector(".wrap");
    body.style.transformOrigin = { left: "left top", right: "right top", menu: "left bottom" }[g.side];
    panel = { host, render, win, doc, wrap, body, g };
    unfurl(panel, false);
    if (at.btn) logo.setAttribute("aria-expanded", "true");
    if (at.keyboard) tab.focus({ preventScroll: true });
    for (const d of new Set([doc, document])) {
      d.addEventListener("pointerdown", outside, true);
      d.addEventListener("keydown", escape, true);
    }
    win.addEventListener("blur", close); // the focus went into a frame
    win.addEventListener("resize", close); // the tab would no longer sit on the logo
    window.addEventListener("pagehide", close);
  }

  function outside(e) {
    const path = e.composedPath();
    if (!path.includes(panel?.host) && !path.includes(button)) close();
  }
  function escape(e) {
    if (e.key === "Escape") close();
  }

  function close() {
    if (!panel) return;
    const p = panel;
    panel = null;
    pin(p.host, { "pointer-events": "none" });
    const folding = unfurl(p, true);
    if (folding) folding.finished.then(() => p.host.remove(), () => p.host.remove());
    else p.host.remove();
    for (const d of new Set([p.doc, document])) {
      d.removeEventListener("pointerdown", outside, true);
      d.removeEventListener("keydown", escape, true);
    }
    p.win.removeEventListener("blur", close);
    p.win.removeEventListener("resize", close);
    window.removeEventListener("pagehide", close);
    logo?.setAttribute("aria-expanded", "false");
  }

  function addPicker() {
    if (!cfg.save || engine.stopped) return; // signed out (nothing to save to), or the extension took over
    addButton();
    addMenuEntries();
    document.addEventListener("click", onEntry, true);
    // the start menu and its footer are built, and rebuilt, by Sitecore and the theme after the page loads
    footers = new MutationObserver(() => document.querySelector("[data-sct-menu-footer]:not(:has(.sct-themes-entry))") && addMenuEntries());
    footers.observe(html, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", addPicker, { once: true });
  else addPicker();

  // Sitecore's static pages (the modal dialog host, JqueryModalDialogs.html) never pass through the module, and
  // browsers keep them cached, so a frame showing one gets this loader from its parent once it has loaded.
  // Only after load: reaching into a frame that still loads kept Chrome from theming it.
  const { src } = document.currentScript;
  function loadInto(e) {
    let d = null;
    try {
      d = e.target.tagName === "IFRAME" && e.target.contentDocument;
    } catch {
      // another origin
    }
    if (!d || !d.documentElement || d.documentElement.dataset.sctEngine || d.querySelector(`script[src^="${cfg.base}sct.js"]`)) return;
    if (!SCT.detect.surfaceFromUrl(d.location.href)) return;
    const s = d.createElement("script"); // a clone would count as already run
    s.src = src;
    s.dataset.sct = JSON.stringify(cfg); // the theme as it is now, after any switch
    (d.head || d.documentElement).append(s);
  }
  document.addEventListener("load", loadInto, true);
})();
