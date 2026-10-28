// Shortcuts help: Ctrl+/ lists the page's keyboard shortcuts in one place: Sitecore's (each ribbon button's
// aria-keyshortcuts, each ribbon tab's access key, Alt+F1 for the ribbon's key hints) and the aids' own. Alt+F1, the
// spec's first choice, is Sitecore's already.
(function (root) {
  const SCT = (root.SCT = root.SCT || {});

  const OURS = [
    ["Ctrl+Shift+Space", "Command palette"],
    ["Ctrl+/", "These shortcuts"],
    ["F6", "Next part of the page"],
    ["Shift+F6", "Previous part of the page"],
    ["Left, Right", "Move along the ribbon's buttons"],
    ["Letters", "Find an item in the content tree"],
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

  function onKey(e) {
    if (e.defaultPrevented || !e.ctrlKey || e.altKey || e.metaKey || (e.key !== "/" && e.code !== "Slash")) return;
    const ctx = contexts.get(e.target.ownerDocument || e.target);
    if (!ctx) return;
    e.preventDefault();
    const { doc } = ctx;
    SCT.aidDialog(ctx, {
      label: "Keyboard shortcuts",
      build(dialog, close) {
        const h = doc.createElement("h2");
        h.textContent = "Keyboard shortcuts";
        const rows = sitecore(doc);
        const done = doc.createElement("button");
        done.type = "button";
        done.textContent = "Close";
        done.addEventListener("click", close);
        dialog.append(h, ...(rows.length ? [table(doc, "Sitecore", rows)] : []), table(doc, "Themes for Sitecore", OURS), done);
      },
    });
  }

  SCT.registerAid("shortcuts-help", {
    css: `${SCT.aidDialogCss}
sct-dialog table{width:100%;border-collapse:collapse;margin:4px 0 12px}
sct-dialog caption{text-align:start;font-weight:600;padding:4px 0}
sct-dialog th{text-align:start;font-weight:600;white-space:nowrap;padding:3px 16px 3px 0;width:1%}
sct-dialog td{padding:3px 0}
sct-dialog button{font:inherit;padding:4px 14px;border:1px solid var(--sct-button-border,ButtonText);border-radius:6px;background:var(--sct-button-bg,ButtonFace);color:var(--sct-button-fg,ButtonText);cursor:pointer}`,
    apply(ctx) {
      if (!contexts.has(ctx.doc)) ctx.listen(ctx.doc, "keydown", onKey);
      contexts.set(ctx.doc, ctx);
    },
    revert(ctx) {
      contexts.delete(ctx.doc);
    },
  });
})(globalThis);
