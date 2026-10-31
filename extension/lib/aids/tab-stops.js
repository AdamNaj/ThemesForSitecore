// Tab stops: Tab stops only on what you act on. Out of the Tab order (the mouse works as before): Sitecore's dialog
// frame while no dialog shows (it lies behind the page, empty, and a screen reader calls it "Dialog"), the splitter
// between the tree and the editor, the content tree's gutter icons, the links in a field's label (a checkbox's label
// is one, so each checkbox took two stops; add-ons put theirs there too), and a drop-down's arrow beside its box, which
// Down already opens. Enter on the editor's active tab (Content) moves to the item's first field, past the editor's
// header buttons and Quick Info; Shift+Tab goes back through them.
(function (root) {
  const SCT = (root.SCT = root.SCT || {});

  const OUT = ".splitter-bar > a, .scContentTreeNodeGutter :is(a, img, [tabindex]), .scEditorFieldLabel a";
  const CONTROL = 'input:not([type="hidden"]), select, textarea, iframe, [contenteditable="true"], [tabindex="0"]';
  const shown = (el) => el.getClientRects().length > 0;

  const watchers = new Map(); // dialog frame -> the observer of its style
  const listening = new WeakSet();

  // the dialog frame sits at z-index -1 until Sitecore brings a dialog up in it
  function syncDialogFrame(ctx, frame) {
    const idle = frame.style.zIndex === "-1";
    if ((frame.getAttribute("tabindex") === "-1") !== idle) ctx.setAttr(frame, "tabindex", idle ? "-1" : null);
    if (frame.hasAttribute("aria-hidden") !== idle) ctx.setAttr(frame, "aria-hidden", idle ? "true" : null);
  }

  // the first field's control in the editor, else the first section's caption to open
  function firstField(doc) {
    for (const cell of doc.querySelectorAll("#ContentEditor .scEditorFieldMarkerInputCell")) {
      const control = [...cell.querySelectorAll(CONTROL)].find((el) => el.tabIndex >= 0 && !el.closest(".scEditorFieldLabel") && shown(el));
      if (control) return control;
    }
    return [...doc.querySelectorAll("#ContentEditor .scEditorSectionCaptionGlyph")].find((g) => !g.id.startsWith("QuickInfo_") && shown(g));
  }

  function onKey(e) {
    if (e.key !== "Enter" || e.defaultPrevented || e.ctrlKey || e.altKey || e.shiftKey || e.metaKey) return;
    if (!e.target.matches || !e.target.matches("#EditorTabs > a.scRibbonEditorTabActive")) return;
    const to = firstField(e.target.ownerDocument);
    if (!to) return;
    e.preventDefault();
    e.stopPropagation();
    to.focus();
  }

  SCT.registerAid("tab-stops", {
    apply(ctx) {
      const { doc, setAttr } = ctx;
      for (const el of doc.querySelectorAll(OUT)) if (el.getAttribute("tabindex") !== "-1") setAttr(el, "tabindex", "-1");
      for (const arrow of doc.querySelectorAll("img.scComboboxDropDown:not([tabindex='-1'])")) {
        if (arrow.closest("tr")?.querySelector('input[role="combobox"]')) setAttr(arrow, "tabindex", "-1");
      }
      const frame = doc.getElementById("jqueryModalDialogsFrame");
      if (frame) {
        syncDialogFrame(ctx, frame);
        if (!watchers.has(frame)) {
          const watch = new MutationObserver(() => syncDialogFrame(ctx, frame));
          watch.observe(frame, { attributes: true, attributeFilter: ["style"] });
          watchers.set(frame, watch);
        }
      }
      if (!listening.has(doc)) {
        listening.add(doc);
        ctx.listen(doc, "keydown", onKey, true);
      }
    },
    revert(ctx) {
      listening.delete(ctx.doc);
      for (const [frame, watch] of watchers) {
        if (frame.ownerDocument !== ctx.doc) continue;
        watch.disconnect();
        watchers.delete(frame);
      }
    },
  });
})(globalThis);
