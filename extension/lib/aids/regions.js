// Regions: skip links at the top of each page, hidden until focused, and F6 / Shift+F6 to move between the page's
// parts (the top bar, the ribbon, the tree, the editor), as in desktop applications. A part takes focus at its main
// control: its tree, its selected tab, its toolbar, else its first control. Within one document; each frame has its own.
(function (root) {
  const SCT = (root.SCT = root.SCT || {});

  const REGION = '[role="banner"], [role="navigation"], [role="main"], [role="region"], [role="search"], header, nav, main';
  const WIDGET = '[role="tree"], [role="tablist"], [role="toolbar"], [role="grid"]';
  const TABBABLE = 'a[href], button, input:not([type="hidden"]), select, textarea, [tabindex]';
  const DEFAULTS = { banner: "Top bar", navigation: "Navigation", main: "Main content", search: "Search", region: "Region" };
  const visible = (el) => el.getClientRects().length > 0;
  const tabbable = (el) => el.matches(TABBABLE) && el.tabIndex >= 0 && !el.disabled && visible(el);
  const roleOf = (el) => el.getAttribute("role") || { HEADER: "banner", NAV: "navigation", MAIN: "main" }[el.tagName];

  function regions(doc) {
    return [...doc.querySelectorAll(REGION)].filter((el) => !el.closest("sct-skip") && visible(el) && !el.parentElement.closest(REGION)
      && (el.tagName !== "HEADER" || el.hasAttribute("role") || !el.parentElement.closest("article, aside, section")));
  }
  function nameOf(el) {
    const ids = (el.getAttribute("aria-labelledby") || "").split(/\s+/).filter(Boolean);
    const named = el.getAttribute("aria-label") || ids.map((id) => el.ownerDocument.getElementById(id)?.textContent || "").join(" ");
    return named.replace(/\s+/g, " ").trim() || DEFAULTS[roleOf(el)] || "Region";
  }
  // where a region takes focus
  function entry(region) {
    for (const widget of region.querySelectorAll(WIDGET)) {
      if (!visible(widget)) continue;
      if (tabbable(widget)) return widget;
      const inside = [...widget.querySelectorAll('[aria-selected="true"], ' + TABBABLE)].find(tabbable);
      if (inside) return inside;
    }
    return [...region.querySelectorAll(TABBABLE)].find(tabbable) || null;
  }
  function go(ctx, region) {
    let to = entry(region);
    if (!to) {
      if (!region.hasAttribute("tabindex")) ctx.setAttr(region, "tabindex", "-1");
      to = region;
    }
    to.focus();
  }

  const contexts = new WeakMap(); // document -> the context of the aid's last pass there, for the key handler
  const listening = new WeakSet();
  function onKey(e) {
    if (e.key !== "F6" || e.defaultPrevented || e.ctrlKey || e.altKey || e.metaKey) return;
    const doc = e.target.ownerDocument || e.target;
    const list = regions(doc);
    if (list.length < 2) return;
    const i = list.findIndex((r) => r.contains(doc.activeElement));
    const next = list[(i + (e.shiftKey ? -1 : 1) + list.length) % list.length];
    e.preventDefault(); // the browser's F6 would leave the page for the address bar
    go(contexts.get(doc), next);
  }

  SCT.registerAid("regions", {
    css: `sct-skip{position:fixed;left:8px;top:8px;z-index:2147483647;display:flex;flex-direction:column;gap:4px}
sct-skip button{font:600 13px/1.4 system-ui,sans-serif;padding:6px 12px;border:2px solid var(--sct-accent-fg,HighlightText);border-radius:4px;background:var(--sct-accent,Highlight);color:var(--sct-accent-fg,HighlightText);cursor:pointer}
sct-skip button:not(:focus){position:absolute;width:1px;height:1px;padding:0;border:0;overflow:hidden;clip-path:inset(50%);white-space:nowrap}`,
    apply(ctx) {
      const { doc } = ctx;
      contexts.set(doc, ctx);
      if (!listening.has(doc)) {
        listening.add(doc);
        ctx.listen(doc, "keydown", onKey);
      }
      if (!doc.body) return;
      const targets = regions(doc).filter((r) => roleOf(r) !== "banner");
      const labels = targets.map((r) => `Skip to ${nameOf(r).replace(/^The /, "the ")}`);
      let skip = doc.querySelector("sct-skip");
      if (!targets.length) return;
      if (!skip) {
        skip = ctx.own(doc.createElement("sct-skip"));
        doc.body.prepend(skip);
        skip.addEventListener("click", (e) => {
          const b = e.target.closest("button");
          const r = b && regions(doc).filter((x) => roleOf(x) !== "banner")[+b.dataset.i];
          if (r) go(contexts.get(doc), r);
        });
      }
      if (skip.dataset.key === labels.join("|")) return;
      skip.dataset.key = labels.join("|");
      skip.replaceChildren(...labels.map((label, i) => {
        const b = doc.createElement("button");
        b.type = "button";
        b.dataset.i = i;
        b.textContent = label;
        return b;
      }));
    },
    revert(ctx) {
      listening.delete(ctx.doc);
    },
  });
})(globalThis);
