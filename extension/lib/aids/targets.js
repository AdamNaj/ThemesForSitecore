// Targets: the 14 to 16px icons Sitecore makes clickable (tree expanders, section and drop-down arrows, window
// buttons) hit at 24px or more (WCAG 2.5.8) without changing a single box: a click on bare background within 5px of
// one is passed on to it. Growing the icons with padding and negative margin took the place of each theme's own
// margin and padding (an aid's layered !important beats the theme's), which crowded the tree and the window buttons.
// Helps tremor as much as low vision.
// ponytail: no pointer cursor in the 5px ring; a pointermove hit test would give one
(function (root) {
  const SCT = (root.SCT = root.SCT || {});

  const ICONS = [
    ".scContentTreeNodeGlyph", ".scEditorSectionCaptionGlyph", ".scComboboxDropDown", "img.scRibbonPanelOpen",
    "img.scWindowManagementButton", ".scSearchOptionsButton",
  ].join(",");
  // a click on any of these is its own, never a near miss
  const OWN = `${ICONS},a,button,input,select,textarea,label,img,[role=button],[onclick]`;
  const REACH = 5;
  const AROUND = [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]];
  const heard = new WeakSet(); // documents with the click handler

  function onClick(e) {
    const t = e.target;
    if (!e.isTrusted || e.button !== 0 || !t.matches || t.matches(OWN) || t.closest("a,button")) return;
    const doc = t.ownerDocument;
    for (const [dx, dy] of AROUND) {
      const hit = doc.elementFromPoint(e.clientX + dx * REACH, e.clientY + dy * REACH);
      const icon = hit && hit.closest && hit.closest(ICONS);
      if (!icon) continue;
      e.preventDefault();
      e.stopImmediatePropagation();
      const { clientX, clientY, screenX, screenY, ctrlKey, shiftKey, altKey, metaKey } = e;
      icon.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: doc.defaultView, detail: 1,
        clientX, clientY, screenX, screenY, ctrlKey, shiftKey, altKey, metaKey }));
      return;
    }
  }

  SCT.registerAid("targets", {
    apply(ctx) {
      if (heard.has(ctx.doc)) return;
      heard.add(ctx.doc);
      ctx.listen(ctx.doc, "click", onClick, true);
    },
    revert(ctx) {
      heard.delete(ctx.doc);
    },
  });
})(globalThis);
