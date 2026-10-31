// Shortcuts help: F1 (or Ctrl+/) lists the page's keyboard shortcuts in one place: Sitecore's (each ribbon button's
// aria-keyshortcuts, each ribbon tab's access key, Alt+F1 for the ribbon's key hints), those of the aids running in
// this frame, and what each running aid and reading setting changes. Alt+F1, the spec's first choice, is Sitecore's
// already; plain F1 is only the browser's help.
(function (root) {
  const SCT = (root.SCT = root.SCT || {});

  // [keys, what, the aid that brings them]
  const OURS = [
    ["F1, Ctrl+/", "This help", "shortcuts-help"],
    ["Ctrl+Shift+Space", "Command palette", "command-palette"],
    ["F6", "Next part of the page", "regions"],
    ["Shift+F6", "Previous part of the page", "regions"],
    ["Left, Right, Home, End", "Move along the ribbon's buttons", "ribbon-toolbar"],
    ["Up, Down", "Move through an open menu", "menus"],
    ["Letters", "Search the content tree, or the editor's fields; Tab for the next match", "tree-keys"],
  ];
  const clean = (s) => (s || "").replace(/\s+/g, " ").trim();
  const contexts = new WeakMap();

  function sitecore(doc) {
    const rows = [];
    const seen = new Set();
    const add = (keys, what) => {
      if (!keys || !what || seen.has(keys + what)) return;
      seen.add(keys + what);
      rows.push([keys, what]);
    };
    for (const tab of doc.querySelectorAll('[role="tab"][accesskey]')) add(`Alt+${tab.getAttribute("accesskey").toUpperCase()}`, `${clean(tab.textContent)} tab`);
    for (const el of doc.querySelectorAll(".scRibbonToolbarStrip [aria-keyshortcuts]")) {
      const keys = clean(el.getAttribute("aria-keyshortcuts"));
      if (!/^[?]+$/.test(keys)) add(keys, clean(el.getAttribute("aria-label") || el.textContent || el.title));
    }
    if (doc.querySelector(".scRibbon")) add("Alt+F1", "Show the ribbon's key hints");
    return rows;
  }

  // the running aids by name and hint, then the reading settings <html> carries
  function improvements(ctx) {
    const { AIDS, FONTS } = SCT.settings;
    const rows = ctx.running().filter((id) => AIDS[id]).map((id) => [AIDS[id].name, AIDS[id].hint]);
    const d = ctx.doc.documentElement.dataset;
    if (FONTS[d.sctFont]) rows.push([FONTS[d.sctFont].name, "The font for Sitecore's text"]);
    if (d.sctSpacing) rows.push(["Wide spacing", "More room between letters and words"]);
    if (d.sctVision) rows.push(["Colour filter", `Pulls apart the colours ${d.sctVision} runs together`]);
    return rows;
  }

  function table(doc, caption, rows) {
    const t = doc.createElement("table");
    const c = doc.createElement("caption");
    c.textContent = caption;
    t.append(c);
    for (const [keys, what] of rows) {
      const tr = doc.createElement("tr");
      const k = doc.createElement("th");
      k.scope = "row";
      k.textContent = keys;
      const w = doc.createElement("td");
      w.textContent = what;
      tr.append(k, w);
      t.append(tr);
    }
    return t;
  }

  // F1 alone, or Ctrl+/ by the typed character: elsewhere the US slash key types "-", and Ctrl+- zooms out
  const wanted = (e) => !e.altKey && !e.metaKey && (e.key === "F1" ? !e.ctrlKey && !e.shiftKey : e.ctrlKey && e.key === "/");

  function onKey(e) {
    if (e.defaultPrevented || !wanted(e)) return;
    const ctx = contexts.get(e.target.ownerDocument || e.target);
    if (!ctx) return;
    e.preventDefault(); // F1: not the browser's help
    const { doc } = ctx;
    SCT.aidDialog(ctx, {
      label: "Shortcuts and aids",
      build(dialog, close) {
        const h = doc.createElement("h2");
        h.textContent = "Shortcuts and aids";
        const running = ctx.running();
        const rows = sitecore(doc);
        const ours = OURS.filter((r) => running.includes(r[2]));
        const aids = improvements(ctx);
        const done = doc.createElement("button");
        done.type = "button";
        done.textContent = "Close";
        done.addEventListener("click", close);
        // Close first: focus goes to it, and the list opens at its top
        dialog.append(h, done,
          ...(rows.length ? [table(doc, "Sitecore", rows)] : []),
          ...(ours.length ? [table(doc, "Themes for Sitecore", ours)] : []),
          ...(aids.length ? [table(doc, "Switched on", aids)] : []));
      },
    });
  }

  SCT.registerAid("shortcuts-help", {
    css: `${SCT.aidDialogCss}
${SCT.important(`sct-dialog table{width:100%;border-collapse:collapse;margin:4px 0 12px}
sct-dialog caption{text-align:start;font-weight:600;padding:4px 0}
sct-dialog th{text-align:start;font-weight:600;white-space:nowrap;padding:3px 16px 3px 0;width:1%;vertical-align:top}
sct-dialog td{padding:3px 0}
sct-dialog button{position:absolute;top:10px;right:12px;font:inherit;padding:4px 14px;border:1px solid var(--sct-button-border,ButtonText);border-radius:6px;background:var(--sct-button-bg,ButtonFace);color:var(--sct-button-fg,ButtonText);cursor:pointer}`)}`,
    apply(ctx) {
      if (!contexts.has(ctx.doc)) ctx.listen(ctx.doc, "keydown", onKey);
      contexts.set(ctx.doc, ctx);
    },
    revert(ctx) {
      contexts.delete(ctx.doc);
    },
  });
})(globalThis);
