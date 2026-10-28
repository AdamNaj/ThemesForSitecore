// Menus: Sitecore's context and drop-down menus already answer the arrow keys, Home, End, Enter, Space and Escape,
// but only once focus is inside them, and opening one leaves focus on the opener. Focus moves to a menu's first item
// when it opens, and back to where it was when it closes, unless Sitecore gave it somewhere already.
// Sitecore's Up and Down count the items of a menu's hidden submenus too, so Down often tries an item that cannot take
// focus and nothing moves; when Sitecore's own move left focus where it was, Up and Down go to the next visible item.
(function (root) {
  const SCT = (root.SCT = root.SCT || {});

  const open = new WeakMap(); // document -> { popup, opener }
  const contexts = new WeakMap(); // document -> the aid's context there, for the key handler
  let heard = new WeakSet(); // menus with the key handler
  let entered = new WeakSet(); // popups focus was moved into once: a submenu's parent is not entered again
  const visible = (el) => el.getClientRects().length > 0;

  // on the menu's table, after Sitecore's handler there (which stops the key going further): only when focus did not move
  function onKey(e) {
    if ((e.key !== "ArrowDown" && e.key !== "ArrowUp") || e.altKey || e.ctrlKey || e.metaKey) return;
    const item = e.target.closest && e.target.closest('.scPopup [role="menuitem"]');
    if (!item || item.ownerDocument.activeElement !== item) return;
    const menu = item.closest('[role="menu"]');
    const items = [...menu.querySelectorAll('[role="menuitem"]')].filter((i) => i.closest('[role="menu"]') === menu && visible(i));
    const to = items[items.indexOf(item) + (e.key === "ArrowDown" ? 1 : -1)];
    if (!to) return;
    e.preventDefault();
    if (!to.hasAttribute("tabindex")) contexts.get(item.ownerDocument).setAttr(to, "tabindex", "-1");
    to.focus();
  }

  SCT.registerAid("menus", {
    apply(ctx) {
      const { doc } = ctx;
      contexts.set(doc, ctx);
      for (const table of doc.querySelectorAll('.scPopup [role="menu"]')) {
        if (heard.has(table)) continue;
        heard.add(table);
        ctx.listen(table, "keydown", onKey);
      }
      const was = open.get(doc);
      if (was && !was.popup.isConnected) {
        open.delete(doc);
        const lost = !doc.activeElement || doc.activeElement === doc.body;
        if (lost && was.opener.isConnected) was.opener.focus();
      }
      for (const popup of doc.querySelectorAll(".scPopup")) {
        if (entered.has(popup) || popup.contains(doc.activeElement)) continue;
        const item = [...popup.querySelectorAll('[role="menu"] [role="menuitem"]')].find(visible);
        if (!item) continue;
        entered.add(popup);
        open.set(doc, { popup, opener: doc.activeElement && doc.activeElement !== doc.body ? doc.activeElement : doc.body });
        if (!item.hasAttribute("tabindex")) ctx.setAttr(item, "tabindex", "0");
        item.focus();
      }
    },
    revert(ctx) {
      contexts.delete(ctx.doc);
      heard = new WeakSet();
      entered = new WeakSet();
    },
  });
})(globalThis);
