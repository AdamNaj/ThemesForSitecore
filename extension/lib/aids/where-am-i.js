// Where am I: the item being edited, as one line under its name in the Content Editor: its path (Quick Info's, else
// the content tree's), its language and its version ("/sitecore/content/Home · English · version 1"). Without either
// path (search results), its name.
(function (root) {
  const SCT = (root.SCT = root.SCT || {});

  const text = (el) => (el ? el.textContent.replace(/\s+/g, " ").trim() : "");

  // Quick Info's item path (names, as Sitecore stores them), else the tree's (display names)
  function path(doc) {
    const info = [...doc.querySelectorAll(".scEditorQuickInfo input")].find((i) => i.value.startsWith("/sitecore/"));
    if (info) return info.value;
    const active = doc.querySelector(".scContentTree .scContentTreeNodeActive");
    if (!active) return "";
    const names = [];
    for (let node = active.closest(".scContentTreeNode"); node; node = node.parentElement.closest(".scContentTreeNode")) {
      names.unshift(text(node.querySelector(":scope > a")));
    }
    return `/${names.join("/")}`;
  }

  SCT.registerAid("where-am-i", {
    css: "sct-where{display:block;max-width:100%;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;font-size:12px;line-height:1.5;color:var(--sct-text-muted,GrayText)}",
    apply(ctx) {
      const { doc } = ctx;
      const panel = doc.querySelector(".scEditorHeaderTitlePanel");
      if (!panel) return;
      const version = text(doc.querySelector(".scEditorHeaderVersionsVersion"));
      const line = [path(doc) || text(panel.querySelector(".scEditorHeaderTitle")), text(doc.querySelector(".scEditorHeaderVersionsLanguage")), version && `version ${version}`]
        .filter(Boolean).join(" · ");
      let where = panel.querySelector("sct-where");
      if (!where) {
        where = ctx.own(doc.createElement("sct-where"));
        panel.append(where);
      }
      if (where.textContent !== line) where.textContent = line;
    },
  });
})(globalThis);
