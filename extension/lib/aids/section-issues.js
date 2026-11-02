// Section errors and warnings: each Content Editor section's title bar says, on its right, how many of its fields
// Sitecore's validation marks as errors (a red marker) and warnings (a yellow one), "2 errors 1 warning", so a problem
// in a collapsed section, or one scrolled out of view, shows without opening it. A collapsed section's fields are in
// the page, hidden, so their markers count too. Each count is a button with Sitecore's messages as its tooltip: it
// opens the section if it is closed and goes to the first field of that kind, the next one on each press after. The
// section's toggle is named or described by the counts, for a screen reader. Sitecore's updateFieldMarkers sets the
// markers each time it validates, after rendering its validator panel again, which brings a pass.
(function (root) {
  const SCT = (root.SCT = root.SCT || {});

  const STATES = { error: "Red", warning: "Yellow" };
  const CONTROL = 'input:not([type="hidden"]), select, textarea, iframe, [contenteditable="true"]';

  const markers = (panel, state) => [...panel.querySelectorAll(`.scEditorFieldMarkerBarCell${STATES[state]}`)];

  function go(button) {
    const caption = button.closest(".scEditorSectionCaptionExpanded, .scEditorSectionCaptionCollapsed");
    const all = markers(caption.nextElementSibling, button.dataset.sctState);
    if (!all.length) return;
    const i = (+button.dataset.sctNext || 0) % all.length;
    button.dataset.sctNext = String(i + 1);
    // Sitecore's own toggle; the section slides open over 100ms
    if (caption.classList.contains("scEditorSectionCaptionCollapsed")) (caption.querySelector(".scEditorSectionCaptionGlyph") || caption).click();
    setTimeout(() => {
      const field = all[i].closest(".scEditorFieldMarker") || all[i];
      field.scrollIntoView({ block: "center" });
      const control = field.querySelector(CONTROL);
      if (control) control.focus({ preventScroll: true });
    }, 150);
  }

  SCT.registerAid("section-issues", {
    // fixed colours, not the theme's: white on the red and black on the amber read at AA under any theme
    // one caption line tall (Chicago's is 20px, 10.4's 35px), the pills centred in it
    css: SCT.important(`sct-section-issues{float:right;display:flex;align-items:center;gap:6px;height:1lh;margin:0 12px 0 0}
sct-section-issues>button{margin:0;padding:0 7px;border:1px solid transparent;border-radius:9px;box-shadow:none;min-width:0;height:auto;font-family:inherit;font-size:12px;font-weight:600;line-height:16px;cursor:pointer}
sct-section-issues>[data-sct-state=error]{background:#c42b1c;color:#fff}
sct-section-issues>[data-sct-state=warning]{background:#fbc200;color:#000}`),
    apply(ctx) {
      const { doc } = ctx;
      for (const caption of doc.querySelectorAll(".scEditorSectionCaptionExpanded, .scEditorSectionCaptionCollapsed")) {
        const panel = caption.nextElementSibling;
        if (!panel || !panel.matches(".scEditorSectionPanel") || !caption.id) continue;
        const found = Object.keys(STATES).map((state) => [state, markers(panel, state)]).filter(([, m]) => m.length);
        const id = `sct-issues-${caption.id}`;
        let badge = doc.getElementById(id);
        // 10.4 and 10.5 name the toggle by the whole caption, the badge in it already
        const glyph = caption.querySelector(".scEditorSectionCaptionGlyph");
        if (glyph && glyph.getAttribute("aria-labelledby") !== caption.id && glyph.getAttribute("aria-describedby") !== (found.length ? id : null)) ctx.setAttr(glyph, "aria-describedby", found.length ? id : null);
        if (!found.length) {
          if (badge) badge.remove();
          continue;
        }
        if (!badge) {
          badge = ctx.own(doc.createElement("sct-section-issues"));
          badge.id = id;
          // the caption's own click and keys open and close the section: not from the counts
          ctx.listen(badge, "click", (e) => {
            e.stopPropagation();
            const button = e.target.closest("button");
            if (button) go(button);
          });
          ctx.listen(badge, "keydown", (e) => e.stopPropagation());
          if (glyph) glyph.after(badge);
          else caption.prepend(badge);
        }
        const key = found.map(([state, m]) => `${m.length} ${state}${m.length > 1 ? "s" : ""}`).join(" ");
        if (badge.dataset.sctKey !== key) {
          badge.dataset.sctKey = key;
          badge.replaceChildren(...found.flatMap(([state, m], n) => {
            const button = doc.createElement("button");
            button.type = "button";
            button.dataset.sctState = state;
            button.textContent = `${m.length} ${state}${m.length > 1 ? "s" : ""}`;
            return n ? [" ", button] : [button];
          }));
        }
        for (const [state, m] of found) {
          const button = badge.querySelector(`[data-sct-state=${state}]`);
          const title = [...m.map((marker) => marker.title.trim()).filter(Boolean), `Press to go to the ${m.length > 1 ? "next one" : "field"}`].join("\n");
          if (button.title !== title) button.title = title;
        }
      }
    },
  });
})(globalThis);
