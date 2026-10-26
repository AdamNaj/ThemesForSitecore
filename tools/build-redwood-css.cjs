// Dev tool: writes extension/themes/redwood/{shell,speak,launchpad,login}.css and the glyph images in
// extension/themes/redwood/glyphs. Redwood recreates NeXTSTEP's grey look; the bevels and glyphs are drawn
// from code, so they are generated here rather than written by hand. Run: node tools/build-redwood-css.cjs
//
// The NeXTSTEP spec this file follows (measured from NeXTSTEP 3.3 at 100%):
// | Part              | Value                                                                        |
// |-------------------|------------------------------------------------------------------------------|
// | Face              | #aaaaaa; content wells #cccccc; lists and fields #ffffff; desktop #505050     |
// | Bevel             | 1px white top and left, 1px #555555 bottom and right, a 1px black outline     |
// | Sunken (fields)   | 1px #555555 top and left, 1px #ffffff bottom and right, a black inner line    |
// | Font              | Helvetica (Arial where it is missing), 12px; titles and menus bold            |
// | Title bar         | 20px, #000000, title centred in bold white; inactive #aaaaaa with black text  |
// | Title buttons     | 16px bevelled grey squares: miniaturise at the left, close at the right       |
// | Menu              | a vertical panel: black title row, 20px grey rows with white/#555 lines,     |
// |                   | a right-pointing arrow on submenu rows, the highlighted row white             |
// | Scroller          | 18px, a #555555 trough, a bevelled #aaaaaa knob, bevelled arrow buttons       |
// | Dock              | 64px bevelled tiles down the screen's right edge                              |
// | Selection         | white in menus and on grey; #aaaaaa (control grey) on white lists             |
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const crypto = require("crypto");

const T = (surface) => `html[data-sct-theme="redwood"][data-sct-surface="${surface}"]`;
const P = T("shell");
// :not(#sct-rw) matches every page; its id weight lets hand-written rules beat Sitecore's own.
const W = (surface) => `${T(surface)}:not(#sct-rw)`;
const FONT = "Helvetica, Arial, sans-serif";
// Glyphs are shapes on an 18px grid, centred in whatever box they paint: triangles, bars, crosses and
// polygons. art() writes each glyph into themes/redwood/glyphs twice, as a PNG and as an SVG. image-set()
// gives a 100% screen the PNG, rasterised the way a hard colour stop is (a pixel is filled when its centre
// is inside the shape) and kept exact by pixelate(); every other scale gets the SVG, drawn at the screen's
// resolution. The CSS names the files sct-ext:<path>, which background.js points at the extension's own
// URL, so a page CSP without data: in img-src (some installs send one) still loads them.
const HEX = { K: "#000", W: "#fff", G: "#555555", C: "#aaaaaa", D: "#333333", L: "#777777", M: "#cccccc" };
const LETTER = Object.fromEntries(Object.entries(HEX).map(([k, v]) => [v, k]));
// a w-wide triangle pointing down or up is (w + 1) / 2 tall; one pointing left or right the other way round
const tri = {
  down: (x, y, w, c = "#000") => ({ kind: "down", x, y, w, h: (w + 1) / 2, c }),
  up: (x, y, w, c = "#000") => ({ kind: "up", x, y, w, h: (w + 1) / 2, c }),
  left: (x, y, h, c = "#000") => ({ kind: "left", x, y, w: (h + 1) / 2, h, c }),
  right: (x, y, h, c = "#000") => ({ kind: "right", x, y, w: (h + 1) / 2, h, c }),
};
const bar = (x, y, w, h, c = "#000") => ({ kind: "bar", x, y, w, h, c });
// a cross corner to corner in an s-pixel square, t pixels thick (NeXT's close glyph is a bold X)
const cross = (x, y, s, c = "#000", t = 1) => ({ kind: "cross", x, y, w: s, h: s, c, t });
// any polygon, points in pixel-edge coordinates: [[x, y], ...]
const poly = (pts, c = "#000") => {
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  return { kind: "poly", pts, x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys), c };
};
const inPoly = (pts, px, py) => {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};

function rasterize(shapes, w, h) {
  const px = Array.from({ length: h }, () => Array(w).fill("."));
  const set = (x, y, c) => { if (x >= 0 && x < w && y >= 0 && y < h) px[y][x] = LETTER[c]; };
  for (const s of shapes) {
    if (s.kind === "poly") {
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (inPoly(s.pts, x + 0.5, y + 0.5)) set(x, y, s.c);
      continue;
    }
    for (let j = 0; j < s.h; j++) for (let i = 0; i < s.w; i++) {
      const d = s.kind === "left" || s.kind === "right" ? Math.abs(j - (s.h - 1) / 2) : 0;
      const on = {
        bar: true,
        down: i >= j && i <= s.w - 1 - j,
        up: i >= s.h - 1 - j && i <= s.w - 1 - (s.h - 1 - j),
        left: i >= d,
        right: i <= s.w - 1 - d,
        cross: (i - j >= 0 && i - j < s.t) || (s.w - 1 - j - i >= 0 && s.w - 1 - j - i < s.t) || (i - j <= 0 && j - i < s.t) || (i + j - (s.w - 1) >= 0 && i + j - (s.w - 1) < s.t),
      }[s.kind];
      if (on) set(s.x + i, s.y + j, s.c);
    }
  }
  return px.map((r) => r.join(""));
}
// The same shapes as vectors. A triangle's sides run through the middle of each pixel step, so it covers
// the same area as its pixels. Bars keep their edges on device pixels (crispEdges).
function vectorize(shapes) {
  return shapes.map(({ kind, x, y, w, h, c, t, pts }) => {
    const path_ = (...p) => `<path d="M${p.join("L")}Z" fill="${c}"/>`;
    if (kind === "bar") return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${c}" shape-rendering="crispEdges"/>`;
    if (kind === "poly") return path_(...pts.map(([a, b]) => `${a} ${b}`));
    if (kind === "down") return path_(`${x - 0.5} ${y}`, `${x + w + 0.5} ${y}`, `${x + w / 2} ${y + h}`);
    if (kind === "up") return path_(`${x - 0.5} ${y + h}`, `${x + w + 0.5} ${y + h}`, `${x + w / 2} ${y}`);
    if (kind === "left") return path_(`${x + w} ${y - 0.5}`, `${x + w} ${y + h + 0.5}`, `${x} ${y + h / 2}`);
    if (kind === "right") return path_(`${x} ${y - 0.5}`, `${x} ${y + h + 0.5}`, `${x + w} ${y + h / 2}`);
    return `<svg x="${x}" y="${y}" width="${w}" height="${h}" overflow="hidden"><path d="M0 0L${w} ${h}M${w} 0L0 ${h}" stroke="${c}" stroke-width="${1.4 * (t || 1)}"/></svg>`;
  }).join("");
}
const GLYPHS = path.join(__dirname, "..", "extension", "themes", "redwood", "glyphs");
fs.rmSync(GLYPHS, { recursive: true, force: true });
fs.mkdirSync(GLYPHS, { recursive: true });
// One background layer: the glyph on a w x h canvas (18px by default), centred unless placed otherwise.
// Both images get a transparent 1px margin: Chrome softens the edge of an image placed between device
// pixels, and the margin keeps that softening off the art.
function art(shapes, { w = 18, h = 18, pos = "center" } = {}) {
  const rows = rasterize(shapes, w, h);
  const svg = vectorize(shapes);
  const name = crypto.createHash("sha1").update(rows.join("|") + svg).digest("hex").slice(0, 10);
  const pad = ".".repeat(w + 2);
  fs.writeFileSync(path.join(GLYPHS, `${name}.png`), png([pad, ...rows.map((r) => `.${r}.`), pad]));
  fs.writeFileSync(path.join(GLYPHS, `${name}.svg`),
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w + 2}" height="${h + 2}" viewBox="-1 -1 ${w + 2} ${h + 2}">${svg}</svg>\n`);
  const url = (ext) => `url("sct-ext:themes/redwood/glyphs/${name}.${ext}")`;
  return `image-set(${url("png")} 1x, ${url("svg")} 2x) ${pos} / ${w + 2}px ${h + 2}px no-repeat`;
}
function png(rows) {
  const h = rows.length, w = rows[0].length;
  const raw = Buffer.alloc(h * (w * 4 + 1));
  rows.forEach((r, y) => [...r].forEach((c, x) => {
    if (c === ".") return;
    const hex = HEX[c].replace(/^#(.)(.)(.)$/, "#$1$1$2$2$3$3");
    raw.writeUInt32BE(((parseInt(hex.slice(1), 16) << 8) | 0xff) >>> 0, y * (w * 4 + 1) + 1 + x * 4);
  }));
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(zlib.crc32(Buffer.concat([Buffer.from(type), data])));
    return Buffer.concat([len, Buffer.from(type), data, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from("89504e470d0a1a0a", "hex"), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}
// At exactly 100% the glyphs' PNGs are drawn nearest-neighbour, so a glyph centred between pixels stays
// exact: every rule whose background draws one gets image-rendering: pixelated in one @media block. The
// property inherits, so a zero-specificity reset keeps it off the element's children.
function pixelate(text) {
  const sels = [...text.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .filter((m) => /(^|[;\s])background(-image)?\s*:[^;]*sct-ext:/.test(m[2]))
    .map((m) => m[1].trim());
  if (!sels.length) return text;
  const all = ':where(html[data-sct-theme="redwood"] *)';
  return `${text}
/* glyphs at exactly 100%: their PNGs, nearest-neighbour (see pixelate()) */
@media (resolution: 1dppx) {
  ${all}, ${all}::before, ${all}::after { image-rendering: auto; }
${sels.map((s) => `  ${s} { image-rendering: pixelated; }`).join("\n")}
}
`;
}
// NeXT's raised face: white top and left, #555 right and bottom, as bands along the box's own edges (for
// glyph buttons without a border of their own: scroller arrows, title-bar buttons)
const bevel = ["linear-gradient(270deg, #555555 1px, transparent 0)", "linear-gradient(0deg, #555555 1px, transparent 0)",
  "linear-gradient(#fff 1px, transparent 0)", "linear-gradient(90deg, #fff 1px, transparent 0)", "linear-gradient(#aaaaaa, #aaaaaa)"];
const btn = (...glyph) => [art(glyph), ...bevel].join(", ");
// Hides an <img>'s own picture so the painted background shows instead.
const paint = (g) => `object-fit: none; object-position: -999px -999px; background: ${g};`;

// NeXT's pop-up list glyph: a small raised bar
const popGlyph = (x, y) => [bar(x, y, 8, 5, "#aaaaaa"), bar(x, y, 8, 1, "#fff"), bar(x, y, 1, 5, "#fff"), bar(x, y + 4, 8, 1, "#000"), bar(x + 7, y, 1, 5, "#000")];
// NeXT's return-key glyph on the default button: a hooked arrow
const returnGlyph = [bar(9, 4, 2, 7), bar(5, 9, 6, 2), tri.left(2, 7, 7)];
// the Dock's start tile: a neutral dark cube seen from above, three shaded faces (never the NeXT logo)
const cube = [
  poly([[20, 5], [35, 12], [20, 19], [5, 12]], "#777777"),
  poly([[5, 12], [20, 19], [20, 36], [5, 29]], "#333333"),
  poly([[20, 19], [35, 12], [35, 29], [20, 36]], "#000"),
  poly([[20, 5], [35, 12], [34, 12.5], [20, 6]], "#cccccc"),
  poly([[5, 12], [20, 5], [20, 6], [6, 12.5]], "#aaaaaa"),
];

const G = {
  up: btn(tri.up(5, 7, 7)),
  down: btn(tri.down(5, 7, 7)),
  left: btn(tri.left(6, 5, 7)),
  right: btn(tri.right(6, 5, 7)),
  // title-bar buttons: miniaturise (a small window), close (a bold X), zoom and restore (one and two frames)
  mini: btn(bar(6, 6, 6, 6), bar(7, 7, 4, 4, "#fff")),
  close: btn(cross(5, 5, 8, "#000", 2)),
  zoom: btn(bar(4, 4, 10, 10), bar(5, 6, 8, 7, "#aaaaaa")),
  restore: btn(bar(6, 3, 9, 8), bar(7, 5, 7, 5, "#aaaaaa"), bar(3, 7, 9, 8), bar(4, 9, 7, 5, "#aaaaaa")),
  switcher: btn(bar(5, 5, 8, 1), bar(5, 8, 8, 1), bar(5, 11, 8, 1)),
  dots: btn(bar(5, 9, 2, 2), bar(8, 9, 2, 2), bar(11, 9, 2, 2)),
  ctrl: btn(bar(5, 5, 8, 1), bar(5, 8, 8, 1), bar(5, 11, 8, 1)),
  first: btn(bar(5, 5, 1, 7), tri.left(7, 5, 7)),
  last: btn(bar(12, 5, 1, 7), tri.right(7, 5, 7)),
  // a pop-up list's button: the raised bar
  combo: btn(...popGlyph(5, 7)),
  // the Launchpad button: nine squares
  grid: art([0, 4, 8].flatMap((y) => [0, 4, 8].map((x) => bar(3 + x, 3 + y, 3, 3)))),
};
// The pop-up glyph at the right end of a select: NeXT's pop-up list is a raised button with the glyph.
const comboRight = art(popGlyph(0, 0), { w: 8, h: 5, pos: "right 7px center" });
// Bare glyphs (no button face) for drop-down arrows and submenu arrows.
const triDown = (c = "#000") => art([tri.down(5, 7, 7, c)]);
const triRight = (c = "#000") => art([tri.right(7, 5, 7, c)]);
// a menu's submenu arrow: NeXT's small solid right-pointing triangle
const menuArrow = (c = "#000") => art([tri.right(7, 5, 9, c)]);
// NeXT's switch: a check mark in a raised grey square
const checkMark = art([poly([[2, 6], [4, 6], [5, 8.5], [9, 1], [11, 1], [5.5, 11], [4.5, 11]])], { w: 12, h: 12, pos: "center" });
const returnKey = (pos) => art(returnGlyph, { w: 14, h: 14, pos });

const raised = "border: 1px solid #000; box-shadow: inset 1px 1px #fff, inset -1px -1px #555555;";
const sunken = "box-shadow: inset 1px 1px #555555, inset -1px -1px #fff;";
// NeXT's text field: white, sunk into the face (dark top and left, white bottom and right, a black line
// inside the dark edge)
const edit = "background: #fff; color: #000; border: 1px solid; border-color: #555555 #fff #fff #555555; border-radius: 0; box-shadow: inset 1px 1px #000;";
const button = `background: #aaaaaa; color: #000; font: 12px ${FONT}; text-transform: none; text-shadow: none; border-radius: 0; ${raised}`;
// A tab: raised, rounded at the top, open at the bottom where it meets its page; the closed ones a shade darker.
const tabFace = `background: #999999; color: #000; border: 1px solid #000; border-bottom: 0; border-radius: 4px 4px 0 0; box-shadow: inset 1px 1px #fff, inset -1px 0 #555555; text-transform: none; text-shadow: none; font-family: ${FONT}; font-size: 12px;`;
// a NeXT window: the black outline and a 3px drop shadow
const winFrame = "border: 1px solid #000; box-shadow: 3px 3px 0 rgba(0, 0, 0, 0.45);";
// a title bar's text
const titleText = `color: #fff; font: bold 12px / 20px ${FONT}; text-align: center; text-transform: none; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;`;

// ---- Shared by every area: the global header is a NeXT shelf, a grey bevelled panel. Its launchpad
// button is a bevelled square with the nine-squares glyph, the portrait sits in a bevelled frame. ----
const header = (S, bar) => `${S}:not(#sct-rw) :is(.sc-globalHeader, .sc-flx-global-header) {
  background: #aaaaaa !important;
  border-bottom: 1px solid #000;
  box-shadow: inset 0 1px #fff, inset 0 -1px #555555;
  color: #000;
  font-family: ${FONT};
}
${S}:not(#sct-rw) :is(.sc-globalHeader, .sc-flx-global-header) :is(span, a, li, .sc-globalheader-appName),
${S}:not(#sct-rw) :is(.sc-globalHeader, .sc-flx-global-header) .sc-accountInformation li::after {
  color: #000;
  font-family: ${FONT};
  font-size: 12px;
  font-weight: bold;
}
${S}:not(#sct-rw) :is(.sc-globalHeader, .sc-flx-global-header) a.sc-global-logo,
${S}:not(#sct-rw) :is(.sc-globalHeader, .sc-flx-global-header) a.sc-global-logo:hover {
  box-sizing: border-box;
  width: 26px;
  height: 26px;
  margin-top: 12px;
  border-radius: 0;
  /* the token layer cuts 10.5's glyph out of the header colour with a mask */
  mask: none;
  background: ${G.grid}, #aaaaaa;
  ${raised}
}
${S}:not(#sct-rw) :is(.sc-globalHeader, .sc-flx-global-header) a.sc-global-logo:active { ${sunken} background-color: #fff; }
/* every item centred on the bar: the account list is a row of flex items centred on its own height */
${S}:not(#sct-rw) :is(.sc-globalHeader, .sc-flx-global-header) ul.sc-accountInformation {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  /* the bar's height above its 1px bottom border: 50px in the shell, 49px on SPEAK pages, 47px on
     the Launchpad */
  height: ${bar}px;
}
${S}:not(#sct-rw) :is(.sc-globalHeader, .sc-flx-global-header) ul.sc-accountInformation > li {
  display: flex;
  align-items: center;
  line-height: normal;
}
${S}:not(#sct-rw) :is(.sc-globalHeader, .sc-flx-global-header) .sc-ext-dbName {
  align-self: center;
  margin-top: 0;
  margin-bottom: 0;
  color: #000;
  font: bold 12px ${FONT};
  line-height: normal;
  vertical-align: middle;
}
${S}:not(#sct-rw) :is(.sc-globalHeader, .sc-flx-global-header) .sc-accountInformation img {
  box-sizing: border-box;
  width: 32px;
  height: 32px;
  padding: 2px;
  border-radius: 0;
  background: #aaaaaa;
  ${raised}
}`;


// The Dock shows a running application's icon at 32px: the task button carries its 16px icon, so the
// applications the start menu lists get their own 32px art; any other keeps its 16px icon, scaled.
const dockIcons = [["Apps", ["pencil", "pictures", "shield", "newspaper", "earth", "paint", "preview", "codes", "refresh",
  "workbox", "setting", "account", "user (1)", "lock", "routes", "packager", "logviewer", "keyboardmap", "install_wizard",
  "informations", "certificate", "importation", "link_broken", "run"]], ["PowerShell", ["ise8", "console", "powershell_runner"]]]
  .flatMap(([dir, names]) => names.map((n) =>
    `  .scStartBarApplication > span > img[src*="/${dir}/16x16/${n}.png" i] { ${paint(`url("/sitecore/shell/~/icon/${dir}/32x32/${n}.png") center / 32px 32px no-repeat`)} }`))
  .join("\n");

// ---- Shell: details 10.x's markup and inline styles need ----
const shellHand = `${W("shell")} {
  /* ---- Menus (context menus, start menu fly-outs, drop-downs): NeXT menu panels. Grey rows, each
     raised by a white line above and a #555 line below, inside a black outline with the window's drop
     shadow; the highlighted row turns white. ---- */
  .scPopup:not(:has(> .scStartMenu)) {
    padding: 0;
    ${winFrame}
    border-radius: 0;
    background: #aaaaaa;
  }
  .scMenu {
    border: 0;
    border-collapse: collapse;
    border-radius: 0;
    box-shadow: none;
    background: #aaaaaa;
    color: #000;
  }
  .scMenu tr > td:is([class^="scMenuItem"], [class^="scMenuPanelItem"]) {
    box-sizing: border-box;
    height: 21px;
    padding-top: 0;
    padding-bottom: 0;
    border: 0;
    border-top: 1px solid #fff;
    border-bottom: 1px solid #555555;
    background: #aaaaaa;
    color: #000;
    font: 12px ${FONT};
    line-height: 19px;
  }
  .scMenu td[class^="scMenuItemIcon"] {
    width: 18px;
    padding: 0 2px 0 4px;
  }
  .scMenu td[class^="scMenuItemCaption"] { padding: 0 8px 0 4px; }
  .scMenu td[class^="scMenuItemHotkey"] { padding: 0 4px; }
  .scMenu tr > td[class^="scMenuItem"][class$="_Disabled"] { color: #555555; }
  .scMenu td[class$="_Disabled"] img { opacity: 0.5; }
  .scMenu tr:not(:has(td[class$="_Disabled"])):hover > td,
  .scMenu tr > td[class$="_Hover"] {
    background: #fff;
    color: #000;
  }
  .scMenu tr:not(:has(td[class$="_Disabled"])):hover > td * { color: #000; }
  /* separators: a groove between two rows */
  .scMenu tr > td[class^="scMenuDivider"] {
    height: 4px;
    padding: 0;
    border: 0;
    background: linear-gradient(#555555 1px, #000 1px 2px, #fff 2px 3px, #aaaaaa 3px);
  }
  .scMenu img[src*="Submenu16x16" i] { ${paint(menuArrow())} }
  /* Sitecore focuses the first row when a menu opens: only keyboard focus shows, as a dotted frame */
  .scMenu tr:focus { outline: none; }
  .scMenu tr:focus-visible > td { outline: 1px dotted #000; outline-offset: -2px; }

  /* ---- Content tree search: a grey strip, a square edit field and two bevelled buttons of its
     height (fixed border-box heights keep their edges level at any zoom) ---- */
  #SearchPanel {
    margin: 0;
    padding: 3px 4px;
    background: #aaaaaa;
    border-bottom: 1px solid #000;
  }
  #SearchPanel > table {
    width: 100%;
    border-spacing: 0;
  }
  #SearchPanel > table > tbody > tr > td {
    height: auto;
    padding: 0;
    vertical-align: middle;
  }
  #SearchPanel > table > tbody > tr > td:first-child { width: 100%; }
  #SearchPanel > table > tbody > tr > td > div {
    float: none !important;
    padding: 0 !important;
  }
  #SearchPanel .scElementHover {
    width: auto;
    height: auto;
    margin: 0;
    padding: 0;
    border: 0;
    background: none;
  }
  #TreeSearch {
    box-sizing: border-box;
    width: 100%;
    height: 22px;
    min-height: 0;
    padding: 2px 4px;
    ${edit}
    font: 12px ${FONT};
  }
  :is(a.scSearchButton, a.scSearchOptionsButton) {
    display: block;
    box-sizing: border-box;
    width: 22px;
    height: 22px;
    margin: 0 0 0 2px;
    padding: 0;
    background: #aaaaaa;
    border-radius: 2px;
    ${raised}
  }
  :is(a.scSearchButton, a.scSearchOptionsButton):active { ${sunken} }
  :is(a.scSearchButton, a.scSearchOptionsButton) img {
    display: block;
    width: 16px;
    height: 16px;
    margin: 2px;
    padding: 0;
  }
  a.scSearchOptionsButton img { ${paint(triDown())} }
  #TreeSearchOptions {
    width: 100%;
    margin: 3px 0 0;
  }
  #TreeSearchOptions td {
    height: auto;
    padding: 1px 0;
    vertical-align: middle;
  }
  #TreeSearchOptions .scElementHover {
    margin: 0;
    padding: 0 4px 0 0;
    border: 0;
    background: none;
  }
  #TreeSearchOptions :is(a.scSearchOptionName, a.scSearchAddCriteria, a.scSearchAddCriteria span) {
    color: #000;
    font: bold 12px ${FONT};
  }
  #TreeSearchOptions img.arrowDown { ${paint(triDown())} }
  #TreeSearchOptions input.scSearchOptionsInput {
    box-sizing: border-box;
    width: 100%;
    height: 22px;
    min-height: 0;
    padding: 2px 4px;
    ${edit}
    font: 12px ${FONT};
  }

  /* ---- The language, version and navigator drop-downs above the editor: NeXT pop-up buttons, raised
     grey with the pop-up glyph at the right end ---- */
  .scEditorTabControls a.scEditorHeaderButton {
    display: inline-flex;
    align-items: center;
    box-sizing: border-box;
    height: 22px;
    min-width: 0;
    margin: 0 0 0 4px;
    padding: 0 0 0 4px;
    ${button}
    line-height: 20px;
  }
  .scEditorTabControls a.scEditorHeaderButton:active { ${sunken} background: #fff; }
  .scEditorTabControls a.scEditorHeaderButton span {
    display: inline-flex;
    align-items: center;
    height: 20px;
  }
  .scEditorTabControls a.scEditorHeaderButton img:not([class*="Glyph"]) { margin: 0 2px 0 0; }
  .scEditorTabControls :is(.scEditorHeaderNavigatorGlyph, .scEditorHeaderVersionsLanguageGlyph, .scEditorHeaderVersionsVersionGlyph) {
    width: 18px;
    height: 20px;
    margin: 0 0 0 2px;
    padding: 0;
    ${paint(art(popGlyph(5, 7)))}
  }

  /* ---- The chunk's rows sit inside its 1px outline and 2px bevel, as the Experience Editor's do: a 1px
     gap, the 46px panel, a 1px gap, the 18px caption. A raised or pressed button never reaches the
     bevel or covers the caption. 10.4's stock panel padding (10px 8px) would push the buttons over the
     caption; both versions get 10.5's. ---- */
  .scRibbonToolbar .chunk { padding-bottom: 2px; }
  .scRibbonToolbar .chunk > .panel {
    box-sizing: border-box;
    height: 46px;
    margin-top: 3px;
    padding: 0 16px 10px;
  }
  .scRibbonToolbar .chunk > .caption {
    height: 18px;
    margin-top: 1px;
    line-height: 18px;
  }
  .scRibbonToolbar :is(a.scRibbonToolbarLargeButton, span.scRibbonToolbarLargeButtonDisabled, a.scRibbonToolbarLargeGalleryButton, span.scRibbonToolbarLargeGalleryButtonDisabled) {
    box-sizing: border-box;
    height: 46px;
    padding: 2px 6px 1px;
  }
  .scRibbonToolbar :is(.scRibbonToolbarLargeComboButton, .scRibbonToolbarLargeComboButtonDisabled) {
    box-sizing: border-box;
    height: 46px;
    padding: 0;
  }
  .scRibbonToolbar :is(.scRibbonToolbarLargeComboButtonTop, .scRibbonToolbarLargeComboButtonTopDisabled) {
    height: auto;
    padding: 2px 6px 0;
  }
  .scRibbonToolbar :is(.scRibbonToolbarLargeComboButtonBottom, .scRibbonToolbarLargeComboButtonBottomDisabled) {
    height: auto;
    padding: 1px 6px;
  }
  /* Sitecore pads the label 4px above and below; under a 24px icon that ran 3px past the 46px button and
     through its hover frame */
  .scRibbonToolbar [class^="scRibbonToolbarLarge"] .header {
    display: block;
    padding: 2px 0 1px;
    line-height: 14px;
  }
  .scRibbonToolbar [class^="scRibbonToolbarLargeComboButtonBottom"] .header { display: inline; }
  /* two small buttons to a column, centred in the panel */
  .scRibbonToolbar .scRibbonToolbarSmallButtons {
    box-sizing: border-box;
    height: 46px;
    padding-top: 2px;
  }
  /* the gallery (Insert, Presets): its list box and scroll buttons inside the panel */
  .scRibbonToolbar .scRibbonGallery {
    box-sizing: border-box;
    height: 46px;
    padding-top: 1px;
    padding-bottom: 0;
  }
  .scRibbonToolbar .scRibbonGalleryList {
    box-sizing: border-box;
    height: 44px;
    margin-top: 0;
  }
  /* the gallery's three scroll buttons share the panel's height */
  .scRibbonToolbar .scRibbonPanelButtons {
    box-sizing: border-box;
    height: 45px;
    margin-top: 0;
    padding: 0;
  }
  .scRibbonToolbar :is(img.scRibbonPanelUp, img.scRibbonPanelDown, img.scRibbonPanelOpen) {
    display: block;
    height: 15px;
  }
  /* gallery buttons (Review > Reminder, Archive) end their caption in the arrow, as Subscribe does */
  .scRibbonToolbar [class^="scRibbonToolbarLargeGalleryButton"] .header { display: inline; }
  .scRibbonToolbar [class^="scRibbonToolbarLargeGalleryButton"] > img:first-child {
    display: block;
    margin: 0 auto 4px;
  }

  /* ---- Tabs, all of them (dialog and application tab strips, the ISE's script tabs, Read-Variable's
     pages, the editor tabs): the selected tab is raised 3px taller, bold, and stands over its page's
     top edge so the two join; the others sit lower. Hovering a tab lightens it; keyboard focus is
     NeXT's dotted frame. Sitecore swaps the classes to *_Hover under the mouse. ---- */
  .scTabstrip,
  .scTabstrip > nobr {
    display: flex;
    align-items: flex-end;
    overflow: visible;
  }
  :is(.scTab, .scTab_Hover, .scTabActive, .scTabActive_Hover)::after { content: none; display: none; }
  :is(.scTab, .scTab_Hover, .scTabActive, .scTabActive_Hover) {
    position: relative;
    box-sizing: border-box;
    height: 21px;
    /* only the right margin: the ISE reserves room before its first tab with a left one */
    margin-right: 1px;
    padding: 0 10px;
    ${tabFace}
    font-weight: normal;
    line-height: 20px;
    cursor: default;
  }
  :is(.scTabActive, .scTabActive_Hover) {
    top: 1px;
    z-index: 2;
    height: 24px;
    background: #aaaaaa;
    font-weight: bold;
    line-height: 23px;
  }
  :is(.scTab_Hover, .scTab:hover) { background: #bbbbbb; }
  /* over a page, the open tab also covers the white line inside the page's black top edge, so its face runs
     on into the page as one surface (the strip aligns tabs to its bottom, so the extra pixel comes from top) */
  .scTabstripContainer:has(> .scTabs) > .scTabstrip :is(.scTabActive, .scTabActive_Hover) { top: 2px; height: 25px; }
  /* the ISE's script tabs have no page under them: the strip draws the line the open tab stands on, from the
     first tab on (SPE's 52px reserve holds the script tree and variables toggles, with no line under them) */
  #TabsPanel .scTabstrip { background-image: linear-gradient(#000 0 0); background-position: 52px 100%; background-size: 100% 1px; background-repeat: no-repeat; }
  /* SPE pulls a script tab's close X 10px into the tab's 20px right padding; with these 10px it touched the edge */
  .scTabstrip .closeTab { margin: 0 -3px 0 6px; }
  :is(.scTab, .scTab_Hover, .scTabActive, .scTabActive_Hover):focus { outline: none; }
  :is(.scTab, .scTab_Hover, .scTabActive, .scTabActive_Hover):focus-visible { outline: 1px dotted #000; outline-offset: -4px; }
  /* the page: grey, as a NeXT dialog, inside a black frame with a raised edge */
  .scTabs {
    box-sizing: border-box;
    border: 1px solid #000;
    background: #aaaaaa;
    box-shadow: inset 1px 1px #fff, inset -1px -1px #555555;
  }
  /* Sitecore sets the open tab 1px left (left: -1px) over its neighbours: the page starts there too, so an open
     first tab's black edge and white highlight run straight on down the page's left side */
  .scTabstripContainer > .scTabs { left: -1px; }
  /* the page inside keeps its 1px border, as layout, but unpainted: Sitecore's grey line covered the frame's
     white edge */
  .scTabs > .scTabPage { background: transparent; border-color: transparent; }
  /* list boxes on a page (item trees, lists) stay white */
  .scTabs .scScrollbox { ${edit} }

  /* the Content Editor's editor tabs stand on the tab row's black line */
  #EditorTabs {
    height: 57px;
    border-bottom: 1px solid #000;
  }
  #EditorTabs > a:is(.scRibbonEditorTabNormal, .scRibbonEditorTabActive) {
    position: relative;
    box-sizing: border-box;
    height: 21px;
    margin: 35px 1px 0 0;
    ${tabFace}
  }
  #EditorTabs > a.scRibbonEditorTabActive {
    top: 1px;
    z-index: 2;
    height: 24px;
    margin-top: 32px;
    background: #cccccc;
  }
  #EditorTabs > a.scRibbonEditorTabNormal:hover { background: #bbbbbb; }
  #EditorTabs > a:focus-visible { outline: 1px dotted #000; outline-offset: -4px; }
  #EditorTabs > a#BTAddNewSearch { width: 32px; }
  :is(.scEditorTabHeaderNormal, .scEditorTabHeaderActive) {
    height: auto;
    padding: 0 10px;
    border: 0;
    background: transparent;
    color: #000;
    font-weight: normal;
    line-height: 20px;
  }
  .scEditorTabHeaderActive {
    font-weight: bold;
    line-height: 23px;
  }

  /* jQuery UI tab strips */
  .ui-tabs .ui-tabs-nav {
    display: flex;
    align-items: flex-end;
    padding: 0 2px;
    border: 0;
    border-bottom: 1px solid #000;
    border-radius: 0;
    background: transparent;
  }
  .ui-tabs .ui-tabs-nav li {
    position: relative;
    top: 1px;
    height: 21px;
    margin: 0 1px 0 0;
    ${tabFace}
  }
  .ui-tabs .ui-tabs-nav li.ui-tabs-active { height: 24px; z-index: 2; background: #aaaaaa; }
  .ui-tabs .ui-tabs-nav li.ui-state-hover:not(.ui-tabs-active) { background: #bbbbbb; }
  .ui-tabs .ui-tabs-nav li a {
    padding: 0 10px;
    color: #000;
    line-height: 20px;
  }
  .ui-tabs .ui-tabs-nav li.ui-tabs-active a { font-weight: bold; line-height: 23px; }
  .ui-tabs .ui-tabs-panel { background: #aaaaaa; }

  /* tooltips drawn as markup (SPE's qTip, jQuery UI): white in a black frame */
  :is(.qtip, .ui-tooltip) {
    border: 1px solid #000;
    border-radius: 0;
    box-shadow: none;
    background: #fff;
    color: #000;
    font: 12px ${FONT};
  }
  :is(.qtip, .ui-tooltip) * { color: #000; }

  /* ---- Start menu: NeXT's main menu, a vertical panel next to the Dock's top tile. A black title row,
     then one column of 21px grey rows (Sitecore's two columns and All Applications in order), each
     raised by a white line above and a #555 line below; folders end in the submenu arrow, the row
     under the pointer turns white. ---- */
  .scPopup:has(> .scStartMenu) {
    /* Sitecore places the menu above its old bottom-left start button, inline */
    top: 51px !important;
    right: 64px;
    left: auto !important;
    width: 200px !important;
    max-height: none !important;
    height: auto !important;
    padding: 0;
    ${winFrame}
    border-radius: 0;
    background: #aaaaaa;
  }
  #StartMenu {
    width: auto;
    height: auto;
    border: 0;
    border-radius: 0;
    box-shadow: none;
    background: #aaaaaa;
  }
  #StartMenu::before {
    content: "Sitecore";
    display: block;
    box-sizing: border-box;
    height: 21px;
    padding: 0 6px;
    border-bottom: 1px solid #000;
    background: #000;
    ${titleText}
    text-align: left;
  }
  .scStartMenuContent {
    display: block;
    box-sizing: border-box;
    height: auto;
    padding: 0;
    background: #aaaaaa;
  }
  :is(.scStartMenuContentColumns, .scStartMenuContentColumns > tbody, .scStartMenuContentColumns > tbody > tr) { display: contents; }
  :is(.scStartMenuLeft, .scStartMenuRight, .scStartMenuPrograms) {
    display: block;
    width: auto;
    height: auto;
    padding: 0;
    border: 0;
    background: #aaaaaa;
  }
  .scStartMenuPrograms .scStartMenuDivider { display: none; }
  /* rows: the icon at 16px beside the name; the descriptions are the rows' tooltips already */
  :is(.scStartMenuLeftOption, .scStartMenuRightFolder, a.scStartMenuProgramsMenu) {
    display: flex;
    align-items: center;
    gap: 6px;
    box-sizing: border-box;
    height: 21px;
    min-height: 0;
    margin: 0;
    padding: 0 4px 0 6px;
    border: 0;
    border-top: 1px solid #fff;
    border-bottom: 1px solid #555555;
    border-radius: 0;
    box-shadow: none;
    background: #aaaaaa;
    color: #000;
  }
  :is(.scStartMenuLeftOptionIcon, .scStartMenuRightFolderIcon) {
    float: none;
    flex: none;
    width: 16px;
    height: 16px;
    margin: 0;
  }
  .scStartMenuLeftOptionDescription {
    display: block;
    min-width: 0;
  }
  :is(.scStartMenuLeftOptionDisplayName, .scStartMenuRightFolderDisplayName, .scStartMenuProgramsMenuText) {
    padding: 0;
    color: #000;
    font: 12px / 19px ${FONT};
    white-space: nowrap;
  }
  .scStartMenuLeftOptionTooltip { display: none; }
  :is(.scStartMenuRightFolderDisplayName, .scStartMenuProgramsMenuText) { flex: 1; }
  /* the folders open fly-outs: NeXT's submenu arrow at the row's end */
  img:is(.scStartMenuRightFolderGlyph, .scStartMenuProgramsGlyph) {
    float: none;
    order: 9;
    width: 16px;
    height: 16px;
    margin: 0;
    ${paint(menuArrow())}
  }
  :is(.scStartMenuLeftOption, .scStartMenuRightFolder, a.scStartMenuProgramsMenu):is(:hover, :focus-visible) {
    background: #fff;
    outline: none;
  }
  :is(.scStartMenuLeftOption, .scStartMenuRightFolder, a.scStartMenuProgramsMenu):hover :is(div, span) { color: #000 !important; }
  /* a groove between the groups */
  .scStartMenuDivider {
    height: 2px;
    margin: 0;
    background: linear-gradient(#000 1px, #555555 1px);
  }
  /* 10.4 still has the user band at the top and Log off at the bottom */
  :is(.scStartMenuTop, .scStartMenuBottom) {
    background: #aaaaaa;
    color: #000;
  }
  :is(.scStartMenuTop, .scStartMenuBottom) * { color: #000; }

  /* ---- Fields on tab pages (SPE Read-Variable and other tabbed dialogs): NeXT's 24px edit controls ---- */
  .scTabs :is(input:not([type]), input[type="text"], input[type="password"], input[type="number"], input[type="search"], select:not([multiple]):not([size]:not([size="1"]))) {
    box-sizing: border-box;
    height: 24px;
    min-height: 0;
    padding: 2px 4px;
    font: 12px ${FONT};
  }
  .scTabs select:not([multiple]):not([size]:not([size="1"])) { padding-right: 22px; }
  /* check lists, multilists and their trees are list boxes; radio groups NeXT's etched group box */
  :is(.scContentControlChecklist, .scContentControlMultilistBox, .scBucketListBox, .scBucketListSelectedBox, .scContentControlTree.scScrollbox, .varRule) {
    ${edit}
  }
  .scContentControlChecklist label,
  .scRadioGroup label { font: 12px ${FONT}; color: #000; }
  .scRadioGroup {
    border: 1px solid #555555;
    border-radius: 0;
    box-shadow: inset 1px 1px #fff, 1px 1px #fff;
  }
  :is(.scContentControlMultilistHelp, .scContentControlTreeListHelp) {
    border: 0;
    background: transparent;
    color: #000;
  }
  /* list navigation: bevelled arrow buttons in place of 10.x's blue chevrons */
  :is(img.scNavButton, img[id^="btnRight"], img[id^="btnLeft"], img[id^="btnUp"], img[id^="btnDown"]) {
    width: 18px;
    height: 18px;
    margin: 0 0 4px;
  }
  :is(img.scNavButton, img[id^="btnRight"])[id*="right" i],
  img[id^="btnRight"] { ${paint(G.right)} }
  :is(img.scNavButton, img[id^="btnLeft"])[id*="left" i],
  img[id^="btnLeft"] { ${paint(G.left)} }
  img.scNavButton[id*="_up"], img[id^="btnUp"] { ${paint(G.up)} }
  img.scNavButton[id*="_down"], img[id^="btnDown"] { ${paint(G.down)} }
  img.scNavButton:not([id]):nth-of-type(1) { ${paint(G.right)} }
  img.scNavButton:not([id]):nth-of-type(2) { ${paint(G.left)} }
  td:last-child > img.scNavButton:not([id]):nth-of-type(1) { ${paint(G.up)} }
  td:last-child > img.scNavButton:not([id]):nth-of-type(2) { ${paint(G.down)} }
  :is(img.scNavButton, img[id^="btnRight"], img[id^="btnLeft"], img[id^="btnUp"], img[id^="btnDown"]):active { filter: invert(0.15); }
  .scMultilistNav a.hovertext { color: #000; }
  /* combo tables (date and time pickers, item pickers): one black frame around the field and its button */
  table.scCombobox {
    box-sizing: border-box;
    height: auto;
    min-height: 0;
    border: 1px solid #000;
    border-collapse: collapse;
    border-radius: 0;
    background: #fff;
  }
  table.scCombobox :is(tbody, tr) { height: auto; }
  table.scCombobox td {
    height: auto;
    padding: 0;
    border: 0;
    vertical-align: middle;
  }
  table.scCombobox td input.scComboboxEdit[type] {
    box-sizing: border-box;
    width: 100%;
    /* the dialog field rule sets 24px with !important; inside the combo's frame it is 22px */
    height: 22px !important;
    margin: 0;
    padding: 2px 4px;
    border: 0;
    border-radius: 0;
    box-shadow: none;
    background: #fff;
    font: 12px ${FONT};
  }
  table.scCombobox img.scComboboxDropDown {
    display: block;
    box-sizing: border-box;
    width: 19px;
    height: 22px;
    margin: 0;
    padding: 0;
    border: 0;
    border-left: 1px solid #000;
    border-radius: 0;
    ${paint(G.combo)}
  }
  /* the date picker's calendar: a black title bar with the month between two arrow buttons, the chosen day
     black as a selection, the other months' days grey */
  table.scCalendar {
    margin: 0;
    border-collapse: collapse;
    color: #000;
    font: 12px ${FONT};
  }
  table.scCalendar td {
    border: 0;
    border-radius: 0;
    box-shadow: none;
    outline: none;
    color: #000;
    font: 12px ${FONT};
    text-transform: none;
  }
  table.scCalendar .scCalendarYearRow td {
    height: 22px;
    padding: 0 2px;
    background: #000;
    color: #fff;
    font-weight: bold;
  }
  .scCalendarYearRow img {
    width: 18px;
    height: 18px;
    vertical-align: middle;
  }
  .scCalendarYearLeftCell img { ${paint(G.left)} }
  .scCalendarYearRightCell img { ${paint(G.right)} }
  table.scCalendar td.scCalendarDay {
    border-bottom: 1px solid #000;
    font-weight: bold;
  }
  table.scCalendar td:is(.scCalendarCell, .scCalendarCellOtherMonth, .scCalendarSelected, .scCalendarToday) {
    height: 18px;
    padding: 1px 5px;
    background: #fff;
    text-align: center;
  }
  table.scCalendar td.scCalendarCellOtherMonth { color: #595959; }
  table.scCalendar td.scCalendarToday { font-weight: bold; }
  table.scCalendar td:is(.scCalendarCell, .scCalendarCellOtherMonth, .scCalendarToday):hover { outline: 1px dotted #000; outline-offset: -3px; }
  table.scCalendar td.scCalendarSelected {
    background: #aaaaaa;
    color: #000;
  }
  table.scCalendar td.scCalendarTodayCell {
    height: 20px;
    text-align: center;
    border-top: 1px solid #000;
    background: #aaaaaa;
  }
  /* the time picker's list: a list box with a black selection */
  ul.scTimePicker { margin: 0; padding: 0; background: #fff; }
  ul.scTimePicker a {
    display: block;
    padding: 1px 6px;
    border: 0;
    border-radius: 0;
    outline: none;
    box-shadow: none;
    color: #000;
    font: 12px ${FONT};
    text-decoration: none;
  }
  ul.scTimePicker a:is(:hover, :focus, .selected, [aria-selected="true"]) {
    background: #aaaaaa;
    color: #000;
  }

  /* the user and role pickers: a read-only grey field and its ... button at the field's height */
  input.scUserPickerEdit {
    border: 1px solid #000;
    background: #aaaaaa;
    color: #000;
  }
  button.scUserPickerButton {
    width: 30px;
    min-width: 0;
    height: 24px;
    padding: 0;
  }
  /* links in prompts (check list actions, rule text): black and underlined, as in Help */
  :is(.checkListActions a, .varRule a, .varRule .scLine span[style*="color"], .varRule .scLine a) { color: #000; text-decoration: underline; }
  .varRule .scLine span { color: #000; }
  .varTitle { color: #000; font-weight: bold; }
  .varHint { color: #000; }

  /* ---- Drop-down galleries (Edit's workflow box...) open in a frame: a menu's black frame and shadow ---- */
  iframe.scGalleryFrame {
    border: 1px solid #000;
    border-radius: 0;
    box-shadow: 2px 2px 0 #000;
  }

  /* ---- Desktop windows are bare frames in 10.x: one that isn't maximised gets a NeXT window's black
     outline and drop shadow ---- */
  .DesktopArea > iframe[id^="FRAME"]:not([style*="width: 100%"]) {
    box-sizing: border-box;
    border: 1px solid #000;
    box-shadow: 3px 3px 0 rgba(0, 0, 0, 0.45);
    background: #aaaaaa;
  }

  /* ---- The taskbar as NeXT's Dock: a column of 64px bevelled tiles down the Desktop's right edge.
     The start button is the top tile, each running application a tile with its icon, and at the foot
     the search field and the database switcher. Sitecore's own controls, restyled; nothing is moved
     in the DOM. The Desktop stops at the Dock, so windows (maximised ones too) never run under it;
     one dragged off to the right is clipped at the Dock's edge. ---- */
  /* the workspace: NeXT's plain #505050, in place of the wallpaper */
  .DesktopArea {
    right: 64px;
    bottom: 0;
    width: auto;
    overflow: clip;
    background: #505050 !important;
  }
  /* the column starts under the header: 51px on 10.5, 50px on 10.4 */
  .scStartbar {
    top: 51px;
    left: auto;
    right: 0;
    bottom: 0;
    width: 64px;
    height: auto;
    border: 0;
    border-left: 1px solid #000;
    background: #505050;
  }
  #Startbar {
    height: 100% !important;
    background: none;
  }
  #Startbar > table {
    display: flex;
    flex-direction: column;
    width: 63px;
    height: 100%;
    border: 0;
    border-spacing: 0;
    background: none;
  }
  :is(#Startbar > table > tbody, #Startbar > table > tbody > tr) { display: contents; }
  #Startbar > table > tbody > tr > td {
    display: block;
    width: auto;
    height: auto;
    padding: 0;
    border: 0;
    background: none;
  }
  /* the tray goes to the foot of the column */
  #Startbar > table > tbody > tr > td:last-child { margin-top: auto; }

  /* a tile: NeXT's bevelled grey square, lit from the top left */
  :where(.scStartButton, #StartbarApplications > tbody > tr > td, .scStartbarTray > tbody > tr > td) {
    box-sizing: border-box;
    width: 63px;
    height: 63px;
    border: 0;
    border-radius: 0;
    background: linear-gradient(135deg, #cccccc, #8c8c8c);
    box-shadow: inset 1px 1px #fff, inset -1px -1px #000, inset -2px -2px #555555;
  }

  /* the start tile: a dark cube, held in while the menu is open */
  .scStartButtonContainer {
    position: relative;
    width: 63px;
    height: 63px;
  }
  .scStartButton,
  .scStartButton:hover,
  .scStartButton.scPopupOpener {
    position: absolute;
    top: 0;
    left: 0;
    margin: 0;
    background: ${art(cube, { w: 40, h: 40 })}, linear-gradient(135deg, #cccccc, #8c8c8c);
  }
  .scStartButton.scPopupOpener {
    background: ${art(cube, { w: 40, h: 40 })}, #fff;
    box-shadow: inset 1px 1px #000, inset 2px 2px #555555, inset -1px -1px #fff;
  }
  .scStartButton:focus { outline: none; }
  .scStartButton:focus-visible { outline: 1px dotted #000; outline-offset: -5px; }

  /* running applications: one tile each, the icon at 32px over its title in small type; the open one
     held in */
  .scStartBarScroller {
    height: auto;
    padding: 0;
    border: 0;
    overflow: visible;
  }
  #StartbarApplications,
  #StartbarApplications > tbody,
  #StartbarApplications > tbody > tr {
    display: flex;
    flex-direction: column;
    width: 63px;
    height: auto;
    margin: 0;
    border-spacing: 0;
  }
  #StartbarApplications > tbody > tr > td {
    position: relative;
    padding: 0;
    color: #000;
    vertical-align: middle;
  }
  #StartbarApplications > tbody > tr > td.scActiveApplication {
    background: #cccccc;
    box-shadow: inset 1px 1px #555555, inset 2px 2px #000, inset -1px -1px #fff;
  }
  .scStartBarApplication {
    width: 63px;
    height: 63px;
    padding: 0;
    border: 0;
    background: none;
  }
  .scStartBarApplication > span {
    display: flex;
    flex-direction: column;
    align-items: safe center;
    justify-content: center;
    gap: 3px;
    box-sizing: border-box;
    width: 63px;
    height: 63px;
    padding: 4px 4px 2px;
    overflow: hidden;
    color: #000;
    font: 9px / 11px ${FONT};
    white-space: nowrap;
  }
  .scStartBarApplication > span > img {
    flex: none;
    width: 32px;
    height: 32px;
    margin: 0 !important;
  }
${dockIcons}

  /* the tray: the search field and the database switcher, a tile each */
  .scStartbarTray,
  .scStartbarTray > tbody,
  .scStartbarTray > tbody > tr {
    display: flex;
    flex-direction: column;
    width: 63px;
    height: auto;
    margin: 0;
    border-spacing: 0;
  }
  .scStartbarTray > tbody > tr > td {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0 5px;
    line-height: normal !important;
  }
  .scSearchBoxContainer { width: auto; }
  /* a short NeXT field in its tile; it widens to the left while you type */
  #SearchBox {
    position: relative;
    box-sizing: border-box;
    width: 53px;
    height: 22px;
    min-height: 0;
    margin: 0;
    padding: 2px 4px;
    ${edit}
    font: 12px ${FONT};
  }
  #SearchBox:focus {
    z-index: 5;
    width: 240px;
    margin-left: -187px;
    outline: none;
  }
  #SearchBox::placeholder { color: #555555; }
  #DatabaseSelector {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    margin: 0;
    padding: 0;
    border: 0;
    background: none;
    color: #000;
    font: bold 11px / 13px ${FONT};
  }
  #DatabaseSelector img { margin: 0 !important; }
  #DatabaseSelector:hover { background: none; }
  .scStartbarTray :is(td, span) { color: #000; }

  /* ---- Bucket search (search tab, Media Library): a NeXT edit field with square button ends, the
     search terms as framed tokens ---- */
  .search-box {
    min-height: 0;
    ${edit}
  }
  :is(.sb_down, .sb_up),
  :is(.sb_down, .sb_up):hover {
    border-right: 1px solid #000;
    border-radius: 0;
    background-color: #aaaaaa;
    box-shadow: inset 1px 1px #fff, inset -1px -1px #555555;
  }
  .btn-search,
  .btn-search:is(:hover, :active) {
    border-left: 1px solid #000;
    border-radius: 0;
    background-color: #aaaaaa;
    background-image: url("/sitecore/shell/Applications/Buckets/images/edition-magnifier.png");
    box-shadow: inset 1px 1px #fff, inset -1px -1px #555555;
  }
  .btn-search:active { box-shadow: inset 1px 1px #555555, inset -1px -1px #fff; }
  .filters .filter {
    border: 1px solid #000;
    border-radius: 0;
    background: #fff;
    color: #000;
  }
  .filters .filter :is(.icon, .remove):hover { border-radius: 0; background-color: #aaaaaa; }
  :is(.side .sb_filter, #results table th) { text-transform: none; }

  /* ---- Ribbon drop-down arrows: NeXT's solid black triangle ---- */
  .scRibbon :is(.scRibbonToolbarLargeComboButtonGlyph, .scRibbonToolbarLargeGalleryButtonGlyph, .scRibbonToolbarSmallGalleryButtonGlyph, .scRibbonToolbarSmallComboButtonGlyph) {
    width: 12px;
    height: 12px;
    border: 0;
    vertical-align: middle;
    ${paint(triDown())}
  }
  .scRibbon [class*="Disabled"] :is([class*="ComboButtonGlyph"], [class*="GalleryButtonGlyph"]) { background: ${triDown("#555555")}; }
  /* a large combo button's drop-down: NeXT's combo box arrow, the triangle over a bar */
  .scRibbon .scRibbonToolbarLargeComboButtonGlyph { background: ${art([tri.down(5, 7, 7), bar(5, 12, 7, 1)])}; }
  .scRibbon [class*="Disabled"] .scRibbonToolbarLargeComboButtonGlyph { background: ${art([tri.down(5, 7, 7, "#555555"), bar(5, 12, 7, 1, "#555555")])}; }
  .scRibbonToolbar [class*="ButtonDisabled"] .header { color: #555555; }

  /* ---- Ribbon galleries (Home > Insert, Security > Presets): list boxes, the hovered row black ---- */
  .scRibbonGalleryList {
    ${edit}
  }
  .scRibbonGalleryList > a[class^="scRibbonToolbar"],
  .scRibbonGalleryList > a[class^="scRibbonToolbar"]:is(:hover, :active) {
    border: 0;
    border-radius: 0;
    box-shadow: none;
    background: #fff;
  }
  .scRibbonGalleryList > a[class^="scRibbonToolbar"]:hover { background: #aaaaaa; }
  .scRibbonGalleryList > a[class^="scRibbonToolbar"]:hover * { color: #000; }
  .scRibbonGalleryList > a.scRibbonToolbarLargeTextButton {
    display: block;
    float: none;
    box-sizing: border-box;
    height: 21px;
    padding: 4px 6px 3px;
    text-align: left;
    white-space: nowrap;
  }
  .scRibbonGalleryList > a.scRibbonToolbarLargeTextButton .scRibbonToolbarLargeTextButtonText {
    display: inline;
    height: auto;
    padding: 0;
    border: 0;
    background: none;
  }
  .scRibbonGalleryList > a.scRibbonToolbarLargeTextButton br { display: none; }

  /* ---- Push buttons in dialogs: NeXT's 24px buttons; the default button carries the return-key glyph ---- */
  :is(button, input[type="button"], input[type="submit"]).scButton,
  .scFormDialogFooter button {
    box-sizing: border-box;
    min-width: 75px;
    height: 24px;
    min-height: 0;
    margin: 0;
    padding: 0 10px;
    ${button}
    line-height: 20px;
    vertical-align: middle;
  }
  :is(button, input[type="button"], input[type="submit"]).scButton:is(:hover, :focus),
  .scFormDialogFooter button:is(:hover, :focus) {
    background-color: #aaaaaa;
    color: #000;
    border-color: #000;
  }
  /* the default button carries NeXT's return-key glyph */
  :is(button, input[type="button"], input[type="submit"]).scButton.scButtonPrimary {
    padding-right: 28px;
    background: ${returnKey("right 7px center")}, #aaaaaa;
  }
  :is(button, input[type="button"], input[type="submit"]).scButton:active {
    background-color: #fff;
    ${sunken}
  }
  :is(button, input[type="button"], input[type="submit"]).scButton:disabled { color: #555555; }
  /* ---- Dialog insets: controls close to the frame, as Copenhagen's were, not 10.x's 28px in;
     the buttons end 8px from the corner in a footer as tall as they need ---- */
  .scDialogContentContainer { padding: 8px; }
  .scFormDialogFooter {
    height: 40px;
    padding: 8px;
    line-height: normal;
  }
  .scFormDialogFooter .footerOkCancel {
    position: static;
    float: right;
    display: flex;
    gap: 6px;
  }
  /* SPE's help (?) floats left 8px down for 10.x's taller footer: level with the 24px buttons instead */
  .scFormDialogFooter img#Copyright { margin: 0; }
  /* a dialog's tab strip is as tall as its open tab, not 10.x's 42px with the tabs at the bottom, and draws no
     line of its own: the page's top edge is the line, and the open tab (1px lower) covers it */
  .scDialogContentContainer .scTabstripContainer > .scTabstrip { height: 24px; border-bottom: 0; }
  .scDialogContentContainer .scTabstripContainer > .scTabs { top: 24px; }

  /* ---- Any other text field keeps its size but loses 10.x's rounded frame ---- */
  input:is(:not([type]), [type="text"], [type="search"], [type="password"], [type="number"], [type="email"], [type="url"]):not([readonly], .ace_editor *, .terminal *),
  textarea:not([readonly], .ace_editor *, .terminal *) {
    border: 1px solid #000;
    border-radius: 0;
    box-shadow: none;
  }

  /* ---- Drop-down lists: NeXT's combo box, the arrow button flush right ---- */
  select:not([multiple]):not([size]:not([size="1"])) {
    appearance: none;
    padding-right: 22px;
    ${edit}
    background: ${comboRight}, #fff;
  }

  /* ---- The Workbox's caption band is a NeXT title bar: black, miniaturise at the left, zoom and close at
     the right ---- */
  .scWorkboxWindowCaption {
    position: relative;
    box-sizing: border-box;
    height: 20px;
    min-height: 0;
    padding: 0;
    border: 0;
    border-bottom: 1px solid #000;
    background: #000;
  }
  .scWorkboxWindowButtons {
    position: absolute;
    top: 2px;
    left: 2px;
    right: 2px;
    display: flex;
    justify-content: flex-end;
    height: 16px;
    margin: 0;
    padding: 0;
    float: none;
  }
  .scWorkboxWindowButtons img[src*="minimize"] { order: -1; margin: 0 auto 0 0; }

  /* ---- Grids (User Manager, Role Manager...): a list box under raised column headings, the selected
     row black ---- */
  .Grid {
    border: 1px solid #000;
    background: #fff;
  }
  .HeadingCell {
    padding: 3px 8px;
    border: 0;
    background: #aaaaaa;
    color: #000;
    font-weight: bold;
    ${raised}
  }
  .HeadingCell::after { content: none; }
  .HeadingCell * { color: #000; }
  :is(.Row, .Row:nth-child(odd), .Row:hover) { background: #fff; }
  :is(.Row, .SelectedRow) td.DataCell {
    padding: 2px 8px;
    border: 0;
    color: #000;
  }
  .SelectedRow td.DataCell,
  .SelectedRow td.DataCell * {
    background: #aaaaaa;
    color: #000;
  }
  .GridFooter img[src*="/grid/pager/"] {
    width: 22px;
    height: 22px;
    padding: 0;
  }
  .GridFooter img[src*="/grid/pager/first"] { ${paint(G.first)} }
  .GridFooter img[src*="/grid/pager/prev"] { ${paint(G.left)} }
  .GridFooter img[src*="/grid/pager/next"] { ${paint(G.right)} }
  .GridFooter img[src*="/grid/pager/last"] { ${paint(G.last)} }
  .GridFooter.scGridFooter img:active { width: 22px; height: 22px; padding: 0; }

  /* ---- Content Editor density: NeXT's 22px fields and Quick Info rows, not 10.5's 35px ---- */
  .scEditorSections input.scContentControl:not([type="checkbox"], [type="radio"]) {
    box-sizing: border-box;
    height: 22px;
    min-height: 0;
    padding: 2px 4px;
    font: 12px ${FONT};
  }
  table.scEditorQuickInfo { border-spacing: 0; }
  table.scEditorQuickInfo tr { line-height: normal; }
  table.scEditorQuickInfo td {
    height: 18px;
    padding: 1px 8px 1px 0;
    white-space: nowrap;
  }
  table.scEditorQuickInfo input {
    height: 18px;
    min-height: 0;
    padding: 0;
    border: 0;
    box-shadow: none;
    background: transparent;
  }
  /* the tree's links are opaque, so a long name covers the browser arrow drawn under it at the column's
     edge instead of running through it */
  .scContentTree a.scContentTreeNodeNormal { background: #fff; }


  /* ---- Workbox workflow and state headers: raised grey strips with bold black text (the token layer
     paints them in the chrome colour, then a later generated rule sets the text to the app colour) ---- */
  :is(.scSectionLeft, .scSectionCenter, .scSectionRight, .scCollapsed .scSectionCenter, .scCollapsed .scSectionRight) {
    border-color: #000;
    background: #aaaaaa;
    color: #000;
  }
  .scSectionCenter { font-weight: bold; }
  .scSectionCenter * { color: #000; }
  /* the state's Submit buttons: NeXT buttons, not 10.x's rounded ones */
  .scWorkboxToolbarButtons .scRollover {
    padding: 3px 10px;
    ${button}
  }
  .scWorkboxToolbarButtons .scRollover:active { background-color: #fff; ${sunken} }

  /* ---- A ribbon group's launcher: a small raised square with an arrow, as NeXT's panels open ---- */
  .scRibbonChunkEndLink img.glyph {
    width: 13px;
    height: 13px;
    ${paint(art([bar(0, 0, 11, 1, "#fff"), bar(0, 0, 1, 11, "#fff"), bar(0, 10, 11, 1), bar(10, 0, 1, 11), tri.right(4, 3, 5)], { w: 11, h: 11 }))}
  }


  /* ---- Drop-down lists are NeXT pop-up lists: a raised grey button with the pop-up glyph at its right
     end, in fields, dialogs and tab pages alike ---- */
  :is(.scEditorSections, .scFormDialogContent, .scDialogContentContainer, .scWizardPageContainer, .scTabs, body) select:not([multiple]):not([size]:not([size="1"])) {
    appearance: none;
    padding-right: 22px;
    border: 1px solid #000;
    border-radius: 0;
    box-shadow: inset 1px 1px #fff, inset -1px -1px #555555;
    background: ${comboRight}, #aaaaaa;
    color: #000;
  }
  :is(.scEditorSections, .scFormDialogContent, .scDialogContentContainer, .scWizardPageContainer, .scTabs, body) select:not([multiple]):not([size]:not([size="1"])):focus-visible {
    outline: 1px dotted #000;
    outline-offset: -4px;
  }


  /* the bucket search field is the .search-box frame; the input inside draws none of its own */
  .search-box input:is(:not([type]), [type="text"], [type="search"]) {
    border: 0;
    box-shadow: none;
    background: transparent;
    outline: none;
  }


  /* ---- Fields in dialogs: edit controls of NeXT's height ---- */
  :is(.scFormDialogContent, .scDialogContentContainer, .scWizardPageContainer) :is(input:not([type]), input[type="text"], input[type="password"], input[type="search"], input[type="number"], select:not([multiple]):not([size])) {
    box-sizing: border-box;
    height: 24px !important;
    min-height: 0;
    padding: 2px 4px;
    ${edit}
    font: 12px ${FONT};
  }
  :is(.scFormDialogContent, .scDialogContentContainer, .scWizardPageContainer) textarea {
    ${edit}
    font: 12px ${FONT};
  }
}`;

// ---- Check boxes and radio buttons, everywhere: NeXT's switch (a raised grey square, a black check mark
// when on) and radio button (a sunken grey disc, a black dot when on). Focus is a dotted frame. ----
const checks = (S) => `${S}:not(#sct-rw) :is(input[type="checkbox"], input[type="radio"]) {
  appearance: none;
  flex: none;
  box-sizing: border-box;
  width: 14px;
  height: 14px;
  margin: 0 4px 0 0;
  padding: 0;
  border: 1px solid #000;
  border-radius: 0;
  box-shadow: inset 1px 1px #fff, inset -1px -1px #555555;
  outline: none;
  background: #aaaaaa;
  vertical-align: -3px;
}
${S}:not(#sct-rw) input[type="radio"] {
  border-color: #555555 #fff #fff #555555;
  border-radius: 50%;
  box-shadow: inset 1px 1px #000;
}
${S}:not(#sct-rw) input[type="checkbox"]:checked { background: ${checkMark}, #aaaaaa; }
${S}:not(#sct-rw) input[type="radio"]:checked { background: radial-gradient(circle at 50% 50%, #000 0 2.5px, #fff 3px 3.5px, #aaaaaa 4px); }
${S}:not(#sct-rw) :is(input[type="checkbox"], input[type="radio"]):focus-visible { outline: 1px dotted #000; outline-offset: 1px; }
${S}:not(#sct-rw) :is(input[type="checkbox"], input[type="radio"]):disabled { opacity: 0.55; }`;

// ---- A SPEAK application's title row (SPE Reports, Forms, Control Panel): 10.x's 90px banner image
// becomes a black NeXT title bar with the title centred ----
const appTitle = (S) => `${S}:not(#sct-rw) .sc-applicationHeader-row1 {
  box-sizing: border-box;
  height: 21px;
  min-height: 0;
  border-bottom: 1px solid #000;
  background: #000;
}
${S}:not(#sct-rw) .sc-applicationHeader-row1::after { content: none; }
${S}:not(#sct-rw) .sc-applicationHeader-row1 .sc-applicationHeader-content {
  height: 20px;
  padding: 0 15px;
}
${S}:not(#sct-rw) .sc-applicationHeader-row1 .sc-applicationHeader-title {
  float: none;
  margin: 0;
  padding: 0;
  text-align: center;
}
${S}:not(#sct-rw) .sc-applicationHeader-row1 :is(.sc-applicationHeader-title, .sc-applicationHeader-title .sc-text) {
  display: block;
  height: 20px;
  ${titleText}
}
${S}:not(#sct-rw) .sc-applicationHeader-row1 .sc-applicationHeader-title::before { display: none; }`;

// ---- SPEAK and Launchpad: fonts, push buttons, check boxes ----
const speakCommon = (S) => `${S} body, ${S} input, ${S} button, ${S} select, ${S} textarea,
${S} :is(h1, h2, h3, h4, h5, h6, p, a, span, label, li, td, th, div) {
  font-family: ${FONT};
}
${S} { scrollbar-color: auto; }
${S} ::-webkit-scrollbar { width: 18px; height: 18px; background: #e0e0e0; }
${S} ::-webkit-scrollbar-thumb { background: #aaaaaa; ${raised} }
${S} ::-webkit-scrollbar-button:single-button { display: block; width: 18px; height: 18px; }
${S} ::-webkit-scrollbar-button:vertical:decrement { background: ${G.up}; }
${S} ::-webkit-scrollbar-button:vertical:increment { background: ${G.down}; }
${S} ::-webkit-scrollbar-button:horizontal:decrement { background: ${G.left}; }
${S} ::-webkit-scrollbar-button:horizontal:increment { background: ${G.right}; }
${header(S, S.includes('launchpad') ? 47 : 49)}
/* push buttons: NeXT's, the default one with the return-key glyph */
${S}:not(#sct-rw) .btn.sc-button {
  box-sizing: border-box;
  min-width: 75px;
  height: 24px;
  margin: 0;
  padding: 0 10px;
  ${button}
  line-height: 20px;
}
${S}:not(#sct-rw) .btn.sc-button:is(:hover, :focus) { background-color: #aaaaaa; color: #000; border-color: #000; }
${S}:not(#sct-rw) .btn.sc-button.btn-primary {
  padding-right: 28px;
  background: ${returnKey("right 7px center")}, #aaaaaa;
}
${S}:not(#sct-rw) .btn.sc-button:active { background-color: #fff; ${sunken} }
${S}:not(#sct-rw) .btn.sc-button:focus-visible { outline: 1px dotted #000; outline-offset: -5px; }
${S}:not(#sct-rw) .btn.sc-button:is(:disabled, .disabled) { color: #555555; opacity: 1; }
${S}:not(#sct-rw) .btn.sc-button .sc-button-text { color: inherit; font: inherit; }
${checks(S)}
/* SPEAK 2 pages (Forms) round their buttons, pills and fields: NeXT's controls are square */
${S}:not(#sct-rw) :is(.btn, .form-control, .input-group > *, .dropdown-menu) { border-radius: 0; }`;

// ---- SPEAK pages ----
const S = T("speak");
const speak = `/* Redwood: SPEAK pages. Generated by tools/build-redwood-css.cjs. */
${speakCommon(S)}
${appTitle(S)}

/* ---- Experience Editor ribbon: dressed as the Content Editor's ribbon in this theme. The tabs are
   NeXT tabs on a grey strip, the open one joined to the toolbar of raised groups, buttons flat until
   hovered. ---- */
${W("speak")} .sc-pageeditbar {
  font: 12px ${FONT};
  color: #000;

  .sc-quickbar {
    display: flow-root;
    height: auto;
    padding: 0 4px;
    border: 0;
    border-bottom: 1px solid #000;
    box-shadow: none;
    background: #aaaaaa;
  }
  .sc-quickbar-item {
    float: left;
    box-sizing: border-box;
    height: 30px;
    margin: 0;
    border: 0;
    border-radius: 0;
    box-shadow: none;
    background: none;
    color: #000;
    font: bold 12px ${FONT};
    line-height: 30px;
    text-transform: none;
    text-decoration: none;
    cursor: default;
  }
  .sc-quickbar-item:focus { outline: none; }
  .sc-quickbar-item:focus-visible { outline: 1px dotted #000; outline-offset: -3px; }
  /* the tabs stand on the strip's bottom line; the open one is a pixel taller and covers it */
  .sc-quickbar-tab {
    position: relative;
    height: 24px;
    margin: 6px 1px 0 0;
    padding: 0 12px;
    ${tabFace}
    font-weight: normal;
    line-height: 22px;
  }
  .sc-quickbar-tab:hover { background: #bbbbbb; }
  .sc-quickbar-tab.sc-quickbar-tab-selected {
    z-index: 1;
    height: 25px;
    margin-bottom: -1px;
    background: #aaaaaa;
    font-weight: bold;
  }
  .sc-quickbar-button {
    width: 24px;
    height: 24px;
    margin: 3px 1px;
    padding: 3px;
    border: 1px solid transparent;
    opacity: 1;
  }
  .sc-quickbar-button > .sprite-speak-ribbon-clean-ee {
    display: block;
    margin: 0;
  }
  .sc-quickbar-button:not(.disabled):hover {
    border-radius: 2px;
    background: #aaaaaa;
    ${raised}
  }
  .sc-quickbar-button:not(.disabled):active { ${sunken} }
  .sc-quickbar-button.disabled > * { opacity: 0.45; }

  .sc-ribbon {
    margin: 0;
    padding: 0;
    border: 0;
    border-bottom: 1px solid #000;
    box-shadow: none;
    background: #aaaaaa;
  }
  /* no display here: Sitecore switches strips with jQuery hide and show */
  .sc-strip {
    height: 76px;
    min-height: 0;
    padding: 0;
    overflow: hidden;
  }
  .sc-chunk {
    display: block;
    float: left;
    box-sizing: border-box;
    height: 72px;
    margin: 2px 1px;
    padding: 0 15px;
    background: #aaaaaa;
    white-space: nowrap;
    ${raised}
  }
  .sc-chunk::before,
  .sc-chunk::after { content: none; }
  /* inside the chunk's 1px outline and 2px bevel: a 1px gap, 46px of buttons, a 1px gap, the 18px
     caption; a raised or pressed button never reaches the bevel or the caption */
  .sc-chunk-button-list {
    display: flow-root;
    height: 46px;
    margin: 3px 0 0;
    padding: 0;
  }
  .sc-chunk-label {
    height: 18px;
    margin: 1px 0 0;
    padding: 0;
    color: #000;
    font: 12px ${FONT};
    line-height: 18px;
    text-align: center;
    text-transform: none;
  }

  /* large buttons */
  :is(.sc-chunk-button, .sc-chunk-button-dropdown, .sc-chunk-gallerybutton) {
    float: left;
    box-sizing: border-box;
    height: 46px;
    margin: 0;
    padding: 2px 6px 1px;
    border: 1px solid transparent;
    border-radius: 0;
    box-shadow: none;
    background: none;
    color: #000;
    text-align: center;
    white-space: nowrap;
    cursor: default;
  }
  :is(.sc-chunk-button, .sc-chunk-button-dropdown, .sc-chunk-gallerybutton) > .sprite-speak-ribbon-clean-ee {
    display: block;
    margin: 0 auto 2px;
  }
  .sc-chunk-button-label {
    margin: 0;
    padding: 0;
    color: inherit;
    font: 12px ${FONT};
    line-height: 14px;
    text-transform: none;
  }
  :is(.sc-chunk-button, .sc-chunk-button-dropdown, .sc-chunk-gallerybutton, .sc-chunk-button-small, .sc-chunk-check-small):not(.disabled):hover {
    background: #aaaaaa;
    ${raised}
  }
  :is(.sc-chunk-button, .sc-chunk-button-dropdown, .sc-chunk-gallerybutton, .sc-chunk-button-small):not(.disabled):active,
  :is(.sc-chunk-button, .sc-chunk-button-dropdown, .sc-chunk-gallerybutton, .sc-chunk-button-small).pressed {
    background: #fff;
    border-color: #000;
    ${sunken}
  }
  .disabled :is(.sc-chunk-button-label, .sc-chunk-check-small-label),
  :is(.sc-chunk-button, .sc-chunk-button-dropdown, .sc-chunk-gallerybutton, .sc-chunk-button-small, .sc-chunk-check-small).disabled {
    color: #555555;
  }

  /* small buttons, two to a column */
  .sc-chunk-button-small-list {
    float: left;
    margin: 2px 0 0;
    padding: 0;
  }
  .sc-chunk-check-list {
    display: flow-root;
    float: left;
    height: 42px;
    margin: 2px 0 0;
    padding: 0;
  }
  .sc-chunk-button-small,
  .sc-chunk-check-small {
    display: block;
    box-sizing: border-box;
    height: 21px;
    margin: 0;
    padding: 2px 4px;
    border: 1px solid transparent;
    border-radius: 0;
    box-shadow: none;
    background: none;
    color: #000;
    line-height: 15px;
    text-align: left;
    white-space: nowrap;
    cursor: default;
  }
  .sc-chunk-button-small > .sprite-speak-ribbon-clean-ee {
    display: inline-block;
    float: none;
    margin: 0 4px 0 0;
    vertical-align: -3px;
  }
  .sc-chunk-button-small .sc-chunk-button-label,
  .sc-chunk-check-small-label {
    display: inline;
    float: none;
    color: inherit;
    font: 12px ${FONT};
    line-height: 15px;
  }
  /* drop-down buttons end in NeXT's solid arrow */
  :is(.sc-chunk-button-dropdown, .sc-chunk-gallerybutton)::after { content: none; }
  :is(.sc-chunk-button-dropdown, .sc-chunk-gallerybutton) .sc-chunk-button-label::after {
    content: "";
    display: inline-block;
    width: 12px;
    height: 12px;
    margin-left: 2px;
    vertical-align: -2px;
    background: ${triDown()};
  }

  /* the preview date: a white box between two bevelled arrow buttons, inside the 46px row */
  .sc-chunk-panel {
    height: 46px;
    margin: 0;
    padding: 0;
    border: 0;
    border-radius: 0;
    box-shadow: none;
    background: none;
  }
  .sc-chunk-datepanel {
    display: flex;
    align-items: center;
    gap: 2px;
    box-sizing: border-box;
    height: 46px;
    margin: 0;
    padding: 0;
    overflow: hidden;
    border: 0;
    border-radius: 0;
    box-shadow: none;
    background: none;
  }
  a.sc-chunk-datepanel-changedate {
    display: block;
    flex: none;
    box-sizing: border-box;
    width: 18px;
    height: 40px;
    margin: 0;
    padding: 0;
    border: 1px solid #000;
    border-radius: 0;
  }
  a.sc-chunk-datepanel-changedate[data-sc-adddays^="-"] { background: ${G.left}; }
  a.sc-chunk-datepanel-changedate:not([data-sc-adddays^="-"]) { background: ${G.right}; }
  a.sc-chunk-datepanel-changedate:active { filter: invert(0.15); }
  a.sc-chunk-datepanel-changedate > .sprite-speak-ribbon-clean-ee { display: none; }
  .sc-chunk-datepanel-datetime {
    height: auto;
    margin: 0;
    padding: 0;
    border: 0;
  }
  .sc-chunk-datepanel-selector {
    display: flex;
    box-sizing: border-box;
    height: 40px;
    min-height: 0;
    align-items: center;
    gap: 6px;
    padding: 0 6px;
    ${edit}
    font: 12px ${FONT};
    line-height: 1.1;
    text-decoration: none;
  }
  .sc-chunk-datepanel-selector * {
    height: auto;
    margin: 0;
    padding: 0;
    color: #000;
    font: 12px ${FONT};
    line-height: 1.15;
  }
  .sc-chunk-datepanel-selector:focus-visible { outline: 1px dotted #000; outline-offset: -3px; }
  .sc-chunk-datepanel-day { display: none; }
  .sc-chunk-datepanel-date { font: bold 16px ${FONT}; }
  .sc-chunk-datepanel-monthyear { text-align: center; }
  .sc-chunk-datepanel-time { font-weight: bold; }

  /* the item path under the ribbon: a grey strip with NeXT push buttons */
  /* 31px with its border, so 24px buttons centre on whole pixels */
  .sc-breadcrumb {
    display: flex;
    align-items: center;
    gap: 4px;
    box-sizing: border-box;
    height: 31px;
    min-height: 0;
    margin: 0;
    padding: 0 4px;
    border: 0;
    border-bottom: 1px solid #000;
    box-shadow: none;
    background: #aaaaaa;
  }
  .sc-breadcrumb-item {
    display: flex;
    align-items: center;
    gap: 2px;
    float: none;
    height: auto;
    padding: 0;
  }
  .sc-breadcrumb .scContentButton { padding: 0 0 0 4px; }
  .sc-breadcrumb-item-path {
    color: #000;
    font: bold 12px ${FONT};
  }
  .sc-breadcrumb-item-button,
  .sc-breadcrumb-item-action {
    display: flex;
    align-items: center;
    box-sizing: border-box;
    height: 22px;
    margin: 0;
    padding: 2px;
    border: 1px solid transparent;
    border-radius: 0;
  }
  :is(.sc-breadcrumb-item-button, .sc-breadcrumb-item-action):hover {
    background: #aaaaaa;
    ${raised}
  }
}

/* ---- SPEAK dialogs (the EE's Preview Date and Time, ...): a dialog-page header, and the date and time
   pickers as NeXT fields whose arrow button replaces the calendar and clock icons ---- */
/* the header is the window's caption, as the shell's dialog pages draw it: the title centred in a black
   band with the dialog's buttons, the description below it on the dialog grey */
${W("speak")} .sc-dialogWindow-header {
  height: auto;
  padding: 0;
  border: 0;
  background: #aaaaaa;
  color: #000;
}
${W("speak")} .sc-dialogWindow-header .sc-dialogWindow-header-title {
  display: block;
  float: none;
  box-sizing: border-box;
  width: auto;
  height: 19px;
  margin: 0;
  padding: 0 46px;
  border-bottom: 1px solid #000;
  background: #000;
  text-align: center;
}
${W("speak")} .sc-dialogWindow-header .sc-dialogWindow-header-title .sc-text {
  display: block;
  height: 18px;
  margin: 0;
  padding: 0;
  color: #fff;
  font: bold 12px / 18px ${FONT};
}
${W("speak")} .sc-dialogWindow-header > .sc-text-title {
  display: block;
  padding: 6px 10px;
  color: #000;
  font: 12px / 16px ${FONT};
}
${W("speak")} .sc-dialogWindow-buttons {
  border-top: 0;
  background: #aaaaaa;
}
${W("speak")} :is(input.sc-datepicker, input.sc-timepicker) {
  box-sizing: border-box;
  height: 24px;
  min-height: 0;
  padding: 2px 22px 2px 4px;
  ${edit}
  background: ${comboRight}, #fff;
  font: 12px ${FONT};
}
${W("speak")} :is(input.sc-datepicker, input.sc-timepicker):focus { outline: 1px dotted #000; outline-offset: -3px; box-shadow: none; }
/* jQuery UI's calendar: as the Content Editor's date picker, a black title bar with the month in white bold
   between two arrow buttons, the chosen day black, the other months' days grey */
${W("speak")} #ui-datepicker-div.ui-datepicker {
  padding: 0;
  border: 1px solid #000;
  border-radius: 0;
  box-shadow: 2px 2px 0 #000;
  background: #fff;
  color: #000;
  font: 12px ${FONT};
}
${W("speak")} .ui-datepicker .ui-datepicker-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 22px;
  padding: 0 2px;
  border: 0;
  border-radius: 0;
  background: #000;
}
${W("speak")} .ui-datepicker .ui-datepicker-title {
  order: 1;
  margin: 0;
  color: #fff;
  font: bold 12px / 22px ${FONT};
  text-transform: none;
}
${W("speak")} .ui-datepicker .ui-datepicker-title * { color: #fff; font: inherit; text-transform: none; }
${W("speak")} .ui-datepicker :is(.ui-datepicker-prev, .ui-datepicker-next) {
  position: static;
  width: 18px;
  height: 18px;
  border: 0;
  border-radius: 0;
  cursor: default;
}
${W("speak")} .ui-datepicker .ui-datepicker-prev,
${W("speak")} .ui-datepicker .ui-datepicker-prev:hover { order: 0; background: ${G.left}; }
${W("speak")} .ui-datepicker .ui-datepicker-next,
${W("speak")} .ui-datepicker .ui-datepicker-next:hover { order: 2; background: ${G.right}; }
${W("speak")} .ui-datepicker :is(.ui-datepicker-prev, .ui-datepicker-next) span { display: none; }
${W("speak")} .ui-datepicker table.ui-datepicker-calendar { margin: 0; border-collapse: collapse; border-spacing: 0; background: #fff; }
${W("speak")} .ui-datepicker tr { height: auto; }
${W("speak")} .ui-datepicker th {
  height: auto;
  padding: 2px 4px;
  line-height: 16px;
  border: 0;
  background: #fff;
  border-bottom: 1px solid #000;
  color: #000;
  font: bold 12px ${FONT};
  text-transform: none;
}
${W("speak")} .ui-datepicker td { height: auto; padding: 0; border: 0; }
${W("speak")} .ui-datepicker td :is(a, span) {
  display: block;
  width: auto;
  height: auto;
  margin: 0;
  padding: 2px 5px;
  border: 0;
  border-radius: 0;
  box-shadow: none;
  background: #fff;
  color: #000;
  font: 12px / 16px ${FONT};
  text-align: center;
}
${W("speak")} .ui-datepicker td.ui-datepicker-other-month :is(a, span) { color: #595959; }
${W("speak")} .ui-datepicker td.ui-datepicker-today a { font-weight: bold; }
${W("speak")} .ui-datepicker td a:hover { outline: 1px dotted #000; outline-offset: -3px; background: #fff; }
${W("speak")} .ui-datepicker td.ui-datepicker-current-day a,
${W("speak")} .ui-datepicker td a.ui-state-active {
  background: #aaaaaa;
  color: #000;
}
/* the time picker's list: a list box with a black selection */
${W("speak")} .ui-timepicker-wrapper {
  border: 1px solid #000;
  border-radius: 0;
  box-shadow: 2px 2px 0 #000;
  background: #fff;
}
${W("speak")} .ui-timepicker-list li {
  padding: 1px 6px;
  color: #000;
  font: 12px ${FONT};
}
${W("speak")} .ui-timepicker-list li:hover,
${W("speak")} .ui-timepicker-list li.ui-timepicker-selected {
  background: #aaaaaa;
  color: #000;
}

/* ---- Control Panel: NeXT's Preferences, a grey window. The page title is its black title bar, Back a
   NeXT button on a grey strip, and each group a browser column: a raised title cell over a white list,
   the row under the pointer control grey. ---- */
${W("speak")} body:has(.sc-controlpanel-box) {
  background: #aaaaaa;

  .sc-applicationContent {
    min-height: 100vh;
    background: #aaaaaa;
    color: #000;
    font: 12px ${FONT};
  }
  .sc-applicationHeader {
    border: 0;
    box-shadow: none;
    background: none;
  }
  .sc-applicationHeader-row1 {
    box-sizing: border-box;
    height: 21px;
    border-bottom: 1px solid #000;
    background: #000;
  }
  .sc-applicationHeader-row1 .sc-applicationHeader-content {
    height: 20px;
    padding: 0 15px;
  }
  .sc-applicationHeader-title {
    float: none;
    margin: 0;
    padding: 0;
    text-align: center;
  }
  .sc-applicationHeader-title,
  .sc-applicationHeader-title .sc-text {
    display: block;
    height: 20px;
    ${titleText}
  }
  .sc-applicationHeader-row2 {
    box-sizing: border-box;
    height: 31px;
    padding: 0 6px;
    border: 0;
    border-bottom: 1px solid #000;
    box-shadow: inset 0 1px #fff, inset 0 -1px #555555;
    background: #aaaaaa;
  }
  .sc-applicationHeader-back { height: 30px; margin: 0; padding: 4px 0 0; }
  /* 10.4 draws its spiral logo in the title row */
  .sc-applicationHeader-row1::after { content: none; }
  /* Back: a NeXT button with a left-pointing arrow (Sitecore's own arrow image is its ::after) */
  .btn.sc-backbutton {
    display: flex;
    align-items: center;
    box-sizing: border-box;
    height: 22px;
    margin: 0;
    padding: 0 10px 0 22px;
    ${button}
    background: ${art([tri.left(5, 4, 9)], { w: 14, h: 18, pos: "left 4px center" })}, #aaaaaa;
  }
  .btn.sc-backbutton::before,
  .btn.sc-backbutton::after { content: none; }
  .sc-backbutton-text {
    position: static;
    height: 20px;
    margin: 0;
    padding: 0;
    color: #000;
    font: 12px / 20px ${FONT};
  }
  .btn.sc-backbutton:active { background-color: #fff; ${sunken} }
  .btn.sc-backbutton:focus-visible { outline: 1px dotted #000; outline-offset: -4px; }
  .sc-applicationContent-main {
    margin-top: 8px;
    background: none;
  }
  .sc-controlpanel-box {
    margin: 8px 0 0;
    padding: 0;
    border: 1px solid;
    border-color: #555555 #fff #fff #555555;
    box-shadow: inset 1px 1px #000;
    background: #fff;
  }
  .sc-controlpanel-box-header h4 {
    box-sizing: border-box;
    height: 21px;
    margin: 0;
    border-bottom: 1px solid #000;
    box-shadow: inset 1px 1px #fff, inset -1px -1px #555555;
    background: #aaaaaa;
    color: #000;
    font: bold 12px / 20px ${FONT};
    text-align: center;
    text-transform: none;
  }
  .sc-controlpanel-box-header h4 img { display: none; }
  .sc-controlpanel-box-content {
    padding: 2px 0;
    border: 0;
    box-shadow: none;
    background: #fff;
  }
  .sc-controlpanel-box-content li {
    height: auto;
    padding: 0;
    border: 0;
  }
  .sc-controlpanel-box-content a {
    display: block;
    padding: 1px 8px;
    color: #000;
    font: 12px ${FONT};
    line-height: 17px;
    text-decoration: none;
    white-space: nowrap;
  }
  .sc-controlpanel-box-content a:is(:hover, :focus) {
    background: #aaaaaa;
    color: #000;
    outline: none;
  }
}`;


// ---- Launchpad: NeXT's Workspace Manager. The page is the #505050 workspace; on it a File Viewer window,
// a black title bar over its grey body. Each group is a column of the viewer's browser: a raised title
// cell over a sunken well holding the group's applications as icons, the name under each, highlighted
// white (NeXT's selection on grey) under the pointer. Custom Analytics is an attention panel under the
// columns. The viewer has no shelf or path buttons: they would do nothing here. ----
const L = T("launchpad");
const icon = (href, url) => `  .sc-launchpad-item${href} .icon img { content: url("${url}"); }`;
const well = "border: 1px solid; border-color: #555555 #fff #fff #555555; box-shadow: inset 1px 1px #000;";
const launchpad = `/* Redwood: Launchpad. Generated by tools/build-redwood-css.cjs. */
${speakCommon(L)}
${W("launchpad")} {
  /* the workspace */
  body,
  .sc-applicationContent {
    background: #505050;
    color: #000;
    font: 12px ${FONT};
  }
  .sc-applicationContent {
    box-sizing: border-box;
    min-height: 100vh;
    padding: 0 14px 14px;
  }
  .sc-applicationHeader {
    border: 0;
    box-shadow: none;
    background: none;
  }
  .sc-applicationHeader-title,
  .sc-applicationHeader-title .sc-text {
    color: #000;
    font-family: ${FONT};
    font-size: 12px;
    font-weight: bold;
  }
  /* the header here is 48px with the button 7px down */
  .sc-globalHeader a.sc-global-logo,
  .sc-globalHeader a.sc-global-logo:hover { margin-top: 4px; }

  /* the File Viewer window */
  .sc-applicationContent-main {
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
    min-height: calc(100vh - 78px);
    max-width: none;
    margin: 14px 0 0;
    padding: 0 0 6px;
    ${winFrame}
    background: #aaaaaa;
  }
  .sc-applicationContent-main::before {
    content: "File Viewer  -  /sitecore/client/Applications";
    display: block;
    flex: none;
    height: 20px;
    padding: 0 8px;
    border-bottom: 1px solid #000;
    background: #000;
    ${titleText}
    white-space: pre;
  }
  .sc-applicationContent-main > .row {
    display: flex;
    flex-direction: column;
    flex: 1;
    margin: 0;
    padding: 6px 6px 0;
  }
  .sc-applicationContent-main > .row > div {
    float: none;
    width: auto;
    padding: 0;
  }
  div[data-sc-id="ColumnPanel1"] {
    display: flex;
    flex-direction: column;
    flex: 1;
    padding: 0;
  }

  /* the browser's columns, one per group */
  .sc-launchpad {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 6px;
    flex: 1;
    float: none;
    width: auto;
    max-width: none;
    margin: 0;
    padding: 0;
  }
  .sc-launchpad-group {
    display: flex;
    flex-wrap: wrap;
    align-content: flex-start;
    box-sizing: border-box;
    min-width: 0;
    margin: 0;
    padding: 0 0 6px;
    ${well}
    background: #aaaaaa;
  }
  .sc-launchpad-group-title {
    flex: 0 0 100%;
    box-sizing: border-box;
    height: 21px;
    margin: 0 0 6px;
    padding: 0 8px;
    border: 0;
    border-bottom: 1px solid #000;
    box-shadow: inset 1px 1px #fff, inset -1px -1px #555555;
    background: #aaaaaa;
    color: #000;
    font: bold 12px / 20px ${FONT};
    text-align: center;
    text-transform: none;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* the applications as Workspace icons */
  .sc-launchpad-item,
  .sc-launchpad-item:is(:hover, :active, :focus) {
    display: flex;
    flex-direction: column;
    align-items: center;
    box-sizing: border-box;
    width: 80px;
    height: auto;
    min-height: 66px;
    margin: 2px 0 4px;
    padding: 2px 0 0;
    border: 0;
    border-radius: 0;
    box-shadow: none;
    background: none;
    color: #000;
    outline: none;
    text-decoration: none;
  }
  .sc-launchpad-item .icon {
    display: block;
    width: 32px;
    height: 32px;
    margin: 0 0 4px;
    padding: 0;
    border-radius: 0;
    background: none;
  }
  .sc-launchpad-item .icon img {
    display: block;
    width: 32px;
    height: 32px;
    margin: 0;
  }
  .sc-launchpad-item .sc-launchpad-text {
    float: none;
    max-width: 76px;
    padding: 0 3px;
    color: #000;
    font: 12px / 14px ${FONT};
    text-align: center;
    white-space: normal;
  }
  .sc-launchpad-item:is(:hover, :focus-visible) .sc-launchpad-text { background: #fff; }
  .sc-launchpad-item:active .icon { filter: brightness(0.8); }
  .sc-launchpad-item:focus-visible .sc-launchpad-text {
    outline: 1px dotted #000;
    outline-offset: 0;
  }
  /* applications the start menu also lists take its colour icons */
${icon('[href*="Content Editor.aspx"]', "/sitecore/shell/~/icon/Apps/32x32/pencil.png")}
${icon('[href*="Media/MediaShop.aspx"]', "/sitecore/shell/~/icon/Apps/32x32/pictures.png")}
${icon('[href*="Workbox.aspx"]', "/sitecore/shell/~/icon/Apps/32x32/workbox.png")}
${icon('[href*="Recycle Bin.aspx"]', "/sitecore/shell/~/icon/Apps/32x32/refresh.png")}
${icon('[href*="PowerShell/PowerShellIse"]', "/sitecore/shell/~/icon/PowerShell/32x32/ise8.png")}
${icon('[href*="PowerShell/PowerShellReports"]', "/sitecore/shell/~/icon/PowerShell/32x32/powershell_runner.png")}
${icon('[href*="ControlPanel.aspx"]', "/sitecore/shell/~/icon/Apps/32x32/setting.png")}
${icon('[href*="shell/default.aspx"]', "/sitecore/shell/~/icon/Apps/32x32/monitor.png")}
${icon('[href*="User Manager.aspx"]', "/sitecore/shell/~/icon/Apps/32x32/user (1).png")}
${icon('[href*="Security Editor.aspx"]', "/sitecore/shell/~/icon/Apps/32x32/shield.png")}
${icon('[href*="Access Viewer.aspx"]', "/sitecore/shell/~/icon/Apps/32x32/lock.png")}
${icon('[href*="Domain Manager.aspx"]', "/sitecore/shell/~/icon/Apps/32x32/routes.png")}
${icon('[href*="Role Manager.aspx"]', "/sitecore/shell/~/icon/Apps/32x32/account.png")}
${icon('[href*="FormsBuilder"]', "/sitecore/shell/~/icon/Apps/32x32/forms.png")}
${icon(':is([href="/"], [href^="/?"])', "/sitecore/shell/~/icon/Apps/32x32/paint.png")}
  /* Custom Analytics: an attention panel under the columns, its label the panel's title cell */
  .sc-text[data-sc-id="CustomAnalyticsLabel"] {
    position: relative;
    z-index: 1;
    display: block;
    float: none;
    box-sizing: border-box;
    height: 21px;
    margin: 6px 0 -22px;
    padding: 0 8px;
    border: 1px solid #000;
    box-shadow: inset 1px 1px #fff, inset -1px -1px #555555;
    background: #aaaaaa;
    color: #000;
    font: bold 12px / 19px ${FONT};
    text-align: center;
    text-transform: none;
  }
  .sc-border[data-sc-id="FallBackMessageBorder"] {
    float: none;
    box-sizing: border-box;
    width: auto;
    margin: 0;
    padding: 22px 0 0;
    ${well}
    background: #aaaaaa;
  }
  .sc-border[data-sc-id="FallBackMessageBorder"] :is(.row, [class*="col-"]) {
    float: none;
    width: auto;
    margin: 0;
    padding: 0;
  }
  .sc-border[data-sc-id="FallBackMessageBorder"] .sc-border {
    min-height: 0;
    border: 0;
    box-shadow: none;
    background: transparent;
  }
  .sc-border[data-sc-id="FallbackMessageWrap"] {
    position: static;
    display: flex;
    align-items: flex-start;
    gap: 16px;
    padding: 12px 16px;
  }
  /* NeXT's attention panel icon: a bold "!" in a raised square */
  .sc-border[data-sc-id="FallbackMessageWrap"]::before {
    content: "!";
    flex: none;
    box-sizing: border-box;
    width: 32px;
    height: 32px;
    ${raised}
    background: #aaaaaa;
    color: #000;
    font: bold 22px / 30px ${FONT};
    text-align: center;
  }
  .sc-text[data-sc-id="FallBackMessage"] {
    position: static;
    display: block;
    color: #000;
    font: 12px / 16px ${FONT};
    text-align: left;
  }
}`;


// ---- Login: NeXT's login panel. The #505050 workspace without wallpaper, the box a grey panel under a
// black title bar, NeXT text fields and a default button with the return-key glyph. ----
const LG = W("login");
const login = `/* Redwood: login. Generated by tools/build-redwood-css.cjs. */
${LG} body {
  background: #505050;
  color: #000;
  font: 12px ${FONT};
}
${LG} :is(label, a, input, button, span, div, p, li) {
  font-family: ${FONT};
  text-shadow: none;
}
${LG} .main {
  max-width: 440px;
  padding: 0;
  ${winFrame}
  border-radius: 0;
  background: #aaaaaa;
}
${LG} .main::before {
  content: "Login Window";
  display: block;
  height: 20px;
  border-bottom: 1px solid #000;
  background: #000;
  ${titleText}
}
${LG} .logo-wrap {
  margin: 16px 0 12px;
}
/* the white logo, drawn black on the grey dialog */
${LG} .logo-wrap img {
  height: 36px;
  width: auto;
  filter: brightness(0);
}
${LG} :is(.login-page, .logged-out, .main > :not(.logo-wrap)) {
  padding: 0 16px 12px;
}
${LG} label {
  margin: 0 0 3px;
  color: #000;
  font-size: 12px;
  font-weight: normal;
}
${LG} .form-control {
  box-sizing: border-box;
  height: 24px;
  margin: 0 0 8px;
  padding: 2px 4px;
  ${edit}
  font-size: 12px;
}
${LG} .form-control:focus {
  border-color: #000;
  box-shadow: none;
  outline: 1px dotted #000;
  outline-offset: 1px;
}
${LG} .btn {
  display: block;
  box-sizing: border-box;
  width: auto;
  min-width: 75px;
  height: 24px;
  margin: 4px 0 0 auto;
  padding: 0 14px;
  ${button}
  line-height: 20px;
}
/* the default button carries NeXT's return-key glyph */
${LG} .btn.btn-primary {
  padding-right: 30px;
  background: ${returnKey("right 8px center")}, #aaaaaa;
}
${LG} .btn:is(:hover, :focus) {
  background-color: #aaaaaa;
  color: #000;
  border-color: #000;
}
${LG} .btn:active { ${sunken} background-color: #fff; }
${LG} .btn:focus-visible { outline: 1px dotted #000; outline-offset: -5px; }
${LG} a,
${LG} a:is(:hover, :focus) {
  color: #000;
  text-decoration: underline;
}
${LG} .remember-me + .forgot-password::before,
${LG} .vertical-separator {
  border-left-color: #000;
}
${checks(T("login"))}
${LG} input[type="checkbox"] { margin: 1px 0 0 -20px; }
${LG} .warning {
  ${edit}
}
${LG} .top {
  border: 1px solid #000;
  box-shadow: none;
  background: #aaaaaa;
}
${LG} .top > a { color: #000; }
`;

const css = `/* Redwood: classic shell. Generated by tools/build-redwood-css.cjs.
   NeXTSTEP's grey: #aaaaaa faces with 1px white/#555555 bevels inside black outlines, white fields and
   lists, black title bars with the title centred, menus as vertical panels and the Dock at the right. */

/* The SPE ISE's Ace editor measures its own monospace font; keep the theme font out of it. */
${P} body, ${P} input, ${P} select, ${P} textarea, ${P} button,
${P} :is(td, a, span, div):not(.ace_editor, .ace_editor *) {
  font-family: ${FONT};
}
${P} {
  scrollbar-color: auto;
}

/* ---- Scrollbars (Chrome and Edge; Firefox only takes colours): NeXT's scroller, a #555 trough with a
   bevelled grey knob and bevelled arrow buttons ---- */
${P} ::-webkit-scrollbar { width: 18px; height: 18px; background: #555555; }
${P} ::-webkit-scrollbar-corner { background: #aaaaaa; }
/* list boxes and text areas too: the token layer colours their thumbs one selector weight higher, and
   Sitecore rounds them */
${P} ::-webkit-scrollbar-thumb, ${P} :is(select, textarea)::-webkit-scrollbar-thumb { background: #aaaaaa; border-radius: 0; ${raised} }
${P} ::-webkit-scrollbar-button:single-button { display: block; width: 18px; height: 18px; }
${P} ::-webkit-scrollbar-button:vertical:decrement { background: ${G.up}; }
${P} ::-webkit-scrollbar-button:vertical:increment { background: ${G.down}; }
${P} ::-webkit-scrollbar-button:horizontal:decrement { background: ${G.left}; }
${P} ::-webkit-scrollbar-button:horizontal:increment { background: ${G.right}; }
/* The rule editor's two lists (10.5) carry Sitecore's own ID-weighted scrollbar, 12px with a rounded thumb in a
   white ring, which outranks the rules above: the NeXT scroller again, at their weight. */
${P} :is(#Conditions, #Description)::-webkit-scrollbar { width: 18px; height: 18px; background: #555555; }
${P} :is(#Conditions, #Description)::-webkit-scrollbar-track { background: transparent; border-radius: 0; }
${P} :is(#Conditions, #Description)::-webkit-scrollbar-thumb { background: #aaaaaa; border-radius: 0; ${raised} }

/* ---- Ribbon tabs: NeXT tabs, rounded at the top; the open one lighter, joined to the toolbar ---- */
${P} .scRibbonNavigator { background: #aaaaaa; border-bottom: 1px solid #000; }
${P} .scRibbon a:is(.scRibbonNavigatorButtonsNormal, .scRibbonNavigatorButtonsContextualNormal, .scRibbonNavigatorButtonsActive, .scRibbonNavigatorButtonsContextualActive) {
  position: relative;
  ${tabFace}
  margin-right: 1px;
  color: #000;
  font-weight: normal;
}
${P} .scRibbon a:is(.scRibbonNavigatorButtonsNormal, .scRibbonNavigatorButtonsContextualNormal):hover { background: #bbbbbb; color: #000; }
/* the open tab runs into the toolbar, over the strip's bottom line */
${P} .scRibbon a:is(.scRibbonNavigatorButtonsActive, .scRibbonNavigatorButtonsContextualActive) {
  z-index: 1;
  margin-bottom: -1px;
  padding-bottom: 1px;
  background: #aaaaaa;
  font-weight: bold;
}

/* ---- Ribbon toolbar: a grey panel of bevelled groups ---- */
${P} .scRibbonToolbar { background: #aaaaaa; border-bottom: 1px solid #000; box-shadow: inset 0 1px #fff; }
${P} .scRibbonToolbar .chunk { height: auto; background: #aaaaaa; ${raised} margin: 2px 1px; }
${P} .scRibbonToolbar .chunk .caption { background: transparent; color: #000; }
${P} .scRibbonToolbar .panel, ${P} .scRibbonToolbar .panel span, ${P} .scRibbonToolbar .panel a { color: #000; }
/* Only the buttons themselves: icons, captions and the small-button columns carry "Button" in their
   class names too. Buttons are flat until hovered, then raised; pressed, NeXT's white highlight. A large
   combo button shows its command and its drop-down as two faces, each pressed on its own. */
${P} .scRibbonToolbar :is(a[class^="scRibbonToolbar"], span[class^="scRibbonToolbar"][class*="Disabled"], .scRibbonToolbarLargeComboButton, .scRibbonToolbarSmallComboButton) { border: 1px solid transparent; border-radius: 0; box-shadow: none; }
${P} .scRibbonToolbar :is(a[class^="scRibbonToolbar"]:not([class*="ComboButton"]), .scRibbonToolbarSmallComboButton):hover { background: #aaaaaa; ${raised} }
${P} .scRibbonToolbar :is(a[class^="scRibbonToolbar"]:not([class*="ComboButton"]), .scRibbonToolbarSmallComboButton):active,
${P} .scRibbonToolbar a[class^="scRibbonToolbar"][class*="ButtonDown"] { background: #fff; border: 1px solid #000; ${sunken} }
${P} .scRibbonToolbar a[class*="ComboButton"]:is(:hover, :active) { background: transparent; border-color: transparent; box-shadow: none; }
${P} .scRibbonToolbar .scRibbonToolbarLargeComboButton:hover > :is(.scRibbonToolbarLargeComboButtonTop, .scRibbonToolbarLargeComboButtonBottom) { background: #aaaaaa; border-color: #000; box-shadow: inset 1px 1px #fff, inset -1px -1px #555555; }
${P} .scRibbonToolbar .scRibbonToolbarLargeComboButton > :is(.scRibbonToolbarLargeComboButtonTop, .scRibbonToolbarLargeComboButtonBottom):active { background: #fff; border-color: #000; box-shadow: inset 1px 1px #555555, inset -1px -1px #fff; }
${P} a.scSystemMenu,
${P} a.scSystemMenu:hover {
  background: ${art([bar(5, 5, 8, 1), bar(5, 8, 8, 1), bar(5, 11, 8, 1)])};
}

/* ---- Content tree: white, as a NeXT browser column. A node with children ends in the browser's
   right-pointing arrow at the column's right edge; the [+]/[-] box still opens it in place. ---- */
${P} .scContentTree { background: #fff; }
/* the selected node is control grey in every tree, the dialogs' item pickers too */
${P} a.scContentTreeNodeActive { background: #aaaaaa; color: #000; border-radius: 0; }
${P} a.scContentTreeNodeActive span { color: #000 !important; }
${P} .scContentTree a.scContentTreeNodeNormal:hover { background: #eeeeee; }
${P} .scContentTreeNode:has(> img:is([src*="/treemenu_collapsed"], [src*="/treemenu_expanded"])) {
  background: ${menuArrow("#555555").replace(" center ", " right 2px top 3px ")};
}
/* The [+]/[-] box is a real 9px bordered box, margined out to the stock 16px footprint: at 125% scaling
   gradient edges and inset shadows land between device pixels and smear, borders snap. */
${P} img[src*="/treemenu_"] {
  box-sizing: border-box;
  width: 9px;
  height: 9px;
  margin: 4px 3px 3px 4px;
  border: 1px solid #555555;
  object-fit: none;
  object-position: -999px -999px;
}
/* Default.css gives tree glyphs a 5px 0 margin */
${P} .scContentTreeNode > img[src*="/treemenu_"] { margin: 9px 3px 8px 4px; }
${P} img[src*="/treemenu_collapsed"] {
  background: linear-gradient(#000, #000) center / 1px 5px no-repeat, linear-gradient(#000, #000) center / 5px 1px no-repeat, #fff;
}
${P} img[src*="/treemenu_expanded"] { background: linear-gradient(#000, #000) center / 5px 1px no-repeat, #fff; }

/* ---- Editor: a #ccc well; sections are raised grey strips ---- */
${P} .scEditorHeaderTitle { font-weight: bold; font-size: 14px; color: #000; }
${P} .scEditorSectionCaptionExpanded, ${P} .scEditorSectionCaptionCollapsed {
  background: #aaaaaa;
  color: #000;
  font-weight: bold;
  line-height: 20px;
  padding: 0 0 0 8px;
  margin: 0 0 2px;
  ${raised}
}
${P} img.scEditorSectionCaptionGlyph { width: 18px; height: 18px; margin: 1px 2px 0 0; }
${P} img.scEditorSectionCaptionGlyph[src*="accordion_up"] { ${paint(G.up)} }
${P} img.scEditorSectionCaptionGlyph[src*="accordion_down"] { ${paint(G.down)} }
${P} .scEditorFieldLabel { color: #000; font-weight: bold; }
/* The marker bar only shows validation colours, as in 10.x. */
${W("shell")} td.scEditorFieldMarkerBarCell { background: transparent; border-left-color: transparent; }
${P} .scContentControl,
${P} .scEditorSections input:not([type="checkbox"]):not([type="radio"]),
${P} .scEditorSections textarea,
${P} .scEditorSections select {
  ${edit}
}

${P} .scSearchInput { ${edit} }

/* ---- Buttons: NeXT's, white while pressed ---- */
${P} .scButton, ${P} button:not(.ui-button), ${P} input[type="button"], ${P} input[type="submit"] {
  ${button}
}
${P} .scButton:active, ${P} button:not(.ui-button):active { background: #fff; ${sunken} }
${P} .scButton:focus-visible, ${P} button:focus-visible { outline: 1px dotted #000; outline-offset: -5px; }

/* ---- Bottom application tabs: a row of NeXT buttons, the open one held in (white) ---- */
${P} .scPager { width: auto; margin: 0; border: 0; border-radius: 0; padding: 2px; background: #aaaaaa; border-top: 1px solid #000; box-shadow: inset 0 1px #fff; }
${P} .scPagerButtonNormal, ${P} .scPagerButtonActive { color: #000; font-weight: normal; background: #aaaaaa; ${raised} border-radius: 0; margin: 1px; }
${P} .scPagerButtonActive { background: #fff; font-weight: bold; box-shadow: inset 1px 1px #555555, inset -1px -1px #fff; }
/* 10.5 draws the pager's links white once visited (the page links to itself); computed styles hide it */
${W("shell")} a:is(.scPagerButtonNormal, .scPagerButtonActive):is(:link, :visited) { color: #000; }

/* ---- Dialog windows (jQuery UI frames around Sitecore dialogs): a NeXT panel, a black outline and a
   drop shadow, the dialog page's header the black title bar ---- */
${P} .ui-dialog {
  background: #aaaaaa;
  border: 1px solid #000;
  border-radius: 0;
  padding: 0;
  box-shadow: 3px 3px 0 rgba(0, 0, 0, 0.45);
}
/* Sitecore stacks a 15px jQuery title bar above the dialog page, whose header is the black title bar.
   Laid over the title bar, the bar keeps dragging and carries the buttons into it. */
${P} .ui-dialog .ui-dialog-titlebar {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 20px;
  min-height: 0;
  padding: 0;
  z-index: 2;
  background: transparent;
  border: 0;
  border-radius: 0;
}
${P} .ui-dialog .ui-dialog-titlebar-buttonpane > * {
  width: 16px;
  height: 16px;
  margin: 2px 0 0 2px;
  padding: 0;
  border: 0;
  border-radius: 0;
  background-repeat: no-repeat;
  background-color: transparent;
  overflow: hidden;
  text-indent: -999px;
}
${P} .ui-dialog .ui-dialog-titlebar-buttonpane > * > * { display: none; }
/* The button pane spans the title bar: miniaturise at the left, close at the right, 2px in.
   Sitecore pins the pane with !important and writes the close button's position inline. */
${P} .ui-dialog .ui-dialog-titlebar-buttonpane {
  left: 0;
  right: 2px !important;
  top: 0 !important;
  width: auto;
  display: flex;
  justify-content: flex-end;
}
${P} .ui-dialog .ui-dialog-titlebar-buttonpane > button.ui-button {
  position: static !important;
  float: none !important;
  order: 9;
  margin: 2px 0 0 2px !important;
  background: ${G.close};
}
${P} .ui-dialog .ui-dialog-titlebar-buttonpane > button.ui-button:active { filter: invert(0.15); }
/* NeXT never dimmed the screen behind a panel; a faint shade still marks the dialog as modal. */
${P} .ui-widget-overlay { background: rgba(0, 0, 0, 0.15); opacity: 1; }
${P} .ui-dialog .ui-dialog-titlebar-maximize { background: ${G.zoom}; }
${P} .ui-dialog .ui-dialog-titlebar-minimize { order: -1; margin-right: auto !important; background: ${G.mini}; }
${P} .ui-dialog .ui-dialog-titlebar-restore { background: ${G.restore}; }

/* Inside a dialog page: its header is the black title bar. */
${P} :is(.scFormDialogHeader, .scDialogHeader) { background: #aaaaaa; padding: 0; border: 0; }
/* the dialog page's header, and the ListView's, which SPE puts straight in the jQuery dialog */
${P} :is(:is(.scFormDialogHeader, .scDialogHeader) .DialogHeader, .ui-dialog > .DialogHeader) {
  background: #000;
  ${titleText}
  height: 20px;
  margin: 0;
  padding: 0 46px;
  border-bottom: 1px solid #000;
}
${P} :is(.scFormDialogHeader, .scDialogHeader) .DialogHeaderDescription { color: #000; padding: 6px 10px; margin: 0; }
/* SPE puts a 32px icon in the title bar; NeXT's titles were one line of text. */
${P} .DialogHeader #DialogIcon { width: 16px; height: 16px; margin-right: 4px; vertical-align: -3px; }
${P} .scFormDialogContent, ${P} .scFormDialogFooter { background: #aaaaaa; }

/* ---- Window buttons: NeXT's bevelled 16px squares, miniaturise and close ---- */
${P} :is(.scSystemButtons, .standartWindowButtons, .scWorkboxWindowButtons) img { width: 16px; height: 16px; margin: 0 0 0 2px; padding: 0; vertical-align: middle; filter: none; }
${P} :is(.scSystemButtons, .standartWindowButtons, .scWorkboxWindowButtons) img[src*="page_switcher"] { ${paint(G.switcher)} }
${P} :is(.scSystemButtons, .standartWindowButtons, .scWorkboxWindowButtons) img[src*="minimize"] { ${paint(G.mini)} }
${P} :is(.scSystemButtons, .standartWindowButtons, .scWorkboxWindowButtons) img[src*="maximize"] { ${paint(G.zoom)} }
${P} :is(.scSystemButtons, .standartWindowButtons, .scWorkboxWindowButtons) img[src*="restore"] { ${paint(G.restore)} }
${P} :is(.scSystemButtons, .standartWindowButtons, .scWorkboxWindowButtons) img[src*="_close"] { ${paint(G.close)} }
${P} :is(.scSystemButtons, .standartWindowButtons, .scWorkboxWindowButtons) img:active { filter: invert(0.15); }
/* Standard windows (ISE, Console, Package Designer...): a NeXT title bar, the title centred in bold
   white, miniaturise at the left end and close at the right. */
${P} .standardWindowCaption { height: 20px; background: #000; border-bottom: 1px solid #000; }
${P} .standardWindowCaption + .windowPlaceholderContainer { top: 21px; }
${P} .standardWindowCaption .scWindowCaption { display: block; ${titleText} padding: 0 60px; }
${P} .standartWindowButtons { top: 2px; left: 2px; right: 2px; height: 16px; display: flex; justify-content: flex-end; pointer-events: none; }
/* The Content Editor, Media Library and Workbox: Sitecore draws no caption over their windows. NeXTSTEP's black title bar, as on every other window, is
   drawn on the caption's empty top line from the window's title (engine.js --sct-window-title), the window's
   buttons on it and the ribbon's menu button moved below it. */
${P}[data-sct-window-title] .scWindowBorder2 > .scCaption > #CaptionTopLine, ${P}[data-sct-window-title] .scWorkboxWindowCaption.scWindowHandle { box-sizing: border-box; height: 21px; background: #000; border-bottom: 1px solid #000; }
${P}[data-sct-window-title] .scWindowBorder2 > .scCaption > #CaptionTopLine::before, ${P}[data-sct-window-title] .scWorkboxWindowCaption.scWindowHandle::before { content: var(--sct-window-title, ""); display: block; box-sizing: border-box; height: 20px; padding: 0 80px; ${titleText} white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
${P}[data-sct-window-title] .scWindowBorder2 > .scCaption > .scSystemButtons, ${P}[data-sct-window-title] .scWorkboxWindowButtons { top: 2px; right: 2px; margin-right: 0; height: 17px; z-index: 2; }
/* the Workbox's buttons float in its caption strip: placed on the bar like the Content Editor's */
${P}[data-sct-window-title] .scWorkboxWindowCaption.scWindowHandle { position: relative; }
${P}[data-sct-window-title] .scWorkboxWindowButtons { position: absolute; float: none; }
/* Under the bar the tabs start at its foot: the empty header over the tab group (17px, for a contextual group's
   name) goes while no contextual group shows, and the menu button, 17px down and 30px tall for that band, moves
   up into the tab row at the row's height */
${P}[data-sct-window-title] .scWindowBorder2 > .scCaption > #SystemMenu { top: 0; margin-top: 21px; height: 32px; }
${P}[data-sct-window-title] .scWindowBorder2 > .scCaption .scRibbonNavigator:not(:has(.scRibbonNavigatorButtonsContextualGroup)) .scRibbonNavigatorButtonsGroupHeader { display: none; }
/* 2px between the title bar and the tabs: they never touch it; the menu button moves down with them */
${P}[data-sct-window-title] .scWindowBorder2 > .scCaption .scRibbonNavigator { padding-top: 2px; }
${P}[data-sct-window-title] .scWindowBorder2 > .scCaption > #SystemMenu { translate: 0 2px; }

${P} .standartWindowButtons img { pointer-events: auto; }
${P} .standartWindowButtons img[src*="minimize"] { order: -1; margin: 0 auto 0 0; }
/* SPE's ISE (ise.js) gives its title the room the .standartWindowButtons box leaves; here that box spans the
   bar (miniaturise on the left, close on the right), so the title would get none. The caption's own
   padding already keeps the title clear of the buttons. */
${P} .standardWindowCaption #WindowCaption { max-width: 100% !important; margin-left: 0 !important; }

/* ---- Insert gallery scroller: bevelled buttons ---- */
${P} .scRibbonPanelButtons { background: #aaaaaa; }
${P} img.scRibbonPanelUp { ${paint(G.up)} width: 18px; height: 18px; filter: none; }
${P} img.scRibbonPanelDown { ${paint(G.down)} width: 18px; height: 18px; filter: none; }
${P} img.scRibbonPanelOpen { ${paint(G.dots)} width: 18px; height: 18px; filter: none; }

/* ==== Hand-written details ==== */
${header(P, 50)}
/* the shell's header: the button centred in its 50px bar */
${W("shell")} .sc-globalHeader .sc-globalHeader-startButton {
  display: flex;
  align-items: center;
  height: 50px;
}
${W("shell")} .sc-globalHeader a.sc-global-logo,
${W("shell")} .sc-globalHeader a.sc-global-logo:hover { margin-top: 0; }
${checks(P)}
${appTitle(P)}
/* 10.4's header is 50px tall, 10.5's 51px */
${W("shell")}[data-sct-version="10.4"] .scStartbar { top: 50px; }
${shellHand}`;

const out = { shell: css, speak, launchpad, login };
for (const [name, text] of Object.entries(out)) {
  fs.writeFileSync(path.join(__dirname, "..", "extension", "themes", "redwood", `${name}.css`), pixelate(text));
  console.log(`${name}.css: ${(text.length / 1024).toFixed(1)} KB`);
}
