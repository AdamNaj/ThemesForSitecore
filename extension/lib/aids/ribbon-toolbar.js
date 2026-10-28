// Ribbon toolbar: the Content Editor ribbon's buttons are one Tab stop instead of twenty, with the arrow keys inside
// (the toolbar pattern). Sitecore already moves between the ribbon's tabs with arrows; its buttons were each a Tab
// stop. No tabindex is written: Tab from inside focuses the strip's last button and lets the browser's own Tab go on
// from there (so it leaves the strip in one press, into the next frame too), and focus coming back from outside
// returns to the button last used.
(function (root) {
  const SCT = (root.SCT = root.SCT || {});

  const STRIP = ".scRibbonToolbarStrip";
  const CONTROLS = 'a[href], button, img[role="button"], [tabindex]:not([tabindex="-1"]):not(input):not(select):not(textarea)';
  const visible = (el) => el.getClientRects().length > 0;
  const controls = (strip) => [...strip.querySelectorAll(CONTROLS)].filter((el) => el.getAttribute("tabindex") !== "-1" && visible(el));
  const last = new WeakMap(); // strip -> the control last focused in it
  const listening = new WeakSet();

  function onKey(e) {
    const strip = e.target.closest && e.target.closest(STRIP);
    if (!strip || e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || /^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName)) return;
    const list = controls(strip);
    const i = list.indexOf(e.target);
    if (i < 0 || !list.length) return;
    if (e.key === "Tab") {
      // the browser's Tab goes on from the end it is leaving by
      const edge = e.shiftKey ? list[0] : list[list.length - 1];
      if (edge !== e.target) edge.focus();
      last.set(strip, e.target); // the button left from, not the edge passed through
      return;
    }
    const to = { ArrowRight: list[(i + 1) % list.length], ArrowLeft: list[(i - 1 + list.length) % list.length], Home: list[0], End: list[list.length - 1] }[e.key];
    if (!to || e.shiftKey) return;
    e.preventDefault();
    to.focus();
  }

  function onFocus(e) {
    const strip = e.target.closest && e.target.closest(STRIP);
    if (!strip) return;
    const came = e.relatedTarget && e.relatedTarget.closest && e.relatedTarget.closest(STRIP) === strip;
    const back = last.get(strip);
    if (!came && back && back !== e.target && back.isConnected && controls(strip).includes(back)) back.focus();
    else last.set(strip, e.target);
  }

  SCT.registerAid("ribbon-toolbar", {
    apply(ctx) {
      const { doc, setAttr } = ctx;
      for (const strip of doc.querySelectorAll(`${STRIP}:not([role])`)) {
        if (!strip.querySelector(CONTROLS)) continue;
        setAttr(strip, "role", "toolbar");
        const tab = strip.id && doc.querySelector(`[role="tab"][aria-controls="${strip.id}"]`);
        if (tab && tab.id) setAttr(strip, "aria-labelledby", tab.id);
      }
      if (!listening.has(doc)) {
        listening.add(doc);
        ctx.listen(doc, "keydown", onKey);
        ctx.listen(doc, "focusin", onFocus);
      }
    },
    revert(ctx) {
      listening.delete(ctx.doc);
    },
  });
})(globalThis);
