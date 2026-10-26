// A theme's miniature: a tiny Sitecore Desktop drawn as SVG from a spec, on a whole-pixel 54x36 grid so every
// edge lands on a pixel. Only what tells themes apart: wallpaper, taskbar and where it sits, window frame,
// title bar and its buttons, ribbon with the accent tab, a tree with one selected row, a section and a field.
// spec fields (colours unless noted):
//   desk, desk2 (vertical gradient to), deco: "grid" | "hills" | "synth"
//   bar, barLine, start, app, barPos: "bottom" | "top" | "right" | "dock" | "center" | "deskbar" | "notes" | "pills" | "tmux"
//   menu: true adds a NeXT-style menu panel at the top left
//   win, border, bw (px, 0 for none), r (px), cap, cap2 (gradient), stripes (stripe colour), pin (pinstripe colour)
//   btns: "right" | "traffic" | "left" | "both", btn, close; tabCap: true draws the title as a BeOS tab
//   ribbon, tab, tabs (divider colours), tree, ed, sec, field, line, sel, fg (outline themes)
//   outline: true draws panels as lines in fg; elbows: [ribbon colour, tree colour]; double: inner frame line
(function (root) {
  const SCT = (root.SCT = root.SCT || {});
  const rect = (x, y, w, h, fill, extra = "") => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"${extra}/>`;
  // a 1px line round a box: half-pixel offsets keep the stroke on whole pixels
  const box = (x, y, w, h, stroke, extra = "") => `<rect x="${x + 0.5}" y="${y + 0.5}" width="${w - 1}" height="${h - 1}" fill="none" stroke="${stroke}"${extra}/>`;
  let n = 0;

  function swatch(s, label = "") {
    const W = 54, H = 36, id = `sw${++n}`, defs = [], out = [], bar = [];
    const pos = s.barPos || "bottom";

    if (s.desk2) defs.push(`<linearGradient id="${id}d" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${s.desk}"/><stop offset="1" stop-color="${s.desk2}"/></linearGradient>`);
    out.push(rect(0, 0, W, H, s.desk2 ? `url(#${id}d)` : s.desk));
    if (s.deco === "grid") for (let i = 6; i < W; i += 6) { out.push(rect(i, 0, 1, H, "#fff", ' opacity=".14"')); if (i < H) out.push(rect(0, i, W, 1, "#fff", ' opacity=".14"')); }
    if (s.deco === "hills") out.push(`<ellipse cx="14" cy="40" rx="32" ry="12" fill="#5a9b2c" shape-rendering="geometricPrecision"/>`);
    if (s.deco === "synth") out.push(`<circle cx="40" cy="20" r="8" fill="#ff7a3d" shape-rendering="geometricPrecision"/>`, rect(32, 21, 16, 1, s.desk2), rect(32, 24, 16, 1, s.desk2), rect(0, 26, W, 10, "#12002b"), rect(0, 27, W, 1, "#ff2e88"), rect(0, 31, W, 1, "#ff2e88"));

    // the taskbar decides where the window sits
    let x = 3, y = 3, w = 48, h = 26;
    if (pos === "top") { y = 7; h = 26; }
    if (pos === "right") { x = 2; w = 42; h = 30; }
    if (pos === "deskbar") { x = 2; y = 7; w = 38; h = 27; }
    if (pos === "tmux") { x = 2; y = 2; w = 50; h = 29; }
    if (pos === "notes" || pos === "pills") h = 25;
    if (s.menu) { x = 10; w = 34; }

    if (pos === "bottom" || pos === "center") {
      bar.push(rect(0, 31, W, 5, s.bar));
      if (s.barLine) bar.push(rect(0, 31, W, 1, s.barLine));
      if (pos === "bottom") bar.push(rect(1, 32, 7, 3, s.start), rect(10, 32, 10, 3, s.app || s.bar));
      else for (let i = 0; i < 4; i++) bar.push(rect(20 + i * 4, 32, 3, 3, i ? s.app : s.start));
    } else if (pos === "top") {
      bar.push(rect(0, 0, W, 4, s.bar), rect(0, 4, W, 1, s.barLine || s.border), rect(2, 1, 3, 2, s.start), rect(40, 1, 12, 2, s.app || s.start));
    } else if (pos === "right") {
      bar.push(rect(46, 0, 8, H, s.bar));
      for (let i = 0; i < 3; i++) bar.push(rect(47, 1 + i * 7, 6, 6, i ? s.app : s.start), box(47, 1 + i * 7, 6, 6, s.barLine || "#222"));
    } else if (pos === "dock") {
      bar.push(rect(15, 31, 24, 4, s.bar, ' rx="1.5"'));
      for (let i = 0; i < 4; i++) bar.push(rect(18 + i * 5, 32, 3, 2, i === 1 ? s.start : s.app));
    } else if (pos === "deskbar") {
      bar.push(rect(42, 2, 10, 11, s.bar), box(42, 2, 10, 11, s.border), rect(43, 3, 8, 3, s.start), rect(43, 8, 7, 1, s.app || s.border), rect(43, 10, 5, 1, s.app || s.border));
    } else if (pos === "notes") {
      bar.push(rect(3, 30, 8, 5, s.start), rect(13, 30, 8, 5, s.app), rect(23, 30, 8, 5, s.app));
    } else if (pos === "pills") {
      bar.push(rect(2, 31, 10, 4, s.start, ' rx="2"'), rect(13, 31, 10, 4, s.app), rect(24, 31, 10, 4, s.app2 || s.app), rect(42, 31, 10, 4, s.app2 || s.app, ' rx="2"'));
    } else if (pos === "tmux") {
      bar.push(rect(0, 33, W, 3, s.bar), rect(0, 33, 6, 3, s.start));
    }
    if (s.menu) out.push(rect(1, 1, 7, 2, "#000"), rect(1, 3, 7, 9, s.win), box(1, 1, 7, 11, "#000"), rect(1, 6, 7, 2, "#fff"));

    const o = s.outline, fill = (c) => (o ? "none" : c), rr = s.r || 0;
    if (s.shadow) out.push(rect(x + 1, y + 1, w, h, "#000", ` rx="${rr}" opacity=".22"`));
    out.push(rect(x, y, w, h, fill(s.win), ` rx="${rr}"`));
    // a rounded window's panels stay inside its corners
    const winStart = out.length;
    if (rr) defs.push(`<clipPath id="${id}w"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rr}"/></clipPath>`);

    // title bar
    const capH = s.tabCap ? 0 : 4;
    if (s.tabCap) {
      out.push(rect(x, y - 4, 16, 4, s.cap), box(x, y - 4, 16, 5, s.border), rect(x + 2, y - 3, 2, 2, s.btn));
    } else {
      if (s.cap2) defs.push(`<linearGradient id="${id}c" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${s.cap}"/><stop offset="1" stop-color="${s.cap2}"/></linearGradient>`);
      out.push(`<path d="M${x} ${y + capH}V${y + rr}a${rr} ${rr} 0 0 1 ${rr} -${rr}H${x + w - rr}a${rr} ${rr} 0 0 1 ${rr} ${rr}V${y + capH}Z" fill="${o ? "none" : s.cap2 ? `url(#${id}c)` : s.cap}"/>`);
      if (s.pin) for (let i = 1; i < capH; i += 2) out.push(rect(x + 1, y + i, w - 2, 1, s.pin));
      if (s.stripes) for (let i = 2; i < w - 2; i += 4) out.push(rect(x + i, y, 2, capH, s.stripes));
      if (o) out.push(rect(x, y + capH, w, 1, s.fg));
      const b = s.btn || s.border;
      if (s.btns === "traffic") out.push(rect(x + 2, y + 1, 2, 2, "#ff5f57"), rect(x + 5, y + 1, 2, 2, "#febc2e"), rect(x + 8, y + 1, 2, 2, "#28c840"));
      if (s.btns === "right") out.push(rect(x + w - 10, y + 1, 2, 2, b), rect(x + w - 7, y + 1, 2, 2, b), rect(x + w - 4, y + 1, 3, 2, s.close || b));
      if (s.btns === "left" || s.btns === "both") out.push(rect(x + 1, y + 1, 2, 2, b));
      if (s.btns === "both") out.push(rect(x + w - 3, y + 1, 2, 2, b));
    }

    // ribbon with the open tab
    const ry = y + capH;
    if (s.elbows) out.push(`<path d="M${x} ${ry + 5}V${ry + 3}a3 3 0 0 1 3 -3H${x + w}v2H${x + 4}a1 1 0 0 0 -1 1V${ry + 5}Z" fill="${s.elbows[0]}" shape-rendering="geometricPrecision"/>`);
    else out.push(rect(x, ry, w, 4, fill(s.ribbon)));
    if (o) out.push(rect(x, ry + 4, w, 1, s.fg));
    if (s.tabs) s.tabs.forEach((c, i) => out.push(rect(x + 2 + i * 5, ry, 4, 2, c)));
    else if (!s.elbows) out.push(rect(x + 2, ry, 6, 1, s.tab));

    // tree with one selected row, editor with a section and a field
    const by = ry + 4, bh = h - capH - 4, tw = Math.round(w * 0.3);
    if (s.elbows) out.push(`<path d="M${x} ${by + 1}h3V${by + bh - 3}a1 1 0 0 0 1 1H${x + tw}v2H${x + 3}a3 3 0 0 1 -3 -3Z" fill="${s.elbows[1]}" shape-rendering="geometricPrecision"/>`);
    else out.push(rect(x, by, tw, bh, fill(s.tree)));
    out.push(rect(x + tw, by, w - tw, bh, fill(s.ed)), rect(x + tw, by, 1, bh, o ? s.fg : s.border));
    const tx = x + (s.elbows ? 4 : 2);
    out.push(rect(tx, by + 4, tw - (s.elbows ? 5 : 4), 3, s.sel, o ? ' fill-opacity=".3"' : ""));
    const ex = x + tw + 3, ew = w - tw - 5;
    out.push(rect(ex, by + 3, ew, 3, o ? "none" : s.sec), o ? box(ex, by + 3, ew, 3, s.fg) : "");
    if (by + 13 <= y + h) {
      if (s.underline) out.push(rect(ex, by + 11, ew, 1, s.line));
      else out.push(rect(ex, by + 8, ew, 4, fill(s.field)), box(ex, by + 8, ew, 4, s.line));
    }

    if (rr) out.splice(winStart, out.length - winStart, `<g clip-path="url(#${id}w)">${out.slice(winStart).join("")}</g>`);
    if (s.bw !== 0) out.push(`<rect x="${x + 0.5}" y="${y + 0.5}" width="${w - 1}" height="${h - 1}" rx="${rr}" fill="none" stroke="${o ? s.fg : s.border}"/>`);
    if (s.bw === 2) out.push(box(x + 1, y + 1, w - 2, h - 2, s.border));
    if (s.double) out.push(box(x + 2, y + 2, w - 4, h - 4, s.border, ' opacity=".7"'));

    const safe = String(label).replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`); // imported themes name themselves
    return `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${safe}" shape-rendering="crispEdges"><defs>${defs.join("")}</defs>${out.join("")}${bar.join("")}</svg>`;
  }

  // An imported theme has no miniature of its own: a neutral Desktop.
  const PLAIN = { desk: "#9aa3b0", bar: "#3b3f46", start: "#7a8494", app: "#5a6070", win: "#ffffff", border: "#8a8f99", cap: "#e4e6ea",
    btns: "right", btn: "#8a8f99", ribbon: "#f2f3f5", tab: "#7a8494", tree: "#ffffff", ed: "#f7f8f9", sec: "#e9ebee", field: "#ffffff", line: "#c3c7ce", sel: "#dfe3ea" };
  // a theme may draw differently on one Sitecore version (Native on 10.4 is 10.4's look)
  SCT.swatchSpec = (theme, version) => (theme && ((theme.swatchFor || {})[version] || theme.swatch)) || PLAIN;
  SCT.swatch = swatch;
  if (typeof module !== "undefined") module.exports = swatch;
})(globalThis);
