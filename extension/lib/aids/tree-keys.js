// Tree keys: typing letters in the content tree moves to the next visible item that starts with them, as in any
// tree. Sitecore already has the arrows, Home, End, Space and Delete, Enter opens a node (it is a link), and Shift+F10
// opens its context menu; this is the one tree key it lacks.
(function (root) {
  const SCT = (root.SCT = root.SCT || {});

  const NODE = '.scContentTree a[id^="Tree_Node_"]';
  const PAUSE = 700; // ms after which typing starts a new search
  const listening = new WeakSet();
  let typed = "";
  let at = 0;

  function onKey(e) {
    if (e.defaultPrevented || e.ctrlKey || e.altKey || e.metaKey || e.key.length !== 1 || e.key === " ") return;
    const node = e.target.closest && e.target.closest(NODE);
    if (!node) return;
    typed = e.timeStamp - at > PAUSE ? e.key : typed + e.key;
    at = e.timeStamp;
    const tree = node.closest(".scContentTree");
    const nodes = [...tree.querySelectorAll(NODE)].filter((a) => a.getClientRects().length);
    const start = nodes.indexOf(node);
    // a single letter moves on from the focused item; more letters may stay on it
    const from = typed.length > 1 ? start : start + 1;
    const order = [...nodes.slice(from), ...nodes.slice(0, from)];
    const match = order.find((a) => a.textContent.trim().toLowerCase().startsWith(typed.toLowerCase()));
    if (!match) return;
    e.preventDefault();
    match.focus();
  }

  SCT.registerAid("tree-keys", {
    apply(ctx) {
      if (listening.has(ctx.doc)) return;
      listening.add(ctx.doc);
      ctx.listen(ctx.doc, "keydown", onKey);
    },
    revert(ctx) {
      listening.delete(ctx.doc);
    },
  });
})(globalThis);
