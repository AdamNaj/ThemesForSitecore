// Fields: each Content Editor field's control is described by its label (which carries the field's help, "Title -
// Please enter..."; Sitecore names the control "Title field" only), and by Sitecore's validation message while its
// marker shows one. A red marker (an error) makes the control aria-invalid. Sitecore's updateFieldMarkers sets the
// marker's class and title each time it validates, after rendering its validator panel again, which brings a pass.
(function (root) {
  const SCT = (root.SCT = root.SCT || {});

  const CONTROL = 'input:not([type="hidden"]), select, textarea, iframe, [contenteditable="true"]';
  const own = new WeakMap(); // control -> the description it had before this aid, which stays first

  SCT.registerAid("fields", {
    apply(ctx) {
      const { doc, setAttr } = ctx;
      for (const cell of doc.querySelectorAll(".scEditorFieldMarkerInputCell")) {
        const label = cell.querySelector(".scEditorFieldLabel");
        const control = cell.querySelector(CONTROL);
        if (!label || !control || !control.id) continue;
        if (!label.id) setAttr(label, "id", `sct-label-${control.id}`);
        const marker = doc.getElementById(`FieldMarker${control.id}`);
        const state = marker && (/BarCell(Red|Yellow)$/.exec(marker.className) || [])[1];
        const message = state && marker.title.trim();
        if (marker && (marker.getAttribute("aria-label") || null) !== (message || null)) setAttr(marker, "aria-label", message || null);
        if (!own.has(control)) own.set(control, control.getAttribute("aria-describedby") || "");
        const describedby = [own.get(control), label.id, message && marker.id].filter(Boolean).join(" ");
        if (control.getAttribute("aria-describedby") !== describedby) setAttr(control, "aria-describedby", describedby);
        const invalid = state === "Red" ? "true" : null;
        if (control.getAttribute("aria-invalid") !== invalid) setAttr(control, "aria-invalid", invalid);
      }
    },
  });
})(globalThis);
