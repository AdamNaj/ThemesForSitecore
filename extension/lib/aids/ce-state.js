// Remember Content Editor state: the Content Editor opens on the item you last had open in it, and with Quick Info
// open or closed as you last left it. Sitecore keeps neither: it opens on Home every time, with Quick Info open
// (its scSections field carries a section's state from item to item, only while that editor page lives). An
// editor opened on an item (fo or id in its address, as the Workbox and the Experience Editor open it) stays on
// that item. The state lives in the site's own localStorage, which both the extension and the Sitecore module reach.
(function (root) {
  const SCT = (root.SCT = root.SCT || {});

  const KEY = "sct-ce-state";
  // the Launchpad's Content Editor.aspx and the Desktop's Content-Editor; ro (another root, the Media Library's)
  // and mo (a mini editor in a dialog) are other jobs
  const EDITOR = /^\/sitecore\/shell\/applications\/content[ -]editor(\.aspx)?\/?$/;
  const states = new WeakMap(); // document -> { first: the item it opened on, back: the URI being restored, quick }
  const waiting = new WeakSet(); // documents still loading, with a load listener

  const dbOf = (uri) => (/^sitecore:\/\/(\w+)\//.exec(uri) || [])[1];
  const idOf = (uri) => (/\{[^}]+\}/.exec(uri) || [])[0];

  function load(win) {
    try {
      const v = JSON.parse(win.localStorage.getItem(KEY) || "{}");
      return v && typeof v === "object" ? v : {};
    } catch {
      return {};
    }
  }
  function save(win, v) {
    try {
      win.localStorage.setItem(KEY, JSON.stringify(v));
    } catch {
      // storage blocked: nothing is remembered
    }
  }

  function apply(ctx) {
    const { doc } = ctx;
    const win = doc.defaultView;
    const q = new URLSearchParams(win.location.search);
    if (!EDITOR.test(decodeURIComponent(win.location.pathname).toLowerCase()) || q.has("ro") || q.has("mo")) return;
    const uri = doc.getElementById("__CurrentItem")?.value;
    if (!uri) return;
    let s = states.get(doc);
    if (!s && doc.readyState !== "complete") {
      // Sitecore's search and section scripts are ready once the page has loaded
      if (!waiting.has(doc)) (waiting.add(doc), ctx.listen(win, "load", () => apply(ctx), { once: true }));
      return;
    }
    const saved = load(win);
    if (!s) {
      const back = !q.has("fo") && !q.has("id") && saved.item && dbOf(saved.item) === dbOf(uri) && idOf(saved.item) !== idOf(uri);
      s = { first: uri, back: back ? saved.item : null, quick: new WeakSet() };
      states.set(doc, s);
      if (s.back) SCT.gotoItem(doc, s.back); // in the language and version it was left in
    }
    // the item it opened on is not worth keeping while the remembered one is on its way
    if (s.back && uri === s.first) return;
    s.back = null;
    const caption = doc.querySelector('[id^="QuickInfo_"].scEditorSectionCaptionExpanded, [id^="QuickInfo_"].scEditorSectionCaptionCollapsed');
    if (caption && !s.quick.has(caption)) {
      s.quick.add(caption);
      // the caption's own click: Sitecore's toggleSection, which also writes scSections for the next item
      if (typeof saved.quickInfo === "boolean" && saved.quickInfo !== (caption.className === "scEditorSectionCaptionExpanded")) caption.click();
    }
    const quickInfo = caption ? caption.className === "scEditorSectionCaptionExpanded" : saved.quickInfo;
    if (uri !== saved.item || quickInfo !== saved.quickInfo) save(win, { item: uri, quickInfo });
  }

  SCT.registerAid("ce-state", { apply });
})(globalThis);
