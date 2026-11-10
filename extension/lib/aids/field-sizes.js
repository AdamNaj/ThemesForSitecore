// Field sizes: a Rich Text, Multi-Line Text, Multilist, Treelist, TreelistEx or Checklist field can be dragged taller or
// shorter by its bottom-right corner, as an Image field's preview can (image-preview.js). Every field of a type is sized
// with the others of its type: a drag on one moves them all, live. A field given its own height moves alone, and its
// corner is tinted. A click or a right-click on the corner opens a menu that says which a field follows and switches
// it: its own height (the one it has now, to start with), or sized with its type again (back to the type's height);
// and a type can go back to Sitecore's height. Field menu has the same switch, for the keyboard (field-menu.js). Fields
// are told apart by their template field's ID, a Treelist by its name. The heights live in the site's own
// localStorage, each type's { height, fields: { key: height } }; without storage they last until the page reloads.
// Sitecore's own 5px bar under some of these fields (scContent.fieldResizeDown, saved on the server) gives way to the
// handle; a height it saved shows until one is dragged here.
// ponytail: the drag is the browser's own resize handle, mouse only
(function (root) {
  const SCT = (root.SCT = root.SCT || {});

  const KEY = "sct-field-sizes";
  const CHANGED = "sct-field-size"; // on the document, after a change: the aids draw the heights again
  const NAMES = { image: "Image", html: "Rich Text", memo: "Multi-Line Text", multilist: "Multilist", treelist: "Treelist", treelistex: "TreelistEx", checklist: "Checklist" };
  // each type's control, in a field's input cell; the part sized is the cell's child that holds it
  const KINDS = {
    html: "iframe.scContentControlHtml",
    memo: "textarea.scContentControlMemo",
    multilist: "table.scContentControlMultilist",
    treelist: ".scContentControlTreelist",
    treelistex: ".scTreelistEx",
    checklist: "fieldset.scContentControlChecklist",
  };
  const CELL = ".scEditorFieldMarkerInputCell";
  const FIELD = "[data-sct-size-kind]:not([data-sct-preview])"; // this aid's boxes; an Image preview is image-preview.js's
  const BLANK = '<svg width="14" height="14" aria-hidden="true"></svg>'; // where the check is not
  const contexts = new WeakMap(); // document -> the aid's context there
  const originals = new WeakMap(); // box -> its style before the aid sized it (a height Sitecore saved)
  const held = new WeakSet(); // boxes in a drag: the aids leave their height alone until it ends
  let fallback = {}; // the heights when storage is blocked

  // A field's own key: its template field's ID, from Sitecore's handlers (fld={...}); a Treelist names none, so its
  // name as the label shows it.
  // ponytail: two templates' fields of the same name share a height when Sitecore gives no ID
  function fieldKey(cell) {
    const id = /fld=(?:\{|%7B)([0-9A-F-]{36})/i.exec(cell.innerHTML);
    if (id) return id[1].toUpperCase();
    const label = cell.querySelector(".scEditorFieldLabel");
    const name = label ? [...label.childNodes].filter((n) => !(n.nodeType === 1 && n.matches("a, button, .scEditorFieldLabelAdministrator"))).map((n) => n.textContent).join("").split(/ - |:/)[0].trim() : "";
    return `name:${name.toLowerCase()}`;
  }
  // a type's { height, fields }: whether a field has its own height, and the height it shows (its own, else the type's)
  const ownOf = (entry, key) => !!(key && entry.fields && entry.fields[key]);
  const heightOf = (entry, key) => (ownOf(entry, key) && entry.fields[key]) || entry.height || null;
  // the changes: "own", the field's own height h; "type", h for the type, after a drag on a field sized with it;
  // "reset", Sitecore's height for the type (a field with its own keeps it); "group", the field sized with its type again
  function choose(entry, choice, key, h) {
    const fields = { ...entry.fields };
    if (choice === "own") return { ...entry, fields: { ...fields, [key]: h } };
    if (choice === "type") return { ...entry, height: h };
    if (choice === "reset") {
      const { height, ...rest } = entry;
      return rest;
    }
    delete fields[key];
    return { ...entry, fields };
  }

  function load(win) {
    try {
      const v = JSON.parse(win.localStorage.getItem(KEY) || "{}");
      return v && typeof v === "object" ? v : {};
    } catch {
      return fallback;
    }
  }
  function save(win, v) {
    fallback = v;
    try {
      win.localStorage.setItem(KEY, JSON.stringify(v));
    } catch {
      // storage blocked: the heights last until the page reloads
    }
    win.document.dispatchEvent(new win.CustomEvent(CHANGED));
  }
  function change(box, choice) {
    const win = box.ownerDocument.defaultView;
    const kind = box.getAttribute("data-sct-size-kind");
    const all = load(win);
    save(win, { ...all, [kind]: choose(all[kind] || {}, choice, box.getAttribute("data-sct-size-key"), heightNow(box)) });
  }

  // the height a box shows, as its own box-sizing counts it
  const heightNow = (box) => Math.round(parseFloat(box.ownerDocument.defaultView.getComputedStyle(box).height));
  // what a box follows, for the menus: null outside the Content Editor's field cells, where a field has no key
  function state(box) {
    const key = box && box.getAttribute("data-sct-size-key");
    if (!key) return null;
    const kind = box.getAttribute("data-sct-size-kind");
    const entry = load(box.ownerDocument.defaultView)[kind] || {};
    return { own: ownOf(entry, key), entry, type: `${NAMES[kind]} fields` };
  }

  // The menu on a box's corner, at the corner: which height the field follows, the switch, and the type's reset.
  // Item info's menu, its keys and its look.
  function ask(ctx, box) {
    const s = state(box);
    if (!s || !SCT.itemMenu) return;
    const { doc } = ctx;
    const r = box.getBoundingClientRect();
    const anchor = ctx.own(doc.createElement("sct-size-anchor"));
    anchor.setAttribute("aria-controls", "sct-size-menu");
    anchor.tabIndex = -1;
    anchor.style.cssText = `position:fixed;left:${Math.round(r.right - 16)}px;top:${Math.round(r.bottom - 16)}px;width:16px;height:16px`;
    doc.body.append(anchor);
    const { menu, group, entry: item, icons } = SCT.itemMenu;
    const pick = (choice) => () => {
      m.close();
      if (choice) change(box, choice);
    };
    const own = s.entry.fields && s.entry.fields[box.getAttribute("data-sct-size-key")];
    const m = menu(ctx, anchor, "Field height", (m) => {
      const g = group(doc, m, s.own ? "This field has its own height" : `This field is sized with all ${s.type}`);
      item(doc, g, `Sized with all ${s.type}`, s.entry.height ? `${s.entry.height}px` : "Sitecore's height", pick(s.own && "group"), 0, s.own ? BLANK : icons.check);
      item(doc, g, "Its own height", s.own ? `${own}px` : `Starts at ${heightNow(box)}px`, pick(!s.own && "own"), 0, s.own ? icons.check : BLANK);
      if (s.entry.height) item(doc, group(doc, m, ""), `Reset ${s.type} to Sitecore's height`, "A field with its own height keeps it", pick("reset"), 0, icons.reset);
    });
    const close = m.close;
    m.close = (focus) => {
      close(focus);
      anchor.remove();
    };
    m.querySelectorAll('[role="menuitem"]')[s.own ? 1 : 0].focus({ preventScroll: true });
  }

  // The corners of the boxes matching sel, in ctx's document: a drag sizes the field, and with it the others of its
  // type that have no height of their own, live; letting go keeps the height. A click, or a right-click, opens the menu.
  // For image-preview.js too.
  function watch(ctx, sel) {
    const { doc } = ctx;
    const win = doc.defaultView;
    let press = null; // { box, height, group } of a pointerdown on a corner
    const corner = (e, box) => {
      const r = box.getBoundingClientRect();
      return e.clientX > r.right - 20 && e.clientY > r.bottom - 20;
    };
    const follow = new win.ResizeObserver(() => {
      const h = press && press.box.style.height;
      if (h) for (const b of press.group) if (b.style.height !== h) ctx.setAttr(b, "style", `height: ${h};`);
    });
    ctx.listen(doc, "pointerdown", (e) => {
      const box = e.target.closest && e.target.closest(sel);
      press = null;
      if (!box || e.button !== 0 || !corner(e, box)) return;
      const s = state(box);
      const kind = box.getAttribute("data-sct-size-kind");
      // the others of its type in this document, without a height of their own
      const group = s && s.own ? [] : [...doc.querySelectorAll(`[data-sct-size-kind="${kind}"]`)].filter((b) => b !== box && !(state(b) && state(b).own));
      press = { box, height: heightNow(box), group };
      for (const b of [box, ...group]) held.add(b);
      follow.observe(box);
    }, true);
    ctx.listen(win, "pointerup", () => {
      const p = press;
      press = null;
      if (!p) return;
      follow.disconnect();
      for (const b of [p.box, ...p.group]) held.delete(b);
      if (heightNow(p.box) === p.height) return ask(ctx, p.box); // a click, not a drag
      const s = state(p.box);
      change(p.box, s && s.own ? "own" : "type");
    }, true);
    ctx.listen(doc, "contextmenu", (e) => {
      const box = e.target.closest && e.target.closest(sel);
      if (!box || !corner(e, box) || !state(box)) return;
      e.preventDefault();
      e.stopPropagation(); // Sitecore's own context menu stays shut
      ask(ctx, box);
    }, true);
  }

  // For Field menu: which height the field in a Content Editor field marker follows, and the switch.
  const boxIn = (marker) => marker.querySelector("[data-sct-size-kind]");
  function fieldState(marker) {
    const s = state(boxIn(marker));
    return s && { own: s.own, type: s.type };
  }
  function toggle(marker) {
    const box = boxIn(marker);
    const s = state(box);
    if (s) change(box, s.own ? "group" : "own");
  }

  // a corner tinted for a field with its own height (data-sct-size-own), under the browser's grip lines
  const css = SCT.important(`[data-sct-size-own]{position:relative}
[data-sct-size-own]::after{content:"";position:absolute;right:0;bottom:0;width:14px;height:14px;pointer-events:none;background:linear-gradient(135deg,transparent 50%,var(--sct-accent,Highlight) 50%)}`) +
    "\n" + (SCT.itemMenu ? SCT.itemMenu.css : "");

  SCT.fieldSize = { CHANGED, css, fieldKey, ownOf, heightOf, choose, load, save, watch, held, fieldState, toggle }; // for image-preview.js, field-menu.js and the tests

  function apply(ctx) {
    const { doc } = ctx;
    const saved = load(doc.defaultView);
    for (const [kind, sel] of Object.entries(KINDS)) {
      for (const control of doc.querySelectorAll(`${CELL} ${sel}`)) {
        const cell = control.closest(CELL);
        const box = [...cell.children].find((c) => c.contains(control));
        if (!box) continue;
        if (!box.hasAttribute("data-sct-size-kind")) {
          originals.set(box, box.getAttribute("style"));
          ctx.setAttr(box, "data-sct-size-kind", kind);
          ctx.setAttr(box, "data-sct-size-key", fieldKey(cell));
          // the part that grows with the box: the control, or what holds it
          const fill = [...box.children].find((c) => c.contains(control));
          if (fill) ctx.setAttr(fill, "data-sct-size-fill", "");
        }
        const entry = saved[kind] || {};
        const key = box.getAttribute("data-sct-size-key");
        if (ownOf(entry, key) !== box.hasAttribute("data-sct-size-own")) ctx.setAttr(box, "data-sct-size-own", ownOf(entry, key) ? "" : null);
        if (held.has(box)) continue;
        const h = heightOf(entry, key);
        const style = h ? `height: ${h}px;` : originals.get(box);
        if (box.getAttribute("style") !== style) ctx.setAttr(box, "style", style);
      }
    }
  }

  SCT.registerAid("field-sizes", {
    // a flex column from the start: a box that changed its display mid-drag would drop the browser's drag. The part
    // that holds the control keeps its own height until the box has one, then grows or shrinks to fill it.
    css: SCT.important(`${FIELD}{display:flex;flex-direction:column;box-sizing:border-box;min-height:32px;overflow:hidden;resize:vertical}
${FIELD}>[data-sct-size-fill]{flex:1 1 auto;min-height:0;box-sizing:border-box}
${FIELD}[style*=height]>[data-sct-size-fill]{height:auto}
[data-sct-size-kind=multilist][style*=height] :is(table.scContentControlMultilist,select.scContentControlMultilistBox){height:100%}
${FIELD}>[data-sct-length]{padding-right:16px}
${FIELD}+div[onmousedown*=fieldResizeDown]{display:none}`) + "\n" + css,
    apply(ctx) {
      if (!contexts.has(ctx.doc)) {
        watch(ctx, FIELD);
        ctx.listen(ctx.doc, CHANGED, () => contexts.has(ctx.doc) && apply(contexts.get(ctx.doc)));
      }
      contexts.set(ctx.doc, ctx);
      apply(ctx);
    },
    revert(ctx) {
      contexts.delete(ctx.doc);
    },
  });
})(globalThis);
