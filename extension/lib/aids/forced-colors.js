// Forced colours: with Windows High Contrast on, the browser repaints every colour from the user's palette, which
// takes out what Sitecore and the themes show by background alone. Selections and active tabs get Highlight back,
// and the themes' glyphs (gradients and image-set() backgrounds, which forced colours drops, on empty elements) keep
// their own colours. Seen on the Content Editor under Native, Fjord and Chicago, 2026-10-28.
(function (root) {
  const SCT = (root.SCT = root.SCT || {});

  const SELECTED = [
    ".scContentTreeNodeActive", ".scRibbonNavigatorButtonsActive", ".scRibbonNavigatorButtonsContextualActive",
    ".scRibbonEditorTabActive", ".scTabActive", ".scMDITabActive", ".scFlatButtonActive", ".scOptionActive",
    ".scTreeitemSelected", ".scMenuPanelItemSelected", ".scCalendarSelected",
    '[role="tab"][aria-selected="true"]', '[role="treeitem"][aria-selected="true"]', '[role="option"][aria-selected="true"]',
  ].join(",");

  SCT.registerAid("forced-colors", {
    // ponytail: every empty element of a themed page keeps its colours, which also keeps an empty spacer's fill;
    // narrow it to the themes' glyph classes if one ever shows as a stray block
    css: `@media (forced-colors: active){
:root[data-sct-theme] :is(a,span,div,i,b,button,img,td):empty{forced-color-adjust:none}
:is(${SELECTED}){forced-color-adjust:none;background:Highlight!important;color:HighlightText!important}
:is(${SELECTED}) *{forced-color-adjust:none;color:HighlightText!important}
}`,
  });
})(globalThis);
