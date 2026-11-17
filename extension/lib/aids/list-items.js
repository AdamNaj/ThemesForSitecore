// Listed items: the items a Content Editor field lists say where they live, and open from where they are listed.
// Path: in a list (not a tree), each item's name is followed by its parent's path, a little faded and without the
// /sitecore every path starts with (/content/Home for an item under Home): the selected side of
// a Treelist, both lists of a Multilist and of a Multilist with Search, and a TreelistEx's rows. A list's paths start in
// one column, past its longest name and the arrow's place. A list box's options hold plain text only, so their paths
// are drawn in a layer laid over the list (<sct-paths>, beside the <select>, which follows its scrolling, size and
// selection), for the options in view; the paths come from the Item Service, once per item for the page's life. A
// TreelistEx's rows carry the path already (their title: the content path, without /sitecore/content for an item
// under it).
// Arrow: the item under the pointer shows a small arrow, and a press on it opens that item as the menus' Navigate
// entries do (SCT.gotoItem: Sitecore's own item:load, then the item scrolled into view in the content tree). In a list
// it shows between the names and the paths, left of the item's path; after the name on a node of a Treelist's tree (a
// node's ID is in its element's id) and on the item picked in a Droplink. One button for the page, laid over the row.
// The arrow is mouse only, as it was asked for; Field menu's Copy raw value has the IDs for the keyboard.
// A Checklist's boxes name no item (no ID or path in the page), so they get neither.
// An item of another database (a field whose source names one) is not in the Content Editor's: no path, and Sitecore
// says it cannot find it when its arrow is pressed.
(function (root) {
  const SCT = (root.SCT = root.SCT || {});

  const CELL = ".scEditorFieldMarkerInputCell";
  const SIZE = 16; // the arrow's box
  const GAP = 6; // each side of the arrow
  const SLOT = SIZE + 2 * GAP; // between a list's longest name and its paths: the arrow's place
  const ICON = '<svg viewBox="0 0 14 14" width="12" height="12" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5.5 3.5h5v5M10.5 3.5l-7 7"/></svg>';
  const paths = new Map(); // db + item ID -> its parent's path, null when it has none here, or a Promise of either
  let sizes = null; // one ResizeObserver for every list with a layer
  let pen = null; // a canvas, to measure an option's text

  // what SCT.gotoItem takes, from each kind of row, or null: an option's value ({ID}, or key|{ID} in a Treelist), a
  // Treelist node's element id (FIELD1_all_<32 hex digits>), a TreelistEx row's title
  const fromValue = (value) => (/\{[0-9A-F]{8}(?:-[0-9A-F]{4}){3}-[0-9A-F]{12}\}/i.exec(value || "") || [""])[0].toUpperCase() || null;
  const fromNode = (id) => {
    const m = /_([0-9A-F]{8})([0-9A-F]{4})([0-9A-F]{4})([0-9A-F]{4})([0-9A-F]{12})$/i.exec(id || "");
    return m ? `{${m.slice(1).join("-").toUpperCase()}}` : null;
  };
  const fromPath = (title) => (!/^\/[^/]/.test(title || "") ? null : /^\/sitecore(\/|$)/i.test(title) ? title : `/sitecore/content${title}`);
  // an item's path as shown: without the item, and without the /sitecore every path starts with:
  // /sitecore/content/Home/About -> /content/Home, /sitecore/content -> /; null for the root's
  const parentPath = (path) => {
    const parent = (path || "").replace(/\/[^/]*$/, "");
    return parent ? parent.replace(/^\/sitecore(?=\/|$)/i, "") || "/" : null;
  };

  const isList = (select) => select.multiple || select.size > 1;
  // a row's own text, without the path this aid put after it
  const ownText = (row) => [...row.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join("").trim();

  // the listed item el is, or is in: { row, target, name, text }; text only for a list box's or a drop-down's row,
  // whose text cannot be measured in the page
  function listed(el) {
    if (!el || !el.closest || !el.closest(CELL)) return null;
    const option = el.closest("option") || (el.matches("select") && !isList(el) ? el.selectedOptions[0] : null);
    if (option) {
      const target = fromValue(option.value);
      return target && { row: el.closest("option") || el, target, name: option.text.trim(), text: option.text };
    }
    const node = el.closest(".scContentTreeNode > a");
    const row = node || el.closest(".scTreelistEx > div[title]");
    const target = node ? fromNode(node.parentNode.id) : row ? fromPath(row.title) : null;
    return target && { row, target, name: node ? node.textContent.trim() : ownText(row) };
  }

  // how wide a text is in an option's style: (text) => px
  function ruler(doc, style) {
    pen ||= doc.createElement("canvas").getContext("2d");
    pen.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    // the Wide spacing setting; a canvas without these measures a little short, and what follows sits a little closer
    if ("letterSpacing" in pen) {
      pen.letterSpacing = style.letterSpacing === "normal" ? "0px" : style.letterSpacing;
      pen.wordSpacing = style.wordSpacing === "normal" ? "0px" : style.wordSpacing;
    }
    return (text) => pen.measureText(text).width;
  }
  // where a row's text starts, from the row's left edge
  const inset = (style) => parseFloat(style.borderLeftWidth) + parseFloat(style.paddingLeft);

  // the item's parent's path now if it is known, else null, with again() called once it is
  function pathOf(doc, db, id, again) {
    const key = `${db}|${id}`;
    if (!paths.has(key)) {
      const ask = fetch(`${doc.location.origin}/sitecore/api/ssc/item/${id.replace(/[{}]/g, "")}?${new URLSearchParams({ database: db, fields: "ItemPath" })}`, { credentials: "include" })
        .then((r) => (r.ok ? r.json() : {}))
        // an item that cannot be read (not in this database, no access, a failed request) has no path, and is not asked for again
        .then((item) => parentPath(item.ItemPath), () => null)
        .then((path) => paths.set(key, path));
      paths.set(key, ask);
    }
    const known = paths.get(key);
    if (!(known instanceof Promise)) return known;
    known.then(again);
    return null;
  }

  // The paths of the options in view, in the list's layer, all from one column: past the longest of the list's names
  // (every option's, in view or not, measured again when they change) and the arrow's place. The layer is laid over
  // the list's inside by how far it is from it now, so it holds wherever Sitecore's markup puts it.
  function draw(doc, db, select) {
    const layer = select.nextElementSibling;
    if (!layer || layer.localName !== "sct-paths") return;
    const win = doc.defaultView;
    const s = select.getBoundingClientRect();
    const first = select.options[0];
    const row = first ? first.getBoundingClientRect() : null;
    if (!row || !row.height || !s.height) return layer.replaceChildren();
    const left = s.left + select.clientLeft, top = s.top + select.clientTop;
    layer.style.width = `${select.clientWidth}px`;
    layer.style.height = `${select.clientHeight}px`;
    const at = layer.getBoundingClientRect();
    layer.sctX = (layer.sctX || 0) + left - at.left;
    layer.sctY = (layer.sctY || 0) + top - at.top;
    layer.style.transform = `translate(${layer.sctX}px,${layer.sctY}px)`;
    const base = win.getComputedStyle(first);
    const names = [base.fontWeight, base.fontSize, base.fontFamily, base.letterSpacing, ...[...select.options].map((o) => o.text)].join("\n");
    if (layer.sctNames !== names) {
      layer.sctNames = names;
      const width = ruler(doc, base);
      layer.sctWidest = 0;
      for (const o of select.options) layer.sctWidest = Math.max(layer.sctWidest, width(o.text));
    }
    // the arrow's place, from the layer's left edge; the paths start a SLOT past the names
    layer.sctArrow = row.left - left + inset(base) + layer.sctWidest + GAP;
    const again = () => {
      if (layer.sctQueued || !select.isConnected) return;
      layer.sctQueued = true;
      win.requestAnimationFrame(() => ((layer.sctQueued = false), draw(doc, db, select)));
    };
    const rows = [];
    for (let i = Math.max(0, Math.floor(select.scrollTop / row.height) - 1); i < select.options.length; i++) {
      const option = select.options[i];
      const r = option.getBoundingClientRect();
      if (r.bottom <= top) continue;
      if (r.top >= top + select.clientHeight) break;
      const id = fromValue(option.value);
      const path = id && pathOf(doc, db, id, again);
      if (!path) continue;
      const style = win.getComputedStyle(option);
      const el = doc.createElement("sct-path");
      el.textContent = path;
      // the option's own colour (a selected one's too) and font, faded by the aid's CSS
      el.style.cssText = `left:${layer.sctArrow + SIZE + GAP}px;top:${r.top - top}px;height:${r.height}px;line-height:${r.height}px;color:${style.color};font-style:${style.fontStyle};font-weight:${style.fontWeight};font-size:${style.fontSize}`;
      rows.push(el);
    }
    layer.replaceChildren(...rows);
    // the arrow showing on one of this list's rows follows the column
    const b = doc.querySelector("[data-sct-goto][data-sct-on]");
    const hit = b && b.sctRow.parentNode === select && listed(b.sctRow);
    if (hit) place(doc, b, hit);
  }

  // A TreelistEx's paths in one column too: each pushed right by what its name is short of the longest, and the
  // arrow's place
  function align(doc, list) {
    const rows = [...list.querySelectorAll(":scope > div > sct-path")].map((path) => {
      const range = doc.createRange();
      range.setStart(path.parentNode, 0);
      range.setEndBefore(path);
      return { path, end: range.getBoundingClientRect().right };
    });
    const widest = Math.max(...rows.map((r) => r.end));
    for (const { path, end } of rows) path.style.marginLeft = `${widest - end + SLOT}px`;
  }

  // the arrow, level with its row: left of the row's path in a list, in the place the list keeps for it; elsewhere
  // just after the row's text (short of a drop-down's own arrow); always inside its list
  function place(doc, b, hit) {
    const r = hit.row.getBoundingClientRect();
    const box = hit.row.closest("select, .scContentControlTree, .scTreelistEx") || hit.row;
    const left = box.getBoundingClientRect().left + box.clientLeft;
    const layer = box.nextElementSibling?.localName === "sct-paths" ? box.nextElementSibling : null;
    const path = hit.row.querySelector("sct-path");
    let x;
    if (layer && layer.sctArrow !== undefined) x = left + layer.sctArrow;
    else if (path) x = path.getBoundingClientRect().left - GAP - SIZE;
    else if (hit.text !== undefined) {
      const style = doc.defaultView.getComputedStyle(hit.row);
      x = r.left + inset(style) + ruler(doc, style)(hit.text) + GAP;
    } else {
      const range = doc.createRange();
      range.selectNodeContents(hit.row);
      x = range.getBoundingClientRect().right + GAP;
    }
    const max = left + box.clientWidth - SIZE - 2 - (box === hit.row ? 20 : 0);
    // important, as the aid's CSS is: its all:unset would win over a plain inline place
    b.style.setProperty("left", `${Math.round(Math.max(left, Math.min(x, max)))}px`, "important");
    b.style.setProperty("top", `${Math.round(r.top + (r.height - SIZE) / 2)}px`, "important");
  }

  SCT.listItems = { fromValue, fromNode, fromPath, parentPath };

  SCT.registerAid("list-items", {
    css: SCT.important(`[data-sct-goto]{all:unset;position:fixed;z-index:2147483645;display:none;align-items:center;justify-content:center;box-sizing:border-box;width:${SIZE}px;height:${SIZE}px;border:1px solid var(--sct-border,GrayText);border-radius:3px;background:var(--sct-panel-bg,Canvas);color:var(--sct-panel-fg,CanvasText);cursor:pointer}
[data-sct-goto][data-sct-on]{display:inline-flex}
[data-sct-goto]:hover{border-color:currentColor}
[data-sct-goto] svg{pointer-events:none}
[data-sct-paths-host]{position:relative}
sct-paths{position:absolute;left:0;top:0;margin:0;padding:0;border:0;overflow:hidden;pointer-events:none}
sct-path{opacity:.6;white-space:nowrap;pointer-events:none}
sct-paths>sct-path{position:absolute}`),
    apply(ctx) {
      const { doc } = ctx;
      const db = /^sitecore:\/\/(\w+)\//.exec(doc.getElementById("__CurrentItem")?.value || "")?.[1];
      if (!db || !doc.body) return;
      // a list dragged taller (Field sizes), a window resized, a section opened (nothing in a closed one has a size)
      sizes ||= new ResizeObserver((entries) => entries.forEach((e) => (e.target.localName === "select" ? draw(doc, db, e.target) : align(doc, e.target))));
      const lists = [...doc.querySelectorAll(`${CELL} select`)].filter((s) => isList(s) && [...s.options].some((o) => fromValue(o.value)));
      for (const select of lists) {
        if (select.nextElementSibling?.localName !== "sct-paths") {
          // the layer's place is measured from the list's parent, so it scrolls with the fields
          if (doc.defaultView.getComputedStyle(select.parentNode).position === "static") ctx.setAttr(select.parentNode, "data-sct-paths-host", "");
          const layer = ctx.own(doc.createElement("sct-paths"));
          layer.setAttribute("aria-hidden", "true");
          select.after(layer);
          sizes.observe(select);
        }
        draw(doc, db, select);
      }
      for (const row of doc.querySelectorAll(`${CELL} .scTreelistEx > div[title]`)) {
        const path = parentPath(fromPath(row.title));
        if (!path || row.querySelector("sct-path")) continue;
        const el = ctx.own(doc.createElement("sct-path"));
        el.textContent = path;
        row.append(el);
      }
      for (const list of doc.querySelectorAll(`${CELL} .scTreelistEx`)) {
        sizes.observe(list); // once, however often it is asked
        align(doc, list);
      }
      let b = doc.querySelector("[data-sct-goto]");
      if (b) {
        // Sitecore drew the fields again: the row the arrow was on is gone
        if (b.sctRow && !b.sctRow.isConnected) b.removeAttribute("data-sct-on");
        return;
      }
      b = ctx.own(doc.createElement("button"));
      b.type = "button";
      b.tabIndex = -1;
      b.setAttribute("data-sct-goto", "");
      b.innerHTML = ICON;
      const hide = () => b.removeAttribute("data-sct-on");
      ctx.listen(doc, "mouseover", (e) => {
        if (e.target === b) return;
        const hit = listed(e.target);
        if (!hit) return hide();
        b.sctRow = hit.row;
        b.title = `Go to ${hit.name}`;
        b.setAttribute("aria-label", b.title);
        place(doc, b, hit);
        b.setAttribute("data-sct-on", "");
      }, true);
      // a list scrolled: its paths follow, and the arrow goes, as it does when the pointer leaves for another frame
      const redraw = (e) => e.target.localName === "select" && draw(doc, db, e.target);
      ctx.listen(doc, "scroll", (e) => (hide(), redraw(e)), true);
      // a selected option's colour, and a list with focus draws its selection in another
      for (const type of ["change", "focusin", "focusout"]) ctx.listen(doc, type, redraw, true);
      ctx.listen(doc.documentElement, "mouseleave", hide);
      b.addEventListener("mousedown", (e) => e.preventDefault()); // focus stays in the field
      b.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        // read again: a drop-down may have another item picked since the pointer came
        const hit = b.sctRow && b.sctRow.isConnected && listed(b.sctRow);
        hide();
        if (hit) SCT.gotoItem(doc, hit.target);
      });
      doc.body.append(b);
    },
    revert() {
      sizes?.disconnect();
      sizes = null;
    },
  });
})(globalThis);
