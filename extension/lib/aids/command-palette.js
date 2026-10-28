// Command palette: Ctrl+Shift+Space, type, Enter. It lists every ribbon command of the page, the ones on other tabs
// too, by name and group ("Copy to · Operations"), and goes to an item by its path or ID through the tree's own search
// box. A command runs by clicking Sitecore's own button, found again by its name when it runs.
(function (root) {
  const SCT = (root.SCT = root.SCT || {});

  const BUTTONS = '.scRibbonToolbarStrip a[href], .scRibbonToolbarStrip [role="button"]';
  const MAX = 12;
  const clean = (s) => (s || "").replace(/\s+/g, " ").trim();
  const nameOf = (el) => clean(el.getAttribute("aria-label") || el.textContent || el.title || el.getAttribute("alt"));
  const contexts = new WeakMap();
  let serial = 0;

  function commands(doc) {
    const seen = new Set();
    const out = [];
    for (const el of doc.querySelectorAll(BUTTONS)) {
      if (el.closest("sct-dialog, [data-sct-quiet-hide], [data-sct-quiet-show]")) continue;
      const name = nameOf(el);
      const group = clean(el.closest(".chunk")?.querySelector(".caption")?.textContent);
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
    const button = [...doc.querySelectorAll(BUTTONS)].find((el) => nameOf(el) === choice.name
      && clean(el.closest(".chunk")?.querySelector(".caption")?.textContent) === choice.group);
    if (button) button.click();
  }

  function open(ctx) {
    const { doc } = ctx;
    const all = commands(doc);
    SCT.aidDialog(ctx, {
      label: "Commands",
      build(dialog, close) {
        const id = `sct-palette-${++serial}`;
        const input = doc.createElement("input");
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
        function choose(i) {
          const c = shown[i];
          if (!c) return;
          close();
          run(doc, c);
        }
        input.addEventListener("input", () => ((at = 0), draw()));
        input.addEventListener("keydown", (e) => {
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
sct-dialog [role="listbox"]{margin-top:8px}
sct-dialog [role="option"]{padding:6px 10px;border-radius:4px;cursor:pointer}
sct-dialog [role="option"][aria-selected="true"]{background:var(--sct-selected-bg,Highlight);color:var(--sct-selected-fg,HighlightText)}`,
    apply(ctx) {
      if (!contexts.has(ctx.doc)) ctx.listen(ctx.doc, "keydown", onKey);
      contexts.set(ctx.doc, ctx);
    },
    revert(ctx) {
      contexts.delete(ctx.doc);
    },
  });
})(globalThis);
