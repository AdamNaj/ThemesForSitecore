// Phosphor: the taskbar is a tmux status line whose left-hand label is the session's host
// ("[cm105]"). CSS cannot read the host name, so the start button gets it as data-sct-ph-host
// (the first label of the host); shell.css shows it with attr(). Nothing of Sitecore's is changed,
// and the dom-kit removes the attribute on a theme switch.
//
// The top-level document of a tab also gets the CRT of TOI's Terminal theme: data-sct-ph-top turns on
// the glass in tokens.css, and a glitch burst every 2 to 15 seconds. TOI tears the page with a WebGL
// shader over html-in-canvas (slices shifted sideways, an RGB split, corrupted blocks). Here the page
// goes through an inline SVG filter for about 0.35s, redrawn four times with a fading amplitude: a few
// random strips of the page (full-width slices and shorter blocks) are offset sideways, each with its
// colour split into red-blue and green copies pulled apart. The filter has to be in the document: a
// data: URL is blocked by some sites' CSP and filters can't reference other documents.
// Cost: this Hyper-V box (and the RDP Chrome on it) has no GPU, so Skia filters run in software. A
// noise-map tear (feTurbulence + feDisplacementMap) with a whole-page RGB split cost 70-100ms a frame
// there; strips limited to their own subregions only touch a few percent of the page.
(function () {
  const GLASS = ["shell", "speak", "launchpad", "login"]; // never ee (the website) or admin (not themed)
  const STEPS = [0, 85, 170, 255]; // ms into a burst; it ends at DURATION
  const DURATION = 340;
  const SHIFT = 30; // px: the furthest a strip moves sideways
  const SPLIT = 2; // px each way for the RGB split
  const NS = "http://www.w3.org/2000/svg";
  const RB = "1 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0";
  const G = "0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0";
  let state = null; // { doc, timers, onMessage }

  const reduced = (doc) => doc.defaultView.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const rnd = (lo, hi) => lo + Math.random() * (hi - lo);

  // 3 to 6 strips at this amplitude, each torn sideways and split; merged over the page
  function strips(win, amp) {
    const w = win.innerWidth;
    const prims = [];
    const nodes = ['<feMergeNode in="SourceGraphic"/>'];
    for (let i = 0, n = 3 + Math.floor(Math.random() * 4); i < n; i++) {
      const block = Math.random() < 0.35; // a corrupted block rather than a whole slice
      const x = block ? Math.round(rnd(0, w * 0.8)) : 0;
      const box = `x="${x}" y="${Math.round(win.scrollY + rnd(0, win.innerHeight))}" width="${block ? Math.round(rnd(w * 0.08, w * 0.35)) : w}" height="${Math.round(rnd(3, block ? 24 : 40))}"`;
      const dx = Math.round((Math.random() < 0.5 ? -1 : 1) * rnd(0.25, 1) * SHIFT * amp);
      const s = Math.max(1, Math.round(SPLIT * amp));
      prims.push(`<feOffset in="SourceGraphic" dx="${dx}" ${box} result="t${i}"/>`,
        `<feColorMatrix in="t${i}" type="matrix" values="${RB}" ${box}/>`, `<feOffset dx="${s}" ${box} result="r${i}"/>`,
        `<feColorMatrix in="t${i}" type="matrix" values="${G}" ${box}/>`, `<feOffset dx="${-s}" ${box} result="g${i}"/>`,
        `<feBlend in="r${i}" in2="g${i}" mode="screen" ${box} result="s${i}"/>`);
      nodes.push(`<feMergeNode in="s${i}"/>`);
    }
    return `${prims.join("")}<feMerge>${nodes.join("")}</feMerge>`;
  }

  function later(fn, ms) {
    const id = setTimeout(() => {
      state.timers.delete(id);
      fn();
    }, ms);
    state.timers.add(id);
  }

  function burst(doc) {
    if (doc.hidden || reduced(doc)) return;
    const { svg } = state;
    const html = doc.documentElement;
    for (const at of STEPS) {
      later(() => {
        svg.firstChild.innerHTML = strips(doc.defaultView, (1 - (at / DURATION) ** 2) * rnd(0.7, 1));
        if (!svg.isConnected) (doc.body || html).append(svg);
        html.setAttribute("data-sct-ph-glitch", "");
      }, at);
    }
    later(() => {
      html.removeAttribute("data-sct-ph-glitch");
      svg.remove();
    }, DURATION);
  }

  function schedule(doc) {
    later(() => {
      burst(doc);
      schedule(doc);
    }, rnd(2000, 15000));
  }

  function startGlass(ctx) {
    const { doc } = ctx;
    if (doc.documentElement.getAttribute("data-sct-ph-top") === null) ctx.setAttr(doc.documentElement, "data-sct-ph-top", "");
    if (state) return;
    const svg = ctx.own(doc.createElementNS(NS, "svg"));
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("style", "position:absolute;width:0;height:0;overflow:hidden");
    svg.innerHTML = '<filter id="sct-ph-glitch" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB"/>';
    const s = (state = { doc, svg, timers: new Set(), onMessage: null });
    // The svg is in the page only during a burst, and bursts start after load: the Desktop's onload
    // (scWindowManagerInitialize) calls className.indexOf on every element, and an SVG element's
    // className is an SVGAnimatedString, so it threw an uncaught "ctl.className.indexOf is not a function".
    if (doc.readyState === "complete") schedule(doc);
    else doc.defaultView.addEventListener("load", () => state === s && schedule(doc), { once: true });
    // dev builds: a page can fire a burst now (tests), with postMessage({ type: "sct-ph-glitch" })
    if (SCT.devHooks) {
      state.onMessage = (e) => e.data && e.data.type === "sct-ph-glitch" && burst(doc);
      doc.defaultView.addEventListener("message", state.onMessage);
    }
  }

  SCT.registerTheme("phosphor", {
    apply(ctx) {
      const button = ctx.doc.getElementById("StartButton");
      const host = (ctx.doc.location.hostname || "").split(".")[0];
      if (button && host && button.getAttribute("data-sct-ph-host") !== host) ctx.setAttr(button, "data-sct-ph-host", host);
      const win = ctx.doc.defaultView;
      if (win && win === win.top && GLASS.includes(ctx.surface)) startGlass(ctx);
    },
    revert({ doc }) {
      doc.documentElement.removeAttribute("data-sct-ph-glitch");
      if (!state) return;
      for (const id of state.timers) clearTimeout(id);
      if (state.onMessage) doc.defaultView.removeEventListener("message", state.onMessage);
      state = null;
    },
  });
})();
