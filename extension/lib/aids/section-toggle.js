// Back, forward, expand and collapse: four buttons in the Content Editor's tab bar, left of the section navigator.
// Back and Forward send the messages the ribbon's Navigate > Back and Forward send (contenteditor:back and
// contenteditor:forward), so they walk Sitecore's own history of the items you opened. Expand all and Collapse all
// open or close every section of the item's fields, each by clicking the captions Sitecore's own toggle sits on, so
// Sitecore remembers the sections open or closed as it does when you click them one by one. They take Sitecore's
// header button classes, so every theme sizes them as it sizes the navigator beside them; the aid draws them, and the
// navigator, flat: no frame or fill until hovered. Each is greyed out when it has nothing to do: Back and Forward when
// the ribbon's are (Sitecore keeps the history on the server and draws a disabled ribbon button with no command, so
// an enabled one's command is the only sign; with no Navigate strip they stay on), Expand all when no section is closed and
// Collapse all when none is open.
(function (root) {
  const SCT = (root.SCT = root.SCT || {});

  const svg = (d) => `<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/></svg>`;
  const BUTTONS = [
    { label: "Back", icon: svg("M10 3.5 5.5 8 10 12.5"), message: "contenteditor:back" },
    { label: "Forward", icon: svg("M6 3.5 10.5 8 6 12.5"), message: "contenteditor:forward" },
    { label: "Expand all sections", icon: svg("M4.5 6 8 2.5 11.5 6M4.5 10 8 13.5 11.5 10"), from: "Collapsed" },
    { label: "Collapse all sections", icon: svg("M4.5 2.5 8 6 11.5 2.5M4.5 13.5 8 10 11.5 13.5"), from: "Expanded" },
  ];
  // the same box as the theme's, so nothing moves: only the frame and the fill go
  const FLAT = ".scEditorTabControls :is(a[data-sct-sections],#ContentEditorNavigator)";

  // square, and as tall as the navigator: its padding above and below, and as much each side as makes the width its
  // height; again whenever a theme changes the navigator's size
  function square(nav) {
    const win = nav.ownerDocument.defaultView;
    const n = win.getComputedStyle(nav);
    const height = nav.getBoundingClientRect().height;
    for (const a of nav.parentElement.querySelectorAll(":scope > a[data-sct-sections]")) {
      const s = win.getComputedStyle(a);
      const pad = Math.max(0, (height - 16 - parseFloat(s.borderLeftWidth) - parseFloat(s.borderRightWidth)) / 2);
      for (const [p, v] of [["padding-top", n.paddingTop], ["padding-bottom", n.paddingBottom], ["padding-left", `${pad}px`], ["padding-right", `${pad}px`]]) {
        a.style.setProperty(p, v, "important");
      }
    }
  }
  let sizes = null;

  function sync(doc) {
    const strip = doc.querySelector('[id$="_Strip_NavigateStrip"]');
    for (const a of doc.querySelectorAll(".scEditorTabControls a[data-sct-sections]")) {
      const v = a.getAttribute("data-sct-sections");
      // a strip that is not showing keeps its markup in a comment, so its text, not its elements
      const on = v.includes(":") ? !strip || strip.innerHTML.includes(`'${v}'`) : !!doc.querySelector(`.scEditorSectionCaption${v}`);
      a.setAttribute("aria-disabled", String(!on));
    }
  }
  const watched = new WeakSet(); // documents with the click listener

  SCT.registerAid("section-toggle", {
    // Sitecore's mouse handlers read the target's className as a string, which an SVG's is not
    css: `a[data-sct-sections] svg{display:inline-block;vertical-align:middle;pointer-events:none}
${FLAT}{border-color:transparent!important;background:transparent!important;box-shadow:none!important}
${FLAT}:hover{background:color-mix(in srgb,currentColor 14%,transparent)!important}
a[data-sct-sections][aria-disabled="true"]{opacity:.4;pointer-events:none}`,
    apply(ctx) {
      const { doc } = ctx;
      for (const nav of doc.querySelectorAll(".scEditorTabControls #ContentEditorNavigator")) {
        if (nav.previousElementSibling?.hasAttribute("data-sct-sections")) continue;
        // plain siblings of the navigator, no wrapper: the gap between header buttons comes from a sibling rule
        for (const { label, icon, message, from } of BUTTONS) {
          const a = ctx.own(doc.createElement("a"));
          a.setAttribute("data-sct-sections", message || from);
          a.href = "#";
          a.className = "scEditorHeaderButton scButton";
          a.setAttribute("role", "button");
          a.title = label;
          a.setAttribute("aria-label", label);
          a.innerHTML = icon;
          a.addEventListener("click", (e) => {
            e.preventDefault();
            if (a.getAttribute("aria-disabled") === "true") return;
            if (message) return SCT.sheer(doc, message);
            for (const caption of doc.querySelectorAll(`.scEditorSectionCaption${from}`)) caption.click();
          });
          nav.before(a);
        }
        sizes ||= new ResizeObserver((entries) => entries.forEach((e) => square(e.target)));
        sizes.observe(nav);
      }
      // a caption opens or closes by a class change, which the engine does not watch: every click, once it has run
      if (!watched.has(doc)) (watched.add(doc), ctx.listen(doc, "click", () => setTimeout(() => sync(doc))));
      sync(doc);
    },
    revert() {
      sizes?.disconnect();
      sizes = null;
    },
  });
})(globalThis);
