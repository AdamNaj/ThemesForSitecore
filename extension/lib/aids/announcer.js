// Announcer: one polite live region in the top document, and what Sitecore shows without saying: the item that opened
// (its name, language and version), its warnings (locked, in workflow, no rights), a validation message, and that an
// item saved. Other aids speak through it with SCT.announce (dom-kit.js). Nothing is said on load, nor twice.
(function (root) {
  const SCT = (root.SCT = root.SCT || {});

  const states = new WeakMap(); // document -> what was last said about it
  const text = (el) => (el ? el.textContent.replace(/\s+/g, " ").trim() : "");

  function read(doc) {
    const name = text(doc.querySelector(".scEditorHeaderTitle"));
    const language = text(doc.querySelector(".scEditorHeaderVersionsLanguage"));
    const version = text(doc.querySelector(".scEditorHeaderVersionsVersion"));
    const icon = doc.querySelector(".scValidationResultIcon");
    return {
      name,
      item: name && [name, language, version && `version ${version}`].filter(Boolean).join(", "),
      warning: [...doc.querySelectorAll(".scEditorWarning")].map((w) =>
        [text(w.querySelector(".scEditorWarningTitle")), text(w.querySelector(".scEditorWarningText"))].filter(Boolean).join(" ")).join(" "),
      validation: icon ? icon.alt : "",
      panel: doc.querySelector(".scValidatorPanel"),
    };
  }

  // Ctrl+S, or Sitecore's Save button: watched before Sitecore's own handlers, which stop the key there
  function saving(e) {
    const doc = e.target.ownerDocument || e.target;
    const state = states.get(doc);
    if (!state) return;
    const save = e.type === "keydown"
      ? (e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === "s"
      : !!(e.target.closest && e.target.closest('a[aria-label="Save"], [title^="Save (Ctrl+S)"]'));
    if (save) state.saving = true;
  }

  SCT.registerAid("announcer", {
    css: "sct-announce{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}",
    apply(ctx) {
      const { doc } = ctx;
      if (ctx.top && doc.body && !doc.querySelector("sct-announce")) {
        const region = ctx.own(doc.createElement("sct-announce"));
        region.setAttribute("role", "status");
        region.setAttribute("aria-live", "polite");
        doc.body.append(region);
      }
      const now = read(doc);
      const was = states.get(doc);
      if (!was) {
        states.set(doc, { ...now, saving: false });
        ctx.listen(doc.defaultView, "keydown", saving, true);
        ctx.listen(doc.defaultView, "click", saving, true);
        return; // nothing on load
      }
      const say = [];
      if (now.item && now.item !== was.item) say.push(now.item);
      if (now.warning && now.warning !== was.warning) say.push(now.warning);
      if (now.validation && now.validation !== was.validation && !/no errors/i.test(now.validation)) say.push(now.validation);
      if (was.saving && now.panel && now.panel !== was.panel) {
        say.push(`Saved ${now.name}`);
        was.saving = false;
      }
      Object.assign(was, now);
      if (say.length) SCT.announce(doc, say.join(". "));
    },
    revert(ctx) {
      states.delete(ctx.doc);
    },
  });
})(globalThis);
