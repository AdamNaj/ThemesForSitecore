// Metal Steel: Metal greys the title pane of every internal frame but the selected one. Sitecore marks the
// active desktop window only on its taskbar entry (#startbar_application_<frame id>, scActiveApplication or
// scInactiveApplication), while the title pane lives inside the window's own iframe document. From the
// desktop frame, each window's iframe and its document's <html> get data-sct-window="active" or "inactive"
// to match its entry, and keep it as windows open, close, take focus or navigate. Only that attribute is
// added; nothing of Sitecore's is changed.
(function () {
  const ATTR = "data-sct-window";
  let state = null; // { doc, ctx, observer, frames: Map<iframe, onload> } while applied in this frame

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
        // a window that navigates gets a new document, which needs the attribute again
        const onload = () => sync();
        frame.addEventListener("load", onload);
        frames.set(frame, onload);
      }
      const cell = entryFor(doc, frame.id);
      if (!cell) continue;
      const value = cell.classList.contains("scActiveApplication") ? "active" : "inactive";
      // the iframe carries it for the frame border drawn around it, its document for the title pane
      if (frame.getAttribute(ATTR) !== value) ctx.setAttr(frame, ATTR, value);
      let html = null;
      try {
        html = frame.contentDocument && frame.contentDocument.documentElement;
      } catch {
        // a cross-origin window: only the iframe is marked
      }
      if (html && html.getAttribute(ATTR) !== value) ctx.setAttr(html, ATTR, value);
    }
  }

  SCT.registerTheme("metalsteel", {
    apply(ctx) {
      const doc = ctx.doc;
      if (!doc.getElementById("Desktop")) return;
      if (!state || state.doc !== doc) {
        state = { doc, ctx, observer: null, frames: new Map() };
      }
      state.ctx = ctx;
      const bar = doc.getElementById("StartbarApplications");
      if (bar && !state.observer) {
        // the engine re-runs apply for added and removed nodes; focus changes only swap the entry's class
        state.observer = new MutationObserver(sync);
        state.observer.observe(bar, { attributes: true, attributeFilter: ["class"], childList: true, subtree: true });
      }
      sync();
    },
    // The engine's dom-kit undoes every attribute set through ctx.setAttr; this drops the listeners.
    revert() {
      if (!state) return;
      if (state.observer) state.observer.disconnect();
      for (const [frame, onload] of state.frames) frame.removeEventListener("load", onload);
      state = null;
    },
  });
})();
