// Dev tool: writes extension/themes/sonata/{shell,speak,launchpad,login}.css and the glyph images in
// extension/themes/sonata/glyphs. Sonata recreates Mac OS 9's Platinum appearance; its bevels, window boxes,
// disclosure triangles and pinstripes are drawn from code, so they are generated here rather than written by hand.
// Run: node tools/build-sonata-css.cjs
//
// Platinum, as measured from Mac OS 9.2 at 100%:
// | Part              | Value                                                                                  |
// |-------------------|----------------------------------------------------------------------------------------|
// | Greys             | face #dddddd, content #eeeeee, shades #cccccc #bbbbbb #999999 #777777 #555555, black     |
// | Highlights        | text selection lavender #ccccff, focus ring lilac #8c8cdb (2px), menu highlight #6060c0 |
// | System font       | Charcoal 12 bold; not shipped, so a bold Verdana/Geneva stack at 11.5px                 |
// | Window frame      | 1px black outline, 1px white inner highlight, 1px #555 drop shadow right and bottom    |
// | Title bar         | 19px #dddddd, four pinstripes (white over #999999, 3px period) in a 12px band, the     |
// |                   | title centred on a plain gap 8px wide each side                                       |
// | Window boxes      | 13px bevelled squares in an etched well: close on the left 7px in; zoom then collapse  |
// |                   | on the right, 7px from the edge, 4px apart, each on a 2px gap in the stripes            |
// | Push button       | 4px rounded, 1px black, white/#999 inner bevel; default button in a 3px ring           |
// | Edit text         | white, 1px #555 frame with #999 inner top-left shadow; focus a 2px lilac ring          |
// | Tabs              | 5px rounded tops, #777 outline, #cccccc; the open one #eeeeee, bold, joined to the page |
// | Scroll bar        | 16px: #bbbbbb track, lavender thumb with grip lines, arrows at both ends                |
// | Menu              | #dddddd, 1px black frame, 1px drop shadow, 18px rows, etched separators               |
// | Menu bar          | 20px #dddddd, 1px black bottom line                                                    |
// | Desktop           | Mac OS 9's blue-violet (#5c6fa8) with a faint diagonal weave                            |
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const crypto = require("crypto");

const T = (surface) => `html[data-sct-theme="sonata"][data-sct-surface="${surface}"]`;
const P = T("shell");
// :not(#sct-so) matches every page; its id weight lets hand-written rules beat Sitecore's own.
const W = (surface) => `${T(surface)}:not(#sct-so)`;
const FONT = 'Charcoal, "Charcoal CY", Verdana, Geneva, Tahoma, sans-serif';
// Glyphs are shapes on a small grid, centred in whatever box they paint: triangles and bars. ico() writes each
// glyph into themes/sonata/glyphs twice, as a PNG and as an SVG. image-set() gives a 100% screen the PNG,
// kept exact by pixelate(); every other scale gets the SVG, drawn at the screen's resolution. Pixel art that is
// not a set of shapes (the window boxes, the menu bar's note) goes through art(), the same pair from rows of
// letters. The CSS names the files sct-ext:<path>, which background.js points at the extension's own URL, so a
// page CSP without data: in img-src (some installs send one) still loads them.
const HEX = {
  K: "#000", W: "#fff", A: "#eee", C: "#ddd", Q: "#ccc", B: "#bbb", G: "#999", D: "#777", E: "#555",
  L: "#ccf", V: "#8c8cdb", M: "#99c", N: "#66a", P: "#6060c0",
};
const LETTER = Object.fromEntries(Object.entries(HEX).map(([k, v]) => [v, k]));
// a w-wide triangle pointing down or up is (w + 1) / 2 tall; one pointing left or right the other way round
const tri = {
  down: (x, y, w, c = "#000") => ({ kind: "down", x, y, w, h: (w + 1) / 2, c }),
  up: (x, y, w, c = "#000") => ({ kind: "up", x, y, w, h: (w + 1) / 2, c }),
  left: (x, y, h, c = "#000") => ({ kind: "left", x, y, w: (h + 1) / 2, h, c }),
  right: (x, y, h, c = "#000") => ({ kind: "right", x, y, w: (h + 1) / 2, h, c }),
};
const bar = (x, y, w, h, c = "#000") => ({ kind: "bar", x, y, w, h, c });

function rasterize(shapes, w, h) {
  const px = Array.from({ length: h }, () => Array(w).fill("."));
  const set = (x, y, c) => { if (x >= 0 && x < w && y >= 0 && y < h) px[y][x] = LETTER[c]; };
  for (const s of shapes) {
    for (let j = 0; j < s.h; j++) for (let i = 0; i < s.w; i++) {
      const d = s.kind === "left" || s.kind === "right" ? Math.abs(j - (s.h - 1) / 2) : 0;
      const on = {
        bar: true,
        down: i >= j && i <= s.w - 1 - j,
        up: i >= s.h - 1 - j && i <= s.w - 1 - (s.h - 1 - j),
        left: i >= d,
        right: i <= s.w - 1 - d,
      }[s.kind];
      if (on) set(s.x + i, s.y + j, s.c);
    }
  }
  return px.map((r) => r.join(""));
}
// The same shapes as vectors. A triangle's sides run through the middle of each pixel step, so it covers
// the same area as its pixels. Bars keep their edges on device pixels (crispEdges).
function vectorize(shapes) {
  return shapes.map(({ kind, x, y, w, h, c }) => {
    const poly = (...p) => `<path d="M${p.join("L")}Z" fill="${c}"/>`;
    if (kind === "bar") return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${c}" shape-rendering="crispEdges"/>`;
    if (kind === "down") return poly(`${x - 0.5} ${y}`, `${x + w + 0.5} ${y}`, `${x + w / 2} ${y + h}`);
    if (kind === "up") return poly(`${x - 0.5} ${y + h}`, `${x + w + 0.5} ${y + h}`, `${x + w / 2} ${y}`);
    if (kind === "left") return poly(`${x + w} ${y - 0.5}`, `${x + w} ${y + h + 0.5}`, `${x} ${y + h / 2}`);
    return poly(`${x} ${y - 0.5}`, `${x} ${y + h + 0.5}`, `${x + w} ${y + h / 2}`);
  }).join("");
}
const GLYPHS = path.join(__dirname, "..", "extension", "themes", "sonata", "glyphs");
fs.rmSync(GLYPHS, { recursive: true, force: true });
fs.mkdirSync(GLYPHS, { recursive: true });
// Writes the PNG and SVG pair for a set of pixel rows; pad is the transparent margin on [x, y] (Chrome softens
// the edge of an image placed between device pixels, and the margin keeps that softening off the art; a tile
// that repeats sideways has none sideways).
function write(rows, svg, [px, py] = [1, 1]) {
  const w = rows[0].length, h = rows.length;
  const name = crypto.createHash("sha1").update(rows.join("|") + svg + px + py).digest("hex").slice(0, 10);
  const side = ".".repeat(px);
  const padded = rows.map((r) => side + r + side);
  const blank = ".".repeat(w + 2 * px);
  fs.writeFileSync(path.join(GLYPHS, `${name}.png`), png([...Array(py).fill(blank), ...padded, ...Array(py).fill(blank)]));
  fs.writeFileSync(path.join(GLYPHS, `${name}.svg`),
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w + 2 * px}" height="${h + 2 * py}" viewBox="${-px} ${-py} ${w + 2 * px} ${h + 2 * py}">${svg}</svg>\n`);
  const url = (ext) => `url("sct-ext:themes/sonata/glyphs/${name}.${ext}")`;
  return { set: `image-set(${url("png")} 1x, ${url("svg")} 2x)`, w: w + 2 * px, h: h + 2 * py };
}
// One background layer: the glyph on a w x h canvas (16px by default), centred unless placed otherwise.
function ico(shapes, { w = 16, h = 16, pos = "center" } = {}) {
  const img = write(rasterize(shapes, w, h), vectorize(shapes));
  return `${img.set} ${pos} / ${img.w}px ${img.h}px no-repeat`;
}
// The pixels as SVG squares, one <rect> per run of one colour, kept on device pixels.
function squares(rows) {
  const h = rows.length, w = rows[0].length;
  const done = rows.map((r) => [...r].map((c) => c === "."));
  const rects = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (done[y][x]) continue;
    const c = rows[y][x];
    let rw = 1, rh = 1;
    while (x + rw < w && !done[y][x + rw] && rows[y][x + rw] === c) rw++;
    while (y + rh < h && [...Array(rw)].every((_, i) => !done[y + rh][x + i] && rows[y + rh][x + i] === c)) rh++;
    for (let j = 0; j < rh; j++) for (let i = 0; i < rw; i++) done[y + j][x + i] = true;
    rects.push(`<rect x="${x}" y="${y}" width="${rw}" height="${rh}" fill="${HEX[c]}"/>`);
  }
  return `<g shape-rendering="crispEdges">${rects.join("")}</g>`;
}
// Pixel art, one letter of HEX per pixel ('.' transparent), with an optional vector redraw for other scales.
function art(rows, { pos = "center", vector } = {}) {
  if (rows.some((r) => r.length !== rows[0].length || /[^.A-Z]/.test(r) || [...r].some((c) => c !== "." && !HEX[c]))) {
    throw new Error(`bad pixel art: ${rows.join("|")}`);
  }
  const img = write(rows, vector || squares(rows));
  return `${img.set} ${pos} / ${img.w}px ${img.h}px no-repeat`;
}
// A tile that repeats sideways (the title bar's pinstripes): no side margin, placed by the caller.
function tile(rows) {
  const img = write(rows, squares(rows), [0, 1]);
  return { img: img.set, w: img.w, h: img.h };
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
    .filter((m) => /(^|[;\s])background(-image)?\s*:[^;]*(sct-ext:|var\(--sct-so-)/.test(m[2]))
    .map((m) => m[1].trim());
  if (!sels.length) return text;
  const all = ':where(html[data-sct-theme="sonata"] *)';
  return `${text}
/* glyphs at exactly 100%: their PNGs, nearest-neighbour (see pixelate()) */
@media (resolution: 1dppx) {
  ${all}, ${all}::before, ${all}::after { image-rendering: auto; }
${sels.map((s) => `  ${s} { image-rendering: pixelated; }`).join("\n")}
}
`;
}
// Hides an <img>'s own picture so the painted background shows instead.
const paint = (g) => `object-fit: none; object-position: -999px -999px; background: ${g};`;

// ---- Platinum's parts ----
// A 16px bevelled button face (scroll arrows, list navigation), drawn whole so its edges stay crisp at 125%:
// a black outline, white top-left and #999 bottom-right inside it, the glyph on #ddd.
const face = (w = 16, h = 16) => [bar(0, 0, w, h), bar(1, 1, w - 2, h - 2, "#999"), bar(1, 1, w - 3, h - 3, "#fff"), bar(2, 2, w - 4, h - 4, "#ddd")];
const btn = (...glyph) => ico([...face(), ...glyph]);
// The scroll bar's arrow boxes: no outline on the bar's outer edge, which the window frame draws.
const sface = (side) => {
  const edges = { top: bar(0, 15, 16, 1), bottom: bar(0, 0, 16, 1), left: bar(15, 0, 1, 16), right: bar(0, 0, 1, 16) };
  return [bar(0, 0, 16, 16, "#999"), bar(0, 0, 15, 15, "#fff"), bar(1, 1, 14, 14, "#ddd"), edges[side], side === "top" || side === "bottom" ? bar(0, 0, 1, 16) : bar(0, 0, 16, 1)];
};
const G = {
  up: btn(tri.up(4, 6, 7)),
  down: btn(tri.down(4, 6, 7)),
  left: btn(tri.left(6, 4, 7)),
  right: btn(tri.right(6, 4, 7)),
  updown: btn(tri.up(5, 3, 5), tri.down(5, 9, 5)),
  dots: btn(bar(4, 7, 2, 2), bar(7, 7, 2, 2), bar(10, 7, 2, 2)),
  first: btn(bar(4, 4, 1, 7), tri.left(6, 4, 7)),
  last: btn(bar(11, 4, 1, 7), tri.right(6, 4, 7)),
  sUp: ico([...sface("top"), tri.up(4, 6, 7)]),
  sDown: ico([...sface("bottom"), tri.down(4, 6, 7)]),
  sLeft: ico([...sface("left"), tri.left(6, 4, 7)]),
  sRight: ico([...sface("right"), tri.right(6, 4, 7)]),
  // the popup menu's arrow box: the triangle under a white highlight (the black divider is the box's border)
  combo: ico([bar(0, 0, 1, 20, "#fff"), tri.down(5, 9, 7)], { w: 17, h: 20 }),
};
// A popup menu's arrow box flush with the right edge of a select: a black divider, then the box.
const comboRight = [
  ico([bar(0, 0, 1, 20), bar(1, 0, 1, 20, "#fff"), tri.down(6, 9, 7)], { w: 18, h: 20, pos: "right 0 center" }),
  "linear-gradient(#dddddd, #dddddd) right 0 top 0 / 18px 100% no-repeat",
].join(", ");
// Bare glyphs (no button face) for drop-down arrows and submenu arrows.
const triDown = (c = "#000") => ico([tri.down(4, 6, 7, c)]);
const triRight = (c = "#000") => ico([tri.right(6, 4, 7, c)]);

// The disclosure triangles of lists and trees: black outlined, #999 inside; pointing right when closed.
const DISCLOSED = { closed: ["K.....", "KK....", "KGK...", "KGGK..", "KGGGK.", "KGGGGK", "KGGGK.", "KGGK..", "KGK...", "KK....", "K....."] };
DISCLOSED.open = DISCLOSED.closed[0].split("").map((_, x) => DISCLOSED.closed.map((r) => r[x]).join(""));
const disclose = (open) => art(open ? DISCLOSED.open : DISCLOSED.closed, {
  vector: open ? `<path d="M0.5 0.5H10.5L5.5 5.5Z" fill="#999" stroke="#000" stroke-linejoin="round"/>`
    : `<path d="M0.5 0.5V10.5L5.5 5.5Z" fill="#999" stroke="#000" stroke-linejoin="round"/>`,
});
// The check box's check mark.
const CHECK = ["........K", ".......KK", "......KK.", "K....KK..", "KK..KK...", ".KKKK....", "..KK.....", "...K....."];
const checkMark = art(CHECK, { vector: `<path d="M0.6 3.6L3.2 6.6L8.6 0.4" fill="none" stroke="#000" stroke-width="1.8" stroke-linejoin="round"/>` });

// The window boxes: a 13px square in an etched well (#777 top and left, white bottom and right), a black
// frame, and inside it a face lit from the top left. The zoom box adds a small square in its top left corner,
// the collapse box two lines across its middle.
function windowBox(kind) {
  const shade = ["W", "W", "A", "A", "A", "C", "C", "C", "Q", "Q", "Q", "B", "B", "B", "G", "G", "G"];
  const rows = [];
  for (let y = 0; y < 13; y++) {
    let r = "";
    for (let x = 0; x < 13; x++) {
      if (x === 12 || y === 12) r += "W";
      else if (x === 0 || y === 0) r += "D";
      else if (x === 1 || y === 1 || x === 11 || y === 11) r += "K";
      else if (kind === "zoom" && ((x >= 3 && x <= 7 && (y === 3 || y === 7)) || (y >= 3 && y <= 7 && (x === 3 || x === 7)))) r += "E";
      else if (kind === "collapse" && (y === 5 || y === 7) && x >= 2 && x <= 10) r += "E";
      else r += shade[(x - 2) + (y - 2)];
    }
    rows.push(r);
  }
  return art(rows);
}
// The menu bar's leftmost menu: a neutral glyph (never the Apple logo), a pair of eighth notes for Sonata.
const NOTE = [
  "....KKKKKKKK",
  "....KKKKKKKK",
  "....K......K",
  "....K......K",
  "....K......K",
  "....K......K",
  "....K......K",
  "....K......K",
  "..KKK....KKK",
  ".KKKK...KKKK",
  "KKKKK..KKKKK",
  "KKKKK..KKKKK",
  ".KKK....KKK.",
];
const note = art(NOTE, { vector: `<g fill="#000"><path d="M4 0H12V2H5V9H4ZM11 2H12V10H11Z"/><ellipse cx="2.6" cy="10.6" rx="2.6" ry="2" transform="rotate(-20 2.6 10.6)"/><ellipse cx="9.6" cy="10.6" rx="2.6" ry="2" transform="rotate(-20 9.6 10.6)"/></g>` });
// The scroll thumb's grip: four ridges, white over #66a, across the lavender thumb.
const GRIP_V = ["WWWWWWW", "NNNNNNN", ".......", "WWWWWWW", "NNNNNNN", ".......", "WWWWWWW", "NNNNNNN", ".......", "WWWWWWW", "NNNNNNN"];
const GRIP_H = GRIP_V[0].split("").map((_, x) => GRIP_V.map((r) => r[x]).join(""));
// The title bar's pinstripes: a 12px band of four ridges, each a white line over a #999 one.
const STRIPES = tile(["CC", "WW", "GG", "CC", "WW", "GG", "CC", "WW", "GG", "CC", "WW", "GG"]);
const stripes = `${STRIPES.img} 0 50% / ${STRIPES.w}px ${STRIPES.h}px repeat-x`;

const BOX = { close: windowBox("close"), zoom: windowBox("zoom"), collapse: windowBox("collapse") };
// The window boxes are defined once as custom properties on <html> (see the top of each stylesheet).
const V = Object.fromEntries(Object.keys(BOX).map((k) => [k, `var(--sct-so-${k})`]));
const boxVars = (S) => `${S} {\n${Object.entries(BOX).map(([k, v]) => `  --sct-so-${k}: ${v};`).join("\n")}\n}`;

// A raised Platinum face: a black outline, white top-left and #999 bottom-right inside it.
const raised = "border: 1px solid #000; box-shadow: inset 1px 1px #fff, inset -1px -1px #999;";
// pressed: the face darkens and the light falls the other way
const sunken = "box-shadow: inset 1px 1px #555, inset -1px -1px #999;";
// Platinum's edit text: white in a #555 frame with a #999 shadow inside its top and left edges.
const edit = "background: #fff; color: #000; border: 1px solid #555; border-radius: 0; box-shadow: inset 1px 1px #999;";
// the focus ring Platinum draws around the field holding the keyboard: two pixels of lilac
const ring = "outline: 2px solid #8c8cdb; outline-offset: 0;";
const button = `background: #dddddd; color: #000; font: bold 11.5px ${FONT}; text-transform: none; text-shadow: none; border-radius: 4px; border: 1px solid #000; box-shadow: inset 1px 1px #fff, inset -1px -1px #999, inset 2px 2px #eee, inset -2px -2px #bbb;`;
// the default button's ring, three pixels out with its own black edge
const defaultRing = "0 0 0 1px #eee, 0 0 0 3px #aaa, 0 0 0 4px #000";
const pressed = "background: #777; color: #fff; box-shadow: inset 1px 1px #555, inset -1px -1px #999;";
// A tab: rounded at the top, open at the bottom where it meets its page.
const tabFace = `background: #cccccc; color: #000; border: 1px solid #777; border-bottom: 0; border-radius: 5px 5px 0 0; box-shadow: inset 1px 1px #eee; text-transform: none; text-shadow: none; font-family: ${FONT}; font-size: 11.5px;`;
// A Platinum window's frame and a title bar: pinstripes either side of a centred title on a plain gap, the
// stripes drawn by the bar's ::before and ::after (flex fillers) so any title, text node or not, sits in the gap.
const windowFrame = "border: 1px solid #000; border-radius: 0; box-shadow: inset 1px 1px #fff, inset -1px -1px #999, 1px 1px 0 #555;";
const titleBar = (sel, { h = 19, pad = 28 } = {}) => `${sel} {
  display: flex;
  align-items: center;
  box-sizing: border-box;
  height: ${h}px;
  margin: 0;
  padding: 0 ${pad}px;
  background: #dddddd;
  color: #000;
  font: bold 11.5px / ${h - 1}px ${FONT};
  text-align: center;
  text-transform: none;
  white-space: nowrap;
}
${sel}::before, ${sel}::after {
  content: "";
  flex: 1 1 0;
  min-width: 8px;
  align-self: stretch;
  background: ${stripes};
}
${sel}::before { margin-right: 8px; }
${sel}::after { margin-left: 8px; }`;

// ---- Shared by every area: the global header is Platinum's menu bar, #ddd with a black line under it and
// bold system text. Its Launchpad button keeps Sitecore's glyph. ----
const header = (S, bar) => `${S}:not(#sct-so) .sc-globalHeader {
  background: #dddddd !important;
  border-bottom: 1px solid #000;
  box-shadow: none;
  color: #000;
  font-family: ${FONT};
}
${S}:not(#sct-so) .sc-globalHeader :is(span, a, li, .sc-globalheader-appName),
${S}:not(#sct-so) .sc-globalHeader .sc-accountInformation li::after {
  color: #000;
  font-family: ${FONT};
  font-size: 11.5px;
  font-weight: bold;
}
${S}:not(#sct-so) .sc-globalHeader a:hover { color: #000; text-decoration: underline; }
/* every item centred on the bar: the account list is a row of flex items centred on its own height */
${S}:not(#sct-so) .sc-globalHeader ul.sc-accountInformation {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  /* the bar's height above its 1px bottom border */
  height: ${bar}px;
}
${S}:not(#sct-so) .sc-globalHeader ul.sc-accountInformation > li {
  display: flex;
  align-items: center;
  line-height: normal;
}
${S}:not(#sct-so) .sc-globalHeader .sc-ext-dbName {
  align-self: center;
  margin-top: 0;
  margin-bottom: 0;
  color: #000;
  font: bold 11.5px ${FONT};
  line-height: normal;
  vertical-align: middle;
}
${S}:not(#sct-so) .sc-globalHeader .sc-accountInformation img {
  box-sizing: border-box;
  border-radius: 0;
  border: 1px solid #000;
}`;

// ---- Shell: details 10.x's markup and inline styles need ----
const shellHand = `${W("shell")} {
  /* ---- Menus (context menus, start menu fly-outs, drop-downs): Platinum's, #ddd in a black frame with a
     drop shadow, 18px rows of bold system text, the highlighted item blue-violet, etched separators ---- */
  .scPopup:not(:has(> .scStartMenu)) {
    padding: 0;
    border: 1px solid #000;
    border-radius: 0;
    box-shadow: 2px 2px 0 rgba(0, 0, 0, 0.35);
    background: #dddddd;
  }
  .scPopup:has(> .scStartMenu) {
    border-radius: 0;
    box-shadow: none;
    background: transparent;
  }
  .scMenu {
    border: 0;
    border-collapse: collapse;
    border-radius: 0;
    box-shadow: none;
    background: #dddddd;
    color: #000;
  }
  .scMenu tr > td:is([class^="scMenuItem"], [class^="scMenuPanelItem"]) {
    height: 18px;
    padding-top: 0;
    padding-bottom: 0;
    border: 0;
    background: #dddddd;
    color: #000;
    font: bold 11.5px ${FONT};
    line-height: 18px;
  }
  .scMenu td[class^="scMenuItemIcon"] {
    width: 16px;
    padding: 0 2px 0 6px;
  }
  .scMenu td[class^="scMenuItemCaption"] { padding: 0 14px 0 4px; }
  .scMenu td[class^="scMenuItemHotkey"] { padding: 0 8px 0 4px; }
  .scMenu tr > td[class^="scMenuItem"][class$="_Disabled"] { color: #999999; }
  .scMenu td[class$="_Disabled"] img { opacity: 0.5; }
  .scMenu tr:not(:has(td[class$="_Disabled"])):hover > td,
  .scMenu tr > td[class$="_Hover"] {
    background: #6060c0;
    color: #fff;
  }
  .scMenu tr:not(:has(td[class$="_Disabled"])):hover > td * { color: #fff; }
  /* separators: an etched line, #999 over white */
  .scMenu tr > td[class^="scMenuDivider"] {
    height: 8px;
    padding: 0;
    border: 0;
    background: linear-gradient(transparent 3px, #999 3px 4px, #fff 4px 5px, transparent 5px), #dddddd;
  }
  .scMenu img[src*="Submenu16x16" i] { ${paint(triRight())} }
  .scMenu tr:hover img[src*="Submenu16x16" i] { background: ${triRight("#fff")}; }

  /* ---- Content tree search: a grey strip, a square edit field and two bevelled buttons of its
     height (fixed border-box heights keep their edges level at any zoom) ---- */
  #SearchPanel {
    margin: 0;
    padding: 3px 4px;
    background: #dddddd;
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
    font: 11.5px ${FONT};
  }
  :is(a.scSearchButton, a.scSearchOptionsButton) {
    display: block;
    box-sizing: border-box;
    width: 22px;
    height: 22px;
    margin: 0 0 0 2px;
    padding: 0;
    background: #dddddd;
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
    font: bold 11.5px ${FONT};
  }
  #TreeSearchOptions img.arrowDown { ${paint(triDown())} }
  #TreeSearchOptions input.scSearchOptionsInput {
    box-sizing: border-box;
    width: 100%;
    height: 22px;
    min-height: 0;
    padding: 2px 4px;
    ${edit}
    font: 11.5px ${FONT};
  }

  /* ---- The language, version and navigator drop-downs above the editor: Platinum combo boxes, a white
     field with the arrow button at its right end ---- */
  .scEditorTabControls a.scEditorHeaderButton {
    display: inline-flex;
    align-items: center;
    box-sizing: border-box;
    height: 22px;
    min-width: 0;
    margin: 0 0 0 4px;
    padding: 0 0 0 4px;
    ${edit}
    font: 11.5px ${FONT};
    line-height: 20px;
  }
  .scEditorTabControls a.scEditorHeaderButton span {
    display: inline-flex;
    align-items: center;
    height: 20px;
  }
  .scEditorTabControls a.scEditorHeaderButton img:not([class*="Glyph"]) { margin: 0 2px 0 0; }
  .scEditorTabControls :is(.scEditorHeaderNavigatorGlyph, .scEditorHeaderVersionsLanguageGlyph, .scEditorHeaderVersionsVersionGlyph) {
    width: 18px;
    height: 20px;
    margin: 0 0 0 4px;
    padding: 0;
    border-left: 1px solid #000;
    ${paint(G.combo)}
    background-color: #dddddd;
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
     Platinum's dotted frame. Sitecore swaps the classes to *_Hover under the mouse. ---- */
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
    background: #eeeeee;
    box-shadow: inset 1px 1px #fff;
    font-weight: bold;
    line-height: 23px;
  }
  :is(.scTab_Hover, .scTab:hover) { background: #dddddd; }
  /* over a page, the open tab also covers the white line inside the page's black top edge, so its face runs
     on into the page as one surface (the strip aligns tabs to its bottom, so the extra pixel comes from top) */
  .scTabstripContainer:has(> .scTabs) > .scTabstrip :is(.scTabActive, .scTabActive_Hover) { top: 2px; height: 25px; }
  /* the ISE's script tabs have no page under them: the strip draws the line the open tab stands on, from the
     first tab on (SPE's 52px reserve holds the script tree and variables toggles, with no line under them) */
  #TabsPanel .scTabstrip { background-image: linear-gradient(#777 0 0); background-position: 52px 100%; background-size: 100% 1px; background-repeat: no-repeat; }
  /* SPE pulls a script tab's close X 10px into the tab's 20px right padding; with these 10px it touched the edge */
  .scTabstrip .closeTab { margin: 0 -3px 0 6px; }
  :is(.scTab, .scTab_Hover, .scTabActive, .scTabActive_Hover):focus { outline: none; }
  /* Sitecore focuses the open tab when a dialog opens; it is marked already, so only the other tabs take the ring */
  :is(.scTab, .scTab_Hover):focus-visible { outline: 2px solid #8c8cdb; outline-offset: -3px; }
  /* the page: Platinum's tab pane, #eee inside a #777 frame with a raised edge */
  .scTabs {
    box-sizing: border-box;
    border: 1px solid #777;
    background: #eeeeee;
    box-shadow: inset 1px 1px #fff, inset -1px -1px #999999;
  }
  /* Sitecore sets the open tab 1px left (left: -1px) over its neighbours: the page starts there too, so an open
     first tab's black edge and white highlight run straight on down the page's left side */
  .scTabstripContainer > .scTabs { left: -1px; }
  /* the page inside keeps its 1px border, as layout, but unpainted: Sitecore's grey line covered the frame's
     white edge */
  .scTabs > .scTabPage { background: transparent; border-color: transparent; }
  /* list boxes on a page (item trees, lists) stay white */
  .scTabs .scScrollbox { ${edit} }

  /* the Content Editor's editor tabs stand on the tab row's #777 line */
  #EditorTabs {
    height: 57px;
    border-bottom: 1px solid #777;
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
    background: #eeeeee;
    box-shadow: inset 1px 1px #fff;
  }
  #EditorTabs > a.scRibbonEditorTabNormal:hover { background: #dddddd; }
  #EditorTabs > a:focus-visible { outline: 2px solid #8c8cdb; outline-offset: -3px; }
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
    border-bottom: 1px solid #777;
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
  .ui-tabs .ui-tabs-nav li.ui-tabs-active { height: 24px; z-index: 2; background: #eeeeee; box-shadow: inset 1px 1px #fff; }
  .ui-tabs .ui-tabs-nav li.ui-state-hover:not(.ui-tabs-active) { background: #dddddd; }
  .ui-tabs .ui-tabs-nav li a {
    padding: 0 10px;
    color: #000;
    line-height: 20px;
  }
  .ui-tabs .ui-tabs-nav li.ui-tabs-active a { font-weight: bold; line-height: 23px; }
  .ui-tabs .ui-tabs-panel { background: #eeeeee; }

  /* tooltips drawn as markup (SPE's qTip, jQuery UI): a Balloon Help tip, pale yellow in a black frame */
  :is(.qtip, .ui-tooltip) {
    border: 1px solid #000;
    border-radius: 4px;
    box-shadow: none;
    background: #ffffe1;
    color: #000;
    font: 11.5px ${FONT};
  }
  :is(.qtip, .ui-tooltip) * { color: #000; }

  /* ---- The start menu drops from the menu bar's note as Platinum's Apple menu: one #ddd menu, two columns
     of 18px rows (a 16px icon and the bold name; the descriptions stay in the tooltips), the highlighted row
     blue-violet, an etched line between the columns ---- */
  .scStartMenuContent {
    display: grid;
    grid-template-columns: auto auto;
    grid-template-rows: auto 1fr;
    align-items: start;
    box-sizing: border-box;
    height: auto;
    padding: 0;
  }
  :is(.scStartMenuContentColumns, .scStartMenuContentColumns > tbody, .scStartMenuContentColumns > tbody > tr) { display: contents; }
  :is(.scStartMenuLeft, .scStartMenuRight, .scStartMenuPrograms) {
    display: block;
    width: auto;
    margin: 0;
    padding: 0;
    border: 0;
    border-radius: 0;
    box-shadow: none;
    background: #dddddd;
  }
  .scStartMenuLeft { grid-column: 1; grid-row: 1 / span 2; align-self: stretch; padding: 3px 0; box-shadow: 1px 0 #fff, inset -1px 0 #999; }
  .scStartMenuRight { grid-column: 2; grid-row: 1; padding: 3px 0 0; }
  .scStartMenuPrograms { grid-column: 2; grid-row: 2; padding: 0 0 3px; }
  .scStartMenuPrograms .scStartMenuDivider { display: block; }
  :is(.scStartMenuLeftOption, .scStartMenuRightFolder, a.scStartMenuProgramsMenu) {
    display: flex;
    align-items: center;
    gap: 6px;
    box-sizing: border-box;
    height: 18px;
    min-height: 0;
    margin: 0;
    padding: 0 10px 0 8px;
    border: 0;
    border-radius: 0;
    box-shadow: none;
    background: #dddddd;
    color: #000;
    text-decoration: none;
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
    flex: 1;
    min-width: 0;
  }
  :is(.scStartMenuLeftOptionDisplayName, .scStartMenuRightFolderDisplayName, .scStartMenuProgramsMenuText) {
    padding: 0;
    color: #000;
    font: bold 11.5px / 18px ${FONT};
    white-space: nowrap;
  }
  .scStartMenuLeftOptionTooltip { display: none; }
  :is(.scStartMenuRightFolderDisplayName, .scStartMenuProgramsMenuText) { flex: 1; padding-right: 16px; }
  /* the folders open fly-outs: Platinum's black arrow at the row's end */
  img:is(.scStartMenuRightFolderGlyph, .scStartMenuProgramsGlyph) {
    float: none;
    order: 9;
    width: 16px;
    height: 16px;
    margin: 0;
    ${paint(triRight())}
  }
  :is(.scStartMenuLeftOption, .scStartMenuRightFolder, a.scStartMenuProgramsMenu):hover { background: #6060c0; }
  :is(.scStartMenuLeftOption, .scStartMenuRightFolder, a.scStartMenuProgramsMenu):hover :is(div, span) { color: #fff !important; }
  :is(.scStartMenuRightFolder, .scStartMenuProgramsMenu):hover img:is(.scStartMenuRightFolderGlyph, .scStartMenuProgramsGlyph) { background: ${triRight("#fff")}; }
  .scStartMenuDivider {
    height: 8px;
    margin: 0;
    background: linear-gradient(transparent 3px, #999 3px 4px, #fff 4px 5px, transparent 5px);
  }
  /* 10.4 still has the user band at the top and Log off at the bottom: menu rows too */
  :is(.scStartMenuTop, .scStartMenuBottom) {
    background: #dddddd;
    color: #000;
  }
  :is(.scStartMenuTop, .scStartMenuBottom) * { color: #000; }

  /* ---- Fields on tab pages (SPE Read-Variable and other tabbed dialogs): Platinum's 22px edit text ---- */
  .scTabs :is(input:not([type]), input[type="text"], input[type="password"], input[type="number"], input[type="search"], select:not([multiple]):not([size]:not([size="1"]))) {
    box-sizing: border-box;
    height: 22px;
    min-height: 0;
    padding: 2px 4px;
    font: 11.5px ${FONT};
  }
  .scTabs select:not([multiple]):not([size]:not([size="1"])) { padding-right: 22px; }
  /* check lists, multilists and their trees are list boxes; radio groups Platinum's etched group box */
  :is(.scContentControlChecklist, .scContentControlMultilistBox, .scBucketListBox, .scBucketListSelectedBox, .scContentControlTree.scScrollbox, .varRule) {
    ${edit}
  }
  .scContentControlChecklist label,
  .scRadioGroup label { font: 11.5px ${FONT}; color: #000; }
  .scRadioGroup {
    border: 1px solid #999999;
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
    width: 16px;
    height: 16px;
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
    border: 1px solid #555;
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
    /* the dialog field rule sets 22px with !important; inside the combo's frame it is 20px */
    height: 20px !important;
    margin: 0;
    padding: 2px 4px;
    border: 0;
    border-radius: 0;
    box-shadow: none;
    background: #fff;
    font: 11.5px ${FONT};
  }
  table.scCombobox img.scComboboxDropDown {
    display: block;
    box-sizing: border-box;
    width: 18px;
    height: 20px;
    margin: 0;
    padding: 0;
    border: 0;
    border-left: 1px solid #000;
    border-radius: 0;
    ${paint(G.combo)}
    background-color: #dddddd;
  }
  /* the date picker's calendar: a blue-violet caption with the month between two arrow buttons, the chosen day
     blue-violet as a selection, the other months' days grey */
  table.scCalendar {
    margin: 0;
    border-collapse: collapse;
    color: #000;
    font: 11.5px ${FONT};
  }
  table.scCalendar td {
    border: 0;
    border-radius: 0;
    box-shadow: none;
    outline: none;
    color: #000;
    font: 11.5px ${FONT};
    text-transform: none;
  }
  table.scCalendar .scCalendarYearRow td {
    height: 22px;
    padding: 0 2px;
    background: #6060c0;
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
  table.scCalendar td.scCalendarCellOtherMonth { color: #555555; }
  table.scCalendar td.scCalendarToday { font-weight: bold; }
  table.scCalendar td:is(.scCalendarCell, .scCalendarCellOtherMonth, .scCalendarToday):hover { outline: 1px dotted #000; outline-offset: -3px; }
  table.scCalendar td.scCalendarSelected {
    background: #6060c0;
    color: #fff;
  }
  table.scCalendar td.scCalendarTodayCell {
    height: 20px;
    text-align: center;
    border-top: 1px solid #000;
    background: #dddddd;
  }
  /* the time picker's list: a list box with a blue-violet selection */
  ul.scTimePicker { margin: 0; padding: 0; background: #fff; }
  ul.scTimePicker a {
    display: block;
    padding: 1px 6px;
    border: 0;
    border-radius: 0;
    outline: none;
    box-shadow: none;
    color: #000;
    font: 11.5px ${FONT};
    text-decoration: none;
  }
  ul.scTimePicker a:is(:hover, :focus, .selected, [aria-selected="true"]) {
    background: #6060c0;
    color: #fff;
  }

  /* the user and role pickers: a read-only grey field and its ... button at the field's height */
  input.scUserPickerEdit {
    border: 1px solid #000;
    background: #dddddd;
    color: #000;
  }
  button.scUserPickerButton {
    width: 30px;
    min-width: 0;
    height: 24px;
    padding: 0;
  }
  /* links in prompts (check list actions, rule text): blue-violet and underlined, as in Help */
  :is(.checkListActions a, .varRule a, .varRule .scLine span[style*="color"], .varRule .scLine a) { color: #6060c0; text-decoration: underline; }
  .varRule .scLine span { color: #6060c0; }
  .varTitle { color: #000; font-weight: bold; }
  .varHint { color: #000; }

  /* ---- Drop-down galleries (Edit's workflow box...) open in a frame: a menu's black frame and shadow ---- */
  iframe.scGalleryFrame {
    border: 1px solid #000;
    border-radius: 0;
    box-shadow: 2px 2px 0 #000;
  }

  /* ---- Desktop windows are bare frames in 10.x: one that isn't maximised gets Platinum's window outline,
     black with a drop shadow ---- */
  .DesktopArea > iframe[id^="FRAME"]:not([style*="width: 100%"]) {
    box-sizing: border-box;
    border: 1px solid #000;
    box-shadow: 1px 1px 0 #555;
  }

  /* ---- Bucket search (search tab, Media Library): a Platinum edit field with square button ends, the
     search terms as framed tokens ---- */
  .search-box {
    min-height: 0;
    ${edit}
  }
  :is(.sb_down, .sb_up),
  :is(.sb_down, .sb_up):hover {
    border-right: 1px solid #000;
    border-radius: 0;
    background-color: #dddddd;
    box-shadow: inset 1px 1px #fff, inset -1px -1px #999999;
  }
  .btn-search,
  .btn-search:is(:hover, :active) {
    border-left: 1px solid #000;
    border-radius: 0;
    background-color: #dddddd;
    background-image: url("/sitecore/shell/Applications/Buckets/images/edition-magnifier.png");
    box-shadow: inset 1px 1px #fff, inset -1px -1px #999999;
  }
  .btn-search:active { ${sunken} }
  .filters .filter {
    border: 1px solid #000;
    border-radius: 4px;
    background: #ccccff;
    color: #000;
  }
  .filters .filter :is(.icon, .remove):hover { border-radius: 0; background-color: #dddddd; }
  :is(.side .sb_filter, #results table th) { text-transform: none; }

  /* ---- Ribbon drop-down arrows: Platinum's solid black triangle ---- */
  .scRibbon :is(.scRibbonToolbarLargeComboButtonGlyph, .scRibbonToolbarLargeGalleryButtonGlyph, .scRibbonToolbarSmallGalleryButtonGlyph, .scRibbonToolbarSmallComboButtonGlyph) {
    width: 12px;
    height: 12px;
    border: 0;
    vertical-align: middle;
    ${paint(triDown())}
  }
  .scRibbon [class*="Disabled"] :is([class*="ComboButtonGlyph"], [class*="GalleryButtonGlyph"]) { background: ${triDown("#999999")}; }
  .scRibbonToolbar [class*="ButtonDisabled"] .header { color: #999999; }

  /* ---- Ribbon galleries (Home > Insert, Security > Presets): list boxes, the hovered row blue-violet ---- */
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
  .scRibbonGalleryList > a[class^="scRibbonToolbar"]:hover { background: #6060c0; }
  .scRibbonGalleryList > a[class^="scRibbonToolbar"]:hover * { color: #fff; }
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

  /* ---- Push buttons in dialogs: Platinum's 22px rounded buttons; the default button wears the thick ring ---- */
  :is(button, input[type="button"], input[type="submit"]).scButton,
  .scFormDialogFooter button {
    box-sizing: border-box;
    min-width: 69px;
    height: 22px;
    min-height: 0;
    margin: 0;
    padding: 0 12px;
    ${button}
    line-height: 20px;
    vertical-align: middle;
  }
  :is(button, input[type="button"], input[type="submit"]).scButton:is(:hover, :focus),
  .scFormDialogFooter button:is(:hover, :focus) {
    background: #dddddd;
    color: #000;
    border-color: #000;
  }
  :is(button, input[type="button"], input[type="submit"]).scButton.scButtonPrimary {
    margin: 0 4px;
    box-shadow: inset 1px 1px #fff, inset -1px -1px #999, inset 2px 2px #eee, inset -2px -2px #bbb, ${defaultRing};
  }
  :is(button, input[type="button"], input[type="submit"]).scButton:active,
  .scFormDialogFooter button:active {
    ${pressed}
  }
  :is(button, input[type="button"], input[type="submit"]).scButton.scButtonPrimary:active { box-shadow: inset 1px 1px #555, inset -1px -1px #999, ${defaultRing}; }
  :is(button, input[type="button"], input[type="submit"]).scButton:focus-visible { outline: 2px solid #8c8cdb; outline-offset: 1px; }
  :is(button, input[type="button"], input[type="submit"]).scButton:disabled { color: #999999; }
  /* ---- Dialog insets: controls close to the frame, as Platinum's (and Copenhagen's) were, not 10.x's 28px in;
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
    gap: 10px;
  }
  /* SPE's help (?) floats left 8px down for 10.x's taller footer: level with the 22px buttons instead */
  .scFormDialogFooter img#Copyright { margin: 0; }
  /* a dialog's tab strip is as tall as its open tab, not 10.x's 42px with the tabs at the bottom, and draws no
     line of its own: the page's top edge is the line, and the open tab (1px lower) covers it */
  .scDialogContentContainer .scTabstripContainer > .scTabstrip { height: 24px; border-bottom: 0; }
  .scDialogContentContainer .scTabstripContainer > .scTabs { top: 24px; }

  /* ---- Any other text field keeps its size but takes Platinum's edit frame, and the lilac ring with the focus ---- */
  input:is(:not([type]), [type="text"], [type="search"], [type="password"], [type="number"], [type="email"], [type="url"]):not([readonly], .ace_editor *, .terminal *),
  textarea:not([readonly], .ace_editor *, .terminal *) {
    border: 1px solid #555;
    border-radius: 0;
    box-shadow: inset 1px 1px #999;
  }
  :is(input:is(:not([type]), [type="text"], [type="search"], [type="password"], [type="number"], [type="email"], [type="url"]), textarea):not([readonly], .ace_editor *, .terminal *):focus { ${ring} }

  /* ---- Drop-down lists: Platinum's combo box, the arrow button flush right ---- */
  select:not([multiple]):not([size]:not([size="1"])) {
    appearance: none;
    padding-right: 22px;
    ${edit}
    background: ${comboRight}, #fff;
  }

  /* ---- The Workbox's caption band: the window's grey, like the Content Editor's tab row ---- */
  .scWorkboxWindowCaption {
    background: #dddddd;
    border-bottom: 1px solid #777;
  }
  /* its panes' collapse, close and section glyphs are white art for 10.x's dark headers: dark on the grey */
  img:is([id$="_collapse"], [id$="_close"], [id$="_section_chevron"]) { filter: brightness(0) opacity(0.65); }

  /* ---- Grids (User Manager, Role Manager...): a list box under raised column headings, the selected
     row blue-violet ---- */
  .Grid {
    border: 1px solid #000;
    background: #fff;
  }
  .HeadingCell {
    padding: 3px 8px;
    border: 0;
    background: #dddddd;
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
    background: #6060c0;
    color: #fff;
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

  /* ---- Quick Info: compact rows, as a Get Info window lists them ---- */
  table.scEditorQuickInfo { border-spacing: 0; }
  table.scEditorQuickInfo tr { line-height: normal; }
  table.scEditorQuickInfo td {
    height: 18px;
    padding: 0 10px 0 0;
    white-space: nowrap;
  }
  table.scEditorQuickInfo td:first-child { font-weight: bold; }
  table.scEditorQuickInfo input {
    height: 18px;
    min-height: 0;
    padding: 0;
  }

  /* ---- Content Editor fields: Platinum's 22px edit text, not 10.x's 35px ---- */
  .scEditorSections :is(input.scContentControl, select.scContentControl:not([multiple], [size])) {
    box-sizing: border-box;
    height: 22px;
    min-height: 0;
    padding: 0 4px;
    font: 11.5px ${FONT};
  }
  .scEditorSections input.scContentControl:focus { ${ring} }

  /* ---- Fields in dialogs: Platinum's 22px edit text ---- */
  :is(.scFormDialogContent, .scDialogContentContainer, .scWizardPageContainer) :is(input:not([type]), input[type="text"], input[type="password"], input[type="search"], input[type="number"], select:not([multiple]):not([size])) {
    box-sizing: border-box;
    height: 22px !important;
    min-height: 0;
    padding: 2px 4px;
    ${edit}
    font: 11.5px ${FONT};
  }
  :is(.scFormDialogContent, .scDialogContentContainer, .scWizardPageContainer) textarea {
    ${edit}
    font: 11.5px ${FONT};
  }
}`;

// ---- Scroll bars, everywhere: Platinum's 16px bar, a #bbb track shaded along its top and left, the
// lavender thumb with its grip lines, an arrow box at each end. Chrome and Edge; Firefox only takes colours. ----
const scrollbars = (S) => {
  const thumb = `border: 0;
  border-radius: 0;
  background-color: #ccccff;
  box-shadow: inset 0 0 0 1px #000, inset 2px 2px #eeeeff, inset -2px -2px #9999cc;`;
  return `${S} { scrollbar-color: auto; }
${S} ::-webkit-scrollbar { width: 16px; height: 16px; background: #bbbbbb; }
${S} ::-webkit-scrollbar-track { border-radius: 0; background: #bbbbbb; }
${S} ::-webkit-scrollbar-track:vertical { box-shadow: inset 1px 0 #000, inset 3px 2px #999; }
${S} ::-webkit-scrollbar-track:horizontal { box-shadow: inset 0 1px #000, inset 2px 3px #999; }
${S} ::-webkit-scrollbar-thumb, ${S} :is(select, textarea)::-webkit-scrollbar-thumb { ${thumb} }
${S} ::-webkit-scrollbar-thumb:vertical { background: ${art(GRIP_V)}, #ccccff; }
${S} ::-webkit-scrollbar-thumb:horizontal { background: ${art(GRIP_H)}, #ccccff; }
${S} ::-webkit-scrollbar-thumb:active { background-color: #b3b3f0; }
${S} ::-webkit-scrollbar-corner { background: #dddddd; box-shadow: inset 1px 1px #000; }
${S} ::-webkit-scrollbar-button:single-button { display: block; width: 16px; height: 16px; }
${S} ::-webkit-scrollbar-button:vertical:decrement { background: ${G.sUp}; }
${S} ::-webkit-scrollbar-button:vertical:increment { background: ${G.sDown}; }
${S} ::-webkit-scrollbar-button:horizontal:decrement { background: ${G.sLeft}; }
${S} ::-webkit-scrollbar-button:horizontal:increment { background: ${G.sRight}; }
${S} ::-webkit-scrollbar-button:active { filter: brightness(0.8); }
/* The rule editor's two lists (10.5) carry Sitecore's own ID-weighted scrollbar, 12px with a rounded thumb in a
   white ring, which outranks the rules above: Platinum's bar again, at their weight. */
${S} :is(#Conditions, #Description)::-webkit-scrollbar { width: 16px; height: 16px; background: #bbbbbb; }
${S} :is(#Conditions, #Description)::-webkit-scrollbar-track { background: #bbbbbb; border-radius: 0; box-shadow: inset 1px 0 #000, inset 3px 2px #999; }
${S} :is(#Conditions, #Description)::-webkit-scrollbar-thumb { ${thumb} background: ${art(GRIP_V)}, #ccccff; }`;
};

// ---- Check boxes and radio buttons, everywhere: Platinum's 12px box (a black frame round a face lit from
// the top left) with a black check mark, and the round radio button with a black dot. Focus is the lilac
// ring. ----
const checks = (S) => `${S}:not(#sct-so) :is(input[type="checkbox"], input[type="radio"]) {
  appearance: none;
  flex: none;
  box-sizing: border-box;
  width: 12px;
  height: 12px;
  margin: 0 5px 0 0;
  padding: 0;
  border: 1px solid #000;
  border-radius: 0;
  box-shadow: inset 1px 1px #fff, inset -1px -1px #bbb;
  outline: none;
  background: #eeeeee;
  vertical-align: -2px;
}
${S}:not(#sct-so) input[type="radio"] { border-radius: 50%; background: radial-gradient(circle at 35% 35%, #fff, #ccc 70%); box-shadow: none; }
${S}:not(#sct-so) input[type="checkbox"]:checked { background: ${checkMark.replace("center", "0 0")}, #eeeeee; }
${S}:not(#sct-so) input[type="radio"]:checked { background: radial-gradient(circle, #000 0 2.5px, transparent 3px), radial-gradient(circle at 35% 35%, #fff, #ccc 70%); }
${S}:not(#sct-so) :is(input[type="checkbox"], input[type="radio"]):active { background-color: #999; }
${S}:not(#sct-so) :is(input[type="checkbox"], input[type="radio"]):focus-visible { outline: 2px solid #8c8cdb; outline-offset: 1px; }
${S}:not(#sct-so) :is(input[type="checkbox"], input[type="radio"]):disabled { border-color: #999999; opacity: 0.6; }`;

// ---- SPEAK and Launchpad: fonts, scroll bars, the menu bar, push buttons, check boxes ----
const speakCommon = (S) => `${S} body, ${S} input, ${S} button, ${S} select, ${S} textarea,
${S} :is(h1, h2, h3, h4, h5, h6, p, a, span, label, li, td, th, div) {
  font-family: ${FONT};
}
${scrollbars(S)}
${boxVars(S)}
${header(S, S.includes('launchpad') ? 47 : 49)}
/* push buttons: Platinum's, the default one in the thick ring */
${S}:not(#sct-so) .btn.sc-button {
  box-sizing: border-box;
  min-width: 69px;
  height: 22px;
  margin: 0;
  padding: 0 12px;
  ${button}
  line-height: 20px;
}
${S}:not(#sct-so) .btn.sc-button:is(:hover, :focus) { background: #dddddd; color: #000; border-color: #000; }
${S}:not(#sct-so) .btn.sc-button.btn-primary {
  margin: 0 4px;
  box-shadow: inset 1px 1px #fff, inset -1px -1px #999, inset 2px 2px #eee, inset -2px -2px #bbb, ${defaultRing};
}
${S}:not(#sct-so) .btn.sc-button:active { ${pressed} }
${S}:not(#sct-so) .btn.sc-button.btn-primary:active { box-shadow: inset 1px 1px #555, inset -1px -1px #999, ${defaultRing}; }
${S}:not(#sct-so) .btn.sc-button:focus-visible { outline: 2px solid #8c8cdb; outline-offset: 1px; }
${S}:not(#sct-so) .btn.sc-button:is(:disabled, .disabled) { color: #999999; opacity: 1; }
${S}:not(#sct-so) .btn.sc-button .sc-button-text { color: inherit; font: inherit; }
${checks(S)}`;

// ---- SPEAK pages ----
const S = T("speak");
const speak = `/* Sonata: SPEAK pages. Generated by tools/build-sonata-css.cjs. */
${speakCommon(S)}

/* ---- Experience Editor ribbon: dressed as the Content Editor's ribbon in this theme. Platinum tabs on
   the window grey, the open one joined to the #eee pane below; the strip holds etched group boxes, buttons
   flat until hovered. ---- */
${W("speak")} .sc-pageeditbar {
  font: 11.5px ${FONT};
  color: #000;

  .sc-quickbar {
    display: flex;
    align-items: flex-end;
    height: auto;
    padding: 4px 4px 0;
    border: 0;
    border-bottom: 1px solid #777;
    box-shadow: none;
    background: #dddddd;
  }
  .sc-quickbar-item {
    float: none;
    box-sizing: border-box;
    margin: 0;
    border: 0;
    border-radius: 0;
    box-shadow: none;
    background: none;
    color: #000;
    font: 11.5px ${FONT};
    text-transform: none;
    text-decoration: none;
    cursor: default;
  }
  .sc-quickbar-item:focus { outline: none; }
  .sc-quickbar-item:focus-visible { outline: 2px solid #8c8cdb; outline-offset: -3px; }
  .sc-quickbar-tab,
  .sc-quickbar-tab:hover {
    position: relative;
    height: 21px;
    margin: 0 1px -1px 0;
    padding: 0 12px;
    ${tabFace}
    line-height: 20px;
  }
  .sc-quickbar-tab:hover { background: #dddddd; }
  .sc-quickbar-tab.sc-quickbar-tab-selected {
    z-index: 1;
    height: 24px;
    background: #eeeeee;
    box-shadow: inset 1px 1px #fff;
    font-weight: bold;
    line-height: 23px;
  }
  .sc-quickbar-button[data-sc-id="QuickRibbon"] { order: 1; margin-left: auto; }
  .sc-quickbar-button[data-sc-id="QuickInsert-Component"] { margin-right: 8px; }
  .sc-quickbar-button {
    align-self: center;
    width: 24px;
    height: 24px;
    margin: 0 1px 2px;
    padding: 3px;
    border: 1px solid transparent;
    opacity: 1;
  }
  .sc-quickbar-button > .sprite-speak-ribbon-clean-ee {
    display: block;
    margin: 0;
  }
  .sc-quickbar-button:not(.disabled):hover {
    border-radius: 3px;
    background: #dddddd;
    ${raised}
  }
  .sc-quickbar-button:not(.disabled):active { ${sunken} }
  .sc-quickbar-button.disabled > * { opacity: 0.45; }

  .sc-ribbon {
    margin: 0;
    padding: 0;
    border: 0;
    border-bottom: 1px solid #777;
    box-shadow: none;
    background: #eeeeee;
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
    margin: 2px 1px 2px 2px;
    padding: 0 6px;
    border: 1px solid #999;
    border-radius: 0;
    box-shadow: inset 1px 1px #fff, 1px 1px #fff;
    background: #eeeeee;
    white-space: nowrap;
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
    font: 11.5px ${FONT};
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
    font: 11.5px ${FONT};
    line-height: 14px;
    text-transform: none;
  }
  :is(.sc-chunk-button, .sc-chunk-button-dropdown, .sc-chunk-gallerybutton, .sc-chunk-button-small, .sc-chunk-check-small):not(.disabled):hover {
    background: #dddddd;
    ${raised}
  }
  :is(.sc-chunk-button, .sc-chunk-button-dropdown, .sc-chunk-gallerybutton, .sc-chunk-button-small):not(.disabled):active,
  :is(.sc-chunk-button, .sc-chunk-button-dropdown, .sc-chunk-gallerybutton, .sc-chunk-button-small).pressed {
    background: #dddddd;
    border-color: #000;
    ${sunken}
  }
  .disabled :is(.sc-chunk-button-label, .sc-chunk-check-small-label),
  :is(.sc-chunk-button, .sc-chunk-button-dropdown, .sc-chunk-gallerybutton, .sc-chunk-button-small, .sc-chunk-check-small).disabled {
    color: #999999;
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
    font: 11.5px ${FONT};
    line-height: 15px;
  }
  /* drop-down buttons end in Platinum's solid arrow */
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
    font: 11.5px ${FONT};
    line-height: 1.1;
    text-decoration: none;
  }
  .sc-chunk-datepanel-selector * {
    height: auto;
    margin: 0;
    padding: 0;
    color: #000;
    font: 11.5px ${FONT};
    line-height: 1.15;
  }
  .sc-chunk-datepanel-selector:focus-visible { outline: 1px dotted #000; outline-offset: -3px; }
  .sc-chunk-datepanel-day { display: none; }
  .sc-chunk-datepanel-date { font: bold 16px ${FONT}; }
  .sc-chunk-datepanel-monthyear { text-align: center; }
  .sc-chunk-datepanel-time { font-weight: bold; }

  /* the item path under the ribbon: a grey strip with Platinum push buttons */
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
    background: #dddddd;
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
    font: bold 11.5px ${FONT};
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
    background: #dddddd;
    ${raised}
  }
}

/* ---- SPEAK dialogs (the EE's Preview Date and Time, ...): a dialog-page header, and the date and time
   pickers as Platinum combo boxes whose arrow button replaces the calendar and clock icons ---- */
/* the header is the window's title bar, as the shell's dialog pages draw it: the title centred between
   pinstripes, the description below it on the dialog grey */
${W("speak")} .sc-dialogWindow-header {
  height: auto;
  padding: 0;
  border: 0;
  background: #dddddd;
  color: #000;
}
${titleBar(`${W("speak")} .sc-dialogWindow-header .sc-dialogWindow-header-title`, { pad: 6 })}
${W("speak")} .sc-dialogWindow-header .sc-dialogWindow-header-title {
  float: none;
  width: auto;
  border-bottom: 1px solid #777;
}
${W("speak")} .sc-dialogWindow-header .sc-dialogWindow-header-title .sc-text {
  display: block;
  flex: none;
  height: 18px;
  margin: 0;
  padding: 0;
  color: #000;
  font: bold 11.5px / 18px ${FONT};
}
${W("speak")} .sc-dialogWindow-header > .sc-text-title {
  display: block;
  padding: 6px 10px;
  color: #000;
  font: 11.5px / 16px ${FONT};
}
${W("speak")} .sc-dialogWindow-buttons {
  border-top: 0;
  background: #dddddd;
}
${W("speak")} :is(input.sc-datepicker, input.sc-timepicker) {
  box-sizing: border-box;
  height: 22px;
  min-height: 0;
  padding: 2px 22px 2px 4px;
  ${edit}
  background: ${comboRight}, #fff;
  font: 11.5px ${FONT};
}
${W("speak")} :is(input.sc-datepicker, input.sc-timepicker):focus { outline: 1px dotted #000; outline-offset: -3px; box-shadow: none; }
/* jQuery UI's calendar: as the Content Editor's date picker, a blue-violet caption with the month in white bold
   between two arrow buttons, the chosen day blue-violet, the other months' days grey */
${W("speak")} #ui-datepicker-div.ui-datepicker {
  padding: 0;
  border: 1px solid #000;
  border-radius: 0;
  box-shadow: 2px 2px 0 #000;
  background: #fff;
  color: #000;
  font: 11.5px ${FONT};
}
${W("speak")} .ui-datepicker .ui-datepicker-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 22px;
  padding: 0 2px;
  border: 0;
  border-radius: 0;
  background: #6060c0;
}
${W("speak")} .ui-datepicker .ui-datepicker-title {
  order: 1;
  margin: 0;
  color: #fff;
  font: bold 11.5px / 22px ${FONT};
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
  font: bold 11.5px ${FONT};
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
  font: 11.5px / 16px ${FONT};
  text-align: center;
}
${W("speak")} .ui-datepicker td.ui-datepicker-other-month :is(a, span) { color: #555555; }
${W("speak")} .ui-datepicker td.ui-datepicker-today a { font-weight: bold; }
${W("speak")} .ui-datepicker td a:hover { outline: 1px dotted #000; outline-offset: -3px; background: #fff; }
${W("speak")} .ui-datepicker td.ui-datepicker-current-day a,
${W("speak")} .ui-datepicker td a.ui-state-active {
  background: #6060c0;
  color: #fff;
}
/* the time picker's list: a list box with a blue-violet selection */
${W("speak")} .ui-timepicker-wrapper {
  border: 1px solid #000;
  border-radius: 0;
  box-shadow: 2px 2px 0 #000;
  background: #fff;
}
${W("speak")} .ui-timepicker-list li {
  padding: 1px 6px;
  color: #000;
  font: 11.5px ${FONT};
}
${W("speak")} .ui-timepicker-list li:hover,
${W("speak")} .ui-timepicker-list li.ui-timepicker-selected {
  background: #6060c0;
  color: #fff;
}

/* ---- Control Panel: a Platinum control panel. The page is the window's #eee body under its title bar (the
   page title between pinstripes), Back a push button under it, each group an etched group box with its name
   on the top edge and its tasks in a white list. ---- */
${W("speak")} body:has(.sc-controlpanel-box) {
  background: #eeeeee;

  .sc-applicationContent {
    min-height: 100vh;
    background: #eeeeee;
    color: #000;
    font: 11.5px ${FONT};
  }
  .sc-applicationHeader {
    border: 0;
    box-shadow: none;
    background: none;
  }
  .sc-applicationHeader-row1 {
    box-sizing: border-box;
    height: 20px;
    border-bottom: 1px solid #777;
    background: #dddddd;
  }
  .sc-applicationHeader-row1 .sc-applicationHeader-content {
    height: 19px;
    padding: 0;
  }
  .sc-applicationHeader-title {
    float: none;
    margin: 0;
    padding: 0;
  }
  .sc-applicationHeader-title .sc-text {
    display: block;
    flex: none;
    height: 19px;
    color: #000;
    font: bold 11.5px / 19px ${FONT};
  }
  .sc-applicationHeader-row2 {
    display: flow-root;
    box-sizing: border-box;
    height: auto;
    padding: 8px 12px 0;
    border: 0;
    background: #eeeeee;
  }
  .sc-applicationHeader-back { height: auto; margin: 0; padding: 0; }
  .btn.sc-backbutton {
    display: inline-flex;
    align-items: center;
    box-sizing: border-box;
    height: 22px;
    min-width: 69px;
    margin: 0;
    padding: 0 12px;
    ${button}
  }
  .btn.sc-backbutton::before { content: none; }
  .btn.sc-backbutton:active { ${pressed} }
  .btn.sc-backbutton:focus-visible { outline: 2px solid #8c8cdb; outline-offset: 1px; }
  .sc-backbutton-text {
    position: static;
    height: auto;
    margin: 0;
    padding: 0;
    color: inherit;
    font: bold 11.5px / 20px ${FONT};
    text-decoration: none;
  }
  .sc-applicationContent-main {
    margin-top: 8px;
    background: none;
  }
  .sc-controlpanel-box {
    position: relative;
    margin: 14px 0 0;
    padding: 14px 8px 8px;
    border: 1px solid #999;
    border-radius: 0;
    background: transparent;
    box-shadow: inset 1px 1px #fff, 1px 1px #fff;
  }
  .sc-controlpanel-box-header h4 {
    position: absolute;
    top: -8px;
    left: 8px;
    height: 16px;
    margin: 0;
    padding: 0 4px;
    background: #eeeeee;
    color: #000;
    font: bold 11.5px / 16px ${FONT};
    text-transform: none;
  }
  /* the group icons are pale line art for 10.x's white cards: dark grey on the #eee body */
  .sc-controlpanel-box-header h4 img { width: 16px; height: 16px; margin: 0 4px 0 0; vertical-align: top; filter: brightness(0) opacity(0.65); }
  .sc-controlpanel-box-content {
    height: auto !important;
    min-height: 0;
    padding: 2px;
    ${edit}
  }
  .sc-controlpanel-box-content li {
    height: auto;
    padding: 0;
    border: 0;
  }
  .sc-controlpanel-box-content a {
    display: block;
    padding: 1px 4px;
    color: #000;
    font: 11.5px ${FONT};
    line-height: 16px;
    text-decoration: none;
    white-space: nowrap;
  }
  .sc-controlpanel-box-content a:is(:hover, :focus) {
    background: #ccccff;
    color: #000;
    outline: none;
  }
}
${titleBar(`${W("speak")} body:has(.sc-controlpanel-box) .sc-applicationHeader-title`, { pad: 6 })}`;

// ---- Launchpad: the Finder. The page is Mac OS 9's blue-violet desktop under the menu bar; each group is a
// Finder window in icon view: a Platinum window with its name centred in a pinstriped title bar and its
// applications as 32px icons on a white grid, the label under each. Pointing at an icon, or giving it the
// keyboard, selects it as the Finder does (the icon darkened, the label white on black). The title bars carry
// no boxes: none of them would do anything here. Custom Analytics is an alert window. ----
const L = T("launchpad");
const icon = (href, url) => `  .sc-launchpad-item${href} .icon img { content: url("${url}"); }`;
const desktop = "repeating-linear-gradient(45deg, rgba(255, 255, 255, 0.06) 0 2px, transparent 2px 4px), #5c6fa8";
const launchpad = `/* Sonata: Launchpad. Generated by tools/build-sonata-css.cjs. */
${speakCommon(L)}
${W("launchpad")} {
  /* the desktop */
  body,
  .sc-applicationContent {
    background: ${desktop};
    color: #000;
    font: 11.5px ${FONT};
  }
  .sc-applicationContent {
    box-sizing: border-box;
    min-height: 100vh;
    padding: 0 16px 16px;
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
    font-size: 11.5px;
    font-weight: bold;
  }
  .sc-applicationContent-main {
    max-width: none;
    margin: 16px 0 0;
    padding: 0;
    background: none;
  }
  .sc-applicationContent-main > .row { margin: 0; }
  .sc-applicationContent-main > .row > div {
    float: none;
    width: auto;
    padding: 0;
  }
  div[data-sc-id="ColumnPanel1"] {
    display: block;
    padding: 0;
  }
  .sc-launchpad { margin-bottom: 16px; }

  /* the Finder windows, side by side and as large as their icons */
  .sc-launchpad {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    gap: 16px;
    float: none;
    width: auto;
    max-width: none;
    margin: 0;
    padding: 0;
  }
  .sc-launchpad-group {
    --sct-cols: 1;
    display: grid;
    grid-template-columns: repeat(var(--sct-cols), minmax(84px, 1fr));
    justify-items: center;
    align-content: start;
    gap: 0;
    box-sizing: border-box;
    min-width: 200px;
    margin: 0;
    padding: 0 0 8px;
    ${windowFrame}
    background: linear-gradient(#fff, #fff) 4px 20px / calc(100% - 8px) calc(100% - 24px) no-repeat, #dddddd;
  }
  /* columns for the group's size: up to four in a row, five and six as two rows of three */
  .sc-launchpad-group:has(> a.sc-launchpad-item:nth-of-type(2)) { --sct-cols: 2; }
  .sc-launchpad-group:has(> a.sc-launchpad-item:nth-of-type(3)) { --sct-cols: 3; }
  .sc-launchpad-group:has(> a.sc-launchpad-item:nth-of-type(4)) { --sct-cols: 4; }
  .sc-launchpad-group:has(> a.sc-launchpad-item:nth-of-type(5)) { --sct-cols: 3; }
  .sc-launchpad-group:has(> a.sc-launchpad-item:nth-of-type(7)) { --sct-cols: 4; }
  .sc-launchpad-group-title {
    grid-column: 1 / -1;
    justify-self: stretch;
    margin: 0 1px 8px;
    border-bottom: 1px solid #777;
    overflow: hidden;
  }
  /* the window's content edge: a #777 line round the white icon area */
  .sc-launchpad-group::after {
    content: "";
    position: absolute;
    inset: 19px 3px 7px 3px;
    border: 1px solid #777;
    border-top: 0;
    pointer-events: none;
  }
  .sc-launchpad-group { position: relative; }

  /* icons on the Finder's grid */
  .sc-launchpad-item,
  .sc-launchpad-item:is(:hover, :active, :focus) {
    display: flex;
    flex-direction: column;
    align-items: center;
    box-sizing: border-box;
    width: 84px;
    height: auto;
    min-height: 64px;
    margin: 0;
    padding: 2px 0 6px;
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
    margin: 0 0 3px;
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
    max-width: 80px;
    padding: 0 2px;
    color: #000;
    font: 11px / 13px ${FONT};
    text-align: center;
    white-space: normal;
  }
  .sc-launchpad-item:is(:hover, :focus-visible) .icon img { filter: brightness(0.6); }
  .sc-launchpad-item:is(:hover, :focus-visible) .sc-launchpad-text {
    background: #000;
    color: #fff;
  }
  .sc-launchpad-item:active .icon img { filter: brightness(0.4); }
  /* applications the start menu also lists take its colour icons, as the Finder showed them */
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

  /* Custom Analytics: an alert window. Its title is the label before the box, laid into the box's title bar. */
  .sc-text[data-sc-id="CustomAnalyticsLabel"] {
    position: relative;
    z-index: 1;
    float: none;
    margin: 1px 1px -20px;
    border-bottom: 1px solid #777;
  }
  .sc-border[data-sc-id="FallBackMessageBorder"] {
    float: none;
    box-sizing: border-box;
    width: 340px;
    margin: 0;
    padding: 20px 0 0;
    ${windowFrame}
    background: #dddddd;
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
    gap: 14px;
    padding: 12px 14px;
  }
  /* the note alert's icon: an "i" in a round white balloon */
  .sc-border[data-sc-id="FallbackMessageWrap"]::before {
    content: "i";
    flex: none;
    box-sizing: border-box;
    width: 32px;
    height: 32px;
    border: 1px solid #000;
    border-radius: 50%;
    background: radial-gradient(circle at 35% 35%, #fff, #ddd 70%);
    color: #000;
    font: bold 20px / 30px Georgia, "Times New Roman", serif;
    text-align: center;
  }
  .sc-text[data-sc-id="FallBackMessage"] {
    position: static;
    display: block;
    color: #000;
    font: 11.5px / 16px ${FONT};
    text-align: left;
  }
}
${titleBar(`${W("launchpad")} .sc-launchpad-group-title`, { pad: 8 })}
${titleBar(`${W("launchpad")} .sc-text[data-sc-id="CustomAnalyticsLabel"]`, { pad: 8 })}
${W("launchpad")} .sc-launchpad-group-title,
${W("launchpad")} .sc-text[data-sc-id="CustomAnalyticsLabel"] { text-overflow: clip; }
${W("launchpad")} [data-sc-id="CustomAnalyticsLabel"] { width: 338px; }`;

// ---- Login: a Platinum movable modal dialog on the blue-violet desktop: the title between pinstripes,
// the logo drawn dark, Platinum edit text and an OK-sized default button in its thick ring. ----
const LG = W("login");
const login = `/* Sonata: login. Generated by tools/build-sonata-css.cjs. */
${scrollbars(T("login"))}
${LG} body {
  background: ${desktop};
  color: #000;
  font: 11.5px ${FONT};
}
${LG} :is(label, a, input, button, span, div, p, li) {
  font-family: ${FONT};
  text-shadow: none;
}
${LG} .main {
  max-width: 440px;
  padding: 0 0 4px;
  border-radius: 0;
  background: #dddddd;
  ${windowFrame}
}
/* the title bar is a pseudo-element, which has no ::before or ::after of its own: the gap behind the title is a
   #ddd band over the stripes, as wide as the title and its 8px margins */
${LG} .main::before {
  content: "Welcome to Sitecore";
  display: block;
  box-sizing: border-box;
  height: 19px;
  margin: 1px 1px 0;
  padding: 0 8px;
  border-bottom: 1px solid #777;
  background: linear-gradient(#dddddd, #dddddd) center / 168px 100% no-repeat, ${stripes}, #dddddd;
  background-clip: content-box;
  background-origin: content-box;
  color: #000;
  font: bold 11.5px / 18px ${FONT};
  text-align: center;
  white-space: nowrap;
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
  padding: 0 18px 12px;
}
${LG} label {
  margin: 0 0 3px;
  color: #000;
  font-size: 11.5px;
  font-weight: bold;
}
${LG} .form-control {
  box-sizing: border-box;
  height: 22px;
  margin: 0 0 8px;
  padding: 2px 4px;
  ${edit}
  font-size: 11.5px;
}
${LG} .form-control:focus {
  border-color: #555;
  box-shadow: inset 1px 1px #999;
  ${ring}
}
${LG} .form-control::placeholder { color: #555555; }
${LG} .btn {
  display: block;
  box-sizing: border-box;
  width: auto;
  min-width: 69px;
  height: 22px;
  margin: 8px 4px 0 auto;
  padding: 0 14px;
  ${button}
  line-height: 20px;
}
${LG} .btn.btn-primary {
  box-shadow: inset 1px 1px #fff, inset -1px -1px #999, inset 2px 2px #eee, inset -2px -2px #bbb, ${defaultRing};
}
${LG} .btn:is(:hover, :focus) {
  background: #dddddd;
  color: #000;
  border-color: #000;
}
${LG} .btn:active { ${pressed} }
${LG} .btn.btn-primary:active { box-shadow: inset 1px 1px #555, inset -1px -1px #999, ${defaultRing}; }
${LG} .btn:focus-visible { outline: 2px solid #8c8cdb; outline-offset: 5px; }
${LG} a,
${LG} a:is(:hover, :focus) {
  color: #3333aa;
  text-decoration: underline;
}
${LG} .remember-me + .forgot-password::before,
${LG} .vertical-separator {
  border-left-color: #777;
}
${checks(T("login"))}
/* Bootstrap hangs the box in the label's 20px left padding */
${LG} .checkbox input[type="checkbox"] { margin: 2px 0 0 -19px; }
${LG} .warning {
  ${edit}
}
${LG} .top {
  border: 1px solid #000;
  box-shadow: none;
  background: #dddddd;
}
${LG} .top > a { color: #000; }
`;

// ---- The Desktop: Mac OS 9. The taskbar becomes the menu bar across the top: the start button is its
// leftmost menu (a pair of eighth notes), then Sitecore's own header items (the Launchpad button, the user,
// Log out), and on the right the search field, the database, the clock (dom.js) and the Application menu,
// which shows the active window's icon and name and drops the other windows' entries down under the
// pointer. Sitecore's own controls, laid out by CSS; nothing is moved in the DOM. ----
const DT = W("shell");
const desktopCss = `/* ==== Desktop: the menu bar, the Apple-style start menu, the blue-violet desktop ==== */
/* the desktop pattern replaces the wallpaper picture (Sitecore sets it inline) */
${DT} .DesktopArea {
  top: 21px;
  bottom: 0;
  margin-top: 0;
  background: ${desktop} !important;
}
/* the global header is the menu bar: 20px of #ddd over a black line, its items left after the note */
${DT} .sc-globalHeader:has(~ div .DesktopArea) {
  height: 20px;
  min-height: 0;
  overflow: visible;
}
${DT} .sc-globalHeader:has(~ div .DesktopArea) .sc-globalHeader-content {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  box-sizing: border-box;
  height: 20px;
  padding: 0 0 0 40px;
}
${DT} .sc-globalHeader:has(~ div .DesktopArea) .col2 {
  float: none;
  width: auto;
  height: 20px;
  padding: 0;
}
${DT} .sc-globalHeader:has(~ div .DesktopArea) .sc-globalHeader-startButton {
  display: flex;
  align-items: center;
  height: 20px;
}
${DT} .sc-globalHeader:has(~ div .DesktopArea) a.sc-global-logo {
  width: 20px;
  height: 20px;
  margin: 0 4px;
  background-size: 14px 14px;
}
${DT} .sc-globalHeader:has(~ div .DesktopArea) .sc-globalHeader-loginInfo { float: none; height: 20px; }
${DT} .sc-globalHeader:has(~ div .DesktopArea) ul.sc-accountInformation {
  flex-direction: row-reverse;
  gap: 0;
  height: 20px;
  margin: 0;
  padding: 0;
}
${DT} .sc-globalHeader:has(~ div .DesktopArea) ul.sc-accountInformation > li {
  height: 20px;
  margin: 0;
  padding: 0 10px;
  line-height: 20px;
}
${DT} .sc-globalHeader:has(~ div .DesktopArea) ul.sc-accountInformation > li::after { content: none; }
${DT} .sc-globalHeader:has(~ div .DesktopArea) ul.sc-accountInformation > li:is(:hover, :focus-within) { background: #6060c0; }
${DT} .sc-globalHeader:has(~ div .DesktopArea) ul.sc-accountInformation > li:is(:hover, :focus-within) :is(a, span) { color: #fff; text-decoration: none; }
${DT} .sc-globalHeader:has(~ div .DesktopArea) .sc-accountInformation img {
  width: 16px;
  height: 16px;
  margin: 0 0 0 6px;
  padding: 0;
  border: 0;
  vertical-align: middle;
}

/* the taskbar laid over the menu bar: transparent, and only its own items take the pointer */
${DT} .scStartbar {
  top: 0;
  bottom: auto;
  z-index: 900;
  height: 20px;
  border: 0;
  background: transparent;
  pointer-events: none;
}
${DT} #Startbar {
  height: 20px !important;
  background: transparent;
  border: 0;
  box-shadow: none;
}
${DT} #Startbar > table {
  display: flex;
  align-items: stretch;
  width: 100%;
  height: 20px;
  border: 0;
  border-spacing: 0;
  background: none;
  box-shadow: none;
}
${DT} #Startbar > table > tbody,
${DT} #Startbar > table > tbody > tr { display: contents; }
${DT} #Startbar > table > tbody > tr > td {
  display: block;
  flex: none;
  width: auto;
  height: 20px;
  padding: 0;
  border: 0;
  background: none;
  pointer-events: auto;
}
${DT} #Startbar > table > tbody > tr > td:nth-child(3) { order: 1; margin-left: auto; }
${DT} #Startbar > table > tbody > tr > td:nth-child(2) { order: 2; position: relative; }

/* the start button: the leftmost menu title, a pair of eighth notes; open, it turns blue-violet */
${DT} .scStartButtonContainer { width: 36px; height: 20px; }
${DT} :is(.scStartButton, .scStartButton:hover, .scStartButton.scPopupOpener) {
  position: static;
  width: 36px;
  height: 20px;
  margin: 0;
  border: 0;
  border-radius: 0;
  box-shadow: none;
  background: ${note.replace("center", "center")}, transparent;
}
${DT} .scStartButton.scPopupOpener { background-color: #6060c0; }
${DT} .scStartButton:focus-visible { outline: 2px solid #8c8cdb; outline-offset: -2px; }
/* the start menu drops from the menu bar, its top edge on the bar's black line */
${DT} .scPopup:has(> #StartMenu) {
  top: 20px !important;
  bottom: auto !important;
  left: 0 !important;
  padding: 0;
  border: 1px solid #000;
  border-radius: 0;
  background: #dddddd;
  box-shadow: 2px 2px 0 rgba(0, 0, 0, 0.35);
}
${DT} #StartMenu {
  width: auto !important;
  height: auto !important;
  border: 0;
  border-radius: 0;
  box-shadow: none;
  background: #dddddd;
}

/* the tray: the search field, the database as a menu title, the clock */
${DT} .scStartbarTray { width: auto; height: 20px; border: 0; border-spacing: 0; background: none; }
${DT} .scStartbarTray > tbody > tr > td {
  height: 20px;
  padding: 0;
  border: 0;
  line-height: 20px !important;
  vertical-align: middle;
}
${DT} #SearchBox {
  box-sizing: border-box;
  width: 150px;
  height: 16px;
  min-height: 0;
  margin: 0 8px 0 0;
  padding: 0 4px;
  ${edit}
  font: 11px ${FONT};
}
${DT} #SearchBox::placeholder { color: #555555; }
${DT} #SearchBox:focus { ${ring} }
${DT} #DatabaseSelector {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 20px;
  margin: 0;
  padding: 0 10px;
  border: 0;
  border-radius: 0;
  background: none;
  color: #000;
  font: bold 11.5px / 20px ${FONT};
}
${DT} #DatabaseSelector img { width: 16px; height: 16px; margin: 0 !important; filter: brightness(0) opacity(0.75); }
${DT} #DatabaseSelector:is(:hover, :focus-visible) { background: #6060c0; color: #fff; outline: none; }
${DT} #DatabaseSelector:is(:hover, :focus-visible) img { filter: brightness(0) invert(1); }
/* no windows open: no Application menu either */
${DT} .scStartBarScroller:not(:has(td)) { display: none; }
${DT} .sct-so-clock {
  display: inline-block;
  height: 20px;
  padding: 0 10px;
  color: #000;
  font: bold 11.5px / 20px ${FONT};
  white-space: nowrap;
}

/* the Application menu: the active window's entry is the title at the bar's right end; under the pointer the
   other windows' entries drop down below it as a Platinum menu */
${DT} .scStartBarScroller {
  height: 20px;
  padding: 0;
  overflow: visible;
  border: 0;
  border-left: 1px solid #999;
  box-shadow: inset 1px 0 #fff;
}
${DT} #StartbarApplications,
${DT} #StartbarApplications > tbody { display: block; height: 20px; margin: 0; border-spacing: 0; }
${DT} #StartbarApplications > tbody > tr {
  display: flex;
  flex-direction: column;
  min-width: 170px;
}
${DT} #StartbarApplications > tbody > tr > td {
  display: none;
  box-sizing: border-box;
  height: 18px;
  padding: 0;
  border: 0;
  border-radius: 0;
  box-shadow: none;
  background: #dddddd;
  color: #000;
}
${DT} #StartbarApplications > tbody > tr > td::before,
${DT} #StartbarApplications > tbody > tr > td::after { content: none; }
${DT} #StartbarApplications > tbody > tr > td.scActiveApplication,
${DT} #StartbarApplications > tbody > tr:not(:has(> td.scActiveApplication)) > td:first-child {
  display: block;
  order: -1;
  height: 20px;
  background: transparent;
}
${DT} .scStartBarScroller:is(:hover, :focus-within) #StartbarApplications > tbody > tr > td { display: block; }
${DT} .scStartBarScroller:is(:hover, :focus-within) #StartbarApplications > tbody > tr > td:not(.scActiveApplication) {
  border-left: 1px solid #000;
  border-right: 1px solid #000;
  box-shadow: 2px 0 0 rgba(0, 0, 0, 0.35);
}
${DT} .scStartBarScroller:is(:hover, :focus-within) #StartbarApplications > tbody > tr > td:not(.scActiveApplication):last-child {
  height: 21px;
  padding-bottom: 3px;
  border-bottom: 1px solid #000;
  box-shadow: 2px 2px 0 rgba(0, 0, 0, 0.35);
}
${DT} .scStartBarScroller:is(:hover, :focus-within) #StartbarApplications > tbody > tr > td.scActiveApplication { background: #6060c0; }
${DT} .scStartBarScroller:is(:hover, :focus-within) #StartbarApplications > tbody > tr > td.scActiveApplication * { color: #fff; }
${DT} .scStartBarScroller #StartbarApplications > tbody > tr > td:not(.scActiveApplication):hover { background: #6060c0; }
${DT} .scStartBarScroller #StartbarApplications > tbody > tr > td:not(.scActiveApplication):hover * { color: #fff; }
${DT} .scStartBarApplication {
  display: flex;
  align-items: center;
  box-sizing: border-box;
  height: 100%;
  min-width: 0;
  max-width: 260px;
  margin: 0;
  padding: 0 10px;
  border: 0;
  border-radius: 0;
  background: none;
  color: #000;
}
${DT} .scStartBarApplication span {
  display: flex;
  align-items: center;
  min-width: 0;
  padding: 0;
  overflow: hidden;
  color: #000;
  font: bold 11.5px ${FONT};
  text-overflow: ellipsis;
  white-space: nowrap;
}
${DT} .scStartBarApplication img { flex: none; width: 16px; height: 16px; margin: 0 6px 0 0 !important; }
`;

const css = `/* Sonata: classic shell. Generated by tools/build-sonata-css.cjs.
   Mac OS 9's Platinum appearance: grey windows with pinstriped title bars and bevelled window boxes,
   Platinum tabs, push buttons, scroll bars and menus. */

${boxVars(P)}

/* The SPE ISE's Ace editor measures its own monospace font; keep the theme font out of it. */
${P} body, ${P} input, ${P} select, ${P} textarea, ${P} button,
${P} :is(td, a, span, div):not(.ace_editor, .ace_editor *) {
  font-family: ${FONT};
}
${scrollbars(P)}

/* ---- Ribbon: Platinum tabs on the window grey, the open one joined to the #eee pane of etched groups ---- */
${P} .scRibbonNavigator { background: #dddddd; border-bottom: 1px solid #777; }
${P} .scRibbon a.scRibbonNavigatorButtonsNormal,
${P} .scRibbon a.scRibbonNavigatorButtonsActive {
  position: relative;
  box-sizing: border-box;
  height: 21px;
  margin: 0 1px -1px 0;
  padding: 0 12px;
  ${tabFace}
  font-weight: normal;
  line-height: 20px;
}
${P} .scRibbon a.scRibbonNavigatorButtonsNormal:hover { background: #dddddd; }
${P} .scRibbon a.scRibbonNavigatorButtonsActive {
  z-index: 1;
  height: 24px;
  background: #eeeeee;
  box-shadow: inset 1px 1px #fff;
  font-weight: bold;
  line-height: 23px;
}
${P} .scRibbon a:is(.scRibbonNavigatorButtonsNormal, .scRibbonNavigatorButtonsActive):focus-visible { outline: 2px solid #8c8cdb; outline-offset: -3px; }
${P} .scRibbonToolbar { background: #eeeeee; border-bottom: 1px solid #777; }
${P} .scRibbonToolbar .chunk { height: auto; background: transparent; border: 1px solid #999; border-radius: 0; box-shadow: inset 1px 1px #fff, 1px 1px #fff; margin: 3px 2px 3px 3px; }
${P} .scRibbonToolbar .chunk .caption { background: transparent; color: #444; }
${P} .scRibbonToolbar .panel, ${P} .scRibbonToolbar .panel span, ${P} .scRibbonToolbar .panel a { color: #000; }
/* Only the buttons themselves: icons, captions and the small-button columns carry "Button" in their
   class names too. A small combo button raises as one piece. A large one is flat until hovered, then shows
   its command and its drop-down as two faces, each pressed on its own. */
${P} .scRibbonToolbar :is(a[class^="scRibbonToolbar"], span[class^="scRibbonToolbar"][class*="Disabled"], .scRibbonToolbarLargeComboButton, .scRibbonToolbarSmallComboButton) { border: 1px solid transparent; border-radius: 3px; box-shadow: none; }
${P} .scRibbonToolbar :is(a[class^="scRibbonToolbar"]:not([class*="ComboButton"]), .scRibbonToolbarSmallComboButton):hover { background: #dddddd; ${raised} }
${P} .scRibbonToolbar :is(a[class^="scRibbonToolbar"]:not([class*="ComboButton"]), .scRibbonToolbarSmallComboButton):active,
${P} .scRibbonToolbar a[class^="scRibbonToolbar"][class*="ButtonDown"] { background: #bbbbbb; border: 1px solid #000; ${sunken} }
${P} .scRibbonToolbar a[class*="ComboButton"]:is(:hover, :active) { background: transparent; border-color: transparent; box-shadow: none; }
${P} .scRibbonToolbar .scRibbonToolbarLargeComboButton:hover > :is(.scRibbonToolbarLargeComboButtonTop, .scRibbonToolbarLargeComboButtonBottom) { background: #dddddd; border-color: #000; box-shadow: inset 1px 1px #fff, inset -1px -1px #999999; }
${P} .scRibbonToolbar .scRibbonToolbarLargeComboButton > :is(.scRibbonToolbarLargeComboButtonTop, .scRibbonToolbarLargeComboButtonBottom):active { background: #bbbbbb; border-color: #000; ${sunken} }

/* ---- Content tree: the Finder's list view, disclosure triangles and a lavender selection ---- */
${P} .scContentTree { background: #fff; }
${P} a.scContentTreeNodeActive { background: #ccccff; color: #000; border-radius: 0; }
${P} a.scContentTreeNodeActive span { color: #000 !important; }
${P} .scContentTree a.scContentTreeNodeNormal:hover { background: transparent; }
/* the triangles, in Sitecore's 16px footprint */
${P} img[src*="/treemenu_collapsed"] { ${paint(disclose(false))} }
${P} img[src*="/treemenu_expanded"] { ${paint(disclose(true))} }

/* ---- Editor ---- */
${P} .scEditorHeaderTitle { font-weight: bold; font-size: 14px; color: #000; }
/* section captions: Platinum's disclosure rows, a triangle before the bold name on the window grey */
${P} .scEditorSectionCaptionExpanded, ${P} .scEditorSectionCaptionCollapsed {
  background: #dddddd;
  color: #000;
  font-weight: bold;
  line-height: 20px;
  padding: 0 0 0 6px;
  margin: 0 0 2px;
  border: 1px solid #999;
  border-radius: 0;
  box-shadow: inset 1px 1px #fff;
}
${P} img.scEditorSectionCaptionGlyph { float: left; width: 16px; height: 16px; margin: 2px 4px 0 0; }
${P} img.scEditorSectionCaptionGlyph[src*="accordion_up"] { ${paint(disclose(true))} }
${P} img.scEditorSectionCaptionGlyph[src*="accordion_down"] { ${paint(disclose(false))} }
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

/* ---- Buttons ---- */
${P} .scButton, ${P} button:not(.ui-button), ${P} input[type="button"], ${P} input[type="submit"] {
  ${button}
}
${P} .scButton:active, ${P} button:not(.ui-button):active { ${pressed} }
${P} .scButton:focus-visible, ${P} button:focus-visible { outline: 2px solid #8c8cdb; outline-offset: 1px; }

/* ---- Bottom application tabs: Platinum tabs hanging from the window's bottom edge ---- */
${P} .scPager { width: auto; margin: 0; border: 0; border-radius: 0; padding: 0 4px 3px; background: #dddddd; border-top: 1px solid #777; }
${P} .scPagerButtonNormal, ${P} .scPagerButtonActive {
  position: relative;
  margin: 0 1px 0 0;
  padding: 0 12px;
  color: #000;
  font-weight: normal;
  background: #cccccc;
  border: 1px solid #777;
  border-top: 0;
  border-radius: 0 0 5px 5px;
  box-shadow: inset 1px 0 #eee;
}
${P} .scPagerButtonActive { top: -1px; padding-top: 1px; background: #eeeeee; box-shadow: inset 1px 0 #fff; font-weight: bold; }
/* 10.5 draws the pager's links white once visited (the page links to itself); computed styles hide it */
${W("shell")} a:is(.scPagerButtonNormal, .scPagerButtonActive):is(:link, :visited) { color: #000; }

/* ---- Dialog windows (jQuery UI frames around Sitecore dialogs): a Platinum window ---- */
${P} .ui-dialog {
  background: #dddddd;
  padding: 0 0 3px;
  ${windowFrame}
}
/* Sitecore stacks a 15px jQuery title bar above the dialog page, whose header is the title bar.
   Laid over it, the bar keeps dragging and carries the window boxes into it. */
${P} .ui-dialog .ui-dialog-titlebar {
  position: absolute;
  top: 1px;
  left: 1px;
  right: 1px;
  height: 19px;
  min-height: 0;
  padding: 0;
  z-index: 2;
  background: transparent;
  border: 0;
  border-radius: 0;
}
${P} .ui-dialog .ui-dialog-titlebar-buttonpane > * {
  width: 15px;
  height: 15px;
  margin: 0;
  padding: 0;
  border: 0;
  border-radius: 0;
  background-color: transparent;
  box-shadow: 0 0 0 2px #dddddd;
  overflow: hidden;
  text-indent: -999px;
}
${P} .ui-dialog .ui-dialog-titlebar-buttonpane > * > * { display: none; }
/* The button pane spans the title bar; the close box goes to the left, zoom and collapse stay right.
   Sitecore pins the pane with !important and writes the close button's position inline. */
${P} .ui-dialog .ui-dialog-titlebar-buttonpane {
  left: 6px;
  right: 6px !important;
  top: 2px !important;
  width: auto;
  height: 15px;
  display: flex;
  justify-content: flex-end;
  gap: 4px;
  margin: 0 !important;
  pointer-events: none;
}
${P} .ui-dialog .ui-dialog-titlebar-buttonpane > * { pointer-events: auto; }
${P} .ui-dialog .ui-dialog-titlebar-buttonpane > button.ui-button {
  position: static !important;
  float: none !important;
  order: -1;
  margin: 0 auto 0 0 !important;
  background: ${V.close};
}
${P} .ui-dialog .ui-dialog-titlebar-maximize, ${P} .ui-dialog .ui-dialog-titlebar-restore { order: 1; background: ${V.zoom}; }
${P} .ui-dialog .ui-dialog-titlebar-minimize { order: 2; background: ${V.collapse}; }
${P} .ui-dialog .ui-dialog-titlebar-buttonpane > *:active { filter: brightness(0.7); }
/* Mac OS 9 dimmed nothing behind a modal dialog; a faint shade still marks the dialog as modal. */
${P} .ui-widget-overlay { background: rgba(0, 0, 0, 0.12); opacity: 1; }

/* Inside a dialog page: its header is the title bar. */
${P} :is(.scFormDialogHeader, .scDialogHeader) { background: #dddddd; padding: 0; border: 0; }
/* the dialog page's header, and the ListView's, which SPE puts straight in the jQuery dialog */
${titleBar(`${P} :is(:is(.scFormDialogHeader, .scDialogHeader) .DialogHeader, .ui-dialog > .DialogHeader)`, { pad: 28 })}
${P} :is(:is(.scFormDialogHeader, .scDialogHeader) .DialogHeader, .ui-dialog > .DialogHeader) { border-bottom: 1px solid #777; }
${P} :is(.scFormDialogHeader, .scDialogHeader) .DialogHeaderDescription { color: #000; padding: 6px 10px; margin: 0; }
/* SPE puts a 32px icon in the title; Platinum titles carry a 16px one at most. */
${P} .DialogHeader #DialogIcon { flex: none; width: 16px; height: 16px; margin-right: 4px; }
${P} .scFormDialogContent, ${P} .scFormDialogFooter { background: #dddddd; }

/* ---- Window boxes: close on the left, zoom then collapse on the right, each on a gap in the stripes ---- */
${P} :is(.scSystemButtons, .standartWindowButtons, .scWorkboxWindowButtons) img {
  width: 15px;
  height: 15px;
  margin: 0;
  padding: 0;
  vertical-align: middle;
  filter: none;
  box-shadow: 0 0 0 2px #dddddd;
}
${P} :is(.scSystemButtons, .standartWindowButtons, .scWorkboxWindowButtons) img[src*="minimize"] { order: 3; ${paint(V.collapse)} }
${P} :is(.scSystemButtons, .standartWindowButtons, .scWorkboxWindowButtons) img[src*="maximize"] { order: 2; ${paint(V.zoom)} }
${P} :is(.scSystemButtons, .standartWindowButtons, .scWorkboxWindowButtons) img[src*="restore"] { order: 2; ${paint(V.zoom)} }
${P} :is(.scSystemButtons, .standartWindowButtons, .scWorkboxWindowButtons) img[src*="_close"] { order: -1; margin-right: auto; ${paint(V.close)} }
${P} :is(.scSystemButtons, .standartWindowButtons, .scWorkboxWindowButtons) img:active { filter: brightness(0.7); }
/* The Content Editor's caption (the band above its tabs) is the window's title bar: pinstripes the width of
   the window, the boxes on gaps in them. Its boxes span the band: close at the left, the rest at the right. */
${P} .scCaption.scDockTop { background: ${stripes.replace("0 50%", "0 3px")}, #dddddd; background-clip: content-box; }
${P} .scCaption.scDockTop :is(#RibbonPanel, .scRibbon, .scRibbonNavigator) { background: transparent; }
${P} .scSystemButtons {
  position: absolute;
  top: 2px;
  left: 7px;
  right: 7px;
  width: auto;
  height: 15px;
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 4px;
  pointer-events: none;
  z-index: 2;
}
${P} .scSystemButtons img { pointer-events: auto; }
${P}[data-sct-window="inactive"] .scCaption.scDockTop { background: #eeeeee; }
${P}[data-sct-window="inactive"] .scSystemButtons { visibility: hidden; }
/* the application switcher keeps Sitecore's glyph, dark on the grey */
${P} :is(.scSystemButtons, .standartWindowButtons, .scWorkboxWindowButtons) img[src*="page_switcher"] { order: 1; width: 16px; height: 15px; box-shadow: 0 0 0 2px #dddddd; ${paint(triDown())} background-color: #dddddd; }
/* Standard windows (ISE, Console, Package Designer...): a Platinum title bar */
${P} .standardWindowCaption { box-sizing: border-box; height: 20px; border-bottom: 1px solid #777; }
${titleBar(`${P} .standardWindowCaption`, { h: 20, pad: 28 })}
${P} .standardWindowCaption + .windowPlaceholderContainer { top: 20px; }
${P} .standardWindowCaption .windowCaptionIcon { flex: none; width: 16px; height: 16px; margin: 0 4px 0 0; }
${P} .standardWindowCaption .scWindowCaption { flex: 0 1 auto; display: block; overflow: hidden; text-overflow: ellipsis; line-height: 19px; font: bold 11.5px / 19px ${FONT}; color: #000; padding: 0; }
${P} .standardWindowCaption .scWindowCaption * { font: inherit; }
/* the ISE writes its script's path into the caption in an inline #bbb: dark grey on the title bar */
${P} .standardWindowCaption .scWindowCaption i { color: #555 !important; }
${P} .standartWindowButtons { top: 2px; left: 7px; right: 7px; height: 15px; display: flex; justify-content: flex-end; align-items: center; gap: 4px; pointer-events: none; }
${P} .standartWindowButtons img { pointer-events: auto; }
/* SPE's ISE (ise.js) gives its title the room the .standartWindowButtons box leaves; here that box spans the
   bar (the close box on the left, zoom and collapse on the right), so the title would get none. The title
   bar's own padding already keeps the title clear of the boxes. */
${P} .standardWindowCaption #WindowCaption { max-width: 100% !important; margin-left: 0 !important; }
/* An inactive window (dom.js marks its document from the taskbar): Mac OS 9 drops the stripes and the boxes and
   greys the title. */
${P}[data-sct-window="inactive"] .standardWindowCaption::before,
${P}[data-sct-window="inactive"] .standardWindowCaption::after { background: none; }
${P}[data-sct-window="inactive"] .standardWindowCaption { background: #eeeeee; }
${P}[data-sct-window="inactive"] .standardWindowCaption .scWindowCaption { color: #777; }
${P}[data-sct-window="inactive"] .standardWindowCaption .scWindowCaption i { color: #999 !important; }
${P}[data-sct-window="inactive"] .standartWindowButtons { visibility: hidden; }
/* The Content Editor, Media Library and Workbox: Sitecore draws no caption over their windows. Platinum's title
   bar, as on every other window, is drawn on the caption's empty top line from the window's title (engine.js
   --sct-window-title): pinstripes with the title centred on a plain gap, the boxes on the bar, the ribbon's menu
   button and tabs straight under it. */
${P}[data-sct-window-title] .scWindowBorder2 > .scCaption.scDockTop { background: #dddddd; }
${P}[data-sct-window-title] .scWindowBorder2 > .scCaption > #CaptionTopLine, ${P}[data-sct-window-title] .scWorkboxWindowCaption.scWindowHandle { display: flex; justify-content: center; box-sizing: border-box; height: 20px; padding: 0 28px; border-bottom: 1px solid #777; background: ${stripes} content-box, #dddddd; }
${P}[data-sct-window-title] .scWindowBorder2 > .scCaption > #CaptionTopLine::before, ${P}[data-sct-window-title] .scWorkboxWindowCaption.scWindowHandle::before { content: var(--sct-window-title, ""); flex: 0 1 auto; min-width: 0; padding: 0 8px; background: #dddddd; color: #000; font: bold 11.5px / 19px ${FONT}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
${P}[data-sct-window-title] .scWindowBorder2 > .scCaption > .scSystemButtons, ${P}[data-sct-window-title] .scWorkboxWindowButtons { top: 2px; left: 7px; right: 7px; margin-right: 0; height: 15px; z-index: 2; }
/* the Workbox's buttons float in its caption strip: placed on the bar like the Content Editor's */
${P}[data-sct-window-title] .scWorkboxWindowCaption.scWindowHandle { position: relative; }
${P}[data-sct-window-title] .scWorkboxWindowButtons { position: absolute; float: none; }
${P}[data-sct-window-title] .scWindowBorder2 > .scCaption > #SystemMenu { top: 20px; margin-top: 0; height: 23px; }
${P}[data-sct-window-title] .scWindowBorder2 > .scCaption .scRibbonNavigator:not(:has(.scRibbonNavigatorButtonsContextualGroup)) .scRibbonNavigatorButtonsGroupHeader { display: none; }
/* 4px between the title bar and the tabs: they never touch it; the menu button moves down with them */
${P}[data-sct-window-title] .scWindowBorder2 > .scCaption .scRibbonNavigator { padding-top: 4px; }
${P}[data-sct-window-title] .scWindowBorder2 > .scCaption > #SystemMenu { translate: 0 4px; }
/* the same 4px on a standard window (the ISE...), whose ribbon is in the page inside the window's chrome */
${P}[data-sct-window-content] .scRibbonNavigator { padding-top: 4px; }
${P}[data-sct-window="inactive"][data-sct-window-title] .scWindowBorder2 > .scCaption > #CaptionTopLine, ${P}[data-sct-window="inactive"][data-sct-window-title] .scWorkboxWindowCaption.scWindowHandle { background: #eeeeee; }
${P}[data-sct-window="inactive"][data-sct-window-title] .scWindowBorder2 > .scCaption > #CaptionTopLine::before, ${P}[data-sct-window="inactive"][data-sct-window-title] .scWorkboxWindowCaption.scWindowHandle::before { background: none; color: #777; }

/* ---- Insert gallery scroller: bevelled buttons ---- */
${P} .scRibbonPanelButtons { background: transparent; }
${P} img.scRibbonPanelUp { ${paint(G.up)} width: 16px; height: 15px; filter: none; }
${P} img.scRibbonPanelDown { ${paint(G.down)} width: 16px; height: 15px; filter: none; }
${P} img.scRibbonPanelOpen { ${paint(G.dots)} width: 16px; height: 15px; filter: none; }

/* ==== Hand-written details ==== */
${header(P, 50)}
${checks(P)}
${shellHand}
${desktopCss}`;

const out = { shell: css, speak, launchpad, login };
for (const [name, text] of Object.entries(out)) {
  fs.writeFileSync(path.join(__dirname, "..", "extension", "themes", "sonata", `${name}.css`), pixelate(text));
  console.log(`${name}.css: ${(text.length / 1024).toFixed(1)} KB`);
}
