// Reduced motion: Sitecore's and the themes' CSS animations and transitions end at once, in their final state, for
// vestibular disorders, migraine and seizure risk. Sitecore's own script-driven slides (scAnimation) run in the page's
// world, which an extension's content script cannot reach.
// Transitions take no time at all rather than a hundredth of a millisecond: every element's transition-property is
// "all" by default, so a duration on every element started a transition on any change, and a script that set a size
// and read it back got the old one until the next frame (jQuery UI sized the media and link pickers' frames to 35px).
(function (root) {
  const SCT = (root.SCT = root.SCT || {});

  SCT.registerAid("reduced-motion", {
    css: `*,*::before,*::after{animation-duration:.01ms!important;animation-iteration-count:1!important;animation-delay:0s!important;transition-duration:0s!important;transition-delay:0s!important;scroll-behavior:auto!important}`,
  });
})(globalThis);
