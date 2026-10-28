// Dialogs: Sitecore's jQuery UI dialogs already have role=dialog and aria-modal, but are labelled by an empty title,
// and closing one leaves focus nowhere. The title takes the dialog's name from its frame (frame-titles names it from
// the page it shows), and when the last dialog closes focus goes back to the newest place it was before, in
// whichever frame that was. Frames share that place through a data attribute, since content scripts in different
// frames share the DOM but nothing else.
(function (root) {
  const SCT = (root.SCT = root.SCT || {});

  const STAMP = "data-sct-focus"; // on the element last focused in each document: when, in ms
  const stamped = new WeakMap(); // document -> that element
  const open = new WeakMap(); // dialog host document -> how many dialogs it had
  const listening = new WeakSet();

  function onFocus(e) {
    const el = e.target;
    if (!el || el.nodeType !== 1) return;
    const prev = stamped.get(el.ownerDocument);
    if (prev && prev !== el) prev.removeAttribute(STAMP);
    el.setAttribute(STAMP, String(Date.now()));
    stamped.set(el.ownerDocument, el);
  }

  // every same-origin document from the top down
  function documents(win, out = []) {
    try {
      out.push(win.document);
    } catch {
      return out;
    }
    for (let i = 0; i < win.frames.length; i++) documents(win.frames[i], out);
    return out;
  }

  // nothing has focus: the deepest active element is a body, or nothing
  function focusLost(win) {
    let doc = win.document;
    for (;;) {
      const a = doc.activeElement;
      if (!a || a === doc.body) return true;
      if (!/^I?FRAME$/.test(a.tagName)) return false;
      try {
        doc = a.contentDocument;
      } catch {
        return false;
      }
      if (!doc) return true;
    }
  }

  function giveFocusBack(doc) {
    const top = doc.defaultView.top;
    if (!focusLost(top)) return; // Sitecore put it somewhere
    const places = documents(top)
      .filter((d) => !d.documentElement.hasAttribute("data-sct-modal-host"))
      .flatMap((d) => [...d.querySelectorAll(`[${STAMP}]`)])
      .filter((el) => el.isConnected);
    const newest = places.sort((a, b) => b.getAttribute(STAMP) - a.getAttribute(STAMP))[0];
    if (!newest) return;
    newest.ownerDocument.defaultView.focus();
    newest.focus();
  }

  SCT.registerAid("dialogs", {
    apply(ctx) {
      const { doc } = ctx;
      if (!listening.has(doc)) {
        listening.add(doc);
        ctx.listen(doc, "focusin", onFocus);
      }
      if (!doc.documentElement.hasAttribute("data-sct-modal-host")) return;
      const dialogs = doc.querySelectorAll('.ui-dialog[role="dialog"]');
      for (const dialog of dialogs) {
        const title = doc.getElementById(dialog.getAttribute("aria-labelledby") || "");
        if (!title || title.textContent.trim()) continue;
        const frame = dialog.querySelector("iframe");
        const name = ((frame && frame.title) || "").replace(/^Sitecore: /, "") || "Dialog";
        if (title.getAttribute("aria-label") !== name) ctx.setAttr(title, "aria-label", name);
      }
      if (open.get(doc) && !dialogs.length) setTimeout(() => giveFocusBack(doc)); // after Sitecore's own close
      open.set(doc, dialogs.length);
    },
    revert(ctx) {
      listening.delete(ctx.doc);
      const el = stamped.get(ctx.doc);
      if (el) el.removeAttribute(STAMP);
      stamped.delete(ctx.doc);
    },
  });
})(globalThis);
