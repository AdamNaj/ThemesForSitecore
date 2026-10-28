// Quiet ribbon: hide the ribbon groups you never use, to cut what is on screen. Each group gets a small × of its own
// (shown on hover or focus); a strip with hidden groups ends with "Show N hidden groups". Hidden is never removed: the
// group stays in the page, display:none. The choice lives in the site's own localStorage, which both the extension
// and the Sitecore module reach; without storage every group shows.
(function (root) {
  const SCT = (root.SCT = root.SCT || {});

  const KEY = "sct-quiet-ribbon";
  const contexts = new WeakMap(); // document -> the aid's context there, for the click handler

  function load(win) {
    try {
      const ids = JSON.parse(win.localStorage.getItem(KEY) || "[]");
      return Array.isArray(ids) ? ids : [];
    } catch {
      return [];
    }
  }
  function save(win, ids) {
    try {
      win.localStorage.setItem(KEY, JSON.stringify(ids));
    } catch {
      // storage blocked: the choice lasts until the page reloads
    }
  }

  function apply(ctx) {
    const { doc, setAttr } = ctx;
    const hidden = new Set(load(doc.defaultView));
    for (const strip of doc.querySelectorAll(".scRibbonToolbarStrip")) {
      let count = 0;
      for (const chunk of strip.querySelectorAll(".chunk[id]")) {
        if (!chunk.querySelector(":scope > [data-sct-quiet-hide]")) {
          const caption = (chunk.querySelector(".caption")?.textContent || "").trim() || "this";
          const hide = ctx.own(doc.createElement("button"));
          hide.type = "button";
          hide.dataset.sctQuietHide = chunk.id;
          hide.setAttribute("aria-label", `Hide the ${caption} group`);
          hide.textContent = "×";
          chunk.append(hide);
        }
        const quiet = hidden.has(chunk.id);
        if (quiet) count++;
        if (quiet !== chunk.hasAttribute("data-sct-quiet")) setAttr(chunk, "data-sct-quiet", quiet ? "" : null);
      }
      let show = strip.querySelector(":scope > [data-sct-quiet-show]");
      if (count && !show) {
        show = ctx.own(doc.createElement("button"));
        show.type = "button";
        show.dataset.sctQuietShow = "";
        strip.append(show);
      }
      if (show && !count) show.remove();
      else if (show) {
        const label = `Show ${count} hidden group${count > 1 ? "s" : ""}`;
        if (show.textContent !== label) show.textContent = label;
      }
    }
  }

  function onClick(e) {
    const button = e.target.closest && e.target.closest("[data-sct-quiet-hide], [data-sct-quiet-show]");
    const ctx = button && contexts.get(button.ownerDocument);
    if (!ctx) return;
    const win = ctx.doc.defaultView;
    let ids = load(win);
    if (button.hasAttribute("data-sct-quiet-hide")) ids.push(button.dataset.sctQuietHide);
    else {
      const strip = button.closest(".scRibbonToolbarStrip");
      ids = ids.filter((id) => !strip.querySelector(`[id="${CSS.escape(id)}"]`));
    }
    save(win, [...new Set(ids)]);
    apply(ctx);
  }

  SCT.registerAid("quiet-ribbon", {
    css: SCT.important(`.scRibbonToolbarStrip .chunk{position:relative}
[data-sct-quiet]{display:none!important}
[data-sct-quiet-hide]{all:unset;position:absolute;top:0;right:0;width:16px;height:16px;font:13px/16px system-ui,sans-serif;text-align:center;border-radius:3px;cursor:pointer;opacity:0}
.chunk:hover>[data-sct-quiet-hide],[data-sct-quiet-hide]:focus-visible{opacity:.85}
[data-sct-quiet-show]{all:unset;align-self:center;margin:0 8px;padding:2px 8px;font:12px/1.4 system-ui,sans-serif;border:1px solid currentColor;border-radius:4px;cursor:pointer;white-space:nowrap}`),
    apply(ctx) {
      if (!contexts.has(ctx.doc)) ctx.listen(ctx.doc, "click", onClick);
      contexts.set(ctx.doc, ctx);
      apply(ctx);
    },
    revert(ctx) {
      contexts.delete(ctx.doc);
    },
  });
})(globalThis);
