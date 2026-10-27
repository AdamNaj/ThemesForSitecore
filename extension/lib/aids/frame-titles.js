// Frame names: every frame and iframe gets a title from the page it shows, so a screen reader says "Content Editor,
// frame" instead of "frame". Read from the frame's address only, never from inside it (a parent may not reach into a
// frame before its load event). A title Sitecore or a project set is left as it is.
(function (root) {
  const SCT = (root.SCT = root.SCT || {});

  // the end of the frame's path, case-insensitive; the first match wins
  const NAMES = [
    [/\/content editor\.aspx$/i, "Content Editor"],
    [/\/controls\/jquerymodaldialogs\.html$/i, "Dialog"],
    [/\/rich text editor\/editorwindow\.aspx$/i, "Rich text editor"],
    [/\/rich text editor\/preview\.aspx$/i, "Rich text preview"],
    [/\/experienceeditor\/ribbon\.aspx$/i, "Experience Editor ribbon"],
    [/\.securitydetails\.aspx$/i, "Security details"],
  ];

  // null for a frame that shows nothing yet
  function nameFor(src, base) {
    if (!src || /^about:/i.test(src)) return null;
    let path;
    try {
      path = decodeURIComponent(new URL(src, base).pathname);
    } catch {
      return null;
    }
    const known = NAMES.find(([re]) => re.test(path));
    if (known) return known[1];
    // the last segment, without its extension; a dotted xaml name keeps its last part
    const last = path.split("/").pop().replace(/\.[^.]*$/, "").split(".").pop();
    return last ? `Sitecore: ${last}` : null;
  }

  const ours = new WeakMap(); // frame -> the title this aid set, so a src change renames only what is ours

  SCT.registerAid("frame-titles", {
    apply(ctx) {
      for (const frame of ctx.doc.querySelectorAll("iframe, frame")) {
        const title = frame.getAttribute("title");
        const mine = ours.get(frame);
        if (title && title !== mine) continue;
        const name = nameFor(frame.getAttribute("src"), ctx.doc.baseURI);
        if (!name || name === title) continue;
        ctx.setAttr(frame, "title", name);
        ours.set(frame, name);
      }
    },
  });
})(globalThis);
