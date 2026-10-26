// The popup's "Imported themes" panel: a drop zone that is also the file picker, and the imported themes.
(function () {
  const api = globalThis.browser ?? globalThis.chrome;

  function el(tag, props = {}, children = []) {
    const node = Object.assign(document.createElement(tag), props);
    node.append(...children);
    return node;
  }

  const FILE_ICON = '<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M9.5 1.75H4.25a1 1 0 0 0-1 1v10.5a1 1 0 0 0 1 1h7.5a1 1 0 0 0 1-1V5zM9.5 1.75V5h3.25" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>';

  async function loadImported() {
    const { imported = {} } = await api.storage.local.get("imported");
    return imported;
  }

  async function save(theme) {
    const imported = await loadImported();
    imported[theme.id] = { name: theme.name, versions: theme.versions, usesTokens: theme.usesTokens, css: theme.css, importedAt: Date.now() };
    await api.storage.local.set({ imported });
  }

  // onChange: after an import or removal; onCount(n): the number of imported themes, on every redraw
  function mount(container, onChange, onCount) {
    const file = el("input", { type: "file", accept: ".css,text/css" });
    const drop = el("label", { className: "drop" });
    drop.innerHTML = `${FILE_ICON}<span class="idle">Drop a .css theme here or <b>choose a file</b></span><span class="over">Drop to import</span>`;
    drop.prepend(file);
    const status = el("p", { className: "status", role: "status" });
    const list = el("div");

    const say = (text, isError) => {
      status.textContent = text;
      status.classList.toggle("error", !!isError);
    };

    // Asks inline, because Firefox popups can't show confirm().
    const ask = (question) => new Promise((resolve) => {
      const yes = el("button", { type: "button", className: "text-button", textContent: "Replace" });
      const no = el("button", { type: "button", className: "text-button", textContent: "Cancel" });
      const row = el("div", { className: "row" }, [el("span", { className: "label", textContent: question }), no, yes]);
      yes.onclick = () => (row.remove(), resolve(true));
      no.onclick = () => (row.remove(), resolve(false));
      drop.after(row);
      yes.focus();
    });

    async function accept(text) {
      const r = await SCT.importTheme.parse(text);
      if (!r.ok) return say(r.error, true);
      const existing = (await loadImported())[r.theme.id];
      if (existing && !(await ask(`Replace "${existing.name}"?`))) return say("Import cancelled.");
      await save(r.theme);
      say(`Imported "${r.theme.name}".`);
      await renderList();
      onChange();
    }

    async function renderList() {
      const imported = Object.entries(await loadImported());
      list.replaceChildren(...imported.map(([id, t]) => {
        const remove = el("button", { type: "button", className: "text-button danger", textContent: "Remove" });
        remove.setAttribute("aria-label", `Remove ${t.name}`);
        remove.onclick = async () => {
          const all = await loadImported();
          delete all[id];
          await api.storage.local.set({ imported: all });
          say("");
          await renderList();
          onChange();
        };
        const label = el("span", { className: "label", textContent: t.name }, [el("small", { textContent: (t.versions || []).join(", ") })]);
        return el("div", { className: "row" }, [label, remove]);
      }));
      onCount(imported.length);
    }

    file.onchange = async () => {
      const f = file.files[0];
      if (f) accept(await f.text());
      file.value = "";
    };
    // a counter, because dragleave fires on every child the pointer crosses
    let depth = 0;
    const hover = (on) => drop.classList.toggle("dragging", on);
    drop.ondragenter = (e) => (e.preventDefault(), depth++, hover(true));
    drop.ondragover = (e) => e.preventDefault();
    drop.ondragleave = () => --depth || hover(false);
    drop.ondrop = async (e) => {
      e.preventDefault();
      depth = 0;
      hover(false);
      const f = e.dataTransfer.files[0];
      if (f) accept(await f.text());
    };

    container.append(drop, status, list);
    renderList();
  }

  globalThis.SCTImportUI = { mount };
})();
