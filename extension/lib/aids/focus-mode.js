// Focus mode: while a Content Editor field has focus (a rich text field's frame too), the editor's other fields and
// its section captions fade back, so the one being edited stands out. Nothing moves and nothing is hidden.
(function (root) {
  const SCT = (root.SCT = root.SCT || {});

  const EDITING = ".scEditorPanel:has(.scEditorFieldMarker:focus-within)";

  SCT.registerAid("focus-mode", {
    css: `${EDITING} .scEditorFieldMarker:not(:focus-within),${EDITING} :is(.scEditorSectionCaptionExpanded,.scEditorSectionCaptionCollapsed){opacity:.35}`,
  });
})(globalThis);
