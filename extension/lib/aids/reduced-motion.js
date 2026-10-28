// Reduced motion: Sitecore's and the themes' CSS animations and transitions end at once, in their final state, for
// vestibular disorders, migraine and seizure risk. Sitecore's own script-driven slides (scAnimation) run in the page's
// world, which an extension's content script cannot reach.
(function (root) {
  const SCT = (root.SCT = root.SCT || {});

  SCT.registerAid("reduced-motion", {
    css: `*,*::before,*::after{animation-duration:.01ms!important;animation-iteration-count:1!important;animation-delay:0s!important;transition-duration:.01ms!important;transition-delay:0s!important;scroll-behavior:auto!important}`,
  });
})(globalThis);
