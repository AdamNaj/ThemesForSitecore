// Sticky item header: the Content Editor's header (the item's icon and name, above its warnings and Quick Info) stays at
// the top of the editor while the fields scroll under it; its last 10px fade out, so a field slides under it rather
// than being cut at a hard edge. The editor panel (.scEditorPanel) is the element that scrolls. Under every theme the
// header reaches out over the panel's side padding (its own padding grows by as much), so it spans the whole editor.
// The header is frosted, never see-through: the colours from it down to the first opaque one (else the theme's app
// background) flattened into one, as the header looked over the panel, laid at 80% over a blur of the fields under
// it. A theme that leaves it clear or translucent (Cupertino, Sun Valley, Tahoe's glass) gets its panel's colour.
// The colour is looked up again on every pass (the engine runs one after each theme or mode switch), whenever the
// panel scrolls and when the OS turns light or dark: a lookup kept from before the theme's CSS landed, or from
// another theme or appearance, left a dark header under dark text.
// ponytail: colours only: a textured panel behind it shows flat
(function (root) {
  const SCT = (root.SCT = root.SCT || {});

  const HEADER = ".scEditorPanel>.scEditorHeader";
  const FADE = "linear-gradient(to bottom,#000 calc(100% - 10px),transparent)";
  const BG = "--sct-sticky-bg";
  // the panel's left and right padding, then the header's own plus those
  const STRETCH = ["--sct-sticky-x", "--sct-sticky-xr", "--sct-sticky-pl", "--sct-sticky-pr"];
  let watched = new WeakSet(); // documents listening for scrolls and the OS appearance
  const filled = new Set(); // headers given a colour or stretched, to take it back

  // A computed colour's alpha: rgba(r, g, b, a), color(srgb r g b / a), transparent; anything else is opaque.
  const alpha = (c) => {
    if (c === "transparent") return 0;
    const m = /rgba\(.*,\s*([\d.]+%?)\s*\)$|\/\s*([\d.]+%?)\s*\)$/.exec(c);
    const a = m ? m[1] || m[2] : "1";
    return a.endsWith("%") ? parseFloat(a) / 100 : parseFloat(a);
  };

  function fill(h) {
    const win = h.ownerDocument.defaultView;
    for (const p of [BG, ...STRETCH]) h.style.removeProperty(p); // the theme's own colours and padding, not ours
    const own = win.getComputedStyle(h), panel = win.getComputedStyle(h.parentElement);
    // out over the panel's padding, the header's content where it was
    const [l, r] = [panel.paddingLeft, panel.paddingRight];
    const vals = [l, r, `${parseFloat(own.paddingLeft) + parseFloat(l)}px`, `${parseFloat(own.paddingRight) + parseFloat(r)}px`];
    STRETCH.forEach((p, i) => h.style.setProperty(p, vals[i]));
    filled.add(h);
    if (own.backgroundImage !== "none") return;
    // translucent colours from the header down, top first, then the first opaque one
    const layers = [];
    let bg = null;
    for (let e = h; e && !bg; e = e.parentElement) {
      const c = win.getComputedStyle(e).backgroundColor;
      const a = alpha(c);
      if (a >= 1) bg = c;
      else if (a > 0) layers.push([c, a]);
    }
    // each layer mixed over the ones below at its own alpha: one opaque colour
    let mix = bg || "var(--sct-app-bg, Canvas)";
    for (const [c, a] of layers.reverse()) mix = `color-mix(in srgb,rgb(from ${c} r g b / 1) ${Math.round(a * 1000) / 10}%,${mix})`;
    h.style.setProperty(BG, mix);
  }

  SCT.registerAid("sticky-header", {
    // no transition: fill() reads the header's padding and colour without ours, and one still running (Reduced
    // motion's .01ms counts) reports ours, which the next scroll added to again
    css: SCT.important(`${HEADER}{position:sticky;top:0;z-index:3;transition:none;-webkit-mask-image:${FADE};mask-image:${FADE}}
${HEADER}[style*="${BG}"]{background-color:color-mix(in srgb,var(${BG}) 80%,transparent);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px)}
${HEADER}[style*="${STRETCH[0]}"]{margin-left:calc(-1*var(${STRETCH[0]}));margin-right:calc(-1*var(${STRETCH[1]}));padding-left:var(${STRETCH[2]});padding-right:var(${STRETCH[3]})}`),
    apply(ctx) {
      const doc = ctx.doc;
      for (const h of filled) if (!h.isConnected) filled.delete(h);
      if (!watched.has(doc)) {
        watched.add(doc);
        let frame = 0;
        ctx.listen(doc, "scroll", (e) => {
          const h = e.target.nodeType === 1 && e.target.matches(".scEditorPanel") && e.target.querySelector(":scope>.scEditorHeader");
          if (h && !frame) frame = doc.defaultView.requestAnimationFrame(() => ((frame = 0), fill(h)));
        }, true);
        ctx.listen(doc.defaultView.matchMedia("(prefers-color-scheme: dark)"), "change", () => doc.querySelectorAll(HEADER).forEach(fill));
      }
      doc.querySelectorAll(HEADER).forEach(fill);
    },
    revert() {
      for (const h of filled) for (const p of [BG, ...STRETCH]) h.style.removeProperty(p);
      filled.clear();
      watched = new WeakSet();
    },
  });
})(globalThis);
