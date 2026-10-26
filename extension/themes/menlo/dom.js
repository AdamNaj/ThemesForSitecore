// Menlo: two states the stylesheets cannot see.
// 1. Which desktop window has the focus. BeOS pales the tab of every window but the active one. Sitecore
//    marks the active window only on its taskbar entry (#startbar_application_<frame id>), while the tab is
//    drawn inside the window's own iframe document. From the desktop frame, each window's iframe document
//    gets data-sct-window="active" or "inactive" to match its entry (as Metal Steel does).
// 2. How wide a dialog's tab is. A BeOS tab is only as wide as its title, with the zoom box at its right
//    end. The title is drawn in the dialog page's frame, the zoom button lives in the jQuery dialog around
//    it: the dialog page marks its <html> data-sct-menlo-dialog (so it can let the dialog's tab band show
//    through) and gives the jQuery dialog the tab's width as --sct-menlo-tab.
// Only those attributes and that one custom property are added; nothing of Sitecore's is changed.
(function () {
  const ATTR = "data-sct-window";
  let state = null; // { doc, ctx, observer, frames: Map<iframe, onload> } while applied in a desktop frame
  let dialog = null; // { host, observer } while applied in a dialog page

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

  function applyDialog(ctx) {
    let host = null;
    try {
      host = window.frameElement && window.frameElement.closest(".ui-dialog");
    } catch {
      // a cross-origin parent
    }
    if (!host) return;
    const html = ctx.doc.documentElement;
    if (!html.hasAttribute("data-sct-menlo-dialog")) ctx.setAttr(html, "data-sct-menlo-dialog", "");
    const head = ctx.doc.querySelector(":is(.scFormDialogHeader, .scDialogHeader) .DialogHeader");
    if (!head || (dialog && dialog.head === head)) return;
    if (dialog) dialog.observer.disconnect();
    const measure = () => host.style.setProperty("--sct-menlo-tab", `${Math.ceil(head.getBoundingClientRect().width)}px`);
    const observer = new ResizeObserver(measure);
    observer.observe(head);
    dialog = { host, head, observer };
    measure();
  }

  SCT.registerTheme("menlo", {
    apply(ctx) {
      const doc = ctx.doc;
      if (ctx.surface === "shell") applyDialog(ctx);
      if (!doc.getElementById("Desktop")) return;
      if (!state || state.doc !== doc) state = { doc, ctx, observer: null, frames: new Map() };
      state.ctx = ctx;
      const bar = doc.getElementById("StartbarApplications");
      if (bar && !state.observer) {
        state.observer = new MutationObserver(sync);
        state.observer.observe(bar, { attributes: true, attributeFilter: ["class"], childList: true, subtree: true });
      }
      sync();
    },
    // The dom-kit undoes every attribute set through ctx.setAttr; this drops listeners and the tab width.
    revert() {
      if (dialog) {
        dialog.observer.disconnect();
        dialog.host.style.removeProperty("--sct-menlo-tab");
        dialog = null;
      }
      if (!state) return;
      if (state.observer) state.observer.disconnect();
      for (const [frame, onload] of state.frames) frame.removeEventListener("load", onload);
      state = null;
    },
  });
})();
