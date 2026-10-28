// Focus ring: a clear outline on whatever has keyboard focus, in every frame, never hidden (WCAG 2.4.7, 2.4.13).
// Sitecore and several themes take the outline off; the aids' layer wins over their !important. The theme's own
// focus colour where it has one, the system's highlight otherwise; thicker for low vision.
(function (root) {
  const SCT = (root.SCT = root.SCT || {});

  SCT.registerAid("focus-ring", {
    css: `:focus-visible{outline:2px solid var(--sct-focus-ring,Highlight)!important;outline-offset:1px!important}
:root[data-sct-needs~="low-vision"] :focus-visible{outline-width:3px!important}`,
  });
})(globalThis);
