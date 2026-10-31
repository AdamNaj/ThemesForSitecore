// Reading guide: a soft band across the frame on the line being read, the pointer's or the focused element's, for
// dyslexia and attention. It never takes a click, and moves at most once a frame.
//
// Every frame draws a band of its own, and one shows at a time: a frame that draws its band claims the top
// document's data-sct-guide, and every other frame hides its band when it sees the claim change. A frame never
// reaches into its child frames (they may still be loading); it only reads the top document, loaded before them.
(function (root) {
  const SCT = (root.SCT = root.SCT || {});

  const guides = new WeakMap(); // document -> { el, y, frame, id, top, watch }

  function topHtml(doc) {
    try {
      return doc.defaultView.top.document.documentElement;
    } catch {
      return null; // a cross-origin top: this frame's band keeps to itself
    }
  }

  function place(doc, y) {
    const g = guides.get(doc);
    if (!g) return;
    g.y = y;
    if (g.frame) return;
    g.frame = doc.defaultView.requestAnimationFrame(() => {
      g.frame = 0;
      g.el.hidden = false; // shown first: a hidden band has no height to centre by
      g.el.style.transform = `translateY(${Math.round(g.y - g.el.offsetHeight / 2)}px)`;
      if (g.top && g.top.getAttribute("data-sct-guide") !== g.id) g.top.setAttribute("data-sct-guide", g.id);
    });
  }
  function hide(doc) {
    const g = guides.get(doc);
    if (!g) return;
    if (g.frame) doc.defaultView.cancelAnimationFrame(g.frame);
    g.frame = 0;
    g.el.hidden = true;
  }
  const onPointer = (e) => place(e.target.ownerDocument || e.target, e.clientY);
  // the pointer left the window: no frame of it is being read
  const onOut = (e) => !e.relatedTarget && hide(e.target.ownerDocument || e.target);
  function onFocus(e) {
    if (!e.target.getBoundingClientRect) return;
    const r = e.target.getBoundingClientRect();
    place(e.target.ownerDocument, r.top + r.height / 2);
  }

  SCT.registerAid("reading-guide", {
    css: `sct-guide{position:fixed;left:0;right:0;top:0;height:1.6em;z-index:2147483646;pointer-events:none;background:color-mix(in srgb,var(--sct-accent,Highlight) 15%,transparent);border-block:1px solid color-mix(in srgb,var(--sct-accent,Highlight) 35%,transparent)}
sct-guide[hidden]{display:none}`,
    apply(ctx) {
      const { doc } = ctx;
      if (!doc.body || guides.has(doc)) return;
      const el = ctx.own(doc.createElement("sct-guide"));
      el.hidden = true;
      el.setAttribute("aria-hidden", "true");
      doc.body.append(el);
      const g = { el, y: 0, frame: 0, id: Math.random().toString(36).slice(2), top: topHtml(doc), watch: null };
      if (g.top) {
        g.watch = new MutationObserver(() => g.top.getAttribute("data-sct-guide") !== g.id && hide(doc));
        g.watch.observe(g.top, { attributes: true, attributeFilter: ["data-sct-guide"] });
      }
      guides.set(doc, g);
      ctx.listen(doc, "pointermove", onPointer, { passive: true });
      ctx.listen(doc, "pointerout", onOut, { passive: true });
      ctx.listen(doc, "focusin", onFocus);
    },
    revert(ctx) {
      const g = guides.get(ctx.doc);
      if (g && g.watch) g.watch.disconnect();
      if (g && g.top && g.top.getAttribute("data-sct-guide") === g.id) g.top.removeAttribute("data-sct-guide");
      guides.delete(ctx.doc);
    },
  });
})(globalThis);
