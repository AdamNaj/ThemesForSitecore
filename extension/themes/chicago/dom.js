// Chicago: two things the stylesheets cannot do.
// 1. The clock in the taskbar's tray. 95's tray always showed the time; Sitecore's tray has none, so the
//    desktop frame gets one owned cell after the database switcher, updated every 15 seconds.
// 2. Which desktop window has the focus. 95 greys the caption of every window but the active one. Sitecore
//    marks the active window only on its taskbar entry (#startbar_application_<frame id>), while the caption
//    is drawn inside the window's own iframe document. From the desktop frame, each window's iframe document
//    gets data-sct-window="active" or "inactive" to match its entry (as Metal Steel and Menlo do).
// Only that cell and that attribute are added; nothing of Sitecore's is changed.
(function () {
  const ATTR = "data-sct-window";
  let state = null; // { doc, ctx, observer, frames: Map<iframe, onload>, timer } while applied in a desktop frame

  function entryFor(doc, id) {
    const cells = doc.querySelectorAll(`#StartbarApplications [id="startbar_application_${CSS.escape(id)}"]`);
    return cells[cells.length - 1] || null;
  }

  function sync() {
    if (!state) return;
    const { doc, ctx, frames } = state;
    for (const frame of doc.querySelectorAll("#Desktop > iframe[id]")) {
      if (!frames.has(frame)) {
        const onload = () => sync();
        frame.addEventListener("load", onload);
        frames.set(frame, onload);
      }
      const cell = entryFor(doc, frame.id);
      if (!cell) continue;
      const value = cell.classList.contains("scActiveApplication") ? "active" : "inactive";
      let html = null;
      try {
        html = frame.contentDocument && frame.contentDocument.documentElement;
      } catch {
        // a cross-origin window
      }
      if (html && html.getAttribute(ATTR) !== value) ctx.setAttr(html, ATTR, value);
    }
  }

  const time = () => new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

  function clock(doc, ctx) {
    const tray = doc.getElementById("Tray");
    if (!tray || doc.getElementById("sct-chicago-clock")) return;
    const cell = doc.createElement("td");
    cell.id = "sct-chicago-clock";
    cell.className = "sct-chicago-clock";
    cell.textContent = time();
    ctx.own(cell);
    tray.after(cell);
    if (!state.timer) {
      state.timer = setInterval(() => {
        const c = state && state.doc.getElementById("sct-chicago-clock");
        if (c) c.textContent = time();
      }, 15000);
    }
  }

  SCT.registerTheme("chicago", {
    apply(ctx) {
      const doc = ctx.doc;
      if (!doc.getElementById("Desktop")) return;
      if (!state || state.doc !== doc) state = { doc, ctx, observer: null, frames: new Map(), timer: 0 };
      state.ctx = ctx;
      clock(doc, ctx);
      const bar = doc.getElementById("StartbarApplications");
      if (bar && !state.observer) {
        state.observer = new MutationObserver(sync);
        state.observer.observe(bar, { attributes: true, attributeFilter: ["class"], childList: true, subtree: true });
      }
      sync();
    },
    // The dom-kit removes the clock cell and undoes every attribute set through ctx.setAttr; this drops
    // the timer and the listeners.
    revert() {
      if (!state) return;
      if (state.timer) clearInterval(state.timer);
      if (state.observer) state.observer.disconnect();
      for (const [frame, onload] of state.frames) frame.removeEventListener("load", onload);
      state = null;
    },
  });
})();
