// Sonata: two things Mac OS 9 shows that CSS cannot.
// 1. The menu bar's clock: a span after the database in the Desktop's tray, updated every 15 seconds.
// 2. Inactive windows: Mac OS 9 drops an inactive window's pinstripes and boxes. Sitecore marks the active
//    desktop window only on its taskbar entry (#startbar_application_<frame id>), while the title bar lives in
//    the window's own iframe document, so each window's <html> gets data-sct-window="active" or "inactive" to
//    match its entry (as Metal Steel does). Only that attribute and the clock are added; nothing of Sitecore's
//    is changed.
(function () {
  const ATTR = "data-sct-window";
  let state = null; // { doc, ctx, observer, timer, clock, frames: Map<iframe, onload> } while applied

  const time = () => new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

  // Sitecore can leave a stale entry behind for a window that navigated: the newest entry wins.
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
        // a cross-origin window: nothing to mark
      }
      if (html && html.getAttribute(ATTR) !== value) ctx.setAttr(html, ATTR, value);
    }
  }

  SCT.registerTheme("sonata", {
    apply(ctx) {
      const doc = ctx.doc;
      const tray = doc.getElementById("Tray");
      if (!doc.getElementById("Desktop") || !tray) return;
      if (!state || state.doc !== doc) state = { doc, ctx, observer: null, timer: 0, clock: null, frames: new Map() };
      state.ctx = ctx;
      if (!state.clock || !state.clock.isConnected) {
        const clock = ctx.own(doc.createElement("span"));
        clock.className = "sct-so-clock";
        clock.textContent = time();
        tray.appendChild(clock);
        state.clock = clock;
        clearInterval(state.timer);
        state.timer = setInterval(() => { if (state && state.clock) state.clock.textContent = time(); }, 15000);
      }
      const bar = doc.getElementById("StartbarApplications");
      if (bar && !state.observer) {
        // focus changes only swap the entry's class; the engine re-runs apply for added and removed nodes
        state.observer = new MutationObserver(sync);
        state.observer.observe(bar, { attributes: true, attributeFilter: ["class"], childList: true, subtree: true });
      }
      sync();
    },
    // The dom-kit removes the clock and undoes every attribute set through ctx.setAttr; this drops the rest.
    revert() {
      if (!state) return;
      clearInterval(state.timer);
      if (state.observer) state.observer.disconnect();
      for (const [frame, onload] of state.frames) frame.removeEventListener("load", onload);
      state = null;
    },
  });
})();
