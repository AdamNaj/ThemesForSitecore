// Type to search: typing in the Content Editor searches the part you are in, and narrows it to what matches. In the
// content tree (a tree item has focus, or you last clicked in the tree) it searches the items the tree has loaded:
// the ones that match stay, with the items above them, faded, as their path; the rest hide. In the editor (you last
// clicked there, or its tabs have focus) it searches the fields by their labels: a section with a match stays, opened
// if it was closed, with only its matching fields; the others hide. The tree also matches each item's template name,
// and the editor each field's type (Rich Text, Droplink), which Sitecore's dialogs give: the Change Template dialog
// names an item's template, the Template Builder and the Inheritance tab its fields' types. They are asked as a search
// starts, and the matches grow as the answers come. The letters typed match in that order, not necessarily together
// ("qagk" finds QA Automated GreeneKing). The typed text shows in a small panel, and the
// nearest match is shown: a tree item takes focus, a field is outlined. Tab and Shift+Tab, or Down and Up, move
// between the matches, more letters narrow it, Backspace or Delete shorten it. Enter picks the match: everything shows
// again, the match in the middle of the view, and the tree item opens (it is a link) or the cursor goes into the field,
// whose section Sitecore opens if it was closed; a click on a tree item opens it the same way. Escape, Left, Right or a
// click elsewhere put everything back. Typing in a field, a box or a rich text editor types there as always. Sitecore
// has no search of either; its tree already has the arrows, Home, End, Space and Delete, and Shift+F10 for its context
// menu. Nothing is removed or moved, only hidden.
// ponytail: templates and field types are kept for the page's life; a template changed meanwhile shows on reload
(function (root) {
  const SCT = (root.SCT = root.SCT || {});

  const NODE = '.scContentTree a[id^="Tree_Node_"]';
  const ROW = ".scContentTreeNode";
  const TREE = "#ContentTreePanel";
  const EDITOR = "#ContentEditor";
  const FIELD = ".scEditorFieldMarker";
  const CAPTION = ".scEditorSectionCaptionExpanded, .scEditorSectionCaptionCollapsed";
  const HIDE = "data-sct-find-hide"; // what the search leaves out
  const OPEN = "data-sct-find-open"; // a closed section shown for its matches, without telling Sitecore
  const PATH = "data-sct-find-path"; // a tree item above a match, kept as its path
  const AT = "data-sct-find-at"; // the field match shown, which keeps no focus
  const SEARCHING = "data-sct-tree-search"; // on the tree, while a search of it runs
  const MARKS = [HIDE, OPEN, PATH, AT];
  const KEYS = /^(button|checkbox|radio|submit|reset|image|file|color|range)$/; // input types that take no text
  const searches = new WeakMap(); // document -> { mode, query, at, region, panel, tree, items, extra, run }
  const pages = new Map(); // a Sitecore dialog's address -> Promise of its page

  const shown = (el) => el.getClientRects().length > 0;
  const text = (el) => (el ? el.textContent.replace(/\s+/g, " ").trim() : "");
  // a field's label without the links add-ons put in it (the Sitecore Extensions add-on's [Go to field] [Reset Field])
  const label = (field) => {
    const el = field.querySelector(".scEditorFieldLabel");
    return el ? [...el.childNodes].filter((n) => !(n.nodeType === 1 && n.matches("a, button"))).map((n) => n.textContent).join("").replace(/\s+/g, " ").trim() : "";
  };
  // the field's name as the label shows it, without its help, its [shared] and its colon
  const fieldName = (field) => {
    const el = field.querySelector(".scEditorFieldLabel");
    return el ? [...el.childNodes].filter((n) => !(n.nodeType === 1 && n.matches("a, button, .scEditorFieldLabelAdministrator"))).map((n) => n.textContent).join("").split(/ - |:/)[0].trim() : "";
  };
  // the typed letters in that order, not necessarily together: "qagk" finds QA Automated GreeneKing, "vid" VenueId
  const fuzzy = (t, q) => {
    let i = 0;
    for (const c of t.toLowerCase()) if (c === q[i]) i++;
    return i >= q.length;
  };
  const typesText = (el) => el.isContentEditable || /^(TEXTAREA|SELECT|IFRAME)$/.test(el.tagName) || (el.tagName === "INPUT" && !KEYS.test(el.type));
  const mark = (el, attr, on) => on !== el.hasAttribute(attr) && el.toggleAttribute(attr, on);

  // which search a key starts, from where focus is, or where the last click was when focus is nowhere
  function modeFor(s, target, doc) {
    if (typesText(target)) return null;
    if (target.closest(NODE) || target.closest(TREE)) return "tree";
    if (target.closest(EDITOR)) return "fields";
    return target === doc.body || target === doc.documentElement ? s.region : null;
  }

  function end(doc) {
    const s = searches.get(doc);
    if (!s || !s.mode) return;
    s.mode = null;
    s.query = "";
    s.at = null;
    s.run = null;
    s.extra = new Map();
    for (const el of doc.querySelectorAll(MARKS.map((m) => `[${m}]`).join())) for (const m of MARKS) el.removeAttribute(m);
    s.tree?.removeAttribute(SEARCHING);
    s.panel.hidden = true;
  }

  // the tree items the search covers: the ones shown as it started (loaded, and not kept hidden by Sitecore)
  const nodes = (s) => s.items.filter((a) => a.isConnected);

  // a Sitecore dialog's page, asked once; a failure is asked again next time
  function page(doc, control, q) {
    const url = `${doc.location.origin}/sitecore/shell/default.aspx?xmlcontrol=${control}&${new URLSearchParams(q)}`;
    if (!pages.has(url)) {
      const ask = fetch(url, { credentials: "include" })
        .then((r) => (r.ok ? r.text() : Promise.reject(new Error(r.status))))
        .then((html) => new DOMParser().parseFromString(html, "text/html"));
      ask.catch(() => pages.delete(url));
      pages.set(url, ask);
    }
    return pages.get(url);
  }

  // the item in the editor (sitecore://master/{ID}?lang=en&ver=1), or just the database the tree shows
  const current = (doc) => {
    const m = /^sitecore:\/\/(\w+)\/(\{[^}]+\})\?lang=([^&]+)/.exec(doc.getElementById("__CurrentItem")?.value || "");
    return m ? { db: m[1], id: m[2], lang: m[3] } : { db: "master" };
  };

  // an item's template, from the Change Template dialog's "Sample/Sample Item - {ID}"
  const templateOf = (doc, db, id) =>
    page(doc, "ChangeTemplate", { id, db }).then((p) => {
      const m = /^(.*) - (\{[0-9A-F-]{36}\})$/i.exec(text(p.getElementById("OldTemplateName")));
      return m && { name: m[1].split("/").pop(), id: m[2] };
    });

  // a template's field types by field ID and by name: its own from the Template Builder, its bases' from the
  // Inheritance tab ("__Display name - Single-Line Text")
  function fieldTypes(doc, item, tid) {
    const q = { id: tid, la: item.lang, language: item.lang, vs: 1, version: 1, database: item.db, readonly: 0, db: item.db };
    return Promise.all([page(doc, "TemplateBuilder", q).catch(() => null), page(doc, "TemplateInheritance", q).catch(() => null)]).then(([own, bases]) => {
      const ids = new Map(), names = new Map();
      const add = (id, name, type) => {
        if (!type) return;
        ids.set(id.toUpperCase(), type);
        names.set(name.replace(/^__/, "").toLowerCase(), type);
      };
      for (const i of own ? own.querySelectorAll('input[id$="_field_id"]') : []) {
        const row = i.id.slice(0, -"_id".length);
        const type = own.getElementById(`${row}_type`);
        add(i.value, own.getElementById(`${row}_name`)?.value || "", (type?.querySelector("option[selected]") || type)?.value);
      }
      for (const a of bases ? bases.querySelectorAll("a.scField") : []) {
        const id = /\{[0-9A-F-]{36}\}/i.exec(a.getAttribute("onclick") || "");
        const t = text(a), cut = t.lastIndexOf(" - ");
        if (id && cut > 0) add(id[0], t.slice(0, cut), t.slice(cut + 3));
      }
      return { ids, names };
    });
  }

  // run the search again when answers land, once for a burst of them
  function refresh(s, doc) {
    if (s.again) return;
    s.again = doc.defaultView.setTimeout(() => {
      s.again = 0;
      if (s.mode && s.query) show(s, doc, 0);
    }, 50);
  }

  // what the search also matches, asked as it starts: each tree item's template name, or each field's type; the
  // fields' controls name their field's ID (fld=), and the ones that do not (dates, tree lists) go by the field's name
  function learn(s, doc) {
    const run = (s.run = {});
    const item = current(doc);
    if (s.mode === "tree") {
      const queue = s.items.slice();
      const next = () => {
        const a = queue.shift();
        if (!a || s.run !== run) return;
        const id = a.id.slice("Tree_Node_".length).replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, "{$1-$2-$3-$4-$5}");
        templateOf(doc, item.db, id)
          .then((t) => {
            if (!t || s.run !== run) return;
            s.extra.set(a, t.name);
            refresh(s, doc);
          }, () => {})
          .then(next);
      };
      // ponytail: four at a time, in tree order; nearest-first if long trees fill in too slowly
      for (let i = 0; i < 4; i++) next();
      return;
    }
    if (!item.id) return;
    templateOf(doc, item.db, item.id)
      .then((t) => t && fieldTypes(doc, item, t.id))
      .then((types) => {
        if (!types || s.run !== run) return;
        for (const f of doc.querySelectorAll(FIELD)) {
          const id = /fld=(\{[0-9A-F-]{36}\})/i.exec(f.innerHTML);
          const type = (id && types.ids.get(id[1].toUpperCase())) || types.names.get(fieldName(f).toLowerCase());
          if (type) s.extra.set(f, type);
        }
        refresh(s, doc);
      }, () => {});
  }

  // narrow the tree to the matches and the items above them; with none, to the item with focus and its path, faded,
  // since a hidden item loses focus and that would end the search
  function narrowTree(s, matches) {
    const keep = new Set();
    for (const a of matches.length ? matches : [s.at].filter(Boolean)) for (let row = a.closest(ROW); row && s.tree.contains(row); row = row.parentElement.closest(ROW)) keep.add(row);
    for (const a of nodes(s)) {
      const row = a.closest(ROW);
      mark(row, HIDE, !keep.has(row));
      mark(a, PATH, keep.has(row) && !matches.includes(a));
    }
  }

  // narrow the editor to the sections with matches, opening the closed ones, and to the matching fields in them
  function narrowFields(doc, all, matches) {
    for (const caption of doc.querySelectorAll(CAPTION)) {
      const panel = caption.nextElementSibling;
      if (!panel) continue;
      const fields = all.filter((f) => panel.contains(f));
      const any = fields.some((f) => matches.includes(f));
      mark(caption, HIDE, !any);
      mark(panel, HIDE, !any);
      mark(panel, OPEN, any && caption.classList.contains("scEditorSectionCaptionCollapsed"));
      for (const f of fields) mark(f, HIDE, any && !matches.includes(f));
    }
  }

  // narrow to the matches and show one: the current one if it still matches, else the next one (step 0), or the next
  // or previous one from it (step 1 or -1)
  function show(s, doc, step) {
    const tree = s.mode === "tree";
    const all = tree ? nodes(s) : [...doc.querySelectorAll(FIELD)].filter((f) => label(f));
    const q = s.query.toLowerCase();
    const matches = all.filter((el) => [tree ? text(el) : label(el), s.extra.get(el) || ""].some((t) => fuzzy(t, q)));
    if (tree) narrowTree(s, matches);
    else narrowFields(doc, all, matches);
    const from = s.at;
    let at = matches.includes(from) && !step ? from : null;
    if (!at && matches.length) {
      // from the one before, in the whole list, so the order holds while the list narrows
      const order = step < 0 ? [...all].reverse() : all;
      const i = order.indexOf(from); // -1 for none: from the top
      at = [...order.slice(i + 1), ...order.slice(0, i + 1)].find((el) => matches.includes(el));
    }
    s.at = at || from;
    if (at && tree && doc.activeElement !== at) at.focus();
    if (!tree) for (const f of all) mark(f, AT, f === at);
    // focus scrolls only when it moves, and a field takes no focus
    if (at) at.scrollIntoView({ block: "nearest" });
    const count = matches.length ? `${matches.indexOf(at) + 1} of ${matches.length} · Tab for the next · Enter to go there` : "No match";
    // the field shown, and its type or the item's template
    const name = (at && !tree ? `${fieldName(at)} · ` : "") + (at && s.extra.has(at) ? `${s.extra.get(at)} · ` : "");
    // in the part searched, at its foot, or at its head while the match is down there
    const box = (tree ? s.tree.closest(".scContentTreeContainer") || s.tree : doc.querySelector(EDITOR) || doc.body).getBoundingClientRect();
    const win = doc.defaultView;
    const low = !!at && at.getBoundingClientRect().bottom > Math.min(box.bottom, win.innerHeight) - 48;
    s.panel.style.left = `${Math.round(box.left + 8)}px`;
    s.panel.style.top = low ? `${Math.round(Math.max(box.top, 0) + 8)}px` : "";
    s.panel.style.bottom = low ? "" : `${Math.round(Math.max(win.innerHeight - box.bottom, 0) + 8)}px`;
    s.panel.firstChild.textContent = s.query;
    s.panel.lastChild.textContent = name + count;
    s.panel.hidden = false;
    if (tree) s.tree.setAttribute(SEARCHING, "");
  }

  // Enter on a field: everything back, the field's section opened as Sitecore opens it (its navigator clicks the
  // section's glyph, which also keeps it open for this user), the field in the middle of the view, the cursor in it
  function goToField(doc, field) {
    end(doc);
    const panel = field.closest(".scEditorSectionPanel") || [...doc.querySelectorAll(CAPTION)].map((c) => c.nextElementSibling).find((p) => p && p.contains(field));
    const caption = panel && panel.previousElementSibling;
    if (caption && caption.classList.contains("scEditorSectionCaptionCollapsed")) (caption.querySelector(".scEditorSectionCaptionGlyph") || caption).click();
    const first = (sel) => [...field.querySelectorAll(sel)].find((el) => !el.disabled && el.type !== "hidden");
    // what takes text (a rich text field's links come first), else the first thing that takes focus
    const control = first('input, textarea, select, iframe, [contenteditable="true"]') || first("a[href], button, [tabindex]");
    // after Sitecore's slide open, a tenth of a second
    doc.defaultView.setTimeout(() => {
      field.scrollIntoView({ block: "center" });
      if (control) control.focus({ preventScroll: true });
    }, 150);
  }

  function onKey(e) {
    const doc = e.target.ownerDocument || e.target;
    const s = searches.get(doc);
    if (!s || e.defaultPrevented || e.ctrlKey || e.altKey || e.metaKey || e.key === "Shift" || e.key === "CapsLock") return;
    if (!s.mode) {
      // a letter starts a search; Space, Delete and the rest stay Sitecore's
      if (e.key.length !== 1 || e.key === " ") return;
      const mode = e.target.nodeType === 1 && modeFor(s, e.target, doc);
      if (!mode) return;
      s.mode = mode;
      s.tree = mode === "tree" ? (e.target.closest(".scContentTree") || doc.querySelector(".scContentTree")) : null;
      if (mode === "tree" && !s.tree) return (s.mode = null);
      s.at = mode === "tree" ? e.target.closest(NODE) || s.tree.querySelector(".scContentTreeNodeActive") : null;
      s.items = mode === "tree" ? [...s.tree.querySelectorAll(NODE)].filter(shown) : [];
      learn(s, doc);
    }
    let step = 0;
    if (e.key.length === 1) s.query += e.key;
    else if (e.key === "Backspace" || e.key === "Delete") s.query = s.query.slice(0, -1);
    else if (e.key === "Tab") step = e.shiftKey ? -1 : 1;
    else if (e.key === "ArrowDown" || e.key === "ArrowUp") step = e.key === "ArrowUp" ? -1 : 1;
    else if (e.key === "Escape") s.query = "";
    else if (e.key === "Enter") {
      const at = s.at;
      const field = s.mode === "fields" && at && at.hasAttribute(AT);
      if (s.mode === "fields") e.preventDefault();
      if (field) return goToField(doc, at);
      end(doc);
      // a tree item opens, as Enter always does, in the middle of the tree
      if (at && s.tree && s.tree.contains(at)) at.scrollIntoView({ block: "center" });
      return;
    } else return end(doc); // Left, Right and the rest: everything back, and the key works
    // before Sitecore's handler on the tree, which would delete the item on Delete
    e.preventDefault();
    e.stopPropagation();
    if (s.query) show(s, doc, step);
    else end(doc);
  }

  // where a click was, for the keys that follow it; a click ends a search, one on a tree item once it has landed
  // there (the tree growing back first would move another item under the pointer)
  function onPointer(e) {
    const doc = e.target.ownerDocument || e.target;
    const s = searches.get(doc);
    if (!s || e.target.nodeType !== 1) return;
    s.region = e.target.closest(TREE) ? "tree" : e.target.closest(EDITOR) ? "fields" : null;
    s.pressed = s.mode === "tree" && !!e.target.closest(ROW);
    if (!s.pressed) end(doc);
  }

  // the item clicked opens, as Sitecore opens it, and the tree comes back with it in the middle, as after Enter
  function onClick(e) {
    const doc = e.target.ownerDocument || e.target;
    const s = searches.get(doc);
    const row = s && s.mode === "tree" && e.target.nodeType === 1 && e.target.closest(ROW);
    if (!row) return;
    s.pressed = false;
    const at = row.querySelector(NODE);
    doc.defaultView.setTimeout(() => {
      end(doc);
      if (at) at.scrollIntoView({ block: "center" });
    }, 0);
  }

  function onFocusOut(e) {
    const doc = e.target.ownerDocument;
    const s = searches.get(doc);
    const to = e.relatedTarget;
    // a press on a tree item's glyph leaves focus nowhere; its click ends the search
    if (s && s.mode === "tree" && !s.pressed && !(to && to.closest && to.closest(NODE))) end(doc);
  }

  SCT.registerAid("tree-keys", {
    css: `[${HIDE}]{display:none!important}
[${OPEN}]{display:revert!important;height:auto!important}
[${PATH}]{opacity:.5}
[${SEARCHING}] a:focus,[${AT}]{outline:2px solid var(--sct-accent,Highlight);outline-offset:1px}
sct-tree-find{position:fixed;z-index:2147483646;display:flex;gap:8px;align-items:baseline;max-width:calc(100vw - 32px);padding:4px 8px;border:1px solid color-mix(in srgb,CanvasText 30%,transparent);border-radius:4px;background:Canvas;color:CanvasText;font:12px/1.4 system-ui,sans-serif;box-shadow:0 2px 8px rgb(0 0 0/.2);pointer-events:none}
sct-tree-find[hidden]{display:none}
sct-tree-find>b{font-weight:600;white-space:pre}
sct-tree-find>span{opacity:.7;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}`,
    apply(ctx) {
      const { doc } = ctx;
      if (!doc.body || searches.has(doc)) return;
      const panel = ctx.own(doc.createElement("sct-tree-find"));
      panel.hidden = true;
      panel.setAttribute("role", "status"); // read out: the field shown, the count, or No match
      panel.append(doc.createElement("b"), doc.createElement("span"));
      doc.body.append(panel);
      searches.set(doc, { mode: null, query: "", at: null, region: null, panel, tree: null, items: [], extra: new Map(), run: null, again: 0, pressed: false });
      ctx.listen(doc, "keydown", onKey, true);
      ctx.listen(doc, "pointerdown", onPointer, true);
      ctx.listen(doc, "click", onClick, true);
      ctx.listen(doc, "focusout", onFocusOut);
    },
    revert(ctx) {
      end(ctx.doc);
      searches.delete(ctx.doc);
    },
  });
})(globalThis);
