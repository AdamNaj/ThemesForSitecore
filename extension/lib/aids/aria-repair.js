// ARIA repair: the roles Sitecore gets wrong, set right, so a screen reader reads the content tree and the ribbon as
// what they are. From a survey of 10.4.1 and 10.5: tree nodes are links with role=group (which allows neither
// aria-selected nor aria-expanded), the ribbon's tablist holds its toolbar too, and icons with alt="" are buttons.
(function (root) {
  const SCT = (root.SCT = root.SCT || {});

  SCT.registerAid("aria-repair", {
    apply(ctx) {
      const { doc, setAttr } = ctx;
      // each node a treeitem, the list of its children a group. Sitecore's Home and End keys focus the first and last
      // [role=treeitem],[role=group]: an empty list marked a group would become End's target, so only lists of nodes.
      for (const a of doc.querySelectorAll('.scContentTree a[role="group"]')) setAttr(a, "role", "treeitem");
      for (const list of doc.querySelectorAll(".scContentTreeNode > div:not(.scContentTreeNodeGutter):not([role])")) {
        if (list.querySelector(".scContentTreeNode")) setAttr(list, "role", "group");
      }
      // the ribbon a named region, its tab buttons the tablist
      for (const ribbon of doc.querySelectorAll('.scRibbon[role="tablist"]')) setAttr(ribbon, "role", "region");
      for (const tabs of doc.querySelectorAll(".scRibbonNavigatorButtonsGroupButtons:not([role])")) {
        if (!tabs.querySelector('[role="tab"]')) continue;
        setAttr(tabs, "role", "tablist");
        setAttr(tabs, "aria-label", "Ribbon tabs");
      }
      // alt="" says "decorative", which a button or a tab stop is not: it takes the text of its label or its title
      // (rewritten in place, not removed, so a revert gives back the markup exactly)
      for (const img of doc.querySelectorAll('img[alt=""][role]:not([role="none"]):not([role="presentation"]), img[alt=""][tabindex]')) {
        const ids = (img.getAttribute("aria-labelledby") || "").split(/\s+/).filter(Boolean);
        const label = img.getAttribute("aria-label") || ids.map((id) => doc.getElementById(id)?.textContent || "").join(" ") || img.title;
        if (label.trim()) setAttr(img, "alt", label.replace(/\s+/g, " ").trim());
      }
    },
  });
})(globalThis);
