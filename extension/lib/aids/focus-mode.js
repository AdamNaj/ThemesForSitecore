// Focus mode: while a Content Editor field has focus (a rich text field's frame too), the editor's other fields, its
// section captions, the ribbon and the content tree fade back, so the one being edited stands out; the tree's selected
// item stays sharp, so you still see where you are. Nothing moves and nothing is hidden.
// A focus listener marks <html>, not :has(): a :has(:focus-within) on the page made every element Sitecore (or an add-on
// such as Sitecore Extensions) inserted restyle the whole document, 0.3 to 16ms a time, seconds per item opened.
(function (root) {
  const SCT = (root.SCT = root.SCT || {});

  const ON = "data-sct-editing";
  const EDITING = `[${ON}]`;
  const heard = new WeakSet(); // documents with the focus listeners

  // after the move: activeElement is the field, or the rich text field's frame
  function sync(doc) {
    const el = doc.activeElement;
    doc.documentElement.toggleAttribute(ON, !!(el && el.closest && el.closest(".scEditorFieldMarker")));
  }

  SCT.registerAid("focus-mode", {
    css: `${EDITING} :is(.scEditorFieldMarker:not(:focus-within),.scEditorSectionCaptionExpanded,.scEditorSectionCaptionCollapsed,#RibbonPanel,#SearchPanel,#ContentTreePanel :is(.scContentTreeNodeGlyph,.scContentTreeNodeGutter,.scContentTreeNode>a:not(.scContentTreeNodeActive))){opacity:.35}`,
    apply(ctx) {
      const { doc } = ctx;
      if (heard.has(doc)) return;
      heard.add(doc);
      const later = () => setTimeout(() => sync(doc));
      ctx.listen(doc, "focusin", later);
      ctx.listen(doc, "focusout", later);
      ctx.listen(doc.defaultView, "blur", later); // focus went into a frame
      sync(doc);
    },
    revert(ctx) {
      heard.delete(ctx.doc);
      ctx.doc.documentElement.removeAttribute(ON);
    },
  });
})(globalThis);
