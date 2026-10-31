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

  // The Start menu is links in two columns, with no menu roles and no keys: it becomes a menu of its entries, which
  // the arrows, Home and End move through, Right (or Enter) opens a folder's submenu; Escape closes the newest popup,
  // Left a submenu, and Sitecore gives focus back to its opener.
  const ENTRY = "a.scStartMenuLeftOption, a.scStartMenuRightFolder, a.scStartMenuProgramsMenu";
  const FOLDER = "a.scStartMenuRightFolder, a.scStartMenuProgramsMenu";
  const entries = (popup) => [...popup.querySelectorAll(ENTRY)].filter(visible);
  function startMenu(ctx, popup) {
    const menu = popup.querySelector(".scStartMenu");
    if (!menu.hasAttribute("role")) {
      ctx.setAttr(menu, "role", "menu");
      ctx.setAttr(menu, "aria-label", "Start menu");
    }
    for (const a of entries(popup)) {
      if (a.getAttribute("role") === "menuitem") continue;
      ctx.setAttr(a, "role", "menuitem");
      if (a.matches(FOLDER)) ctx.setAttr(a, "aria-haspopup", "menu");
    }
  }
  // Sitecore's closePopups, run in the page through an inline handler (a content script cannot reach scForm), on all
  // but the popups opened before the newest; it puts focus back on the newest one's opener. Not as a Sheer message:
  // every request closes all popups, and so does a click that reaches the document.
  function closeNewest(doc) {
    const a = doc.createElement("a");
    a.setAttribute("onclick", 'event.stopPropagation(); scForm.browser.closePopups("Escape", top.popups.slice(0, -1)); return false');
    a.hidden = true;
    doc.body.append(a);
    a.click();
    a.remove();
  }
  function onPopupKey(e) {
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
    const doc = e.currentTarget.ownerDocument;
    const popup = e.currentTarget;
    if (!popup.isConnected) return; // Sitecore closed it already
    const sub = [...doc.querySelectorAll(".scPopup")].indexOf(popup) > 0; // opened from another popup
    if (e.key === "Escape" || (e.key === "ArrowLeft" && sub)) {
      e.preventDefault();
      closeNewest(doc);
      return;
    }
    const item = e.target.closest && e.target.closest(ENTRY);
    if (!item || !popup.querySelector(".scStartMenu")) return;
    const list = entries(popup);
    const i = list.indexOf(item);
    const to = { ArrowDown: list[i + 1], ArrowUp: list[i - 1], Home: list[0], End: list.at(-1) }[e.key];
    if (to) {
      e.preventDefault();
      to.focus();
    } else if (e.key === "ArrowRight" && item.matches(FOLDER)) {
      e.preventDefault();
      item.click();
    }
  }

  SCT.registerAid("menus", {
    apply(ctx) {
      const { doc } = ctx;
      contexts.set(doc, ctx);
      for (const popup of doc.querySelectorAll(".scPopup")) {
        if (heard.has(popup)) continue;
        heard.add(popup);
        ctx.listen(popup, "keydown", onPopupKey);
        if (popup.querySelector(".scStartMenu")) startMenu(ctx, popup);
      }
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
        const item = [...popup.querySelectorAll('[role="menu"] [role="menuitem"]')].find(visible) || entries(popup)[0];
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
