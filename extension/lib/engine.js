// The page engine, shared by the extension (content.js) and the Sitecore module (sitecore/host.js): tags the
// frame, asks the host for its theme, runs the theme's DOM module. Everything it needs from whatever delivered it
// comes through the host:
//   alive()           false once the host is gone (an extension reload)
//   version()         Promise of the Sitecore version stored for this origin, or null
//   saveVersion(v)    remembers the version this origin runs
//   site()            Promise of this origin's { title, tint, env, phase, hue, accessibility }
//   url(path)         the address of a packaged file (fonts/...), asked for only while the site has a reading font
//   theme(version)    Promise of the catalog entry ({ id, name, usesTokens }) this frame should show now
//   apply(msg)        swaps the frame's theme CSS; msg { surface, version, previous, previousEntry, previousMode, off }
//                     (off: to Native whatever the site's setting);
//                     Promise of { theme, name, usesTokens, dev, mode } (mode: the site's light or dark, "" for System)
//   tokens(id)        Promise of a theme's token CSS, "" for none
//   listen(fn)        calls fn(kind, detail) when a setting changes: theme, title, tint, env, phase, hue, accessibility, mode,
//                     version (detail: the version), imported (detail: the imported themes before the change)
//   stop()            the engine has stopped: drop the listener and anything the host added
(function (root) {
  const SCT = (root.SCT = root.SCT || {});

  // Returns the engine, or null when this frame is not a Sitecore surface or already runs one.
  SCT.startEngine = function (host) {
    // injected twice by registration and by executeScript; an engine unloaded by Disable lets a new one start
    if (SCT.engine && !SCT.engine.stopped) return null;

    const doc = document;
    const html = doc.documentElement;
    const origin = location.origin;
    const surfaceName = SCT.detect.surfaceFromUrl(location.href);
    if (!surfaceName) return null;

    const engine = (SCT.engine = { id: Math.random().toString(36).slice(2), theme: null, stopped: false });
    let version = null;
    let versionKnown = false; // from the cache or sitecore.version.xml; the stylesheet guess never overrides it
    let dev = false;
    let kit = null;
    let observer = null;
    let frame = 0;
    let cssOnly = false;
    let domReady = false;
    let live = null;

    html.dataset.sctEngine = engine.id;
    html.dataset.sctSurface = surfaceName;
    // Sitecore's modal dialog host is a full-window frame laid over the app; its page must stay see-through.
    // Its value is the host page's surface: a frame whose color-scheme differs from its host's gets an opaque
    // canvas, so over the Experience Editor's website (no color-scheme) it must not take the theme's.
    if (/\/controls\/jquerymodaldialogs\.html$/i.test(location.pathname)) {
      let host = "";
      try {
        host = SCT.detect.surfaceFromUrl(parent.location.href) || "";
      } catch {
        // cross-origin host
      }
      html.dataset.sctModalHost = host;
    }

    // A newer engine (after an extension reload or update) takes over the page.
    const handover = new MutationObserver(() => {
      if (html.dataset.sctEngine !== engine.id) stop();
    });
    handover.observe(html, { attributes: true, attributeFilter: ["data-sct-engine"] });

    function alive() {
      return !engine.stopped && host.alive();
    }

    function setVersion(v) {
      version = v;
      const ui = SCT.settings.uiVersion(v);
      html.dataset.sctVersion = ui || "10.5";
      // 10.0 to 10.3 carry their release: the generated maps' rules for their older stylesheets apply only there,
      // and surfaces/launchpad.css gives 10.0 the 10.1 Launchpad
      if (v && ui !== v) html.dataset.sctLegacy = v;
      else delete html.dataset.sctLegacy;
    }

    // One request at a time per frame: each reply changes what the next request has to remove,
    // so overlapping requests would remove or keep the wrong CSS.
    let queue = Promise.resolve();
    function requestTheme(previousEntry, off) {
      queue = queue.then(() => doRequestTheme(previousEntry, off)).catch(() => {});
      return queue;
    }

    // off: Native whatever the site's setting, for unload()
    async function doRequestTheme(previousEntry, off) {
      const reply = await host.apply({ surface: surfaceName, version, previous: engine.theme, previousEntry, previousMode: engine.mode, off });
      if (!reply || reply.error || !alive()) return;
      dev = reply.dev;
      engine.mode = reply.mode; // a mode change swaps only the CSS
      if (reply.theme === engine.theme && !previousEntry) return;
      revertDom();
      engine.theme = reply.theme;
      engine.themeName = reply.name;
      if (reply.theme === "native") delete html.dataset.sctTheme;
      else html.dataset.sctTheme = reply.theme;
      html.toggleAttribute("data-sct-tokens", reply.usesTokens);
      applyHue();
      if (domReady) applyDom(), syncMaxButton(), syncTaskbar(), syncWindowTitle(), syncLaunchpadRows();
      syncLive();
      if (tabWatch) syncTint(); // a tint from the theme follows it
      if (doc.readyState === "complete") rememberPaint();
    }

    // A Desktop window's Maximize/Restore button always shows Sitecore's maximize image, even while the window is
    // maximized (the Content Editor opens that way). Under a theme it shows the restore image (page_restore.png,
    // dialog_restore_v2.png, which Sitecore ships) while the window's frame fills the Desktop, so themes draw the
    // right glyph. scForm.rollOver builds its _h image from the current one, so hovering keeps the swap. Native
    // and a theme switch put back only the images swapped here.
    const MAXIMIZE = /(page|dialog)_maximize/, RESTORE = /(page|dialog)_restore/;
    const swapped = new Set();
    let maxWatch = null;
    function syncMaxButton() {
      let frame = null;
      try {
        frame = window.frameElement;
      } catch {
        // a cross-origin parent
      }
      if (!frame || surfaceName !== "shell" || !alive()) return;
      if (!maxWatch) {
        maxWatch = new MutationObserver(() => (alive() ? syncMaxButton() : maxWatch.disconnect()));
        maxWatch.observe(frame, { attributes: true, attributeFilter: ["style"] });
      }
      const themed = !!engine.theme && engine.theme !== "native";
      const maximized = themed && frame.style.width === "100%" && frame.style.height === "100%";
      for (const img of doc.querySelectorAll(".scSystemButtons img, .standartWindowButtons img, .scWorkboxWindowButtons img")) {
        const src = img.getAttribute("src") || "";
        if (maximized && MAXIMIZE.test(src)) {
          img.setAttribute("src", src.replace(MAXIMIZE, "$1_restore"));
          swapped.add(img);
        } else if (!maximized && swapped.has(img) && RESTORE.test(src)) {
          img.setAttribute("src", src.replace(RESTORE, "$1_maximize"));
          swapped.delete(img);
        }
      }
    }

    // 10.0's Launchpad wraps each group's tiles in a .sc-launchpad-group-row; 10.1 and later don't, and themes lay
    // the tiles out as the group's children (> .sc-launchpad-item, :nth-of-type). Under a theme the rows hand their
    // tiles to the group; Native and stop put them back.
    const rows = new Map(); // row -> its tiles
    function syncLaunchpadRows() {
      if (surfaceName !== "launchpad") return;
      const themed = alive() && !!engine.theme && engine.theme !== "native";
      if (themed) {
        for (const row of doc.querySelectorAll(".sc-launchpad-group-row")) {
          const tiles = [...row.children];
          rows.set(row, tiles);
          row.replaceWith(...tiles);
        }
        return;
      }
      for (const [row, tiles] of rows) {
        if (tiles[0] && tiles[0].isConnected) tiles[0].before(row), row.append(...tiles);
      }
      rows.clear();
    }

    // Sitecore drops a window's taskbar entry from its unload event, which Chrome and Edge no longer fire, so a
    // window that navigates (the Content Editor switched to the Media Library or the Workbox) gets a second entry
    // and a closed window leaves its entry behind. Under every theme the newest entry per window stays and
    // entries whose window is gone are dropped. Native keeps Sitecore's behaviour.
    let taskWatch = null;
    function syncTaskbar() {
      const bar = doc.getElementById("StartbarApplications");
      if (!bar || !alive()) return;
      if (!taskWatch) {
        taskWatch = new MutationObserver(() => (alive() ? syncTaskbar() : taskWatch.disconnect()));
        taskWatch.observe(bar, { childList: true, subtree: true });
      }
      if (!engine.theme || engine.theme === "native") return;
      const seen = new Set();
      for (const cell of [...bar.querySelectorAll('td[id^="startbar_application_"]')].reverse()) {
        const id = cell.id.slice("startbar_application_".length);
        if (seen.has(id) || !doc.getElementById(id)) cell.remove();
        else seen.add(id);
      }
    }

    // A Desktop window's title, read from its taskbar entry, as data-sct-window-title and --sct-window-title (a CSS
    // string) on its <html>: Sitecore draws no caption over the Content Editor, Media Library or Workbox, so a
    // theme that gives those windows a title bar shows it with content: var(--sct-window-title). The window's own
    // engine reads its parent's taskbar (a parent never reaches into a window before it loads). The taskbar
    // entry's icon comes along as --sct-window-icon (a CSS url). The page inside a standard window's chrome (the
    // ISE, the Recycle Bin...) is marked data-sct-window-content, so a theme can see through it to the window.
    // Native keeps Sitecore's behaviour.
    let titleWatch = null;
    function syncWindowTitle() {
      let own = null, bar = null, content = false;
      try {
        own = window.frameElement;
        if (own && own.parentElement?.classList.contains("DesktopArea")) bar = own.ownerDocument.getElementById("StartbarApplications");
        else content = !!(own?.closest(".windowPlaceholderContainer") && own.ownerDocument.defaultView.frameElement?.parentElement?.classList.contains("DesktopArea"));
      } catch {
        return; // a window from another origin
      }
      const on = !engine.stopped && engine.theme && engine.theme !== "native";
      if (content && on) html.dataset.sctWindowContent = "";
      else delete html.dataset.sctWindowContent;
      if (!bar) return;
      if (!titleWatch && alive() && !engine.stopped) {
        titleWatch = new MutationObserver(() => (alive() && !engine.stopped ? syncWindowTitle() : titleWatch.disconnect()));
        titleWatch.observe(bar, { childList: true, subtree: true, characterData: true });
      }
      const cell = own.ownerDocument.getElementById(`startbar_application_${own.id}`);
      const title = cell ? cell.textContent.trim().replace(/\s+/g, " ") : "";
      const icon = cell?.querySelector("img")?.src;
      if (title && on) {
        html.dataset.sctWindowTitle = title;
        html.style.setProperty("--sct-window-title", `"${title.replace(/["\\]/g, "\\$&")}"`);
        if (icon) html.style.setProperty("--sct-window-icon", `url("${icon.replace(/["\\]/g, "\\$&")}")`);
        else html.style.removeProperty("--sct-window-icon");
      } else {
        delete html.dataset.sctWindowTitle;
        html.style.removeProperty("--sct-window-title");
        html.style.removeProperty("--sct-window-icon");
      }
    }

    // Sitecore resizes a Desktop window only from the 4px rim of the window's own document (scWin.hitTest), and
    // only where that document carries scWin's handlers: the whole window in most apps, the caption alone in the
    // Workbox. Themes draw the window frame on the iframe in the Desktop (border, padding, box-shadow, outline),
    // where the window never sees the mouse. Under a theme, a press on that frame or up to GRAB px outside the
    // iframe, or on the window's rim outside scWin's handlers, is handed to the window as a press on the matching
    // rim, so Sitecore's own resize runs (outline, minimum size, floatBounds). Native keeps Sitecore's behaviour.
    const GRAB = 6, RIM = 4, CORNER = 16;
    const HANDLER = '[onmousedown*="scWin.mouseDown"]';
    const CURSORS = { left: "ew", right: "ew", top: "ns", bottom: "ns", topleft: "nwse", bottomright: "nwse", topright: "nesw", bottomleft: "nesw" };
    let cursorOn = null;
    // which edge or corner of box r a point is on, given the frame's widths inside r (inset) and the band outside it (out)
    function edge(x, y, r, inset, out) {
      if (x < r.left - out || x >= r.right + out || y < r.top - out || y >= r.bottom + out) return "";
      let h = x < r.left + inset.left ? "left" : x >= r.right - inset.right ? "right" : "";
      let v = y < r.top + inset.top ? "top" : y >= r.bottom - inset.bottom ? "bottom" : "";
      if (!h && !v) return "";
      if (!v) v = y < r.top + CORNER ? "top" : y >= r.bottom - CORNER ? "bottom" : "";
      else if (!h) h = x < r.left + CORNER ? "left" : x >= r.right - CORNER ? "right" : "";
      return v + h;
    }
    function frameHit(e) {
      const t = e.target;
      if (!engine.theme || engine.theme === "native" || !alive() || !t.closest) return null;
      // inside a Desktop window (its document, or a frame in it that reaches its edge, as the Workbox's list
      // does): the window's rim, where Sitecore's handlers don't reach
      let x = e.clientX, y = e.clientY, w = window, own = null;
      try {
        while ((own = w.frameElement) && !own.parentElement?.classList.contains("DesktopArea")) {
          const r = own.getBoundingClientRect();
          (x += r.left + own.clientLeft), (y += r.top + own.clientTop), (w = w.parent);
        }
      } catch {
        return null; // a cross-origin parent
      }
      if (own) {
        const d = w.document;
        if (own.style.width === "100%" || (w === window && t.closest(HANDLER))) return null;
        const hit = edge(x, y, { left: 0, top: 0, right: d.body.offsetWidth, bottom: d.body.offsetHeight }, { left: RIM, top: RIM, right: RIM, bottom: RIM }, 0);
        return hit && { d, hit };
      }
      if (w !== window) return null;
      // the Desktop: a press on a window's iframe or on the bare Desktop (its link list's background), never an icon
      const desk = doc.querySelector(".DesktopArea");
      if (!desk || (t !== desk && t.parentElement !== desk && t.id !== "DesktopLinks")) return null;
      const frames = t.tagName === "IFRAME" ? [t] : [...desk.children].filter((f) => f.tagName === "IFRAME").sort((a, b) => (+b.style.zIndex || 0) - (+a.style.zIndex || 0));
      for (const f of frames) {
        if (f.style.width === "100%" || !f.offsetWidth) continue;
        const cs = getComputedStyle(f);
        // the Desktop only sees points off the window's page: its border, padding, or a corner its radius cut off
        const px = (side) => Math.max(parseFloat(cs[`border${side}Width`]) + parseFloat(cs[`padding${side}`]), parseFloat(cs.borderTopLeftRadius) || 0);
        const hit = edge(e.clientX, e.clientY, f.getBoundingClientRect(), { left: px("Left"), top: px("Top"), right: px("Right"), bottom: px("Bottom") }, GRAB);
        if (hit) return { f, hit };
      }
      return null;
    }
    function frameCursor(e) {
      const hit = e.buttons ? null : frameHit(e);
      const el = hit ? e.target : null;
      if (cursorOn && cursorOn.el !== el) cursorOn.el.style.cursor = cursorOn.prev;
      if (el && cursorOn?.el !== el) cursorOn = { el, prev: el.style.cursor };
      if (el) el.style.cursor = `${CURSORS[hit.hit]}-resize`;
      else cursorOn = null;
    }
    function framePress(e) {
      if (e.button !== 0 || e.ctrlKey || e.shiftKey || e.altKey) return;
      const hit = frameHit(e);
      let d = null;
      try {
        d = hit && (hit.d || hit.f.contentDocument); // only on a press: the window has long loaded by then
      } catch {
        // cross-origin window
      }
      const target = d && d.readyState === "complete" && !d.querySelector(".scWindowNoResize") && d.querySelector(HANDLER);
      if (!target) return;
      e.preventDefault();
      const w = d.body.offsetWidth, h = d.body.offsetHeight;
      const clientX = /left/.test(hit.hit) ? 0 : /right/.test(hit.hit) ? w - 1 : w >> 1;
      const clientY = /top/.test(hit.hit) ? 0 : /bottom/.test(hit.hit) ? h - 1 : h >> 1;
      const view = d.defaultView;
      target.dispatchEvent(new view.MouseEvent("mousedown", { bubbles: true, cancelable: true, view, button: 0, buttons: 1, clientX, clientY, screenX: e.screenX, screenY: e.screenY }));
    }
    function frameResize(on) {
      const how = on ? "addEventListener" : "removeEventListener";
      doc[how]("mousedown", framePress, true);
      doc[how]("mousemove", frameCursor, true);
      if (!on && cursorOn) cursorOn.el.style.cursor = cursorOn.prev, cursorOn = null;
    }

    // Dev installs record the slowest pass: data-sct-apply-ms for the theme's DOM module,
    // data-sct-live-ms for the runtime colour map.
    function noteMs(ms, key = "sctApplyMs") {
      if (dev && ms > Number(html.dataset[key] || 0)) html.dataset[key] = ms.toFixed(2);
    }

    // Token themes also map what the build never saw; the Experience Editor's page is the website's own.
    // It starts with the theme, before the DOM is ready, so its first pass lands inside holdPaint's hold.
    function syncLive() {
      const want = alive() && html.hasAttribute("data-sct-tokens") && surfaceName !== "ee";
      if (want && !live) (live = SCT.createLiveMap(doc, (ms) => noteMs(ms, "sctLiveMs"))).start();
      if (!want && live) {
        live.stop();
        live = null;
      }
    }

    function context() {
      return {
        surface: surfaceName, version: version || "10.5", doc,
        own: kit.own, addClass: kit.addClass, setAttr: kit.setAttr, move: kit.move,
      };
    }

    function run() {
      const mod = SCT.domModules[engine.theme];
      if (!mod || !kit) return;
      const t0 = performance.now();
      try {
        mod.apply(context());
      } catch (err) {
        console.warn("[Themes for Sitecore]", engine.theme, err);
        cssOnly = true;
        revertDom();
        return;
      }
      if (observer) observer.takeRecords(); // drop the mutations apply just caused
      noteMs(performance.now() - t0);
    }

    function applyDom() {
      const mod = SCT.domModules[engine.theme];
      if (!mod || cssOnly) return;
      kit = SCT.createDomKit(doc);
      observer = new MutationObserver((records) => {
        if (!alive()) return stop();
        if (records.every((r) => kit.isOwned(r.target) || [...r.addedNodes, ...r.removedNodes].every((n) => kit.isOwned(n) || n.nodeType !== 1))) return;
        if (!frame) frame = requestAnimationFrame(() => ((frame = 0), run()));
      });
      run();
      if (kit) observer.observe(html, { childList: true, subtree: true });
    }

    function revertDom() {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      if (observer) observer.disconnect();
      observer = null;
      if (kit) {
        const mod = SCT.domModules[engine.theme];
        kit.revertAll();
        try {
          if (mod && mod.revert) mod.revert({ surface: surfaceName, version, doc });
        } catch (err) {
          console.warn("[Themes for Sitecore]", engine.theme, err);
        }
      }
      kit = null;
    }

    // Disable on this site (the popup): the frame goes back to Sitecore's own look while the extension can still
    // reach it, the theme's CSS out, the tab's title and icon as the page set them and no data-sct-* left on <html>,
    // and the engine stops for good.
    engine.unload = async () => {
      if (!alive()) return;
      await requestTheme(undefined, true);
      titlePostfix = "";
      iconUrl = null;
      if (tabWatch) stampTab();
      stop();
      for (const key of Object.keys(html.dataset)) if (key.startsWith("sct")) delete html.dataset[key];
    };

    function stop() {
      if (engine.stopped) return;
      releasePaint();
      revertDom();
      for (const img of swapped) img.setAttribute("src", (img.getAttribute("src") || "").replace(RESTORE, "$1_maximize"));
      if (maxWatch) maxWatch.disconnect();
      if (taskWatch) taskWatch.disconnect();
      if (titleWatch) titleWatch.disconnect();
      frameResize(false);
      engine.stopped = true;
      syncWindowTitle(); // takes the title off
      syncLive();
      syncLaunchpadRows();
      stampBar(); // takes the bar's postfix out
      if (html.dataset.sctEngine === engine.id) applyHue(); // a newer engine keeps the page's hue
      applyAccess();

      handover.disconnect();
      if (tabWatch) tabWatch.disconnect();
      host.stop();
    }

    // The top window's tab tells Sitecore instances apart: its title carries the site's postfix and its
    // favicon the site's tint. What the page carries lives on <html> and on the icon links, so an engine
    // taking over the page does not add either twice.
    const ICONS = 'link[rel~="icon" i]';
    const SITECORE_ICON = "/sitecore/images/favicon.ico"; // Launchpad and SPEAK apps link no icon
    let titlePostfix = "";
    let tintSetting = "";
    let tint = null; // the colour the favicon is tinted with, null when off
    let iconUrl = null; // the favicon drawn in that colour
    let iconBlocked = false; // the page's CSP refuses data: images, so its own icon stays
    let tabWatch = null;

    function stampTab() {
      const next = SCT.settings.withPostfix(doc.title, titlePostfix, html.dataset.sctTitle || "");
      if (titlePostfix) html.dataset.sctTitle = titlePostfix;
      else delete html.dataset.sctTitle;
      if (next !== doc.title) doc.title = next;
      stampIcon();
      tabWatch.takeRecords(); // our own changes
    }

    // Every icon link points at the tinted icon, the page's own address kept in data-sct-href.
    function stampIcon() {
      const links = [...doc.querySelectorAll(ICONS)];
      if (!iconUrl) {
        for (const l of links) {
          if (l.hasAttribute("data-sct-owned")) l.remove();
          else if (l.hasAttribute("data-sct-href")) {
            l.setAttribute("href", l.dataset.sctHref);
            delete l.dataset.sctHref;
          }
        }
        return;
      }
      if (!links.length) {
        const own = doc.createElement("link");
        own.rel = "icon";
        own.setAttribute("data-sct-owned", "");
        (doc.head || html).append(own);
        links.push(own);
      }
      for (const l of links) {
        if (!l.hasAttribute("data-sct-href") && !l.hasAttribute("data-sct-owned")) l.dataset.sctHref = l.getAttribute("href") || "";
        if (l.getAttribute("href") !== iconUrl) l.setAttribute("href", iconUrl);
      }
    }

    // The page's icon in the tint's hue, keeping the icon's light and shade; null when it cannot be read.
    function drawIcon(color) {
      const link = doc.querySelector(`${ICONS}:not([data-sct-owned])`);
      const src = (link && (link.dataset.sctHref ?? link.getAttribute("href"))) || SITECORE_ICON;
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          const canvas = doc.createElement("canvas");
          canvas.width = canvas.height = 32;
          const g = canvas.getContext("2d");
          g.drawImage(img, 0, 0, 32, 32);
          g.globalCompositeOperation = "color";
          g.fillStyle = color;
          g.fillRect(0, 0, 32, 32);
          g.globalCompositeOperation = "destination-in"; // back to the icon's own shape
          g.drawImage(img, 0, 0, 32, 32);
          try {
            resolve(canvas.toDataURL());
          } catch {
            resolve(null); // an icon from another origin taints the canvas
          }
        };
        img.onerror = () => resolve(null);
        img.src = new URL(src, location.href).href;
      });
    }

    async function syncTint() {
      const want = SCT.settings.tintColor(tintSetting, SCT.themes.find((t) => t.id === engine.theme));
      if (want === tint) return;
      tint = want;
      const url = want ? await drawIcon(want) : null;
      if (tint !== want || !alive()) return; // a newer tint took over
      iconUrl = iconBlocked ? null : url;
      stampTab();
    }

    async function syncTab() {
      const { title, tint } = await host.site();
      if (!alive()) return;
      // document.title collapses whitespace, so the postfix does too or it never matches
      titlePostfix = (title || "").trim().replace(/\s+/g, " ");
      tintSetting = tint || "";
      // Sitecore retitles its apps as they load and navigate
      if (!tabWatch) {
        tabWatch = new MutationObserver(() => (alive() ? stampTab() : stop()));
        tabWatch.observe(doc.head || html, { childList: true, subtree: true, characterData: true });
        // a blocked favicon shows as a blank page, so the page keeps its own
        doc.addEventListener("securitypolicyviolation", (e) => {
          if (!alive() || e.blockedURI !== "data" || !/^(img|default)-src/.test(e.effectiveDirective)) return;
          iconBlocked = true;
          if (iconUrl) (iconUrl = null), stampTab();
        });
      }
      stampTab();
      syncTint();
    }

    // The postfix also shows in Sitecore's top bar (the global header) of any frame that has one: the Desktop,
    // Launchpad, SPEAK apps, the Experience Editor's ribbon, the standalone Content Editor. One owned element and
    // one owned <style> with Native's look at zero specificity, so surfaces/bar.css restyles it per theme. Under
    // Native, the Sitecore Extensions add-on's database name keeps the centre and the postfix sits left of it.
    const BARS = ".sc-globalHeader, .sc-flx-global-header";
    const BAR_CSS = `:where(sct-bar-postfix){position:absolute;z-index:1;left:50%;top:50%;transform:translate(-50%,-50%);
  box-sizing:border-box;max-width:calc(100% - 2 * var(--sct-bar-side,360px));overflow:hidden;white-space:nowrap;
  text-overflow:ellipsis;pointer-events:none;padding:3px 10px;border:1px solid #d9cfff;border-radius:4px;background:#f1edff;
  color:#4a1fd1;font:600 12px/16px "Open Sans",Arial,sans-serif;letter-spacing:.02em;text-transform:none;text-align:center}
  :where([data-sct-version="10.4"]) :where(sct-bar-postfix){border-color:#5a5a5a;border-radius:2px;background:#3c3c3c;color:#fff}
  :where(html:not([data-sct-theme])) :where(.sc-globalHeader:has(>.sc-ext-dbName)>sct-bar-postfix){left:auto;right:calc(50% + 44px);
  transform:translateY(-50%);max-width:calc(50% - 44px - 300px)}`;
    // ponytail: Native's offset fits MASTER, WEB and CORE in Sitecore's 12px; a longer database name would need measuring
    let barPostfix = "";
    function stampBar() {
      const bar = alive() && barPostfix ? doc.querySelector(BARS) : null;
      let own = doc.querySelector("sct-bar-postfix[data-sct-owned]");
      let css = doc.querySelector("style[data-sct-bar]");
      if (!bar) return own?.remove(), css?.remove();
      if (!css) {
        css = doc.createElement("style");
        css.setAttribute("data-sct-owned", "");
        css.setAttribute("data-sct-bar", "");
        css.textContent = BAR_CSS;
        (doc.head || html).append(css);
      }
      if (own?.parentElement !== bar) {
        own?.remove();
        own = doc.createElement("sct-bar-postfix");
        own.setAttribute("data-sct-owned", "");
        bar.append(own);
      }
      if (own.textContent !== barPostfix) own.textContent = barPostfix;
    }
    async function syncBar() {
      const { title } = await host.site();
      if (!alive()) return;
      barPostfix = (title || "").trim().replace(/\s+/g, " ");
      stampBar();
    }

    // The site's environment (Guardrail draws it): data-sct-env on every frame, nothing when unset.
    async function syncEnv() {
      const site = await host.site();
      if (!alive()) return;
      const env = SCT.settings.ENVS.includes(site.env) ? site.env : null;
      if (env) html.dataset.sctEnv = env;
      else delete html.dataset.sctEnv;
    }

    // The site's time of day (Meridian follows it instead of the clock): data-sct-phase-pin, nothing for Auto.
    async function syncPhase() {
      const site = await host.site();
      if (!alive()) return;
      const phase = SCT.settings.PHASES.includes(site.phase) ? site.phase : null;
      if (phase) html.dataset.sctPhasePin = phase;
      else delete html.dataset.sctPhasePin;
    }

    // The site's hue (themes.js `hue`): --sct-hue (degrees) and data-sct-hue on every frame, for themes that
    // offer one; their tokens.css turns its colours by it. Nothing when unset, under other themes, or stopped.
    let hues = null; // the site's saved hues, resolved for the theme in use
    async function syncHue() {
      const site = await host.site();
      if (!alive()) return;
      hues = site.hue;
      applyHue();
    }
    function applyHue() {
      const theme = SCT.themes.find((t) => t.id === engine.theme);
      const h = alive() && theme && theme.hue ? SCT.settings.hue(hues, theme.id) : null;
      if (h) {
        html.style.setProperty("--sct-hue", String(h));
        html.dataset.sctHue = h;
      } else if (html.hasAttribute("data-sct-hue")) {
        html.style.removeProperty("--sct-hue");
        delete html.dataset.sctHue;
      }
    }

    // The site's accessibility aids (settings.js `accessibility`), under every theme, one owned <style> per frame:
    // - the reading font and spacing in every frame (data-sct-font, data-sct-spacing), never on the website the
    //   Experience Editor shows; its ribbon is a SPEAK frame of its own;
    // - the colour filter on the top document only (data-sct-vision and the SVG filter #sct-vision): a filter takes in
    //   every frame below it, which applying it there too would correct twice. Like a filter over the screen, it takes
    //   in the Experience Editor's website as well.
    let access = null;
    async function syncAccess() {
      const site = await host.site();
      if (!alive()) return;
      access = SCT.settings.accessibility(site.accessibility);
      applyAccess();
    }
    function applyAccess() {
      if (html.dataset.sctEngine !== engine.id) return; // a newer engine keeps the page's
      const a = alive() && access ? { ...access } : null;
      if (a && surfaceName === "ee") a.font = a.spacing = null;
      if (a && !TOP) a.vision = null;
      // The Desktop's window manager walks every element on load and calls className.indexOf, which an SVG element
      // breaks (its className is an object): the filter comes in once the page's own load handlers have run.
      if (a?.vision && doc.readyState !== "complete") {
        a.vision = null;
        window.addEventListener("load", () => setTimeout(applyAccess), { once: true });
      }
      for (const [key, value] of [["sctFont", a?.font], ["sctSpacing", a?.spacing], ["sctVision", a?.vision]]) {
        if (value) html.dataset[key] = value;
        else delete html.dataset[key];
      }
      let filter = doc.querySelector("svg[data-sct-vision]");
      if (a?.vision) {
        if (!filter) {
          const NS = "http://www.w3.org/2000/svg";
          filter = doc.createElementNS(NS, "svg");
          filter.setAttribute("data-sct-owned", "");
          filter.setAttribute("data-sct-vision", "");
          filter.setAttribute("aria-hidden", "true");
          // display:none would switch the filter off in some browsers
          filter.setAttribute("style", "position:absolute;width:0;height:0;overflow:hidden");
          filter.append(doc.createElementNS(NS, "filter"));
          filter.firstChild.id = "sct-vision";
          filter.firstChild.append(doc.createElementNS(NS, "feColorMatrix"));
          html.append(filter);
        }
        filter.querySelector("feColorMatrix").setAttribute("values", SCT.settings.visionValues(a.vision, a.strength));
      } else filter?.remove();
      let style = doc.querySelector("style[data-sct-access]");
      const css = SCT.settings.accessibilityCss(a, host.url);
      if (!css) return style?.remove();
      if (!style) {
        style = doc.createElement("style");
        style.setAttribute("data-sct-owned", "");
        style.setAttribute("data-sct-access", "");
        (doc.head || html).append(style);
      }
      if (style.textContent !== css) style.textContent = css;
    }

    function saveVersion(v) {
      if (!v || v === version) return;
      setVersion(v);
      host.saveVersion(v);
      requestTheme();
    }

    async function probeVersion() {
      if (surfaceName === "login") return;
      try {
        const r = await fetch(origin + "/sitecore/shell/sitecore.version.xml", { credentials: "include" });
        const v = r.ok ? SCT.detect.parseVersionXml(await r.text()) : null;
        if (v) {
          versionKnown = true;
          saveVersion(v);
        }
      } catch {
        // hardened servers block the file; the stylesheet heuristic decides instead
      }
    }

    function onChange(kind, detail) {
      if (!alive()) return stop();
      if (kind === "theme") switchTheme().catch(() => {});
      if ((kind === "title" || kind === "tint") && tabWatch) syncTab();
      if (kind === "title" && domReady) syncBar();
      if (kind === "env") syncEnv();
      if (kind === "phase") syncPhase();
      if (kind === "hue") syncHue();
      if (kind === "accessibility") syncAccess();
      if (kind === "mode") requestTheme();
      if (kind === "version" && detail && detail !== version) {
        setVersion(detail);
        requestTheme().then(() => {
          revertDom();
          if (domReady) applyDom();
        });
      }
      if (kind === "imported" && engine.theme && engine.theme.startsWith("import:")) {
        requestTheme((detail || {})[engine.theme] || undefined);
      }
    }

    // The Sitecore Extensions add-on pins its ribbon toggle where stock Sitecore draws the quickbar;
    // themes move the quickbar, so publish where its toggle is and surfaces/ee.css lines the add-on up.
    function trackRibbonToggle() {
      const ribbon = doc.getElementById("scWebEditRibbon");
      if (!ribbon) return;
      const sync = () => {
        const t = ribbon.contentDocument?.querySelector('[data-sc-id="QuickRibbon"]')?.getBoundingClientRect();
        // a hidden ribbon (the add-on's own toggle) leaves the add-on to place its button
        if (!t || !t.height) return html.removeAttribute("data-sct-ee-toggle");
        const f = ribbon.getBoundingClientRect();
        html.style.setProperty("--sct-ee-toggle-top", `${f.top + t.top}px`);
        html.style.setProperty("--sct-ee-toggle-right", `${html.clientWidth - f.left - t.left}px`);
        html.style.setProperty("--sct-ee-toggle-w", `${t.width}px`);
        html.style.setProperty("--sct-ee-toggle-h", `${t.height}px`);
        html.setAttribute("data-sct-ee-toggle", "");
      };
      const resized = new ResizeObserver(sync);
      const watch = () => {
        resized.disconnect();
        resized.observe(ribbon);
        // a theme change in the ribbon resizes its quickbar or toggle
        for (const el of ribbon.contentDocument?.querySelectorAll('.sc-quickbar, [data-sc-id="QuickRibbon"]') || []) resized.observe(el);
      };
      // Only after load: reaching into the ribbon while it still loads kept Chrome from theming it.
      ribbon.addEventListener("load", watch);
    }

    function whenDomReady(fn) {
      if (doc.readyState !== "loading") fn();
      else doc.addEventListener("DOMContentLoaded", fn, { once: true });
    }

    // The theme's CSS lands a round trip after the page starts, so a themed page would first paint
    // in Sitecore's own colours. Until it lands, paint the background this surface had last time
    // and keep the content hidden. A top window instead shows the content blurred, under a small
    // window drawn in the theme's colours, and fades both out once the CSS lands.
    // The page's localStorage is the only store readable synchronously.
    // the top window keeps its own record: same-surface frames (the Desktop's) overwrite theirs
    const TOP = window === window.top;
    const EARLY_KEY = `sct-early:${surfaceName}${TOP ? ":top" : ""}`;
    // overlay custom property -> the theme token it is read from
    const EARLY_TOKENS = { tb: "titlebar-bg", tbf: "titlebar-fg", pan: "panel-bg", fg: "panel-fg", mu: "muted-fg", ac: "accent", bd: "window-border" };
    const FADE = 250; // ms for the blur and the window to come and to go
    let early = null;
    let overlay = null;
    let overlayName = null;
    let fadeInEnds = 0; // a switch fades the window in; releasePaint lets that finish first

    function holdPaint() {
      let saved = null;
      try {
        saved = JSON.parse(localStorage.getItem(EARLY_KEY));
      } catch {
        // storage blocked or unreadable: no hold
      }
      const bg = saved && saved.bg;
      // ee and Identity Server login only count once their markup shows, so never hold those
      if (typeof bg !== "string" || SCT.detect.needsDom(location.href) || !/^[#\w(),.\s%-]+$/.test(bg)) return;
      hold(bg);
      if (TOP) showOverlay(saved, false);
      setTimeout(releasePaint, 1500); // never leave the page hidden if the background does not answer
    }

    function hold(bg) {
      early = doc.createElement("style");
      early.setAttribute("data-sct-owned", ""); // the runtime colour map leaves it alone
      // a page that is loading paints blurred from the start; a page already shown blurs in
      early.textContent = (bg ? `html{background:${bg}!important}` : "") + (TOP
        ? `body{filter:blur(8px)!important;transition:filter ${FADE}ms!important}`
        : "body{opacity:0!important}");
      html.append(early);
    }

    // A theme switch blurs the top window in under a window drawn in the incoming theme's look. Every
    // frame swaps its CSS once the blur is complete; then the window fades out.
    async function switchTheme() {
      const next = await nextTheme();
      if (!next) return requestTheme();
      const blur = TOP && !early;
      if (blur) {
        const tokens = await incomingTokens(next.id);
        const now = paintRecord();
        hold(null);
        fadeInEnds = performance.now() + FADE;
        if (now) showOverlay(look((t) => tokens[t], tokens["app-bg"] || now.bg, next.name), true);
      }
      await new Promise((r) => setTimeout(r, FADE));
      await requestTheme();
      if (!blur) return;
      const record = paintRecord();
      if (overlay && record) dressOverlay(record); // the page's own values, in case a rule the file read missed differs
      fadeInEnds = performance.now() + FADE / 2; // a beat at full before fading out
      releasePaint();
    }

    // The tokens the incoming theme sets on this page, read from its token CSS before that CSS lands:
    // the rules whose selector matches this <html> once it carries the new theme, and whose media match.
    async function incomingTokens(id) {
      const tokens = {};
      const css = await host.tokens(id);
      if (!css) return tokens; // Native, Sitecore 10.4 and themes without tokens: the window's defaults
      const sheet = new CSSStyleSheet();
      sheet.replaceSync(css);
      const probe = html.cloneNode(false);
      probe.dataset.sctTheme = id;
      const read = (rules) => {
        for (const r of rules) {
          if (r.media) {
            if (matchMedia(r.media.mediaText).matches) read(r.cssRules);
          } else if (r.style && probe.matches(r.selectorText)) {
            for (const p of r.style) if (p.startsWith("--sct-")) tokens[p.slice(6)] = r.style.getPropertyValue(p).trim();
          }
        }
      };
      read(sheet.cssRules);
      return tokens;
    }

    // the theme this frame is switching to, or null when the change leaves it alone
    async function nextTheme() {
      const next = await host.theme(version);
      return next.id === engine.theme ? null : next;
    }

    // the saved values come from the page's storage, so they only ever reach CSSOM setters and textContent
    function dressOverlay(saved) {
      for (const [k, v] of Object.entries(saved.tokens || {})) overlay.style.setProperty(`--${k}`, String(v));
      overlay.style.setProperty("--app", saved.bg);
      overlay.style.setProperty("--r", `${Math.min(parseFloat(saved.radius) || 0, 12)}px`);
      overlay.style.fontFamily = String(saved.font || "");
      overlayName.textContent = String(saved.name || "");
    }

    function showOverlay(saved, fadeIn) {
      overlay = doc.createElement("sct-applying");
      overlay.setAttribute("data-sct-owned", "");
      const root = overlay.attachShadow({ mode: "closed" });
      root.innerHTML = `<style>
  :host{all:initial;position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;justify-content:center;
    background:color-mix(in srgb,var(--app) 45%,transparent);opacity:1;transition:opacity ${FADE}ms}
  ${fadeIn ? "@starting-style{:host{opacity:0}}" : ""}
  .w,.t{transition:background-color ${FADE / 2}ms,color ${FADE / 2}ms,border-color ${FADE / 2}ms}
  .w{min-width:250px;background:var(--pan,#fff);color:var(--fg,#222);border:1px solid var(--bd,#a0a0a0);
    border-radius:var(--r);overflow:hidden;box-shadow:0 10px 30px rgba(0,0,0,.25);font-size:12px}
  .t{background:var(--tb,#2b2b2b);color:var(--tbf,#fff);padding:6px 10px}
  .b{display:flex;flex-direction:column;align-items:center;gap:9px;padding:18px 16px}
  .s{width:22px;height:22px;box-sizing:border-box;border-radius:50%;border:2.5px solid color-mix(in srgb,currentColor 15%,transparent);
    border-top-color:var(--ac,#dc291e);animation:spin .8s linear infinite}
  @keyframes spin{to{transform:rotate(360deg)}}
  @media (prefers-reduced-motion:reduce){.s{animation:none}}
  .h{font-size:15px;font-weight:bold}
  .n{color:var(--mu,#666)}
  .n:empty{display:none}
  </style><div class="w" role="status"><div class="t">Themes for Sitecore</div>
  <div class="b"><div class="s"></div><div class="h">Applying theme</div><div class="n"></div></div></div>`;
      overlayName = root.querySelector(".n");
      dressOverlay(saved);
      html.append(overlay);
    }

    function releasePaint() {
      const [style, host] = [early, overlay];
      early = overlay = null;
      if (!style) return;
      if (!host) return style.remove();
      // the CSS often swaps within a blink, so a switch finishes its fade-in before fading out
      setTimeout(() => {
        style.sheet.insertRule("body{filter:blur(0)!important}", style.sheet.cssRules.length);
        host.style.opacity = "0";
        setTimeout(() => (style.remove(), host.remove()), FADE);
      }, Math.max(0, fadeInEnds - performance.now()));
    }

    // the current theme's background and window colours, as holdPaint and showOverlay read them
    function paintRecord() {
      const bg = [doc.body, html].map((el) => el && getComputedStyle(el).backgroundColor)
        .find((c) => c && c !== "transparent" && c !== "rgba(0, 0, 0, 0)");
      if (!bg) return null;
      const style = getComputedStyle(html);
      return look((t) => style.getPropertyValue(`--sct-${t}`), bg, engine.themeName);
    }

    // the window's look from a theme's tokens; themes without tokens get the overlay's Sitecore defaults
    function look(token, bg, name) {
      const tokens = {};
      for (const [k, t] of Object.entries(EARLY_TOKENS)) {
        const v = (token(t) || "").trim();
        if (v) tokens[k] = v;
      }
      const font = (token("font-family") || "").trim();
      return {
        bg, name, tokens, radius: token("radius") || "",
        font: font && font !== "inherit" ? font : doc.body ? getComputedStyle(doc.body).fontFamily : "",
      };
    }

    function rememberPaint() {
      try {
        const record = engine.theme && engine.theme !== "native" && paintRecord();
        if (record) localStorage.setItem(EARLY_KEY, JSON.stringify(record));
        else localStorage.removeItem(EARLY_KEY);
      } catch {
        // storage blocked
      }
    }

    async function start() {
      holdPaint();
      const stored = await host.version();
      setVersion(stored || null);
      versionKnown = !!stored;
      host.listen(onChange);
      syncEnv();
      syncPhase();
      syncHue();
      syncAccess();

      // An ee URL is only a candidate until the page shows Experience Editor markup.
      if (SCT.detect.needsDom(location.href)) await new Promise((r) => whenDomReady(r));
      if (SCT.detect.surface(location.href, doc.body ? doc : null) !== surfaceName) {
        delete html.dataset.sctSurface;
        releasePaint();
        return stop();
      }
      await requestTheme();
      releasePaint();
      if (!version) probeVersion();
      whenDomReady(() => {
        domReady = true;
        if (TOP) syncTab();
        syncBar();
        if (surfaceName === "ee") trackRibbonToggle();
        if (surfaceName === "shell") frameResize(true);
        if (alive()) applyDom(), syncMaxButton(), syncTaskbar(), syncWindowTitle(), syncLaunchpadRows();
      });
      window.addEventListener("load", () => {
        if (!versionKnown) saveVersion(SCT.detect.versionFromDocument(doc));
        rememberPaint();
      }, { once: true });
    }

    start();
    return engine;
  };
})(globalThis);
