// Errors in shapes: Sitecore tells a field's validation by colour alone, red or yellow on the bar beside the field and
// on the squares of the Validator Bar and the validation dialog. Each state gets a shape as well: the bar becomes a
// column of crosses (an error) or a wave (a warning), the control a solid or a dashed outline, the label a triangle or
// a dotted ring, and the squares a triangle, a dotted ring, a tick and a plain ring. Message bars get a solid or a
// dashed edge. The colours are surfaces/shell.css's markers, 3:1 on the field area under every theme; under Native,
// Sitecore's red as it is (4.9:1 on its grey) and its amber mixed with black (its own is 1.5:1). Every bar is 14px wide, so a field does not move when it validates.
(function (root) {
  const SCT = (root.SCT = root.SCT || {});

  const ERROR = "var(--sct-error-marker,color-mix(in srgb,#ce130a 60%,var(--sct-panel-fg,#ce130a)))";
  const WARNING = "var(--sct-warning-marker,color-mix(in srgb,#fbc200 60%,var(--sct-panel-fg,#000)))";
  const VALID = "color-mix(in srgb,#008000 60%,var(--sct-panel-fg,#000))";
  const PENDING = "color-mix(in srgb,var(--sct-panel-fg,#000) 50%,transparent)";
  const marked = (state) => `.scEditorFieldMarker:has(>tbody>tr>.scEditorFieldMarkerBarCell${state})`;
  const square = (colour) => `img[src*="bullet_square_${colour}" i]`;

  SCT.registerAid("state-shapes", {
    // the label's glyph floats to the start of its ::after, which leaves its ::before to Errors in words; important,
    // as the aids' layer sits under Sitecore's and the themes' stylesheets
    css: SCT.important(`td:is(.scEditorFieldMarkerBarCell,.scEditorFieldMarkerBarCellGrey,.scEditorFieldMarkerBarCellRed,.scEditorFieldMarkerBarCellYellow){width:14px;min-width:14px;border-left-width:0}
td.scEditorFieldMarkerBarCellGrey{box-shadow:inset 5px 0 var(--sct-border,#d9d9d9)}
td.scEditorFieldMarkerBarCellRed{background:${ERROR};mask:url(sct-ext:glyphs/gutter-error.svg) top left/8px 8px repeat-y}
td.scEditorFieldMarkerBarCellYellow{background:${WARNING};mask:url(sct-ext:glyphs/gutter-warning.svg) top left/8px 12px repeat-y}
${marked("Red")} .scEditorFieldMarkerInputCell>div:not(.scEditorFieldLabel,.scContentButtons){outline:2px solid ${ERROR};outline-offset:2px;border-radius:6px}
${marked("Yellow")} .scEditorFieldMarkerInputCell>div:not(.scEditorFieldLabel,.scContentButtons){outline:2px dashed ${WARNING};outline-offset:2px;border-radius:6px}
:is(${marked("Red")},${marked("Yellow")}) .scEditorFieldLabel{font-weight:700}
:is(${marked("Red")},${marked("Yellow")}) .scEditorFieldLabel::after{content:"";float:left;width:14px;height:14px;margin:1px 6px 0 0}
${marked("Red")} .scEditorFieldLabel::after{background:${ERROR};mask:url(sct-ext:glyphs/state-error.svg) center/14px 14px no-repeat}
${marked("Yellow")} .scEditorFieldLabel::after{background:${WARNING};mask:url(sct-ext:glyphs/state-warning.svg) center/14px 14px no-repeat}
:is(${square("red")},${square("yellow")},${square("green")},${square("grey")}){object-fit:none;object-position:-999px -999px;background:${ERROR};mask:url(sct-ext:glyphs/state-error.svg) center/14px 14px no-repeat}
${square("yellow")}{background:${WARNING};mask-image:url(sct-ext:glyphs/state-warning.svg)}
${square("green")}{background:${VALID};mask-image:url(sct-ext:glyphs/state-valid.svg)}
${square("grey")}{background:${PENDING};mask-image:url(sct-ext:glyphs/state-pending.svg)}
.scMessageBar.scError{box-shadow:inset 4px 0 0 ${ERROR}}
.scMessageBar.scWarning{border-left:4px dashed ${WARNING}}`),
  });
})(globalThis);
