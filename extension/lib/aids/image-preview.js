// Image preview: an Image field's preview can be dragged taller or shorter (its bottom-right corner), and three buttons
// under it show the image at its own size (Normal, as Sitecore shows it), filling the preview (Fill, cropped) or all
// of it inside the preview (Fit). Sitecore draws the preview as a frame on a thumbnail at most 128px tall; the aid
// shows the same image in the page instead, where object-fit can size it, and for Fill and Fit asks Sitecore's media
// handler for a copy as tall as the preview needs, so a big preview is not a blown-up thumbnail. The height follows
// Field sizes' rules (field-sizes.js, which keeps it): a drag sizes every Image field without a height of its own, and
// a click on the corner gives this one its own. The choice of Normal, Fill or Fit is for every Image field. Both live in
// the site's own localStorage; without storage they last until the page reloads.
// ponytail: the drag is the browser's own resize handle, mouse only; the keyboard has the three buttons
(function (root) {
  const SCT = (root.SCT = root.SCT || {});

  const KEY = "sct-image-preview";
  const MODES = [
    { id: "none", label: "Normal", title: "The image at its own size, as Sitecore shows it" },
    { id: "cover", label: "Fill", title: "Fill the preview with the image, cropping what does not fit" },
    { id: "contain", label: "Fit", title: "The whole image, as large as fits in the preview" },
  ];
  const BOX = ".scContentControlImageImage";
  const contexts = new WeakMap(); // document -> the aid's context there, for the click handler
  let resized = null;
  let fallback = {}; // the choice when storage is blocked

  function load(win) {
    try {
      const v = JSON.parse(win.localStorage.getItem(KEY) || "{}");
      return v && typeof v === "object" ? v : {};
    } catch {
      return fallback;
    }
  }
  function save(win, v) {
    fallback = v;
    try {
      win.localStorage.setItem(KEY, JSON.stringify(v));
    } catch {
      // storage blocked: the choice lasts until the page reloads
    }
  }
  const modeOf = (v) => (MODES.some((m) => m.id === v.mode) ? v.mode : "none");

  // The address to show: Sitecore's thumbnail for Normal; for Fill and Fit the same image as tall as the preview
  // needs it at this display's pixel ratio, in steps of 64px, so a drag fetches a few copies, not one per pixel.
  // Sitecore never enlarges past the image's own size.
  function source(img, frame, mode) {
    const src = frame.src;
    const box = img.parentElement;
    if (mode === "none" || !img.naturalWidth || !box.clientHeight) return src;
    const ratio = img.naturalWidth / img.naturalHeight;
    const across = box.clientWidth / ratio;
    const tall = mode === "cover" ? Math.max(box.clientHeight, across) : Math.min(box.clientHeight, across);
    const url = new URL(src);
    url.searchParams.set("h", String(Math.ceil((tall * (img.ownerDocument.defaultView.devicePixelRatio || 1)) / 64) * 64));
    url.searchParams.delete("mw");
    return url.href;
  }

  function show(img, frame, mode) {
    const want = source(img, frame, mode);
    if (img.src !== want) img.src = want;
  }

  function apply(ctx) {
    const { doc } = ctx;
    const win = doc.defaultView;
    const saved = load(win);
    const mode = modeOf(saved);
    let sizes = SCT.fieldSize.load(win);
    // the one height every Image field had before Field sizes kept them, moved there once
    if (saved.height) {
      const { height, ...rest } = saved;
      save(win, rest);
      if (!(sizes.image && sizes.image.height)) SCT.fieldSize.save(win, (sizes = { ...sizes, image: { ...sizes.image, height } }));
    }
    for (const box of doc.querySelectorAll(BOX)) {
      const frame = box.querySelector(":scope > iframe[id$='_image']");
      const details = box.parentElement.querySelector(":scope > .scContentControlImageDetails");
      if (!frame || !details) continue;
      if (!box.hasAttribute("data-sct-preview")) {
        ctx.setAttr(box, "data-sct-preview", "");
        ctx.setAttr(box, "data-sct-size-kind", "image");
        const cell = box.closest(".scEditorFieldMarkerInputCell");
        if (cell) ctx.setAttr(box, "data-sct-size-key", SCT.fieldSize.fieldKey(cell));
        resized ||= new ResizeObserver(onResize);
        resized.observe(box);
      }
      if (box.getAttribute("data-sct-fit") !== mode) ctx.setAttr(box, "data-sct-fit", mode);
      const key = box.getAttribute("data-sct-size-key");
      const own = SCT.fieldSize.ownOf(sizes.image || {}, key);
      if (own !== box.hasAttribute("data-sct-size-own")) ctx.setAttr(box, "data-sct-size-own", own ? "" : null);
      const h = SCT.fieldSize.heightOf(sizes.image || {}, key);
      const height = h ? `height: ${h}px;` : null;
      if (!SCT.fieldSize.held.has(box) && box.getAttribute("style") !== height) ctx.setAttr(box, "style", height);
      // the image, beside Sitecore's frame, which stays in the page for Sitecore to point at the next image picked
      let img = box.querySelector(":scope > img[data-sct-preview]");
      if (frame.getAttribute("src") && !img) {
        img = ctx.own(doc.createElement("img"));
        img.setAttribute("data-sct-preview", "");
        img.alt = frame.getAttribute("alt") || "";
        img.addEventListener("load", () => show(img, frame, box.getAttribute("data-sct-fit")));
        box.append(img);
      }
      if (img && !frame.getAttribute("src")) img.remove();
      else if (img) {
        // a newly picked image: Sitecore's thumbnail first, which gives the shape for the copy Fill and Fit fetch
        if (img.dataset.sctFrom !== frame.src) {
          img.dataset.sctFrom = frame.src;
          img.src = frame.src;
        } else show(img, frame, mode);
      }
      let bar = details.querySelector(":scope > [data-sct-fit-bar]");
      if (!bar) {
        bar = ctx.own(doc.createElement("span"));
        bar.setAttribute("data-sct-fit-bar", "");
        bar.setAttribute("role", "group");
        bar.setAttribute("aria-label", "Image preview size");
        for (const m of MODES) {
          const b = doc.createElement("button");
          b.type = "button";
          b.dataset.sctFit = m.id;
          b.textContent = m.label;
          b.title = m.title;
          bar.append(b);
        }
        details.prepend(bar);
      }
      for (const b of bar.children) {
        const on = String(b.dataset.sctFit === mode);
        if (b.getAttribute("aria-pressed") !== on) b.setAttribute("aria-pressed", on);
      }
    }
  }

  // a preview of another height, in a drag or after one: Fill and Fit fetch the copy it needs
  function onResize(entries) {
    for (const { target: box } of entries) {
      const img = box.querySelector(":scope > img[data-sct-preview]");
      const frame = box.querySelector(":scope > iframe[id$='_image']");
      if (img && frame && img.dataset.sctFrom === frame.src) show(img, frame, box.getAttribute("data-sct-fit"));
    }
  }

  // A press on the resize handle can end in a click on the box, whose own onclick opens the media browser: one that
  // went down on the handle (its corner), or ended on a box of another height than it started, goes no further.
  let press = null; // { box, height, grip } of the last pointerdown on a preview
  function onPointerDown(e) {
    const box = e.target.closest && e.target.closest(`${BOX}[data-sct-preview]`);
    const r = box && box.getBoundingClientRect();
    press = box && { box, height: r.height, grip: e.clientX > r.right - 20 && e.clientY > r.bottom - 20 };
  }
  function onBoxClick(e) {
    const box = press && e.target.closest && e.target.closest(BOX);
    if (!box || box !== press.box || !(press.grip || box.getBoundingClientRect().height !== press.height)) return;
    e.stopPropagation();
    e.preventDefault();
  }

  function onClick(e) {
    const button = e.target.closest && e.target.closest("[data-sct-fit-bar] > button");
    const ctx = button && contexts.get(button.ownerDocument);
    if (!ctx) return;
    const win = ctx.doc.defaultView;
    save(win, { ...load(win), mode: button.dataset.sctFit });
    apply(ctx);
  }

  SCT.registerAid("image-preview", {
    // the height not !important: the inline height a drag writes has to win over it
    css: `${BOX}[data-sct-preview]{height:128px}
${SCT.important(`${BOX}[data-sct-preview]{box-sizing:content-box;min-height:32px;overflow:hidden;resize:vertical}
${BOX}[data-sct-preview]>iframe{display:none}
${BOX}>img[data-sct-preview]{display:block;width:100%;height:100%;max-width:none;object-position:left top;cursor:pointer}
${BOX}[data-sct-fit=cover]>img[data-sct-preview]{object-fit:cover;object-position:center}
${BOX}[data-sct-fit=contain]>img[data-sct-preview]{object-fit:contain;object-position:center}
${BOX}[data-sct-fit=none]>img[data-sct-preview]{object-fit:none}
[data-sct-fit-bar]{float:right;display:inline-flex;gap:2px;margin:-3px 0 0 8px}
[data-sct-fit-bar]>button{all:unset;padding:1px 8px;border-radius:3px;font:inherit;color:inherit;cursor:pointer}
[data-sct-fit-bar]>button:hover{background:color-mix(in srgb,currentColor 12%,transparent)}
[data-sct-fit-bar]>button[aria-pressed=true]{background:color-mix(in srgb,currentColor 20%,transparent)}
[data-sct-fit-bar]>button:focus-visible{outline:2px solid var(--sct-focus-ring,Highlight);outline-offset:1px}`)}
${SCT.fieldSize.css}`,
    apply(ctx) {
      if (!contexts.has(ctx.doc)) {
        ctx.listen(ctx.doc, "click", onClick);
        ctx.listen(ctx.doc, "pointerdown", onPointerDown, true);
        ctx.listen(ctx.doc, "click", onBoxClick, true);
        SCT.fieldSize.watch(ctx, `${BOX}[data-sct-preview]`);
        ctx.listen(ctx.doc, SCT.fieldSize.CHANGED, () => contexts.has(ctx.doc) && apply(contexts.get(ctx.doc)));
      }
      contexts.set(ctx.doc, ctx);
      apply(ctx);
    },
    revert(ctx) {
      contexts.delete(ctx.doc);
      resized?.disconnect();
      resized = null;
    },
  });
})(globalThis);
