// Locked fields: a field you cannot edit (an item someone else has locked, no write access, a protected item) looks
// much like one you can, a shade greyer. Its control gets a padlock on its right and a faint hatch, and the warning
// over a locked item the same hatch. The hatch is the control's own text colour, the padlock a mid grey that shows on
// light and dark fields alike.
(function (root) {
  const SCT = (root.SCT = root.SCT || {});

  const HATCH = "repeating-linear-gradient(135deg,transparent 0 5px,color-mix(in srgb,currentColor 9%,transparent) 5px 10px)";

  SCT.registerAid("locked-fields", {
    // background-image only, so the theme's background colour stays
    css: SCT.important(`.scEditorSections :is(input.scContentControl,textarea.scContentControl):is([readonly],:disabled){background-image:url(sct-ext:glyphs/lock.svg),${HATCH};background-repeat:no-repeat,repeat;background-position:right 10px center,0 0;background-size:12px 14px,auto;padding-right:30px}
.scEditorWarning{background-image:${HATCH}}`),
  });
})(globalThis);
