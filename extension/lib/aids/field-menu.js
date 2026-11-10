// Field menu: a small button after each field's label in the Content Editor (and Shift+F10 in the field) opens a menu
// that copies the field's name or its raw value, opens the field's definition under its template or the template that
// defines it, pastes the clipboard's text in as the raw value (through the Item Service; an empty clipboard is refused),
// and resets the field to its standard value, through Sitecore's Reset Fields dialog posted without showing it. Paste
// and Reset save at once, so each takes a second press (twice()), then the item opens again. Unsaved changes: Sitecore
// asks to save them as the item opens again, and Yes saves the old value back.
// ponytail: no warning before that; the editor's modified flag lives in the page's script, out of a content script's reach
// The field's ID is in its control's handler (fld=); the fields that draw none (dates, tree lists, rules) are found by
// their label in the Reset Fields dialog's page, which draws the same labels beside each field's checkbox
// (Reset_<ID>). The field's name and its template come from the Item Service, once per field for the page's life.
// The menu is Item info's (item-info.js), with its keys and its look.
(function (root) {
  const SCT = (root.SCT = root.SCT || {});

  const FIELD = ".scEditorFieldMarker";
  const LABEL = ".scEditorFieldLabel";
  const FLD = /\bfld=(\{[0-9A-F-]{36}\})/i;
  const fields = new Map(); // db + field ID -> Promise of { name, path, tid, tname }
  const pages = new Map(); // the item's URI -> Promise of its Reset Fields page
  let serial = 0;
  // a clipboard, drawn as Item info's icons are
  const PASTE = '<svg viewBox="0 0 14 14" width="14" height="14" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="2.5" width="9" height="10" rx="1.5"/><path d="M5 2.5V1.5h4v1M5 6.5h4M5 9h2.5"/></svg>';

  const hex = (id) => id.replace(/[{}-]/g, "").toUpperCase();
  const guid = (h) => `{${h.replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, "$1-$2-$3-$4-$5")}}`;
  // a label's text without the buttons and links in it (ours, the Sitecore Extensions add-on's Go to field, Reset Field)
  const labelText = (el) => (el ? [...el.childNodes].filter((n) => !(n.nodeType === 1 && n.matches("a, button"))).map((n) => n.textContent).join("").replace(/\s+/g, " ").trim() : "");

  // the item in the editor: sitecore://master/{ID}?lang=en&ver=1
  function current(doc) {
    const uri = doc.getElementById("__CurrentItem")?.value || "";
    const m = /^sitecore:\/\/(\w+)\/(\{[^}]+\})\?lang=([^&]+)&ver=(\d+)/.exec(uri);
    return m && { uri, db: m[1], id: m[2], lang: m[3], ver: m[4] };
  }

  const resetUrl = (doc, item) => `${doc.location.origin}/sitecore/shell/default.aspx?${new URLSearchParams({ xmlcontrol: "ResetFields", id: item.id, la: item.lang, vs: item.ver, db: item.db })}`;
  const fetchPage = (url) => fetch(url, { credentials: "include" })
    .then((r) => (r.ok ? r.text() : Promise.reject(new Error(`Reset Fields ${r.status}`))))
    .then((html) => new DOMParser().parseFromString(html, "text/html"));

  function resetPage(doc, item) {
    if (!pages.has(item.uri)) {
      const ask = fetchPage(resetUrl(doc, item));
      ask.catch(() => pages.delete(item.uri));
      pages.set(item.uri, ask);
    }
    return pages.get(item.uri);
  }

  // Resets the field as the Reset Fields dialog's Reset does, without showing it (as the Sitecore Extensions add-on's
  // Reset Field does): a fresh copy of its page for its form state, then the form posted back with only this field ticked
  async function reset(doc, item, id) {
    const url = resetUrl(doc, item);
    const page = await fetchPage(url);
    const value = (name) => [...page.getElementsByName(name)].map((i) => i.value).find(Boolean) || "";
    if (!page.getElementById(`Reset_${hex(id)}`) || !value("__VIEWSTATE")) throw new Error("not the Reset Fields page");
    const body = new URLSearchParams({ __EVENTTARGET: "OK", __EVENTTYPE: "click", __CONTEXTMENU: "", __MODIFIED: "", __ISEVENT: "1", __CSRFTOKEN: value("__CSRFTOKEN"), __VIEWSTATE: value("__VIEWSTATE"), [`Reset_${hex(id)}`]: "1" });
    const r = await fetch(url, { method: "POST", credentials: "include", body });
    if (!r.ok) throw new Error(`Reset Fields ${r.status}`);
  }

  // the field's ID, or null
  async function fieldId(doc, item, marker) {
    const m = FLD.exec(marker.innerHTML);
    if (m) return m[1].toUpperCase();
    const want = labelText(marker.querySelector(LABEL));
    const page = await resetPage(doc, item);
    for (const box of page.querySelectorAll('input[id^="Reset_"]')) {
      if (labelText(box.closest(FIELD)?.querySelector(LABEL)) === want) return guid(box.id.slice("Reset_".length));
    }
    return null;
  }

  // the field's name and path, and its template (the field's section's parent), from the Item Service
  function fieldInfo(doc, db, id) {
    const key = `${db}|${id}`;
    if (!fields.has(key)) {
      const get = (x) => fetch(`${doc.location.origin}/sitecore/api/ssc/item/${x.replace(/[{}]/g, "")}?${new URLSearchParams({ database: db, fields: "ItemName,ItemPath,ParentID" })}`, { credentials: "include" })
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`Item Service ${r.status}`))));
      const ask = get(id).then(async (f) => {
        const section = await get(f.ParentID);
        const parts = f.ItemPath.split("/");
        return { name: f.ItemName, path: f.ItemPath, tid: `{${section.ParentID.toUpperCase()}}`, tname: parts[parts.length - 3] };
      });
      ask.catch(() => fields.delete(key));
      fields.set(key, ask);
    }
    return fields.get(key);
  }

  // the field's raw value as saved, its standard value when it has none of its own, from the Item Service
  const itemUrl = (doc, item, q = {}) => `${doc.location.origin}/sitecore/api/ssc/item/${item.id.replace(/[{}]/g, "")}?${new URLSearchParams({ database: item.db, language: item.lang, version: item.ver, ...q })}`;
  async function rawValue(doc, item, name) {
    const r = await fetch(itemUrl(doc, item, { includeStandardTemplateFields: "true", fields: name }), { credentials: "include" });
    const j = r.ok ? await r.json() : {};
    if (!(name in j)) throw new Error(`Item Service ${r.status}`);
    return j[name] ?? "";
  }
  async function writeRaw(doc, item, name, value) {
    const r = await fetch(itemUrl(doc, item), { method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ [name]: value }) });
    if (!r.ok) throw new Error(`Item Service ${r.status}`);
  }

  // A change that is saved at once takes a second press: not a double-click's, nor one after focus moved on or five
  // seconds passed. first(b, v) says what the next press does and returns true, or false to refuse; then(b, v) does it.
  function twice(first, then) {
    let armed = 0; // when the first press was; -1 while one runs
    return async (b, v) => {
      if (armed < 0 || (armed && Date.now() - armed < 400)) return;
      if (armed) {
        armed = -1;
        return then(b, v);
      }
      armed = -1;
      if (!(await first(b, v))) return (armed = 0);
      const at = (armed = Date.now());
      b.setAttribute("data-sct-armed", "");
      const disarm = () => {
        if (armed !== at) return;
        armed = 0;
        b.removeAttribute("data-sct-armed");
        v.textContent = "";
      };
      setTimeout(disarm, 5000);
      b.addEventListener("blur", disarm, { once: true });
    };
  }

  function open(ctx, button, marker, item) {
    const { doc } = ctx;
    const { menu, group, entry, copy, copied, icons } = SCT.itemMenu;
    const title = labelText(marker.querySelector(LABEL)).split(/ - |:/)[0].trim();
    const id = fieldId(doc, item, marker);
    const info = id.then((x) => (x ? fieldInfo(doc, item.db, x) : Promise.reject(new Error("no field ID"))));
    info.catch(() => {});
    const later = (fn) => () => {
      m.close();
      setTimeout(fn);
    };
    const m = menu(ctx, button, `Field ${title}`, (m) => {
      const add = (g, label, act, icon) => (entry(doc, g, label, "", act, 0, icon), g.lastElementChild.querySelector("sct-item-value"));
      // the item opens again after a change, to show it
      const saved = (done, said, failed) => {
        m.close(true);
        SCT.announce(doc, done ? said : failed);
        if (done) setTimeout(() => SCT.gotoItem(doc, item.uri));
      };
      const g = group(doc, m, title || "Field");
      const name = add(g, "Copy field name", async (b, v) => {
        const f = await info.catch(() => null);
        if (!f) return;
        await copy(doc, f.name);
        copied(doc, m, b, v);
      }, icons.copy);
      const raw = add(g, "Copy raw value", async (b, v) => {
        const text = await info.then((f) => rawValue(doc, item, f.name)).catch(() => null);
        if (text === null) return (v.textContent = "Could not read");
        await copy(doc, text);
        copied(doc, m, b, v);
      }, icons.copy);
      const field = add(g, "Navigate to field", later(() => id.then((x) => x && SCT.gotoItem(doc, x))), icons.field);
      const template = add(g, "Navigate to template", later(() => info.then((f) => SCT.gotoItem(doc, f.tid), () => {})), icons.template);
      // Field sizes' switch (field-sizes.js): the field's own height, or sized with the others of its type
      const size = SCT.fieldSize && SCT.fieldSize.fieldState(marker);
      if (size) add(g, size.own ? `Size with all ${size.type}` : "Give it its own height", () => (SCT.fieldSize.toggle(marker), m.close(true)), icons.reset);
      // apart from the rest under a rule, since they change the item, each saved at once
      const changes = group(doc, m, "");
      let clip = "";
      const paste = add(changes, "Paste raw value", twice(async (b, v) => {
        // the browser may first ask whether the site can see the clipboard
        v.textContent = "Reading the clipboard...";
        try {
          clip = await doc.defaultView.navigator.clipboard.readText();
        } catch {
          v.textContent = "Cannot read the clipboard";
          SCT.announce(doc, "Cannot read the clipboard");
          return false;
        }
        if (!clip) {
          v.textContent = "Clipboard is empty";
          SCT.announce(doc, "The clipboard is empty: nothing to paste");
          return false;
        }
        v.textContent = `Press again to paste ${clip.length} character${clip.length === 1 ? "" : "s"}`;
        b.title = clip.length > 300 ? `${clip.slice(0, 300)}...` : clip;
        SCT.announce(doc, "Press again to replace the field's value with the clipboard's. It is saved at once.");
        return true;
      }, async (b, v) => {
        v.textContent = "Pasting...";
        const done = await info.then((f) => writeRaw(doc, item, f.name, clip)).then(() => true, () => false);
        saved(done, "Pasted", "Could not paste into the field");
      }), PASTE);
      add(changes, "Reset to standard value", twice((b, v) => {
        v.textContent = "Press again to reset";
        SCT.announce(doc, "Press again to reset the field to its standard value. It is saved at once.");
        return true;
      }, async (b, v) => {
        v.textContent = "Resetting...";
        const done = await id.then((x) => x && reset(doc, item, x)).then(() => true, () => false);
        saved(done, "Reset to standard value", "Could not reset the field");
      }), icons.reset);
      // a placeholder bar in each value until the Item Service answers
      for (const v of [name, field, template]) v.dataset.loading = "";
      info.then((f) => {
        for (const [v, text, title] of [[name, f.name, f.name], [field, f.path.replace(/^\/sitecore\/templates\//i, ""), f.path], [template, f.tname, f.tname]]) {
          delete v.dataset.loading;
          v.textContent = text;
          v.parentNode.title = title;
        }
      }, () => {
        for (const v of [name, field, template]) delete v.dataset.loading;
        name.textContent = template.textContent = "Could not load";
        // without the field's name there is no raw value to read or write
        for (const v of [name, raw, template, paste]) v.parentNode.setAttribute("aria-disabled", "true");
      });
      m.querySelector('[role="menuitem"]').focus();
    });
  }

  function toggle(ctx, button, item) {
    if (button.getAttribute("aria-expanded") === "true") return ctx.doc.getElementById(button.getAttribute("aria-controls"))?.close();
    open(ctx, button, button.closest(FIELD), item);
  }

  SCT.registerAid("field-menu", {
    css: SCT.important(`[data-sct-field-menu]{all:unset;display:inline-flex;align-items:center;justify-content:center;box-sizing:border-box;width:16px;height:16px;margin:0 4px;vertical-align:middle;border-radius:3px;color:inherit;cursor:pointer;opacity:.4}
.scEditorFieldMarker:hover [data-sct-field-menu],[data-sct-field-menu]:focus-visible,[data-sct-field-menu][aria-expanded="true"]{opacity:1}
[data-sct-field-menu]:hover,[data-sct-field-menu][aria-expanded="true"]{background:color-mix(in srgb,currentColor 12%,transparent)}
[data-sct-field-menu]:focus-visible{outline:2px solid var(--sct-focus-ring,Highlight);outline-offset:1px}
sct-item-menu [data-sct-armed] sct-item-value{color:inherit;opacity:1;font-family:inherit;font-size:inherit;font-weight:600}`) + "\n" + (SCT.itemMenu ? SCT.itemMenu.css : ""),
    apply(ctx) {
      const { doc } = ctx;
      const item = current(doc);
      if (!item || !SCT.itemMenu) return;
      if (!doc.documentElement.hasAttribute("data-sct-field-menu-on")) {
        ctx.setAttr(doc.documentElement, "data-sct-field-menu-on", "");
        // Shift+F10 in a field opens its menu
        ctx.listen(doc, "keydown", (e) => {
          if (e.key !== "F10" || !e.shiftKey || e.ctrlKey || e.altKey) return;
          const b = e.target.closest && e.target.closest(FIELD)?.querySelector("[data-sct-field-menu]");
          if (!b) return;
          e.preventDefault();
          e.stopPropagation();
          toggle(ctx, b, current(doc));
        }, true);
      }
      for (const label of doc.querySelectorAll(`${FIELD} ${LABEL}`)) {
        if (label.querySelector("[data-sct-field-menu]")) continue;
        const b = ctx.own(doc.createElement("button"));
        b.type = "button";
        b.tabIndex = -1; // one more Tab stop per field is too many; Shift+F10 in the field reaches it
        b.setAttribute("data-sct-field-menu", "");
        b.setAttribute("aria-haspopup", "menu");
        b.setAttribute("aria-expanded", "false");
        b.setAttribute("aria-controls", `sct-field-menu-${++serial}`);
        b.setAttribute("aria-label", "Field menu");
        b.title = "Field menu (Shift+F10)";
        b.innerHTML = SCT.itemMenu.down;
        b.addEventListener("click", (e) => {
          e.stopPropagation(); // the label's own click stays out of it
          toggle(ctx, b, current(doc));
        });
        // after the label's text, before the links add-ons put in it
        label.insertBefore(b, [...label.children].find((c) => c.matches("a, button") && c !== b) || null);
      }
    },
    revert({ doc }) {
      for (const m of doc.querySelectorAll("sct-item-menu")) m.close();
    },
  });
})(globalThis);
