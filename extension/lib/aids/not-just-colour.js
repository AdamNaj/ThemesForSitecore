// Not just colour: Sitecore shows a field's validation as a red or yellow bar beside it and nothing else. The field's
// label says it in words too, "Error: " or "Warning: ", so the state does not hang on telling red from yellow.
(function (root) {
  const SCT = (root.SCT = root.SCT || {});

  const LABEL = (state) => `.scEditorFieldMarker:has(> tbody > tr > .scEditorFieldMarkerBarCell${state}) .scEditorFieldLabel::before`;

  SCT.registerAid("not-just-colour", {
    css: `${LABEL("Red")}{content:"Error: ";font-weight:700}
${LABEL("Yellow")}{content:"Warning: ";font-weight:700}`,
  });
})(globalThis);
