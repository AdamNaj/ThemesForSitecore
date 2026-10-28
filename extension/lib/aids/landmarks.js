// Landmarks: the main parts of each page marked and named, so a screen reader can list them and jump between them.
// Only elements with no role of their own; the ribbon's region is aria-repair's. From a survey of 10.4.1 and 10.5.
(function (root) {
  const SCT = (root.SCT = root.SCT || {});

  // per surface: [selector, role, name]; a name of "" leaves aria-label alone
  const LANDMARKS = {
    shell: [
      ["#ContentTreePanel", "navigation", "Content tree"],
      ["#ContentEditor", "main", "Item editor"],
      ["#Desktop", "main", "Desktop"],
      ["#Startbar", "region", "Taskbar"],
    ],
    launchpad: [
      ["header.sc-applicationHeader", "banner", ""],
      [".sc-launchpad", "main", "Launchpad"],
    ],
    admin: [["mat-toolbar", "banner", ""]],
    speak: [["nav.sc-quickbar", "", "Quick bar"]],
  };

  SCT.registerAid("landmarks", {
    apply(ctx) {
      for (const [selector, role, name] of LANDMARKS[ctx.surface] || []) {
        const el = ctx.doc.querySelector(selector);
        if (!el) continue;
        if (role && !el.hasAttribute("role")) ctx.setAttr(el, "role", role);
        if (name && !el.hasAttribute("aria-label")) ctx.setAttr(el, "aria-label", name);
      }
    },
  });
})(globalThis);
