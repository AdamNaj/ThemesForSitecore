// Content tab first: an item whose template gives it an editor of its own (a folder's Folder tab, a bucket's Search)
// opens on that tab. This switches it to Content once, as the item loads, so a tab you pick afterwards stays picked.
(function (root) {
  const SCT = (root.SCT = root.SCT || {});

  const seen = new WeakSet(); // the Content tabs already handled; Sitecore builds new ones for every item it loads

  SCT.registerAid("content-tab", {
    apply({ doc }) {
      for (const tab of doc.querySelectorAll('#EditorTabs > a[id^="BContent"]')) {
        if (seen.has(tab)) continue;
        seen.add(tab);
        const active = doc.querySelector("#EditorTabs > .scRibbonEditorTabActive");
        // the same item's other editor; each tab's id ends with its item's ID
        if (active && active !== tab && active.id.endsWith(tab.id.slice("BContent".length))) tab.click();
      }
    },
  });
})(globalThis);
