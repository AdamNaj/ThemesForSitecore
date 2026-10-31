// Command palette: Ctrl+Shift+Space, type, Enter. It lists every ribbon command of the page, the ones on other tabs
// too, by name and group ("Copy to · Operations"), and goes to an item by its path or ID through the tree's own search
// box. A command runs by clicking Sitecore's own button, found again by its name when it runs.
(function (root) {
  const SCT = (root.SCT = root.SCT || {});

  const STRIPS = ".scRibbonToolbarStrip, .scRibbonToolbarContextualStrip";
  const BUTTONS = 'a[href], [role="button"]';
  const MAX = 12;
  const clean = (s) => (s || "").replace(/\s+/g, " ").trim();
  const nameOf = (el) => clean(el.getAttribute("aria-label") || el.textContent || el.title || el.getAttribute("alt"));
  const groupOf = (el) => clean(el.closest(".chunk")?.querySelector(".caption")?.textContent);
  const contexts = new WeakMap();
  let serial = 0;

  // The Content Editor keeps every tab but the open one as a comment in a BLOCKQUOTE, and puts the HTML back when
  // its tab is clicked (setActiveStrip in Content Editor.js): the buttons of a closed tab are read from an inert
  // copy of that comment, and run after a click on the tab. A strip in an editor tab's ribbon that is not showing
  // belongs to another item, and is left out.
  function buttons(doc) {
    const out = [];
    for (const strip of doc.querySelectorAll(STRIPS)) {
      if (strip.closest(".scRibbon")?.style.display === "none") continue;
      const quote = strip.firstElementChild?.tagName === "BLOCKQUOTE" ? strip.firstElementChild : null;
      let scope = strip;
      let tab = null;
      if (quote) {
        tab = doc.getElementById(`${strip.id.split("_")[0]}_Nav_${strip.id.slice(strip.id.lastIndexOf("_") + 1)}`);
        if (!tab) continue;
        const copy = doc.createElement("template");
        copy.innerHTML = [...quote.childNodes].filter((n) => n.nodeType === 8).map((n) => n.data).join("");
        scope = copy.content;
      }
      for (const el of scope.querySelectorAll(BUTTONS)) out.push({ el, tab });
    }
    return out;
  }

  function commands(doc) {
    const seen = new Set();
    const out = [];
    for (const { el } of buttons(doc)) {
      if (el.closest("sct-dialog, [data-sct-quiet-hide], [data-sct-quiet-show]")) continue;
      const name = nameOf(el);
      const group = groupOf(el);
      const label = group && group !== name ? `${name} · ${group}` : name;
      if (!name || seen.has(label)) continue;
      seen.add(label);
      out.push({ label, name, group });
    }
    return out;
  }

  function run(doc, choice) {
    if (choice.goto) {
      const box = doc.getElementById("TreeSearch");
      if (!box) return;
      box.value = choice.goto;
      box.dispatchEvent(new Event("input", { bubbles: true }));
      (doc.querySelector(".scSearchButton") || box).click();
      return;
    }
    const find = () => buttons(doc).find(({ el }) => nameOf(el) === choice.name && groupOf(el) === choice.group);
    let found = find();
    if (found?.tab) {
      found.tab.click();
      found = find();
    }
    if (found && !found.tab) found.el.click();
  }

  function open(ctx) {
    const { doc } = ctx;
    const all = commands(doc);
    SCT.aidDialog(ctx, {
      label: "Commands",
      build(dialog, close) {
        const id = `sct-palette-${++serial}`;
        const input = doc.createElement("input");
        input.className = "scIgnoreModified"; // Sitecore's own: typing here does not mark the item changed
        input.setAttribute("role", "combobox");
        input.setAttribute("aria-label", "Command or item path");
        input.setAttribute("aria-expanded", "true");
        input.setAttribute("aria-controls", `${id}-list`);
        input.setAttribute("aria-autocomplete", "list");
        input.placeholder = all.length ? "Type a command, or an item path or ID" : "Type an item path or ID";
        const list = doc.createElement("div");
        list.id = `${id}-list`;
        list.setAttribute("role", "listbox");
        list.setAttribute("aria-label", "Commands");
        let shown = [];
        let at = 0;
        function draw() {
          const q = clean(input.value).toLowerCase();
          const words = q.split(" ").filter(Boolean);
          shown = all.filter((c) => words.every((w) => c.label.toLowerCase().includes(w))).slice(0, MAX);
          if (/^[/{]/.test(q)) shown.unshift({ label: `Go to ${clean(input.value)}`, goto: clean(input.value) });
          at = Math.min(at, Math.max(shown.length - 1, 0));
          list.replaceChildren(...shown.map((c, i) => {
            const o = doc.createElement("div");
            o.id = `${id}-${i}`;
            o.setAttribute("role", "option");
            o.setAttribute("aria-selected", String(i === at));
            o.textContent = c.label;
            o.addEventListener("mousedown", (e) => (e.preventDefault(), choose(i)));
            return o;
          }));
          if (!shown.length) list.textContent = all.length ? "Nothing matches" : "No commands on this page";
          if (shown.length) input.setAttribute("aria-activedescendant", `${id}-${at}`);
          else input.removeAttribute("aria-activedescendant");
        }
        // after the key that chose it has finished: Sitecore's own Enter handler must not see it and post again
        function choose(i) {
          const c = shown[i];
          if (!c) return;
          close();
          setTimeout(() => run(doc, c));
        }
        input.addEventListener("input", () => ((at = 0), draw()));
        // the palette's own keys stay in the palette
        input.addEventListener("keydown", (e) => {
          if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter") e.stopPropagation();
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            if (shown.length) at = (at + (e.key === "ArrowDown" ? 1 : -1) + shown.length) % shown.length;
            draw();
          } else if (e.key === "Enter") {
            e.preventDefault();
            choose(at);
          }
        });
        dialog.append(input, list);
        draw();
      },
    });
  }

  function onKey(e) {
    if (e.defaultPrevented || e.code !== "Space" || !e.ctrlKey || !e.shiftKey || e.altKey || e.metaKey) return;
    const ctx = contexts.get(e.target.ownerDocument || e.target);
    if (!ctx) return;
    e.preventDefault();
    open(ctx);
  }

  SCT.registerAid("command-palette", {
    css: `${SCT.aidDialogCss}
${SCT.important(`sct-dialog [role="listbox"]{margin-top:8px}
sct-dialog [role="option"]{padding:6px 10px;border-radius:4px;cursor:pointer}
sct-dialog [role="option"][aria-selected="true"]{background:var(--sct-accent,Highlight);color:var(--sct-accent-fg,HighlightText)}`)}`,
    apply(ctx) {
      if (!contexts.has(ctx.doc)) ctx.listen(ctx.doc, "keydown", onKey);
      contexts.set(ctx.doc, ctx);
    },
    revert(ctx) {
      contexts.delete(ctx.doc);
    },
  });
})(globalThis);
