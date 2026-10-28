// Names: every image an alt, every control a name a screen reader can say, and the parts Sitecore makes clickable
// with onclick alone a button you can reach and press from the keyboard. From a survey of 10.4.1 and 10.5.
(function (root) {
  const SCT = (root.SCT = root.SCT || {});

  // controls that draw only an icon, and what they do; images take an alt, anything else an aria-label
  const LABELS = [
    [".sc-global-logo", "Launchpad"],
    ["#BTAddNewSearch", "New search"],
    ["#navigationTreeViewButton", "Navigation tree"],
    ["img.scRibbonPanelUp", "Scroll up"],
    ["img.scRibbonPanelDown", "Scroll down"],
    ["img.scRibbonPanelOpen", "More options"],
    ["img.scComboboxDropDown", "Show options"],
    ["input.bucketSearch", "Search"],
    ['select[id$="_unselected"]', "Available items"],
    ['select[id$="_selected"]', "Selected items"],
  ];
  const CONTROL = "a, button, input, select, textarea, [tabindex], [onclick]";
  const named = (el) => !!(el.getAttribute("aria-label") || el.getAttribute("aria-labelledby") || (el.labels && el.labels.length)
    || (el.tagName === "IMG" ? el.alt : el.textContent).trim() || el.title.trim()
    || [...el.querySelectorAll("img[alt]")].some((i) => i.alt.trim()));
  const clean = (s) => s.replace(/\s+/g, " ").trim();

  const made = new WeakSet(); // the elements this aid made buttons
  const listening = new WeakSet(); // documents with the key handler
  // Enter and Space press a made button, unless Sitecore's own handler took the key first
  function onKey(e) {
    if (e.defaultPrevented || (e.key !== "Enter" && e.key !== " ") || !made.has(e.target)) return;
    e.preventDefault();
    e.target.click();
  }

  SCT.registerAid("names", {
    apply(ctx) {
      const { doc, setAttr } = ctx;
      for (const [selector, label] of LABELS) {
        for (const el of doc.querySelectorAll(selector)) {
          if (named(el)) continue;
          setAttr(el, el.tagName === "IMG" ? "alt" : "aria-label", label);
        }
      }
      for (const img of doc.querySelectorAll("img:not([alt]):not([aria-label]):not([aria-labelledby])")) {
        const owner = img.closest("a, button, [role=button]");
        if (img.title.trim()) setAttr(img, "alt", clean(img.title));
        else if (!owner || clean(owner.textContent) || named(owner)) setAttr(img, "alt", ""); // decoration, or beside its text
        else if (owner.title.trim()) setAttr(img, "alt", clean(owner.title));
      }
      // an alt that repeats the text beside it is said twice
      for (const img of doc.querySelectorAll('img[alt]:not([alt=""])')) {
        const owner = img.closest("a, button, [role=button]");
        if (owner && clean(owner.textContent) === clean(img.alt)) setAttr(img, "alt", "");
      }
      // a small clickable part with no role: a button, in the Tab order (ponytail: "small" is 40 characters and three
      // elements at most, so containers that delegate clicks are left alone; measure boxes if one ever slips through)
      for (const el of doc.querySelectorAll("div[onclick]:not([role]), span[onclick]:not([role]), img[onclick]:not([role]), td[onclick]:not([role])")) {
        if (el.querySelector(CONTROL) || el.getElementsByTagName("*").length > 3 || !named(el) || clean(el.textContent).length > 40) continue;
        setAttr(el, "role", "button");
        if (!el.hasAttribute("tabindex")) setAttr(el, "tabindex", "0");
        made.add(el);
      }
      if (!listening.has(doc)) {
        listening.add(doc);
        ctx.listen(doc, "keydown", onKey);
      }
    },
    revert(ctx) {
      listening.delete(ctx.doc);
    },
  });
})(globalThis);
