// Contrast scan for shots.cjs --scan: in every frame of the page, finds text below WCAG AA against the
// colour behind it, placeholders below AA, light patches in a dark theme, small glyphs (icons, arrows,
// knobs) whose rendered pixels barely differ from their background, and needless scrollbars (a menu or page
// that scrolls for a few pixels while it still has room to grow). Findings are leads, not verdicts:
// disabled controls and colour item icons on a selection can show up and are fine.

// Runs inside each frame. Returns text/light findings and the glyph boxes to check against the screenshot.
function inFrame() {
  // frames the extension leaves alone (the website in a Rich Text preview, blank frames) are not the theme's
  if (!document.documentElement.dataset.sctSurface) return null;
  let pen = null;
  const rgba = (s) => {
    const m = /rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?/.exec(s || "");
    if (m) return [+m[1], +m[2], +m[3], m[4] === undefined ? 1 : +m[4]];
    // oklch() and color() (a site's hue turns the tokens in OKLCH): painted to sRGB as the page paints them
    if (!/^(oklch|oklab|lch|lab|color)\(/.test(s || "")) return null;
    pen ??= document.createElement("canvas").getContext("2d", { willReadFrequently: true });
    pen.clearRect(0, 0, 1, 1);
    pen.fillStyle = s;
    pen.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = pen.getImageData(0, 0, 1, 1).data;
    return [r, g, b, a / 255];
  };
  const lum = ([r, g, b]) => {
    const f = (v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const ratio = (a, b) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);
  const name = (el) => {
    const parts = [];
    for (let n = el; n && n.nodeType === 1 && parts.length < 3; n = n.parentElement) {
      const cls = [...n.classList].filter((c) => !c.startsWith("sct-")).slice(0, 2).map((c) => `.${c}`).join("");
      parts.unshift(n.tagName.toLowerCase() + (n.id ? `#${n.id}` : "") + cls);
      if (n.id) break;
    }
    return parts.join(" > ");
  };
  const vw = innerWidth, vh = innerHeight;
  const shown = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1 || r.bottom < 0 || r.right < 0 || r.top > vh || r.left > vw) return null;
    const cs = getComputedStyle(el);
    return cs.visibility === "hidden" || +cs.opacity === 0 ? null : r;
  };
  // The colour painted behind el: the nearest opaque-enough background colour. null when an image,
  // gradient or filter on the way makes the computed colours a guess.
  const behind = (el) => {
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
      const cs = getComputedStyle(n);
      if (cs.filter !== "none" || cs.mixBlendMode !== "normal" || (cs.backdropFilter || "none") !== "none") return null;
      const c = rgba(cs.backgroundColor);
      if (c && c[3] >= 0.6) return c;
      if (cs.backgroundImage !== "none") return null;
    }
    return document.documentElement.style.colorScheme === "dark" ? [18, 18, 18, 1] : [255, 255, 255, 1];
  };
  const skip = (el) => el.closest(".ace_editor, [disabled], [aria-disabled='true'], .scRibbonToolbarLargeButtonDisabled, .scRibbonToolbarSmallButtonDisabled, .disabled");
  const appBg = rgba(getComputedStyle(document.documentElement).getPropertyValue("--sct-app-bg").trim().replace(/^#(..)(..)(..)$/, (_, r, g, b) => `rgb(${parseInt(r, 16)}, ${parseInt(g, 16)}, ${parseInt(b, 16)})`));
  const dark = appBg ? lum(appBg) < 0.2 : false;
  // the overflow a box scrolls for, if it is small (SLACK px or less) and the box could have grown instead
  const SLACK = 48;
  const needless = (el, cs, r) => {
    const out = [];
    const y = el.scrollHeight - el.clientHeight, x = el.scrollWidth - el.clientWidth;
    if (/auto|scroll/.test(cs.overflowY) && y > 1 && y <= SLACK && r.bottom + y < vh - 2) out.push(`${y}px too short`);
    if (/auto|scroll/.test(cs.overflowX) && x > 1 && x <= SLACK && r.right + x < vw - 2) out.push(`${x}px too narrow`);
    return out.join(", ");
  };
  const found = [], glyphs = [];
  // the page itself: a document a few pixels taller or wider than its window
  const page = document.scrollingElement;
  if (page && getComputedStyle(page).overflow !== "hidden" && getComputedStyle(document.body || page).overflow !== "hidden") {
    const y = page.scrollHeight - innerHeight, x = page.scrollWidth - innerWidth;
    if ((y > 1 && y <= SLACK) || (x > 1 && x <= SLACK)) found.push({ kind: "scroll", what: "the page", detail: `${Math.max(y, 0)}px taller, ${Math.max(x, 0)}px wider than the window` });
  }
  for (const el of document.body ? document.body.querySelectorAll("*") : []) {
    if (/^(SCRIPT|STYLE|IFRAME|FRAME|NOSCRIPT|BR|OPTION)$/.test(el.tagName)) continue;
    const r = shown(el);
    if (!r || skip(el)) continue;
    const cs = getComputedStyle(el);
    const bg = behind(el);
    const ownText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    if (ownText && bg) {
      const fg = rgba(cs.color);
      const large = parseFloat(cs.fontSize) >= 24 || (parseFloat(cs.fontSize) >= 18.66 && +cs.fontWeight >= 700);
      const x = fg && fg[3] > 0.5 ? ratio(fg, bg) : 99;
      if (x < (large ? 3 : 4.5)) found.push({ kind: "text", what: name(el), detail: `${x.toFixed(2)}:1 ${cs.color} on rgb(${bg.slice(0, 3).join(", ")})`, sample: el.textContent.trim().slice(0, 30) });
    }
    if (/^(INPUT|TEXTAREA)$/.test(el.tagName) && el.placeholder && bg) {
      const ph = rgba(getComputedStyle(el, "::placeholder").color);
      if (ph && ratio(ph, bg) < 4.5) found.push({ kind: "placeholder", what: name(el), detail: `${ratio(ph, bg).toFixed(2)}:1 ${getComputedStyle(el, "::placeholder").color}`, sample: el.placeholder.slice(0, 30) });
    }
    // a box that scrolls for a few pixels while it still has room to grow (a menu one row short, a page a few
    // pixels taller than the window): menus and pages never scroll unless they have run out of room
    const extra = needless(el, cs, r);
    if (extra) found.push({ kind: "scroll", what: name(el), detail: extra });
    const own = rgba(cs.backgroundColor);
    const masked = (cs.maskImage && cs.maskImage !== "none") || (cs.webkitMaskImage && cs.webkitMaskImage !== "none");
    // a masked element's background colour is its glyph's ink, not a patch
    if (dark && !masked && own && own[3] >= 0.6 && lum(own) > 0.45 && r.width * r.height >= 576 && !/^(IMG|VIDEO|CANVAS|svg)$/.test(el.tagName)) {
      found.push({ kind: "light", what: name(el), detail: `${cs.backgroundColor} ${Math.round(r.width)}x${Math.round(r.height)}` });
    }
    const small = r.width >= 5 && r.height >= 5 && r.width <= 40 && r.height <= 40;
    const painted = el.tagName === "IMG" || el.tagName === "svg" || cs.backgroundImage !== "none" || masked;
    if (small && painted && !ownText) {
      const back = behind(el.parentElement || el);
      // an item or command icon is drawn even when it matches its background (a white icon on a white header)
      const drawn = el.tagName === "IMG" && el.naturalWidth > 0 && /\/(temp\/iconcache|-\/icon)\//i.test(el.currentSrc || el.src);
      if (back) glyphs.push({ what: name(el), x: r.left, y: r.top, w: r.width, h: r.height, bg: back.slice(0, 3), drawn });
    }
  }
  return { url: location.pathname, dark, found, glyphs };
}

// Decodes the screenshot on a blank page (no Sitecore CSP there) and measures each glyph box: the most
// any of its pixels stands out from the colour behind it.
function measure({ png, boxes, scale }) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = img.width; c.height = img.height;
      const g = c.getContext("2d");
      g.drawImage(img, 0, 0);
      const lum = ([r, gr, b]) => {
        const f = (v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
        return 0.2126 * f(r) + 0.7152 * f(gr) + 0.0722 * f(b);
      };
      resolve(boxes.map((b) => {
        const x = Math.max(0, Math.round(b.x * scale)), y = Math.max(0, Math.round(b.y * scale));
        const w = Math.min(c.width - x, Math.round(b.w * scale)), h = Math.min(c.height - y, Math.round(b.h * scale));
        if (w < 2 || h < 2) return 99;
        const d = g.getImageData(x, y, w, h).data, lb = lum(b.bg);
        let best = 1;
        for (let i = 0; i < d.length; i += 4) {
          const l = lum([d[i], d[i + 1], d[i + 2]]);
          best = Math.max(best, (Math.max(l, lb) + 0.05) / (Math.min(l, lb) + 0.05));
        }
        return best;
      }));
    };
    img.src = `data:image/png;base64,${png}`;
  });
}

// Scans every frame of page; returns findings grouped by kind, selector and detail, with counts.
async function scanPage(page, scratch, scale = 1) {
  const all = [], boxes = [];
  for (const frame of page.frames()) {
    let off = { x: 0, y: 0 };
    if (frame !== page.mainFrame()) {
      const box = await frame.frameElement().then((e) => e.boundingBox()).catch(() => null);
      if (!box || box.width < 2) continue;
      off = box;
    }
    const res = await frame.evaluate(inFrame).catch(() => null);
    if (!res) continue;
    for (const f of res.found) all.push({ ...f, url: res.url });
    for (const g of res.glyphs) boxes.push({ ...g, x: g.x + off.x, y: g.y + off.y, url: res.url });
  }
  if (boxes.length) {
    const png = (await page.screenshot()).toString("base64");
    await scratch.goto("about:blank");
    const contrast = await scratch.evaluate(measure, { png, boxes, scale });
    boxes.forEach((b, i) => {
      // under 1.02 nothing is drawn at all (the blank spacers Sitecore puts beside leaf tree nodes), unless the box is an image
      if ((contrast[i] >= 1.02 || b.drawn) && contrast[i] < 1.6) all.push({ kind: "glyph", what: b.what, detail: `stands out ${contrast[i].toFixed(2)}:1 from rgb(${b.bg.join(", ")})`, url: b.url });
    });
  }
  const groups = new Map();
  for (const f of all) {
    const key = `${f.kind}|${f.url}|${f.what}|${f.detail}`;
    const g = groups.get(key) || { ...f, count: 0 };
    g.count++;
    groups.set(key, g);
  }
  return [...groups.values()];
}

module.exports = { scanPage };
