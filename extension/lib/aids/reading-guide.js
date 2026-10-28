// Reading guide: a soft band across the frame on the line being read, the pointer's or the focused element's, for
// dyslexia and attention. It never takes a click, and moves at most once a frame.
(function (root) {
  const SCT = (root.SCT = root.SCT || {});

  const guides = new WeakMap(); // document -> { el, y, frame }

  function place(doc, y) {
    const g = guides.get(doc);
    if (!g) return;
    g.y = y;
    if (g.frame) return;
    g.frame = doc.defaultView.requestAnimationFrame(() => {
      g.frame = 0;
      g.el.hidden = false; // shown first: a hidden band has no height to centre by
      g.el.style.transform = `translateY(${Math.round(g.y - g.el.offsetHeight / 2)}px)`;
    });
  }
  const onPointer = (e) => place(e.target.ownerDocument || e.target, e.clientY);
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
      guides.set(doc, { el, y: 0, frame: 0 });
      ctx.listen(doc, "pointermove", onPointer, { passive: true });
      ctx.listen(doc, "focusin", onFocus);
    },
    revert(ctx) {
      guides.delete(ctx.doc);
    },
  });
})(globalThis);
