// Menus: Sitecore's context and drop-down menus already answer the arrow keys, Home, End, Enter, Space and Escape,
// but only once focus is inside them, and opening one leaves focus on the opener. Focus moves to a menu's first item
// when it opens, and back to where it was when it closes, unless Sitecore gave it somewhere already.
(function (root) {
  const SCT = (root.SCT = root.SCT || {});

  const open = new WeakMap(); // document -> { popup, opener }
  const visible = (el) => el.getClientRects().length > 0;

  SCT.registerAid("menus", {
    apply(ctx) {
      const { doc } = ctx;
      const was = open.get(doc);
      if (was && !was.popup.isConnected) {
        open.delete(doc);
        const lost = !doc.activeElement || doc.activeElement === doc.body;
        if (lost && was.opener.isConnected) was.opener.focus();
      }
      for (const popup of doc.querySelectorAll(".scPopup")) {
        if (open.get(doc)?.popup === popup || popup.contains(doc.activeElement)) continue;
        const item = [...popup.querySelectorAll('[role="menu"] [role="menuitem"]')].find(visible);
        if (!item) continue;
        open.set(doc, { popup, opener: doc.activeElement && doc.activeElement !== doc.body ? doc.activeElement : doc.body });
        if (!item.hasAttribute("tabindex")) ctx.setAttr(item, "tabindex", "0");
        item.focus();
      }
    },
  });
})(globalThis);
