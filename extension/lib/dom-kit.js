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
  if (typeof module !== "undefined") module.exports = createDomKit;
})(globalThis);
