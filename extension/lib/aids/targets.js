// Targets: the 16px icons Sitecore makes clickable (tree expanders, section and drop-down arrows, window buttons) hit
// at 24px (WCAG 2.5.8) without moving anything: 4px of padding, taken back with -4px of margin, the drawing kept to
// the content box. Helps tremor as much as low vision.
// ponytail: the ribbon's small buttons are 20px rows in a fixed-height ribbon; growing them means a new ribbon layout
(function (root) {
  const SCT = (root.SCT = root.SCT || {});

  const ICONS = [
    ".scContentTreeNodeGlyph", ".scEditorSectionCaptionGlyph", ".scComboboxDropDown", "img.scRibbonPanelOpen",
    "img.scWindowManagementButton", ".scSearchOptionsButton",
  ].join(",");

  SCT.registerAid("targets", {
    css: `:is(${ICONS}){box-sizing:content-box!important;padding:4px!important;margin:-4px!important;background-clip:content-box!important;background-origin:content-box!important}`,
  });
})(globalThis);
