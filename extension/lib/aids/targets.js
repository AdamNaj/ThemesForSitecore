// Targets: the 14 to 16px icons Sitecore makes clickable (tree expanders, section and drop-down arrows, window
// buttons) hit at 24px or more (WCAG 2.5.8) without moving anything: 5px of padding, taken back with -5px of margin,
// the drawing kept to the content box. Helps tremor as much as low vision.
// ponytail: the ribbon's small buttons are 20px rows in a fixed-height ribbon; growing them means a new ribbon layout
(function (root) {
  const SCT = (root.SCT = root.SCT || {});

  const ICONS = [
    ".scContentTreeNodeGlyph", ".scEditorSectionCaptionGlyph", ".scComboboxDropDown", "img.scRibbonPanelOpen",
    "img.scWindowManagementButton", ".scSearchOptionsButton",
  ].join(",");

  SCT.registerAid("targets", {
    css: `:is(${ICONS}){box-sizing:content-box!important;padding:5px!important;margin:-5px!important;background-clip:content-box!important;background-origin:content-box!important}`,
  });
})(globalThis);
