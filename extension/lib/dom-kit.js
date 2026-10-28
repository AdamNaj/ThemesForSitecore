// Records every DOM change a theme makes so the engine can undo all of it.
(function (root) {
  const SCT = (root.SCT = root.SCT || {});
  const OWNED = "data-sct-owned";

  function createDomKit(doc) {
    // ponytail: the undo log only grows; nodes Sheer UI throws away leave stale no-op entries.
    // Prune disconnected entries here if a long session ever shows it in a heap profile.
    const undo = [];
    const attrsSeen = new Map();
    const moved = new Set();

    function own(el) {
      el.setAttribute(OWNED, "");
      undo.push(() => el.remove());
      return el;
    }

    function addClass(el, cls) {
      if (!/^sct-/.test(cls)) throw new Error(`Theme classes must start with "sct-": ${cls}`);
      if (el.classList.contains(cls)) return;
      el.classList.add(cls);
      undo.push(() => el.classList.remove(cls));
    }

    function setAttr(el, name, value) {
      let seen = attrsSeen.get(el);
      if (!seen) attrsSeen.set(el, (seen = new Set()));
      if (!seen.has(name)) {
        seen.add(name);
        const had = el.hasAttribute(name);
        const old = el.getAttribute(name);
        undo.push(() => (had ? el.setAttribute(name, old) : el.removeAttribute(name)));
      }
      if (value === null) el.removeAttribute(name); // null takes the attribute out
      else el.setAttribute(name, value);
    }

    function move(node, parent, before) {
      if (!moved.has(node)) {
        moved.add(node);
        const home = node.parentNode;
        const next = node.nextSibling;
        undo.push(() => {
          if (!home || !home.isConnected) return;
          home.insertBefore(node, next && next.parentNode === home ? next : null);
        });
      }
      parent.insertBefore(node, before || null);
    }

    function listen(target, type, fn, options) {
      target.addEventListener(type, fn, options);
      undo.push(() => target.removeEventListener(type, fn, options));
    }

    function revertAll() {
      while (undo.length) {
        try {
          undo.pop()();
        } catch {
          // a node Sitecore already replaced; nothing left to undo
        }
      }
      attrsSeen.clear();
      moved.clear();
    }

    function isOwned(node) {
      for (let n = node; n && n !== doc; n = n.parentNode) {
        if (n.nodeType === 1 && n.hasAttribute(OWNED)) return true;
      }
      return false;
    }

    return { own, addClass, setAttr, move, listen, revertAll, isOwned };
  }

  SCT.createDomKit = createDomKit;

  // Theme dom.js files call this; content.js loads after them and starts the engine.
  SCT.domModules = SCT.domModules || {};
  SCT.registerTheme = (id, mod) => {
    SCT.domModules[id] = mod;
  };
  // and lib/aids/<id>.js this, for the accessibility aids the engine runs under every theme
  SCT.aidModules = SCT.aidModules || {};
  SCT.registerAid = (id, mod) => {
    SCT.aidModules[id] = mod;
  };
  // An aid's words for a screen reader, from any frame: into the top document's live region (lib/aids/announcer.js)
  // when it is there. The same words again are cleared first, so they are said again.
  SCT.announce = (doc, text) => {
    let region = null;
    try {
      region = doc.defaultView && doc.defaultView.top.document.querySelector("sct-announce");
    } catch {
      return; // a cross-origin top
    }
    if (!region || !text) return;
    if (region.textContent !== text) region.textContent = text;
    else {
      region.textContent = "";
      setTimeout(() => (region.textContent = text), 100);
    }
  };
  // An aid's dialog (the command palette, the shortcuts): owned, modal and named; build(dialog, close) fills it. Focus
  // goes in, stays in on Tab, and goes back where it was when Escape or a click outside closes it. Asked again while
  // one is open, the open one takes focus. Its look is SCT.aidDialogCss, in the CSS of each aid that uses it.
  SCT.aidDialog = (ctx, { label, build }) => {
    const { doc } = ctx;
    const FOCUSABLE = 'input, button, [tabindex]:not([tabindex="-1"])';
    const open = doc.querySelector("sct-dialog");
    if (open) return (open.querySelector(FOCUSABLE) || open).focus();
    const back = doc.activeElement;
    const dialog = ctx.own(doc.createElement("sct-dialog"));
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("aria-label", label);
    dialog.tabIndex = -1;
    const outside = (e) => !dialog.contains(e.target) && close();
    function close() {
      if (!dialog.isConnected) return;
      dialog.remove();
      doc.removeEventListener("mousedown", outside, true);
      if (back && back.isConnected && back !== doc.body) back.focus();
    }
    dialog.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        close();
      } else if (e.key === "Tab") {
        const all = [...dialog.querySelectorAll(FOCUSABLE)];
        const i = all.indexOf(doc.activeElement);
        e.preventDefault();
        if (all.length) all[(i + (e.shiftKey ? -1 : 1) + all.length) % all.length].focus();
      }
    });
    doc.addEventListener("mousedown", outside, true);
    build(dialog, close);
    doc.body.append(dialog);
    (dialog.querySelector(FOCUSABLE) || dialog).focus();
  };
  SCT.aidDialogCss = `sct-dialog{position:fixed;z-index:2147483647;top:12vh;left:50%;transform:translateX(-50%);width:min(560px,92vw);max-height:70vh;overflow:auto;box-sizing:border-box;padding:12px;border:1px solid var(--sct-border,CanvasText);border-radius:8px;background:var(--sct-panel-bg,Canvas);color:var(--sct-panel-fg,CanvasText);font:14px/1.45 system-ui,sans-serif;box-shadow:0 12px 40px rgba(0,0,0,.35);text-align:start}
sct-dialog h2{margin:0 0 8px;font-size:15px}
sct-dialog input{box-sizing:border-box;width:100%;padding:8px 10px;border:1px solid var(--sct-input-border,CanvasText);border-radius:6px;background:var(--sct-input-bg,Field);color:var(--sct-input-fg,FieldText);font:inherit}`;
  if (typeof module !== "undefined") module.exports = createDomKit;
})(globalThis);
