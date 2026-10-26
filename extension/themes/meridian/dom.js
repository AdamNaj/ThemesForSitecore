// Meridian: the palette follows the local clock. Every frame's <html> gets data-sct-phase (dawn, day, dusk
// or night) and keeps it current once a minute; tokens.css holds a block per phase. A change after the
// first one sets data-sct-fading for the length of the cross-fade. Both attributes go through the dom-kit,
// so a theme switch removes them.
// The site's time of day from the picker (the engine's data-sct-phase-pin) wins over the clock, and a
// change to it cross-fades like the clock's.
(function () {
  const PHASES = ["dawn", "day", "dusk", "night"];
  const FADE_MS = 6500; // a little longer than the 6s transition in tokens.css
  let state = null; // { doc, ctx, timer, pin, fading } while applied in this frame

  function phaseAt(hour) {
    if (hour >= 5 && hour < 9) return "dawn";
    if (hour >= 9 && hour < 17) return "day";
    if (hour >= 17 && hour < 21) return "dusk";
    return "night";
  }

  function update() {
    if (!state) return;
    const { doc, ctx } = state;
    const html = doc.documentElement;
    const pinned = html.getAttribute("data-sct-phase-pin");
    const phase = PHASES.includes(pinned) ? pinned : phaseAt(new Date().getHours());
    const was = html.getAttribute("data-sct-phase");
    if (was === phase) return;
    if (was) {
      // the transition must be in place before the colours change
      ctx.setAttr(html, "data-sct-fading", "");
      getComputedStyle(html).color;
      clearTimeout(state.fading);
      state.fading = setTimeout(() => html.removeAttribute("data-sct-fading"), FADE_MS);
    }
    ctx.setAttr(html, "data-sct-phase", phase);
  }

  SCT.registerTheme("meridian", {
    apply(ctx) {
      if (!state || state.doc !== ctx.doc) {
        if (state) {
          clearInterval(state.timer);
          state.pin.disconnect();
        }
        const pin = new MutationObserver(update);
        pin.observe(ctx.doc.documentElement, { attributes: true, attributeFilter: ["data-sct-phase-pin"] });
        state = { doc: ctx.doc, ctx, timer: setInterval(update, 60000), pin, fading: 0 };
      }
      state.ctx = ctx;
      update();
    },
    // The dom-kit removes both attributes; this stops the clock.
    revert() {
      if (!state) return;
      clearInterval(state.timer);
      state.pin.disconnect();
      clearTimeout(state.fading);
      state = null;
    },
  });
})();
