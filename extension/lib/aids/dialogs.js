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
  const unstamping = new WeakSet(); // frame elements that lose their stamp on their next load

  function onFocus(e) {
    const el = e.target;
    if (!el || el.nodeType !== 1) return;
    const prev = stamped.get(el.ownerDocument);
    if (prev && prev !== el) prev.removeAttribute(STAMP);
    const now = String(Date.now());
    el.setAttribute(STAMP, now);
    stamped.set(el.ownerDocument, el);
    // and the frame elements above, so the walk below enters only frames this aid ran in, which have loaded: a
    // parent must not touch a frame's document before its load
    try {
      for (let win = el.ownerDocument.defaultView; win.frameElement; win = win.parent) {
        const frame = win.frameElement;
        frame.setAttribute(STAMP, now);
        if (!unstamping.has(frame)) {
          unstamping.add(frame);
          frame.addEventListener("load", () => frame.removeAttribute(STAMP)); // its next page is a new document
        }
      }
    } catch {
      // a cross-origin parent
    }
  }

  // every document from the top down that holds a stamp
  function documents(doc, out = []) {
    out.push(doc);
    for (const frame of doc.querySelectorAll(`iframe[${STAMP}], frame[${STAMP}]`)) {
      try {
        if (frame.contentDocument) documents(frame.contentDocument, out);
      } catch {
        // cross-origin
      }
    }
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
    const places = documents(top.document)
      .filter((d) => !d.documentElement.hasAttribute("data-sct-modal-host"))
      .flatMap((d) => [...d.querySelectorAll(`[${STAMP}]:not(iframe):not(frame)`)])
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
      try {
        ctx.doc.defaultView.frameElement?.removeAttribute(STAMP);
      } catch {
        // a cross-origin parent
      }
      stamped.delete(ctx.doc);
    },
  });
})(globalThis);
