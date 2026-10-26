// Dev tool: writes extension/themes/metalsteel/{shell,speak,launchpad,login}.css. Metal's bumps are gradients and its window
// icons and glyphs pixel art (written out as PNGs), so they are generated here rather than written by hand.
const fs = require("fs");
const zlib = require("zlib");
const crypto = require("crypto");
const path = require("path");

const SURFACE = (s) => `html[data-sct-theme="metalsteel"][data-sct-surface="${s}"]`;
const P = SURFACE("shell");
// :not(#sct-ms) matches every page; its id weight lets a rule win over Sitecore's id- and class-heavy selectors.
const X = `${P}:not(#sct-ms)`;
// A desktop window's document while another window has the focus (set by dom.js).
const PI = `${P}[data-sct-window="inactive"]`;
// A Content Editor, Media Library or Workbox Desktop window (engine.js names it), active and inactive; the
// caption strip a title pane is drawn on, and the window's buttons.
const WT = `${X}[data-sct-window-title]`, WTI = `${PI}:not(#sct-ms)[data-sct-window-title]`;
const winBar = (w, tail = "") => `${w} .scWindowBorder2 > .scCaption > #CaptionTopLine${tail},
${w} .scWorkboxWindowCaption.scWindowHandle${tail}`;
const winButtons = (w) => `${w} .scWindowBorder2 > .scCaption > .scSystemButtons,
${w} .scWorkboxWindowButtons`;
// DefaultMetalTheme, the "Steel" theme of Java's Metal look and feel.
const p1 = "#666699", p2 = "#9999cc", p3 = "#ccccff", s1 = "#666666", s2 = "#999999", s3 = "#cccccc";
const COLORS = { K: "#000", W: "#fff", P: p1, M: p2, L: p3, D: s1, G: s2, C: s3 };
const FONT = 'Arial, "Liberation Sans", Helvetica, sans-serif';

// Pixel art, one character per pixel: '.' is transparent, letters are COLORS. Each glyph is written into
// themes/metalsteel/glyphs (named by its pixels) twice: the pixel art as a PNG, and a vector redraw as an SVG
// (registered with vector() below; a glyph without one gets its pixels as squares). image-set() gives a 100%
// screen the PNG, kept exact by pixelate(), and every other scale the SVG, drawn at the screen's resolution:
// at 125% pixel art either blurs unevenly (one-pixel gradients did) or doubles every fourth row (a pixelated
// image does). The CSS names the files sct-ext:<path>, which background.js points at the extension's own
// URL, so a page CSP that blocks data: (some installs send one) still loads them. Centred in the box, placed at [x, y]
// from its top left, or, given a number, that many pixels in from the right edge and centred vertically.
const GLYPHS = path.join(__dirname, "..", "extension", "themes", "metalsteel", "glyphs");
fs.rmSync(GLYPHS, { recursive: true, force: true });
fs.mkdirSync(GLYPHS, { recursive: true });
const VECTORS = new Map();
const vector = (rows, body) => VECTORS.set(rows.join("|"), body);
function art(rows, at) {
  const h = rows.length, w = rows[0].length;
  if (rows.some((r) => r.length !== w || /[^.KWPMLDGC]/.test(r))) throw new Error(`bad pixel art: ${rows.join("|")}`);
  // Both images get a transparent 1px margin: Chrome softens the edge of an image placed between device
  // pixels, and the margin keeps that softening off the art.
  const pad = ".".repeat(w + 2);
  const name = crypto.createHash("sha1").update(rows.join("|")).digest("hex").slice(0, 10);
  fs.writeFileSync(path.join(GLYPHS, `${name}.png`), png([pad, ...rows.map((r) => `.${r}.`), pad]));
  fs.writeFileSync(path.join(GLYPHS, `${name}.svg`),
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w + 2}" height="${h + 2}" viewBox="-1 -1 ${w + 2} ${h + 2}">${VECTORS.get(rows.join("|")) || squares(rows)}</svg>\n`);
  const pos = Array.isArray(at) ? `${at[0] - 1}px ${at[1] - 1}px` : typeof at === "number" ? `right ${at - 1}px center` : "center";
  const url = (ext) => `url("sct-ext:themes/metalsteel/glyphs/${name}.${ext}")`;
  return `image-set(${url("png")} 1x, ${url("svg")} 2x) ${pos} / ${w + 2}px ${h + 2}px no-repeat`;
}
// The pixels as SVG squares, one <rect> per run of one colour.
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
    rects.push(`<rect x="${x}" y="${y}" width="${rw}" height="${rh}" fill="${COLORS[c]}"/>`);
  }
  return rects.join("");
}
function png(rows) {
  const h = rows.length, w = rows[0].length;
  const raw = Buffer.alloc(h * (w * 4 + 1));
  rows.forEach((r, y) => [...r].forEach((c, x) => {
    if (c === ".") return;
    const hex = COLORS[c].replace(/^#(.)(.)(.)$/, "#$1$1$2$2$3$3");
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
// At exactly 100% the glyphs' PNGs are drawn nearest-neighbour, so pixel art placed between pixels stays
// exact: every rule whose background draws a glyph (directly or through a --sct-metal-* icon) gets
// image-rendering: pixelated in one @media block. The property inherits, so a zero-specificity reset keeps it
// off the element's children (a tab's icon, say); any rule of Sitecore's still wins over that reset.
function pixelate(text) {
  const sels = [...text.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .filter((m) => /(^|[;\s])background(-image)?\s*:[^;]*(sct-ext:|var\(--sct-metal-)/.test(m[2]))
    .map((m) => m[1].trim());
  if (!sels.length) return text;
  const all = ':where(html[data-sct-theme="metalsteel"] *)';
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

// MetalBumps: a 4px tile with highlight dots at (0,0) and (2,2) and shadow dots at (1,1) and (3,3).
const dot = (c, x, y) => `conic-gradient(from 270deg at 1px 1px, ${c} 25%, transparent 0) ${x}px ${y}px / 4px 4px`;
const bumps = (hi, lo) => [dot(hi, 0, 0), dot(lo, 1, 1), dot(hi, 2, 2), dot(lo, 3, 3)].join(", ");

// Metal's flush 3D border: a dark rectangle with a white one a pixel down and right.
const flush = `border: 1px solid; border-color: ${s1} #fff #fff ${s1}; box-shadow: inset 1px 1px #fff, inset -1px -1px ${s1};`;
const flushShadow = `inset 1px 1px ${s1}, inset 2px 2px #fff, inset -1px -1px #fff, inset -2px -2px ${s1}`;
// The internal frame border: 5px of primary1 with a groove (black, primary2) two pixels in.
const frame = `border: 1px solid ${p1}; box-shadow: inset 1px 1px ${p1}, inset -1px -1px ${p2}, inset 0 0 0 2px #000, inset 3px 3px ${p2}, inset 0 0 0 4px ${p1};`;

// The window icons, copied pixel for pixel from a Steel title bar.
const WINDOW = [
  ".PPPPPPPPPPPPPP.", "PPPPPPPPPPPPPPPP", "PPWLLWLLWLLWLLPP", "PPLPLLPLLPLLPLPP", "PPLLLLLLLLLLLLPP", "PPPPPPPPPPPPPPPP",
  "PPWWWWWWWWWWWWPP", "PPWWWWWWWWWWWWPP", "PPWWWWWWWWWWWWPP", "PPWWWWWWWWWWWWPP", "PPWWWWWWWWWWWWPP", "PPWWWWWWWWWWWWPP",
  "PPWWWWWWWWWWWWPP", "PPWWWWWWWWWWWWPP", "PPPPPPPPPPPPPPPP", ".PPPPPPPPPPPPPP.",
];
const ICONIFY = [
  "................", "............K...", ".......KK..KPP..", ".......KPWKPPW..", ".......KPKPPW...", ".......KPPPW....",
  ".......KPPPKK...", ".......KPPPPPW..", "KKKKKKK.WWWWWW..", "KPPPPPP.........", "KPWWWPPW........", "KPW..KPW........",
  "KPW..KPW........", "KPPKKKPW........", "KPPPPPPW........", ".WWWWWWW........",
];
const MAXIMIZE = [
  "................", "........KKKKKK..", "........KPPPPPW.", ".........WKPPPW.", ".........KPPPPW.", "KKKKKKKKKPPWPPW.",
  "KPPPPPPPPPWWPPW.", "KPWWWWKPPPW..WW.", "KPW..KPPPPW.....", "KPW.KPPWPPW.....", "KPWKPPW.KPW.....", "KPKPPW..KPW.....",
  "KPPPW...KPW.....", "KPPPPKKKKPW.....", "KPPPPPPPPPW.....", ".WWWWWWWWWW.....",
];
// restore (Metal's alternate maximize icon, shown while the frame is maximized): the maximize window with
// the arrow pointing into it from the top right
const RESTORE = [
  "................", ".............K..", "........KK..KPP.", "........KPWKPPW.", "........KPKPPW..", "KKKKKKKKKPPPW...",
  "KPPPPPPPKPPPKK..", "KPWWWWWWKPPPPPW.", "KPW.....KWWWWWW.", "KPW.....KPW.....", "KPW.....KPW.....", "KPW.....KPW.....",
  "KPW.....KPW.....", "KPPKKKKKKPW.....", "KPPPPPPPPPW.....", ".WWWWWWWWWW.....",
];
const CLOSE = [
  "................", "KKKKKKKKKKKKKK..", "KPPPPPPPPPPPPPW.", "KP..........PPW.", "KP..K....K..KPW.", "KP.KPP..KPP.KPW.",
  "KP..PPPKPPW.KPW.", "KP...PPPPW..KPW.", "KP...KPPPW..KPW.", "KP..KPPPPP..KPW.", "KP.KPPWWPPP.KPW.", "KP..PW...PWWKPW.",
  "KP........W.KPW.", "KPPKKKKKKKKKKPW.", "KPPPPPPPPPPPPPW.", ".WWWWWWWWWWWWWW.",
];
// Scroll arrows: black, 8x4, as Metal draws them in a 17px button.
const UP = ["...KK...", "..KKKK..", ".KKKKKK.", "KKKKKKKK"];
const DOWN = [...UP].reverse();
const LEFT = ["...K", "..KK", ".KKK", "KKKK", "KKKK", ".KKK", "..KK", "...K"];
const RIGHT = LEFT.map((r) => [...r].reverse().join(""));
// Tree handles: a ringed knob with its handle pointing right (collapsed) or down (expanded).
const KNOB = ["..KKKK......", ".KPPPPK.....", "KPMLLMMK....", "KPLKKLMK....", "KPLKKWMK....", "KPMLWWMK....", ".KMMMMK.....", "..KKKK......"];
const COLLAPSED = KNOB.map((r, y) => (y === 3 || y === 4 ? r.slice(0, 8) + "KKKK" : r));
const EXPANDED = [...KNOB, "...KK.......", "...KK.......", "...KK.......", "...KK......."];
const CHECK = [".........K", "........KK", "...KK..KK.", "...KK.KK..", "...KKKK...", "...KKK....", "...KK....."];
const RADIO = (dot) => [
  "....DDDD.....", "..DDWWWWDDW..", ".DWWCCCCWWDW.", `.DWC${dot ? "KKKK" : "CCCC"}CCDW.`,
  ...Array(4).fill(`DWC${dot ? "KKKKKK" : "CCCCCC"}CCDW`),
  `.DWC${dot ? "KKKK" : "CCCC"}CCDW.`, ".DWCCCCCCCDW.", "..DDCCCCDDW..", "..WWDDDDWW...", "....WWWW.....",
];

// Metal tabs: a slanted top-left corner, a dark outline and a highlight (H) inside it. The clip cuts the
// corner just outside the dark diagonal, which is drawn in pixels; backgrounds are placed from the border
// edge so the pixels line up with the outline.
const SLANT = ["......D", ".....DH", "....DH.", "...DH..", "..DH...", ".DH....", "DH....."];

// Vector redraws for screens above 100% (see art()), on each glyph's own pixel grid. Shapes the pixels only
// approximate become real ones: arrow and check strokes, round knobs and radio buttons, true diagonals.
// The window icon and the ribbon dots are rectangles, so their pixels are their vector.
const { K, W, P: PX, M, L, D, C } = COLORS;
const shaded = (id, from, to) => `<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient>`;
// the knob: a black-rimmed ring shaded from primary1 (top left) to primary2, a light inner ring, a black hole
const knob = (handle) => `<defs>${shaded("r", PX, M)}${shaded("i", L, W)}</defs>${handle}`
  + `<circle cx="4" cy="4" r="3.5" fill="url(#r)" stroke="${K}"/><circle cx="4" cy="4" r="1.6" fill="url(#i)"/><circle cx="4" cy="4" r="1" fill="${K}"/>`;
vector(COLLAPSED, knob(`<rect x="7" y="3" width="5" height="2" fill="${K}"/>`));
vector(EXPANDED, knob(`<rect x="3" y="7" width="2" height="5" fill="${K}"/>`));
vector(UP, `<path d="M3 0H5L8 3V4H0V3Z" fill="${K}"/>`);
vector(DOWN, `<path d="M0 0H8V1L5 4H3L0 1Z" fill="${K}"/>`);
vector(LEFT, `<path d="M4 0V8H3L0 5V3L3 0Z" fill="${K}"/>`);
vector(RIGHT, `<path d="M0 0V8H1L4 5V3L1 0Z" fill="${K}"/>`);
vector(CHECK, `<path d="M4 2.2V5.7L9.6 0.4" fill="none" stroke="${K}" stroke-width="2" stroke-linejoin="bevel"/>`);
// Metal's flush radio: a control-shadow circle with a white one a pixel down and right, a white highlight
// inside along the top left
for (const on of [false, true]) {
  vector(RADIO(on), `<circle cx="7" cy="7" r="5.5" fill="none" stroke="${W}"/><circle cx="6" cy="6" r="5.5" fill="${C}" stroke="${D}"/>`
    + `<path d="M2.82 9.18A4.5 4.5 0 0 1 9.18 2.82" fill="none" stroke="${W}"/>` + (on ? `<circle cx="6" cy="6" r="3" fill="${K}"/>` : ""));
}
for (const hi of ["C", "W"]) {
  vector(SLANT.map((r) => r.replace(/H/g, hi)), `<path d="M0 7L7 0" stroke="${D}" stroke-width="1.25"/><path d="M1 7L7 1" stroke="${COLORS[hi]}"/>`);
}
// The internal-frame icons. Their boxes are rectangles and stay on the pixel grid: a black top and left
// edge, a primary1 band, a sunken black inner edge and a white drop edge. Only the diagonals are drawn as
// lines: primary1, dark along the upper left and white along the lower right, as the pixels shade them.
const box = (x, y, w, h) => `<path d="M${x + w} ${y + 1}h1v${h}H${x + 1}v-1h${w - 1}z" fill="${W}"/>`
  + `<path d="M${x} ${y}h${w}v1H${x + 1}v${h - 1}H${x}z" fill="${K}"/>`
  + `<path fill-rule="evenodd" fill="${PX}" d="M${x + 1} ${y + 1}h${w - 1}v${h - 1}H${x + 1}z M${x + 2} ${y + 2}h${w - 4}v${h - 4}H${x + 2}z"/>`
  + `<path d="M${x + w - 2} ${y + 3}h1v${h - 4}H${x + 3}v-1h${w - 5}z" fill="${K}"/>`;
const stroke = (d) => `<g fill="none"><path d="${d}" stroke="${W}" stroke-width="1.2" transform="translate(.6 .6)"/>`
  + `<path d="${d}" stroke="${K}" stroke-width="1.2" transform="translate(-.55 -.55)"/><path d="${d}" stroke="${PX}" stroke-width="1.6"/></g>`;
vector(CLOSE, box(0, 1, 14, 14) + `<clipPath id="x"><rect x="2" y="3" width="10" height="10"/></clipPath>`
  + `<g clip-path="url(#x)">${stroke("M4 5L11 12M11 5L4 12")}</g>`);
// maximize: a window with an arrow out of it to the top right
vector(MAXIMIZE, box(0, 5, 10, 10) + `<path d="M2 7h4v1H3v3H2z" fill="${W}"/>` + stroke("M3 12.4L11.4 4")
  + `<path d="M8.6 2H14V7.4Z" fill="${PX}"/><path d="M8 1.5H14" stroke="${K}"/><path d="M14.5 2V8" stroke="${W}"/>`);
// iconify: an arrow from the top right into a small window
vector(ICONIFY, box(0, 8, 7, 7) + `<path d="M2 10h3v1H3v2H2z" fill="${W}"/>` + stroke("M12.8 1.8L9.4 5.2")
  + `<path d="M8 2.6V8H13.4Z" fill="${PX}"/><path d="M7.5 2V8" stroke="${K}"/><path d="M8 8.5H14" stroke="${W}"/>`);
vector(RESTORE, box(0, 5, 10, 10) + `<path d="M2 7h6v1H3v5H2z" fill="${W}"/>` + stroke("M13.8 1.8L10.4 5.2")
  + `<path d="M9 2.6V8H14.4Z" fill="${PX}"/><path d="M8.5 2V8" stroke="${K}"/><path d="M9 8.5H15" stroke="${W}"/>`);
// Each window icon is defined once as a custom property on <html> (see the top of the stylesheet) and
// used through var().
const ICONS = { window: art(WINDOW), iconify: art(ICONIFY), maximize: art(MAXIMIZE), restore: art(RESTORE), close: art(CLOSE) };
const G = Object.fromEntries(Object.keys(ICONS).map((k) => [k, `var(--sct-metal-${k})`]));
const tab = (fill, hi) => `
  clip-path: polygon(0 6.5px, 6.5px 0, 100% 0, 100% 100%, 0 100%);
  background: ${art(SLANT.map((r) => r.replace(/H/g, hi)), [0, 0])},
    linear-gradient(${COLORS[hi]}, ${COLORS[hi]}) 7px 1px / 100% 1px no-repeat,
    linear-gradient(${COLORS[hi]}, ${COLORS[hi]}) 1px 7px / 1px 100% no-repeat, ${COLORS[fill]};
  background-origin: border-box;
  border: 1px solid ${s1};
  border-bottom: 0;
  border-radius: 0;
  box-shadow: none;`;
// The ribbon's own buttons: links, but not a large combo button's two (see LC below).
const RB = 'a[class*="scRibbonToolbar"][class*="Button"]:not(.scRibbonToolbarLargeComboButton > a)';
// A large combo button's command (top) and drop-down (bottom) links.
const LC = ':is(.scRibbonToolbarLargeComboButtonTop, .scRibbonToolbarLargeComboButtonBottom)';
const TABS = (state) => [".scRibbon a.scRibbonNavigatorButtons", ".scRibbon a.scRibbonNavigatorButtonsContextual"].map((s) => `${P} ${s}${state}`).join(",\n");

// The global header (Desktop, Content Editor, SPEAK pages): the frame's title pane, bumps between the logo
// and the account links, which stand on the plain title colour.
const header = (S) => `/* ---- Global header: the frame's title pane, bumps between the logo and the account links ---- */
${S} .sc-globalHeader {
  background: ${bumps("#fff", p1)}, ${p3};
  border-bottom: 1px solid ${p2};
  box-shadow: inset 0 14px ${p3}, inset 0 -14px ${p3};
  color: #000;
}
${S} .sc-globalHeader .sc-accountInformation li,
${S} .sc-globalHeader .sc-accountInformation span,
${S} .sc-globalHeader .sc-accountInformation a,
${S} .sc-globalHeader a { color: #000; font-weight: bold; }
${S} .sc-globalHeader .col2 { padding: 0; }
${S} .sc-globalHeader-startButton { display: inline-block; padding: 0 8px 0 12px; background: ${p3}; }
${S} .sc-globalHeader-loginInfo { text-align: right; }
${S} .sc-accountInformation { display: inline-block; padding: 0 15px 0 8px; background: ${p3}; }
`;

const css = `/* Metal Steel: classic shell. Generated by tools/build-metal-css.cjs.
   Java Swing's Metal look and feel in its Steel theme: grey controls with flush 3D borders, lavender
   title bars textured with bumps, slanted tabs, bold Dialog text. */

${P} {
${Object.entries(ICONS).map(([k, v]) => `  --sct-metal-${k}: ${v};`).join("\n")}
}

/* The SPE ISE's Ace editor measures its own monospace font; keep the theme font out of it. */
${P} body, ${P} input, ${P} select, ${P} textarea, ${P} button,
${P} :is(td, a, span, div):not(.ace_editor, .ace_editor *) {
  font-family: ${FONT};
}
${P} {
  scrollbar-color: auto;
}

/* ---- Scrollbars (Chrome and Edge; Firefox only takes colours) ---- */
${P} ::-webkit-scrollbar { width: 17px; height: 17px; background: ${s3}; }
${P} ::-webkit-scrollbar-track:vertical { background: ${s3}; box-shadow: inset 1px 0 ${s1}, inset 2px 0 ${s2}, inset -1px 0 #fff, inset -2px 0 ${s1}; }
${P} ::-webkit-scrollbar-track:horizontal { background: ${s3}; box-shadow: inset 0 1px ${s1}, inset 0 2px ${s2}, inset 0 -1px #fff, inset 0 -2px ${s1}; }
/* List boxes and text areas too: the token layer colours their thumbs one selector weight higher, and
   Sitecore rounds their thumb and track. */
${P} ::-webkit-scrollbar-track { border-radius: 0; }
${P} ::-webkit-scrollbar-thumb, ${P} :is(select, textarea)::-webkit-scrollbar-thumb {
  border: 0;
  border-radius: 0;
  background: ${bumps(p3, p1)}, ${p2};
  box-shadow: inset 1px 1px ${p1}, inset 2px 2px ${p3}, inset -1px -1px #fff, inset -2px -2px ${p1}, inset 0 0 0 3px ${p2};
}
${P} ::-webkit-scrollbar-corner { background: ${s3}; }
${P} ::-webkit-scrollbar-button:single-button { display: block; box-shadow: ${flushShadow}; }
${P} ::-webkit-scrollbar-button:vertical:single-button { width: 17px; height: 15px; }
${P} ::-webkit-scrollbar-button:horizontal:single-button { width: 15px; height: 17px; }
${P} ::-webkit-scrollbar-button:vertical:decrement { background: ${art(UP, [5, 6])}, ${s3}; }
${P} ::-webkit-scrollbar-button:vertical:increment { background: ${art(DOWN, [5, 5])}, ${s3}; }
${P} ::-webkit-scrollbar-button:horizontal:decrement { background: ${art(LEFT, [6, 5])}, ${s3}; }
${P} ::-webkit-scrollbar-button:horizontal:increment { background: ${art(RIGHT, [5, 5])}, ${s3}; }
/* The rule editor's two lists (10.5) carry Sitecore's own ID-weighted scrollbar, 12px with a rounded thumb in a
   white ring, which outranks the rules above: Metal's bar again, at their weight. */
${P} :is(#Conditions, #Description)::-webkit-scrollbar { width: 17px; height: 17px; background: ${s3}; }
${P} :is(#Conditions, #Description)::-webkit-scrollbar-track { border-radius: 0; }
${P} :is(#Conditions, #Description)::-webkit-scrollbar-track:vertical { background: ${s3}; box-shadow: inset 1px 0 ${s1}, inset 2px 0 ${s2}, inset -1px 0 #fff, inset -2px 0 ${s1}; }
${P} :is(#Conditions, #Description)::-webkit-scrollbar-thumb {
  border: 0;
  border-radius: 0;
  background: ${bumps(p3, p1)}, ${p2};
  box-shadow: inset 1px 1px ${p1}, inset 2px 2px ${p3}, inset -1px -1px #fff, inset -2px -2px ${p1}, inset 0 0 0 3px ${p2};
}

${header(P)}
/* ---- Ribbon: slanted Metal tabs over the toolbar ---- */
${P} .scRibbon, ${P} .scRibbonNavigator { background: ${s3}; }
${P} .scRibbonNavigator { border-bottom: 0; }
${TABS("Normal")},
${TABS("Active")} {
  ${tab("G", "C")}
  position: relative;
  color: #000;
  font: bold 12px/20px ${FONT};
  text-transform: none;
  padding: 0 12px 0 14px;
  margin-right: -1px;
}
/* The open tab runs into the toolbar, over its top line. */
${TABS("Active")} {
  ${tab("C", "W")}
  z-index: 1;
  margin-bottom: -1px;
  padding-bottom: 1px;
}
${P} a.scSystemMenu, ${P} a.scSystemMenu:hover { background: ${art(WINDOW, [23, 3])}; }
${P} .scRibbonToolbar { background: ${s3}; border-top: 1px solid #fff; border-bottom: 1px solid ${s1}; }
${P} .scRibbonToolbar .chunk {
  height: auto;
  background: ${s3};
  border: 1px solid ${s2};
  box-shadow: inset 1px 1px #fff, 1px 1px #fff;
  margin: 3px 2px 3px 1px;
}
/* The strip keeps 5px above and below its chunks, not 10.5's 12px; it holds its floated chunks itself
   rather than through its 80px minimum. */
${P} :is(.scRibbonToolbarStrip, .scRibbonToolbarContextualStrip) {
  display: flow-root;
  min-height: 0;
  padding-top: 5px;
  padding-bottom: 5px;
}
/* The buttons sit 2px in from the chunk's sides, not 10.5's 16px, and 3px below its top edge, which a
   large button touched; a caption wider than its buttons keeps 4px. Each button and column pads its
   content 5px a side rather than 8px. */
${P} .scRibbonToolbar .chunk > .panel {
  padding-top: 3px;
  padding-left: 2px;
  padding-right: 2px;
}
${P} .scRibbonToolbar .chunk > .caption {
  padding-left: 4px;
  padding-right: 4px;
}
${P} .scRibbonToolbar :is(a.scRibbonToolbarLargeGalleryButton, .scRibbonToolbarLargeGalleryButtonDisabled, .scRibbonGallery, a.scRibbonToolbarLargeButton, .scRibbonToolbarLargeButtonDisabled, a.scRibbonToolbarLargeButtonDown, .scRibbonToolbarSmallButtons, .scRibbonToolbarLargeComboButton, .scRibbonToolbarLargeComboButtonDown, .scRibbonLargeImageButtonDown, .scRibbonToolbarLargeComboButtonDisabled, .scRibbonToolbarSmallGalleryButtonDisabled, .scRibbonToolbarSmallButtonDisabled) {
  padding-left: 5px;
  padding-right: 5px;
}
/* The ListView's Filter row lines up with the middle of the Page chunk's two rows (see surfaces/shell.css),
   which now start 3px lower. */
${P} .scRibbonToolbar .chunk > .panel:has(> .scRibbonToolbarSmallButtons > #Filter) {
  padding-top: 9px;
  padding-bottom: 4px;
}
${P} .scRibbonToolbar .chunk .caption { background: transparent; color: #000; font: 11px ${FONT}; }
${P} .scRibbonToolbar .panel, ${P} .scRibbonToolbar .panel span, ${P} .scRibbonToolbar .panel a { color: #000; }
${P} .scRibbonToolbar [class*="scRibbonToolbar"][class*="Button"] { border: 1px solid transparent; border-radius: 0; }
/* Only the buttons themselves react, not their icons, labels or the small buttons' column, and disabled
   buttons (spans) not at all. A large combo button is flat until hovered, then shows its command and its
   drop-down as two faces, each pressed on its own. */
${P} .scRibbonToolbar ${RB}:hover { background: ${s3}; ${flush} }
${P} .scRibbonToolbar ${RB}:active { background: ${s2}; }
${P} .scRibbonToolbar .scRibbonToolbarLargeComboButton:hover > ${LC} { background: ${s3}; ${flush} }
${P} .scRibbonToolbar .scRibbonToolbarLargeComboButton > ${LC}:active { background: ${s2}; }

/* ---- Content tree ---- */
${P} .scContentTree { background: #fff; }
${P} .scContentTree a.scContentTreeNodeActive { background: ${p3}; outline: 1px solid ${p2}; color: #000; border-radius: 0; }
${P} .scContentTree a.scContentTreeNodeActive span { color: #000 !important; }
${P} .scContentTree a.scContentTreeNodeNormal:hover { background: transparent; }
${P} img[src*="/treemenu_collapsed"] { ${paint(art(COLLAPSED, [4, 4]))} overflow: hidden; }
${P} img[src*="/treemenu_expanded"] { ${paint(art(EXPANDED, [4, 4]))} overflow: hidden; }

/* ---- Editor ---- */
${P} .scEditorHeaderTitle { font: bold 14px ${FONT}; color: #000; }
${P} a.scRibbonEditorTabActive, ${P} a.scRibbonEditorTabNormal, ${P} a#BTAddNewSearch, ${P} a#BTAddNewSearch:hover {
  ${tab("G", "C")}
  height: 22px;
  margin: 35px -1px 0 0;
}
${P} a.scRibbonEditorTabActive { ${tab("C", "W")} position: relative; z-index: 1; height: 23px; }
${P} #EditorTabs { height: 57px; border-bottom: 1px solid #fff; }
${P} a#BTAddNewSearch { width: 34px; }
${P} .scEditorTabHeaderActive, ${P} .scEditorTabHeaderNormal {
  background-color: transparent;
  color: #000;
  font: bold 12px ${FONT};
  border: 0;
  height: 22px;
  line-height: 22px;
  padding: 0 12px 0 14px;
}
${P} .scEditorSectionCaptionExpanded, ${P} .scEditorSectionCaptionCollapsed {
  background: ${s3};
  color: #000;
  font: bold 12px ${FONT};
  line-height: 22px;
  padding: 0 0 0 4px;
  margin: 0 0 2px;
  ${flush}
}
${P} img.scEditorSectionCaptionGlyph { width: 16px; height: 16px; margin: 3px 4px 0 0; float: left; }
${P} img.scEditorSectionCaptionGlyph[src*="accordion_up"] { ${paint(art(UP))} }
${P} img.scEditorSectionCaptionGlyph[src*="accordion_down"] { ${paint(art(DOWN))} }
${P} .scEditorFieldLabel { color: #000; font: bold 12px ${FONT}; }
/* The gutter left of a field stays empty until validation colours it, as in Sitecore. */
${P} .scEditorFieldMarkerBarCellGrey { border-left-color: ${s2}; }

/* ---- Fields: white with a flush border ---- */
${P} .scContentControl,
${P} .scSearchInput,
${P} input:is([type="text"], [type="password"], [type="search"], [type="number"], [type="email"], [type="url"], :not([type])),
${P} textarea,
${P} select {
  background-color: #fff;
  color: #000;
  border-radius: 0;
  ${flush}
}
${P} select:not([multiple], [size]) {
  appearance: none;
  padding-right: 22px;
  background: ${art(DOWN, 4)},
    linear-gradient(${s1}, ${s1}) right 17px top 0 / 1px 100% no-repeat,
    linear-gradient(${s3}, ${s3}) right 0 top 0 / 17px 100% no-repeat, #fff;
}
${P} input[type="checkbox"], ${P} input[type="radio"] {
  appearance: none;
  width: 13px;
  height: 13px;
  margin: 0 4px 0 0;
  vertical-align: -2px;
  border: 0;
  border-radius: 0;
}
${P} input[type="checkbox"] { background: ${s3}; box-shadow: ${flushShadow}; }
${P} input[type="checkbox"]:checked { background: ${art(CHECK, [0, 3])}, ${s3}; }
${P} input[type="radio"] { background: ${art(RADIO(false), [0, 0])}; }
${P} input[type="radio"]:checked { background: ${art(RADIO(true), [0, 0])}; }
${P} :is(input[type="checkbox"], input[type="radio"]):disabled { opacity: 0.5; }
${P} :is(input[type="checkbox"], input[type="radio"]):focus-visible { outline: 1px solid ${p2}; outline-offset: 1px; }

/* ---- Buttons: grey, flush border, bold; the default button has a second dark ring ---- */
${P} .scButton, ${P} button:not(.ui-button), ${P} input[type="button"], ${P} input[type="submit"] {
  background: ${s3};
  color: #000;
  font: bold 12px ${FONT};
  border-radius: 0;
  ${flush}
}
${P} .scButton:active, ${P} button:not(.ui-button):active, ${P} input:is([type="button"], [type="submit"]):active { background: ${s2}; }
${P} .scButtonPrimary { box-shadow: inset 1px 1px #fff, inset -1px -1px ${s1}, 0 0 0 1px ${s1}; }
${P} .scButton:focus-visible, ${P} button:focus-visible { outline: 1px solid ${p2}; outline-offset: -4px; }

/* ---- Bottom application tabs: Metal tabs on the bottom edge ---- */
${P} .scPager { width: auto; margin: 0; border: 0; border-radius: 0; padding: 0 2px 2px; background: ${s3}; border-top: 1px solid ${s1}; }
${P} .scPagerButtonNormal, ${P} .scPagerButtonActive {
  color: #000;
  font: bold 12px ${FONT};
  background: ${s2};
  border: 1px solid ${s1};
  border-top: 0;
  border-radius: 0;
  box-shadow: inset 1px 0 ${s3};
  margin: 0 -1px 0 0;
}
${P} .scPagerButtonActive { background: ${s3}; box-shadow: inset 1px 0 #fff, 0 -1px ${s3}; position: relative; z-index: 1; }

/* ---- Dialog windows: a Metal internal frame. Sitecore stacks an empty jQuery title bar above the dialog
   page, whose header is the title pane; laid over the header, the bar keeps dragging and carries the
   window buttons into it. ---- */
${P} .ui-dialog {
  background: ${s3};
  border-radius: 0;
  padding: 4px;
  ${frame}
}
${P} .ui-dialog .ui-dialog-titlebar {
  position: absolute;
  top: 5px;
  left: 5px;
  right: 5px;
  height: 22px;
  min-height: 0;
  padding: 0;
  z-index: 2;
  background: transparent;
  border: 0;
  border-radius: 0;
}
${P} .ui-dialog .ui-dialog-titlebar-buttonpane {
  top: 3px !important;
  right: 4px !important;
  margin: 0 !important;
  height: 16px;
  display: flex;
  gap: 2px;
}
${P} .ui-dialog .ui-dialog-titlebar-buttonpane > * {
  width: 16px;
  height: 16px;
  margin: 0;
  padding: 0;
  border: 0;
  border-radius: 0;
  background-color: transparent;
  box-shadow: none;
  overflow: hidden;
  text-indent: -999px;
}
${P} .ui-dialog .ui-dialog-titlebar-buttonpane > * > * { display: none; }
${P} .ui-dialog .ui-dialog-titlebar-buttonpane > button.ui-button {
  position: static !important;
  float: none !important;
  order: 9;
  margin-left: 8px !important;
  background: ${G.close};
}
${P} .ui-dialog .ui-dialog-titlebar-maximize { background: ${G.maximize}; }
${P} .ui-dialog .ui-dialog-titlebar-minimize { background: ${G.iconify}; }
${P} .ui-dialog .ui-dialog-titlebar-restore { background: ${G.restore}; }
${P} .ui-dialog .ui-dialog-titlebar-collapse { background: ${art(DOWN)}; }
/* Metal never dimmed what was behind a dialog; a faint shade still marks the dialog as modal. */
${P} .ui-widget-overlay { background: rgba(0, 0, 0, 0.12); opacity: 1; }

/* Inside a dialog page: the header is the title pane, the window icon, the title, then bumps. */
${P} :is(.scFormDialogHeader, .scDialogHeader) { background: ${s3}; padding: 0; border: 0; min-height: 0 !important; }
/* the dialog page's header, and the ListView's, which SPE puts straight in the jQuery dialog */
${P} :is(:is(.scFormDialogHeader, .scDialogHeader) .DialogHeader, .ui-dialog > .DialogHeader) {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 21px;
  margin: 0;
  padding: 0 0 0 5px;
  background: ${p3};
  border-bottom: 1px solid ${p2};
  color: #000;
  font: bold 12px/21px ${FONT};
  white-space: nowrap;
}
${P} :is(:is(.scFormDialogHeader, .scDialogHeader) .DialogHeader, .ui-dialog > .DialogHeader)::before {
  content: "";
  flex: none;
  width: 16px;
  height: 16px;
  background: ${G.window};
}
${P} :is(:is(.scFormDialogHeader, .scDialogHeader) .DialogHeader, .ui-dialog > .DialogHeader)::after {
  content: "";
  flex: 1;
  align-self: stretch;
  margin: 3px 70px 4px 0;
  background: ${bumps("#fff", p1)};
}
/* SPE puts a 32px icon in the header; Metal's title pane shows a 16px one in place of the window icon. */
${P} .DialogHeader:has(#DialogIcon)::before { display: none; }
${P} .DialogHeader #DialogIcon { width: 16px; height: 16px; margin: 0; }
${P} :is(.scFormDialogHeader, .scDialogHeader) .DialogHeaderDescription { color: #000; padding: 8px 10px; margin: 0; font: 12px ${FONT}; }
${P} .scFormDialogContent, ${P} .scFormDialogFooter, ${P} .scDialogContentContainer { background: ${s3}; }
${P} .scFormDialogFooter { border-top: 1px solid #fff; border-radius: 0; }
/* Dialog insets: controls close to the frame (as Copenhagen's are), not 10.x's 28px in; the buttons end 8px
   from the corner in a footer as tall as they need. */
${X} .scDialogContentContainer { padding: 8px; }
${X} .scFormDialogFooter { height: 42px; padding: 8px; line-height: normal; }
${X} .scFormDialogFooter .footerOkCancel { position: static; float: right; }
/* SPE's help (?) floats left 8px down for 10.x's taller footer: centred on the 26px buttons instead */
${X} .scFormDialogFooter img#Copyright { margin: 1px 0 0; }

/* ---- Tab strips (dialogs, the ISE's script tabs) ---- */
/* Sitecore draws a 40px divider after the open tab; Metal tabs need none. */
${P} .scTabstrip [class*="scTabActive"]::after { display: none; }
${P} .scTabstrip, ${P} .scTabstrip > nobr { display: flex; align-items: flex-end; }
${P} .scTabstrip { border-bottom: 1px solid #fff; }
/* Sitecore swaps scTab for scTab_Hover under the mouse; the stock hover class is uppercase on a light face. */
${P} .scTabstrip :is(.scTab, .scTab_Hover), ${P} .scTabstrip [class*="scTabActive"] {
  ${tab("G", "C")}
  height: auto;
  padding: 0 12px 0 14px;
  margin-right: -1px;
  text-transform: none;
  color: #000;
  font: bold 12px/20px ${FONT};
}
${P} .scTabstrip [class*="scTabActive"] { ${tab("C", "W")} position: relative; z-index: 1; padding-bottom: 1px; margin-bottom: -1px; }
/* SPE pulls a script tab's close X 10px into the tab's 20px right padding; with these 12px it touched the edge. */
${P} .scTabstrip .closeTab { margin: 0 -4px 0 6px; }

/* ---- Window buttons (Desktop windows and the Content Editor's own) ---- */
${P} :is(.scSystemButtons, .standartWindowButtons, .scWorkboxWindowButtons) { display: flex; align-items: center; gap: 2px; }
${P} :is(.scSystemButtons, .standartWindowButtons, .scWorkboxWindowButtons) img { width: 16px; height: 16px; margin: 0; padding: 0; vertical-align: middle; filter: none; }
${P} :is(.scSystemButtons, .standartWindowButtons, .scWorkboxWindowButtons) img[src*="page_switcher"] { ${paint(G.window)} }
${P} :is(.scSystemButtons, .standartWindowButtons, .scWorkboxWindowButtons) img[src*="minimize"] { ${paint(G.iconify)} }
${P} :is(.scSystemButtons, .standartWindowButtons, .scWorkboxWindowButtons) img[src*="maximize"] { ${paint(G.maximize)} }
${P} :is(.scSystemButtons, .standartWindowButtons, .scWorkboxWindowButtons) img[src*="restore"] { ${paint(G.restore)} }
${P} :is(.scSystemButtons, .standartWindowButtons, .scWorkboxWindowButtons) img[src*="_close"] { ${paint(G.close)} margin-left: 8px; }
/* Standard windows (ISE, Console, Package Designer...): a Metal title pane with bumps. */
${P} .standardWindowCaption {
  height: 22px;
  background: ${bumps("#fff", p1)}, ${p3};
  box-shadow: inset 0 3px ${p3}, inset 0 -5px ${p3};
  border-bottom: 1px solid ${p2};
}
${P} .standardWindowCaption + .windowPlaceholderContainer { top: 23px; }
${P} .standardWindowCaption .windowCaptionIcon { display: inline-block; vertical-align: top; margin: 3px 0 0 5px; background: ${p3}; }
${P} .standardWindowCaption .scWindowCaption {
  display: inline-block;
  line-height: 22px;
  font: bold 12px/22px ${FONT};
  color: #000;
  padding: 0 6px;
  background: ${p3};
  vertical-align: top;
}
${P} .standardWindowCaption .scWindowCaption * { font: inherit; }
/* The ISE writes its script's path into the caption as italics in an inline #bbb, all but lost on primary3:
   primary1, the scroll thumb's dark purple. */
${P} .standardWindowCaption .scWindowCaption i { color: ${p1} !important; }
${P} .standartWindowButtons { top: 3px; right: 4px; background: ${p3}; padding-left: 6px; }
/* An inactive window (dom.js marks its document from the taskbar): Metal's inactive title pane, control grey
   with white and secondary1 bumps. */
${PI} .standardWindowCaption {
  background: ${bumps("#fff", s1)}, ${s3};
  box-shadow: inset 0 3px ${s3}, inset 0 -5px ${s3};
  border-bottom-color: ${s2};
}
${PI} .standardWindowCaption :is(.windowCaptionIcon, .scWindowCaption), ${PI} .standartWindowButtons { background: ${s3}; }
/* The Content Editor, Media Library and Workbox: Sitecore draws no caption over their windows. Metal's title
   pane, as on every other window, is drawn on the caption's empty top line (the Workbox: its empty caption
   strip) from the window's title (engine.js --sct-window-title), the window's buttons on it. The ribbon's menu
   button shrinks to the tab row below it, and the tab row drops its empty group-header line (kept while a
   contextual tab group shows one), so the tabs sit right under the title pane. */
${winBar(WT)} {
  box-sizing: border-box;
  height: 23px;
  padding: 0;
  background: ${bumps("#fff", p1)}, ${p3};
  box-shadow: inset 0 3px ${p3}, inset 0 -5px ${p3};
  border-bottom: 1px solid ${p2};
}
${winBar(WT, "::before")} {
  content: var(--sct-window-title, "");
  display: inline-block;
  vertical-align: top;
  max-width: calc(100% - 110px);
  padding: 0 6px 0 25px;
  background: var(--sct-window-icon, none) 5px center / 16px 16px no-repeat, ${p3};
  color: #000;
  font: bold 12px/22px ${FONT};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
${winButtons(WT)} { position: absolute; float: none; top: 3px; right: 4px; margin-right: 0; height: 16px; z-index: 2; background: ${p3}; padding-left: 6px; }
${WT} .scWindowBorder2 > .scCaption > #SystemMenu { top: 0; margin-top: 23px; height: 21px; }
${WT} .scWindowBorder2 > .scCaption .scRibbonNavigator:not(:has(.scRibbonNavigatorButtonsContextualGroup)) .scRibbonNavigatorButtonsGroupHeader { display: none; }
/* 4px between the title bar and the tabs: they never touch it; the menu button moves down with them */
${WT} .scWindowBorder2 > .scCaption .scRibbonNavigator { padding-top: 4px; }
${WT} .scWindowBorder2 > .scCaption > #SystemMenu { translate: 0 4px; }
/* the same 4px on a standard window (the ISE...), whose ribbon is in the page inside the window's chrome */
${X}[data-sct-window-content] .scRibbonNavigator { padding-top: 4px; }
${winBar(WTI)} {
  background: ${bumps("#fff", s1)}, ${s3};
  box-shadow: inset 0 3px ${s3}, inset 0 -5px ${s3};
  border-bottom-color: ${s2};
}
${winBar(WTI, "::before")} { background-color: ${s3}; }
${winButtons(WTI)} { background: ${s3}; }

/* ---- Insert gallery scroller ---- */
${P} .scRibbonPanelButtons { background: ${s3}; }
${P} img.scRibbonPanelUp { ${paint(art(UP))} width: 17px; height: 15px; filter: none; box-shadow: ${flushShadow}; background-color: ${s3}; }
${P} img.scRibbonPanelDown { ${paint(art(DOWN))} width: 17px; height: 15px; filter: none; box-shadow: ${flushShadow}; background-color: ${s3}; }
${P} img.scRibbonPanelOpen { ${paint(art(["KK.KK.KK", "KK.KK.KK"]))} width: 17px; height: 15px; filter: none; box-shadow: ${flushShadow}; background-color: ${s3}; }

/* ---- Desktop: a JDesktopPane with a toolbar for the taskbar ---- */
${P} #Startbar, ${P} #Startbar > table { background: ${s3}; border-top: 1px solid #fff; box-shadow: inset 0 -1px ${s1}; }
${P} .scStartButton, ${P} .scStartButton.scPopupOpener, ${P} .scStartButton:hover {
  background: url("/sitecore/shell/themes/standard/images/homebutton2.png") center / 24px 24px no-repeat, ${s3};
  border-radius: 0;
  ${flush}
}
${P} .scStartButton.scPopupOpener { background-color: ${s2}; }
${P} .scStartBarScroller a, ${P} .scStartBarScroller div[class*="Button"], ${P} #StartbarApplications * { color: #000; font: bold 12px ${FONT}; }
${P} .scActiveApplication { background: ${s2}; ${flush} }
${P} .scInactiveApplication { background: ${s3}; ${flush} }
${P} .scInactiveApplication::before, ${P} .scInactiveApplication::after { display: none; }
${P} .scStartbarTray, ${P} .scStartbarTray * { color: #000; background-color: transparent; }
${P} .scStartbarTray input, ${P} #SearchBox { background: #fff; border-radius: 0; ${flush} }

/* The start menu is a Metal popup menu: a primary1 outline, a white highlight, primary2 selection. */
${P} #StartMenu {
  background: ${s3};
  border: 1px solid ${p1};
  border-radius: 0;
  box-shadow: inset 1px 1px #fff;
  font-family: ${FONT};
}
${P} .scStartMenuLeft, ${P} .scStartMenuRight { background: ${s3}; }
${P} .scStartMenuLeft *, ${P} .scStartMenuRight * { color: #000; }
${P} .scStartMenuLeftOption, ${P} .scStartMenuRightFolder { font-weight: bold; }
${P} .scStartMenuLeftOption:hover, ${P} .scStartMenuRightFolder:hover, ${P} .scMenu :is(.scGalleryMenuItem, tr:not([class]):has(> .scMenuItemIcon)):hover { background: ${p2}; }
${P} .scStartMenuLeftOptionDescription { color: ${p1} !important; font-weight: normal; }
${P} .scStartMenuPrograms { background: ${s3}; border-top: 1px solid ${s1}; box-shadow: inset 0 1px #fff; }
${P} .scStartMenuPrograms * { color: #000; }
${X} img.scStartMenuRightFolderGlyph { ${paint(art(RIGHT))} }

/* ==== Where 10.x's own metrics (34-36px controls, 6px corners, soft shadows) outrank the rules above. ==== */

/* ---- Fields: Metal's 22px text field and combo box; Sitecore's 34px minimum and corners go ---- */
${X} input:is([type="text"], [type="password"], [type="search"], [type="number"], [type="email"], [type="url"], :not([type])),
${X} select:not([multiple], [size]) {
  box-sizing: border-box;
  height: 22px;
  min-height: 0;
  padding: 0 4px;
  border-radius: 0;
  background-color: #fff;
  font: 12px/20px ${FONT};
  ${flush}
}
${X} select:not([multiple], [size]) { padding-right: 22px; }
${X} textarea, ${X} select:is([multiple], [size]) { border-radius: 0; ${flush} }
${X} :is(input, select, textarea):focus { outline: none; }

/* ---- Combo tables (date and time pickers, item pickers): one Metal combo box. The table is the 22px
   field with the flush border; the text inside has no frame of its own and fills it; the button is the
   combo's arrow in a control-grey well, as on a select. ---- */
${X} table.scCombobox {
  box-sizing: border-box;
  height: 22px;
  min-height: 0;
  border-collapse: separate;
  border-spacing: 0;
  border-radius: 0;
  overflow: hidden;
  background: #fff;
  ${flush}
}
${X} table.scCombobox :is(tbody, tr, td) { height: auto; }
${X} table.scCombobox td { padding: 0; border: 0; vertical-align: middle; }
${X} table.scCombobox input.scComboboxEdit {
  box-sizing: border-box;
  width: 100%;
  height: 20px !important;
  min-height: 0;
  margin: 0;
  padding: 0 4px;
  border: 0;
  border-radius: 0;
  box-shadow: none;
  background: transparent;
}
${X} table.scCombobox img.scComboboxDropDown {
  display: block;
  box-sizing: border-box;
  width: 17px;
  height: 20px;
  margin: 0;
  padding: 0;
  border: 0;
  border-left: 1px solid ${s1};
  border-radius: 0;
  box-shadow: none;
  ${paint(`${art(DOWN)}, ${s3}`)}
}

/* ---- Push buttons: 26px Metal buttons, wide enough for OK and Cancel ---- */
${X} :is(.scButton:not(.scEditorHeaderButton), input[type="button"], input[type="submit"]) {
  box-sizing: border-box;
  height: 26px;
  min-width: 75px;
  padding: 0 14px;
  border-radius: 0;
  line-height: 24px;
}
${X} button:not(.ui-button) { border-radius: 0; }

/* ---- Drop-down arrows: Metal's black combo-box triangle for Sitecore's chevrons ---- */
${X} img[src*="ribbondropdown" i] { ${paint(art(DOWN))} }

/* ---- Tree search: a Metal toolbar of a text field and two 22px buttons on one line ---- */
${X} #SearchPanel {
  padding: 4px;
  background: ${s3};
  border-bottom: 1px solid ${s1};
  box-shadow: 0 1px #fff;
}
${X} #SearchPanel > table { width: 100%; border-spacing: 0; }
${X} #SearchPanel > table > tbody > tr > td { height: auto; padding: 0; vertical-align: middle; }
${X} #SearchPanel > table > tbody > tr > td:first-child { width: 100%; }
${X} #SearchPanel > table > tbody > tr > td > div { float: none !important; padding: 0 0 0 2px !important; }
${X} #SearchPanel .scElementHover { width: auto; height: auto; padding: 0; border: 0; background: none; }
${X} #TreeSearch { width: 100%; }
${X} :is(a.scSearchButton, a.scSearchOptionsButton) {
  display: block;
  box-sizing: border-box;
  width: 22px;
  height: 22px;
  padding: 2px;
  background: ${s3};
  ${flush}
}
${X} :is(a.scSearchButton, a.scSearchOptionsButton):active { background-color: ${s2}; }
${X} :is(a.scSearchButton, a.scSearchOptionsButton) img { display: block; width: 16px; height: 16px; margin: 0; padding: 0; }
${X} a.scSearchOptionsButton img { ${paint(art(DOWN))} }
/* the expanded options: the same fields, rows as tall as they are */
${X} #SearchOptionsList td { height: auto; padding: 2px 0; vertical-align: middle; }
${X} #TreeSearchOptions .scElementHover { padding: 0 4px 0 0; border: 0; background: none; }
${X} .scSearchAddCriteriaInput { padding-top: 2px; }
${X} :is(a.scSearchOptionName, a.scSearchAddCriteria) { display: flex; align-items: center; gap: 4px; padding: 0; color: #000; font: bold 12px ${FONT}; }
${X} a.scSearchOptionName img.arrowDown { ${paint(art(DOWN))} }

/* ---- Language, version and navigator drop-downs above the editor: Metal combo buttons ---- */
${X} .scEditorTabControls a.scEditorHeaderButton {
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 22px;
  min-width: 0;
  padding: 0 4px 0 6px;
  border-radius: 0;
  background: ${s3};
  color: #000;
  font: bold 12px/20px ${FONT};
  ${flush}
}
${X} .scEditorTabControls a.scEditorHeaderButton:active { background-color: ${s2}; }
${X} .scEditorTabControls a.scEditorHeaderButton img { margin: 0; }
${X} .scEditorTabControls a.scEditorHeaderButton span { display: inline-flex; align-items: center; gap: 4px; }

/* ---- Menus (context menus, start menu fly-outs, drop-downs): a Metal popup menu, a primary1 outline with
   a white highlight inside, bold items, primary2 selection, etched separators and no shadow ---- */
${X} .scPopup, ${X} .scMenu:not(.scPopup > .scMenu) {
  padding: 1px 0 0 1px;
  background: ${s3};
  border: 1px solid ${p1};
  border-radius: 0;
  box-shadow: inset 1px 1px #fff;
}
${X} .scPopup > .scMenu { background: transparent; border: 0; box-shadow: none; }
${X} .scMenu td {
  height: auto;
  padding: 3px 4px;
  background: transparent;
  color: #000;
  font: bold 12px ${FONT};
  line-height: 16px;
}
${X} .scMenu :is(.scMenuItemIcon, .scMenuItemIcon_Hover, .scMenuItemIcon_Disabled) { width: 16px; padding: 3px 2px 3px 6px; }
${X} .scMenu :is(.scMenuItemCaption, .scMenuItemCaption_Hover, .scMenuItemCaption_Disabled) { padding: 3px 10px 3px 4px; }
${X} .scMenu :is(.scMenuItemHotkey, .scMenuItemHotkey_Hover, .scMenuItemHotkey_Disabled) { padding: 3px 6px 3px 4px; text-align: right; }
${X} .scMenu :is(.scMenuItemIcon_Hover, .scMenuItemCaption_Hover, .scMenuItemHotkey_Hover, .scMenuPanelItem_Hover, .scMenuPanelItemSelected_Hover) { background: ${p2}; }
${X} .scMenu :is(.scGalleryMenuItem, tr:not([class]):has(> .scMenuItemIcon)):hover { background: ${p2}; }
${X} .scMenu :is(.scGalleryMenuItem, tr:not([class]):has(> .scMenuItemIcon)):has(.scMenuItemCaption_Disabled):hover { background: transparent; }
${X} .scMenu :focus-visible, ${X} .scMenu:focus-visible { outline: 1px solid ${p2}; outline-offset: -1px; }
/* drop-down galleries (language, version, ribbon drop-downs) open in an iframe: the popup's outline, no shadow */
${X} iframe.scGalleryFrame { border: 1px solid ${p1}; border-radius: 0; box-shadow: none; }
${X} .scMenu :is(.scMenuItemIcon_Disabled, .scMenuItemCaption_Disabled, .scMenuItemHotkey_Disabled) { color: ${s2}; }
${X} .scMenu .scMenuItemIcon_Disabled > img { opacity: 0.5; }
${X} .scMenu img[src*="submenu16x16" i] { ${paint(art(RIGHT))} }
${X} .scMenu :is(.scMenuDividerIcon, .scMenuDividerCaption, .scMenuDividerHotkey) {
  height: 4px;
  padding: 0;
  border: 0;
  background: linear-gradient(transparent 1px, ${p1} 1px 2px, #fff 2px 3px, transparent 3px);
  font-size: 0;
  line-height: 0;
}
${X} .scMenu :is(.scMenuDividerIcon, .scMenuDividerCaption, .scMenuDividerHotkey) img { display: none; }
${X} .scMenuHeader { padding: 4px 6px; color: #000; font: bold 12px ${FONT}; }

/* ---- Dialog tab panes: Metal's JTabbedPane. The strip is as tall as a tab; the content area is control
   grey with a raised border (white top and left, secondary1 bottom and right) that the open tab joins;
   the scrolling list inside it is a white scroll pane with a flush border. ---- */
${X} .scTabstrip { box-sizing: border-box; height: 22px; background: transparent; }
/* Sitecore sets the open tab 1px left (left: -1px) over its neighbours: the page starts there too, so the open
   first tab's dark edge and white highlight run straight on down the page's left side. */
${X} .scTabstripContainer > .scTabs { top: 22px; left: -1px; background: ${s3}; border: 1px solid ${s1}; border-top: 0; box-shadow: inset 1px 0 #fff; }
${X} .scTabs .scTabPage .scScrollbox { background: #fff; ${flush} }
/* The page inside keeps its 1px border, as layout, but unpainted: Sitecore's grey line covered the frame's
   white edge. */
${X} .scTabs > .scTabPage { border-color: transparent; }

/* ---- Ribbon galleries (Home > Insert, Security > Presets): rows of a Metal list, selected in primary3 ---- */
${X} .scRibbonGalleryList > a:is(:hover, :active) { background: ${p3}; border-color: transparent; box-shadow: none; }

/* The ribbon's fold button: Metal's arrows */
${X} a.scRibbonClose { background: ${art(UP)}; }
${X} a.scRibbonOpen { background: ${art(DOWN)}; }
${X} :is(a.scRibbonClose, a.scRibbonOpen)::before { content: none; }

/* ---- Bucket search (Media Library and bucket Search tabs): one white Metal field holding the filter
   tokens, the expander and the Clear and Search buttons as Metal buttons inside it. The area map clears
   the buttons' icons; they are put back. ---- */
${X} .search-box { border-radius: 0; background: #fff; ${flush} }
${X} .search-box :is(.sb_down, .sb_up) { border: 0; box-shadow: inset -1px 0 ${s1}; }
${X} .search-box .sb_down { background: ${art(DOWN)}, ${s3}; }
${X} .search-box .sb_up { background: ${art(UP)}, ${s3}; }
${X} .search-box #raw-user-input { border: 0; box-shadow: none; background: transparent; }
${X} .filters .filter { border: 1px solid ${p2}; border-radius: 0; background: ${p3}; color: #000; }
${X} .clear-search-box :is(.btn-clear, .btn-search) { border-radius: 0; ${flush} }
${X} .clear-search-box .btn-clear { background: url("/sitecore/shell/Applications/Buckets/images/clear.png") center no-repeat, ${s3}; }
${X} .clear-search-box .btn-search { background: url("/sitecore/shell/Applications/Buckets/images/edition-magnifier.png") center no-repeat, ${s3}; }
${X} .clear-search-box :is(.btn-clear, .btn-search):active { background-color: ${s2}; }

/* The Workbox's empty caption strip: control grey, like the Content Editor's tab row */
${X} .scWorkboxWindowCaption { background: ${s3}; }

/* ---- Desktop windows: each is an iframe, so the internal frame's 5px grooved border is drawn outside it
   as rings (inside out: primary1; primary2 top-left, primary1 bottom-right; black; primary1 top-left,
   primary2 bottom-right; primary1) ---- */
${X} #Desktop > iframe {
  box-shadow: 0 0 0 1px ${p1}, -1px -1px 0 1px ${p2}, 0 0 0 2px ${p1}, 0 0 0 3px #000, 1px 1px 0 3px ${p2}, 0 0 0 5px ${p1};
}
/* an inactive frame draws the same border in the control colours (dom.js marks the iframe) */
${X} #Desktop > iframe[data-sct-window="inactive"] {
  box-shadow: 0 0 0 1px ${s1}, -1px -1px 0 1px ${s2}, 0 0 0 2px ${s1}, 0 0 0 3px #000, 1px 1px 0 3px ${s2}, 0 0 0 5px ${s1};
}

/* ---- Desktop search box: a Metal text field in the toolbar ---- */
${X} #SearchBox { width: 180px; margin: 0 4px; }
`;

// ==== SPEAK pages (speak and launchpad areas) ====
// What every SPEAK page shares: Dialog for Open Sans, the bumped title pane for a header, Metal fields,
// check boxes and push buttons.
// band: the header's height inside its bottom border (SPEAK pages 49px, Launchpad 47px), which every
// header item is centred on, as the bumps are.
const speakCommon = (S, band = 49) => {
  const SX = `${S}:not(#sct-ms)`;
  return `${SX} :is(body, input, button, select, textarea, h1, h2, h3, h4, h5, h6, p, a, span, div, li, label, td, th, nav, header, section):not([class*="glyphicon"], .fa, [class*="fa-"]) {
  font-family: ${FONT};
}
${header(SX)}
/* SPEAK's header lays the logo and the application name out in a half-width column: the column shrinks to
   them and stands on the title colour, and the account links cover the header's bottom line no more. */
${SX} .sc-globalHeader-content > :first-child { padding-left: 0; }
${SX} .sc-globalHeader .sc-globalHeader-startButton { display: flex; align-items: center; box-sizing: border-box; width: auto; height: ${band}px; margin: 0; border-radius: 0; }
${SX} .sc-globalHeader .sc-globalHeader-startButton .sc-global-logo { flex: none; margin: 0; }
${SX} .sc-globalHeader .sc-globalheader-appName:not(:empty) { height: ${band}px; margin: 0; padding: 0 8px; background: ${p3}; color: #000; font: bold 12px/${band}px ${FONT}; }
${SX} .sc-globalHeader .sc-accountInformation { height: ${band}px; line-height: ${band}px; vertical-align: top; box-shadow: none; }
${SX} .sc-globalHeader .sc-accountInformation li { height: ${band}px; line-height: ${band}px; vertical-align: top; }
${SX} .sc-globalHeader .sc-accountInformation img { vertical-align: top; margin-top: ${(band - 32) / 2}px; margin-bottom: 0; }
${SX} .sc-globalHeader .sc-ext-dbName { line-height: ${band}px; }
${SX} .sc-globalHeader .sc-accountInformation li,${SX} .sc-globalHeader .sc-accountInformation li::before, ${SX} .sc-globalHeader .sc-accountInformation li::after { color: #000; }
${SX} .sc-globalHeader .sc-accountInformation a { text-decoration: none; }
${SX} .sc-globalHeader .sc-accountInformation a:hover { text-decoration: underline; }

/* ---- Fields, check boxes, push buttons ---- */
${SX} :is(input:is([type="text"], [type="password"], [type="search"], [type="number"], [type="email"], [type="url"], :not([type])), select:not([multiple], [size]), .form-control) {
  box-sizing: border-box;
  height: 22px;
  min-height: 0;
  padding: 0 4px;
  border-radius: 0;
  background-color: #fff;
  color: #000;
  font: 12px/20px ${FONT};
  ${flush}
}
${SX} textarea { border-radius: 0; ${flush} }
${SX} :is(input, select, textarea, .form-control):focus { outline: none; box-shadow: inset 1px 1px #fff, inset -1px -1px ${s1}; border-color: ${s1} #fff #fff ${s1}; }
${SX} input[type="checkbox"], ${SX} input[type="radio"] {
  appearance: none;
  width: 13px;
  height: 13px;
  margin: 0 4px 0 0;
  vertical-align: -2px;
  border: 0;
  border-radius: 0;
  outline: none;
}
${SX} input[type="checkbox"] { background: ${s3}; box-shadow: ${flushShadow}; }
${SX} input[type="checkbox"]:checked { background: ${art(CHECK, [0, 3])}, ${s3}; }
${SX} input[type="radio"] { background: ${art(RADIO(false), [0, 0])}; box-shadow: none; }
${SX} input[type="radio"]:checked { background: ${art(RADIO(true), [0, 0])}; }
${SX} .btn {
  box-sizing: border-box;
  height: 26px;
  min-width: 75px;
  padding: 0 14px;
  border-radius: 0;
  background: ${s3};
  color: #000;
  font: bold 12px/24px ${FONT};
  text-transform: none;
  text-shadow: none;
  ${flush}
}
${SX} .btn :is(span, .sc-button-text) { color: inherit; font: inherit; }
${SX} .btn:hover, ${SX} .btn:focus { background: ${s3}; color: #000; }
${SX} .btn:active, ${SX} .btn.active { background: ${s2}; }
${SX} .btn:focus-visible { outline: 1px solid ${p2}; outline-offset: -4px; }
${SX} .btn:disabled, ${SX} .btn.disabled { background: ${s3}; color: ${s2}; opacity: 1; }
/* the default button carries Metal's second dark ring */
${SX} .btn.btn-primary { box-shadow: inset 1px 1px #fff, inset -1px -1px ${s1}, 0 0 0 1px ${s1}; }
${SX} .btn.btn-primary :is(span, .sc-button-text) { color: #000; }
`;
};

// A Metal internal frame around a SPEAK panel: the grooved 5px border, then a title pane (primary3, a 16px
// icon or none, the bold title, bumps to the right) and the content below it.
const internalFrame = (root, title) => `${root} {
  box-sizing: border-box;
  padding: 4px;
  background: ${s3};
  border-radius: 0;
  ${frame}
}
${title} {
  display: flex;
  align-items: center;
  gap: 6px;
  box-sizing: border-box;
  height: 22px;
  margin: 0;
  padding: 0 0 0 5px;
  background: ${p3};
  border-bottom: 1px solid ${p2};
  color: #000;
  font: bold 12px/21px ${FONT};
  text-transform: none;
  white-space: nowrap;
}
${title.includes("::") ? "" : `${title}::after {
  content: "";
  flex: 1;
  align-self: stretch;
  margin: 4px 5px 5px 0;
  background: ${bumps("#fff", p1)};
}`}`;

// The application header of a SPEAK page (title, Back): a Metal toolbar under the title pane.
const appHeader = (SX) => `${SX} .sc-applicationHeader { border: 0; background: ${s3}; box-shadow: none; }
${SX} .sc-applicationHeader-row1 { display: flow-root; height: auto; min-height: 0; padding: 0; background: ${s3}; border: 0; }
${SX} .sc-applicationHeader-row1::after { content: none; }
${SX} .sc-applicationHeader-row1 .sc-applicationHeader-content { height: auto; padding: 10px 15px 6px; }
${SX} .sc-applicationHeader-title, ${SX} .sc-applicationHeader-title .sc-text { color: #000; font: bold 16px/22px ${FONT}; }
${SX} .sc-applicationHeader-row2 { display: flow-root; height: auto; min-height: 0; padding: 0 15px 8px; background: ${s3}; border: 0; border-bottom: 1px solid ${s1}; box-shadow: 0 1px #fff; }
${SX} .btn.sc-backbutton { display: inline-flex; align-items: center; gap: 6px; height: 26px; min-width: 0; padding: 0 12px 0 8px; ${flush} background: ${s3}; }
${SX} .btn.sc-backbutton:active { background: ${s2}; }
${SX} .btn.sc-backbutton .sc-backbutton-text { position: static; min-width: 0; height: auto; margin: 0; padding: 0; color: #000; font: bold 12px/24px ${FONT}; text-decoration: none; }
${SX} .btn.sc-backbutton:hover .sc-backbutton-text { text-decoration: none; }
${SX} .btn.sc-backbutton::before, ${SX} .btn.sc-backbutton:is(:hover, :active)::before { position: static; flex: none; width: 4px; height: 8px; background: ${art(LEFT, [0, 0])}; mask: none; transform: none; }`;

const SP = SURFACE("speak"), SPX = `${SP}:not(#sct-ms)`;
const EE = `${SPX} .sc-pageeditbar`;
const speak = `/* Metal Steel: SPEAK pages and the Experience Editor ribbon. Generated by tools/build-metal-css.cjs. */
${speakCommon(SP)}
/* ==== Experience Editor ribbon: the SPEAK ribbon dressed as the Content Editor's Metal ribbon ==== */
${EE} { color: #000; font: 12px ${FONT}; }

/* The tab row: quick buttons, the slanted tabs, and the fold button at the far end */
${EE} .sc-quickbar {
  display: flex;
  align-items: flex-end;
  height: auto;
  padding: 6px 4px 0;
  border: 0;
  background: ${s3};
  box-shadow: none;
}
${EE} .sc-quickbar-item { float: none; margin: 0; text-transform: none; cursor: default; }
${EE} .sc-quickbar-button {
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
  align-self: center;
  width: 22px;
  height: 22px;
  padding: 0;
  margin: 0 1px 0 0;
  border: 1px solid transparent;
  border-radius: 0;
  background: none;
  box-shadow: none;
  opacity: 1;
}
${EE} .sc-quickbar-button:not(.disabled):hover { background: ${s3}; ${flush} }
${EE} .sc-quickbar-button:not(.disabled):active { background: ${s2}; }
${EE} .sc-quickbar-button.disabled { opacity: 0.45; }
${EE} .sc-quickbar-button[data-sc-id="QuickRibbon"] { order: 1; margin-left: auto; }
/* Sitecore pins the fold glyph's background-position with !important: the arrow is drawn in a pseudo-element */
${EE} .sc-quickbar-button :is(.navigate_up, .navigate_down) { float: none; margin: 0; background: none; mask: none; }
${EE} .sc-quickbar-button :is(.navigate_up, .navigate_down)::before { content: ""; display: block; width: 16px; height: 16px; }
${EE} .sc-quickbar-button .navigate_up::before { background: ${art(UP)}; }
${EE} .sc-quickbar-button .navigate_down::before { background: ${art(DOWN)}; }
${EE} .sc-quickbar-button[data-sc-id="QuickInsert-Component"] { margin-right: 8px; }
${EE} .sc-quickbar-tab, ${EE} .sc-quickbar-tab:hover {
  ${tab("G", "C")}
  position: relative;
  height: auto;
  padding: 0 12px 0 14px;
  margin-right: -1px;
  color: #000;
  font: bold 12px/20px ${FONT};
  text-decoration: none;
}
${EE} .sc-quickbar-item:focus { outline: none; }
${EE} .sc-quickbar-item:focus-visible { outline: 1px solid ${p2}; outline-offset: -3px; }
${EE} .sc-quickbar-tab.sc-quickbar-tab-selected {
  ${tab("C", "W")}
  z-index: 1;
  margin-bottom: -1px;
  padding-bottom: 1px;
}

/* The toolbar and its chunks, as .scRibbonToolbar and .chunk in the Content Editor */
${EE} .sc-ribbon { background: ${s3}; border: 0; border-top: 1px solid #fff; border-bottom: 1px solid ${s1}; box-shadow: none; }
${EE} .sc-strip { min-height: 0; padding: 0 0 0 1px; }
${EE} .sc-chunk {
  float: left;
  height: auto;
  margin: 3px 2px 3px 1px;
  padding: 0;
  background: ${s3};
  border: 1px solid ${s2};
  border-radius: 0;
  box-shadow: inset 1px 1px #fff, 1px 1px #fff;
}
${EE} .sc-chunk::before, ${EE} .sc-chunk::after { content: none; }
${EE} :is(.sc-chunk-button-list, .sc-chunk-check-list) { display: flow-root; height: 50px; min-height: 0; margin: 0; padding: 0 8px; }
${EE} .sc-chunk-label { height: 20px; margin: 0; padding: 0 6px; color: #000; font: 11px/20px ${FONT}; text-align: center; text-transform: none; }

/* large buttons: a 24px icon over its caption, a flush border while hovered, secondary2 while pressed */
${EE} :is(.sc-chunk-button, .sc-chunk-button-dropdown, .sc-chunk-gallerybutton) {
  float: left;
  box-sizing: border-box;
  height: 50px;
  margin: 0;
  padding: 4px 8px;
  border: 1px solid transparent;
  border-radius: 0;
  background: none;
  box-shadow: none;
  color: #000;
  text-align: center;
}
${EE} :is(.sc-chunk-button, .sc-chunk-button-dropdown, .sc-chunk-gallerybutton) > [class*="sprite"] { display: block; margin: 0 auto; }
${EE} .sc-chunk-button-label { margin: 0; padding: 4px 0 0; color: #000; font: 12px/12px ${FONT}; text-transform: none; }
${EE} :is(.sc-chunk-button, .sc-chunk-button-dropdown, .sc-chunk-gallerybutton, .sc-chunk-button-small, .sc-chunk-check-small):not(.disabled):hover { background: ${s3}; ${flush} }
${EE} :is(.sc-chunk-button, .sc-chunk-button-dropdown, .sc-chunk-gallerybutton, .sc-chunk-button-small):not(.disabled):active,
${EE} :is(.sc-chunk-button, .sc-chunk-button-dropdown, .sc-chunk-gallerybutton, .sc-chunk-button-small).pressed { background: ${s2}; ${flush} }
${EE} .disabled .sc-chunk-button-label, ${EE} .disabled.sc-chunk-check-small .sc-chunk-check-small-label { color: ${s2}; }
${EE} .disabled > [class*="sprite"] { opacity: 0.45; }
${EE} :is(.sc-chunk-button, .sc-chunk-button-small, .sc-chunk-button-dropdown, .sc-chunk-gallerybutton).disabled { opacity: 1; }

/* small buttons and check boxes, three to a column */
${EE} .sc-chunk-button-small-list { float: left; margin: 0; padding: 0; }
${EE} :is(.sc-chunk-button-small, .sc-chunk-check-small) {
  display: flex;
  align-items: center;
  gap: 4px;
  box-sizing: border-box;
  height: 21px;
  margin: 0;
  padding: 0 4px;
  border: 1px solid transparent;
  border-radius: 0;
  background: none;
  box-shadow: none;
  color: #000;
  white-space: nowrap;
}
${EE} .sc-chunk-button-small > [class*="sprite"] { float: none; margin: 0; }
${EE} :is(.sc-chunk-button-small .sc-chunk-button-label, .sc-chunk-check-small-label) { display: inline; float: none; padding: 0; color: #000; font: 12px/16px ${FONT}; }
${EE} .sc-chunk-check-list { float: left; padding-top: 2px; }
${EE} input.sc-smallcheckbox { margin: 0; }

/* drop-down buttons end their caption in Metal's combo arrow */
${EE} :is(.sc-chunk-button-dropdown, .sc-chunk-gallerybutton)::after { content: none; }
${EE} :is(.sc-chunk-button-dropdown, .sc-chunk-gallerybutton) .sc-chunk-button-label::after {
  content: "";
  display: inline-block;
  width: 8px;
  height: 4px;
  margin: 0 0 1px 4px;
  background: ${art(DOWN, [0, 0])};
}

/* the preview date: a white Metal field between the two arrows */
${EE} .sc-chunk-datepanel { display: flex; align-items: center; height: 50px; margin: 0; padding: 0 2px; border: 0; border-radius: 0; background: none; box-shadow: none; }
${EE} .sc-chunk-datepanel-selector { padding: 2px 6px; border-radius: 0; background: #fff; color: #000; ${flush} }
${EE} .sc-chunk-datepanel-selector * { color: #000; font-family: ${FONT}; }

/* The item path under the ribbon: a Metal toolbar like the tree search, with Metal Go and Edit buttons */
${EE} .sc-breadcrumb {
  display: flex;
  align-items: center;
  gap: 4px;
  box-sizing: border-box;
  height: 32px;
  min-height: 0;
  margin: 0;
  padding: 0 6px;
  background: ${s3};
  border: 0;
  border-top: 1px solid #fff;
  border-bottom: 1px solid ${s1};
  box-shadow: none;
}
${EE} .sc-breadcrumb-item { display: flex; align-items: center; gap: 4px; float: none; height: auto; margin: 0; padding: 0; }
${EE} .sc-breadcrumb-item > * { margin-top: 0; margin-bottom: 0; }
${EE} .sc-breadcrumb-item-path { color: #000; font: bold 12px ${FONT}; text-decoration: none; }
${EE} .sc-breadcrumb-item-path:hover { text-decoration: underline; }
${EE} :is(.sc-breadcrumb-item-button, .sc-breadcrumb-item-action) {
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 22px;
  min-width: 14px;
  padding: 0 2px;
  border: 1px solid transparent;
  border-radius: 0;
  background: none;
}
${EE} .sc-breadcrumb-item-button { width: 22px; }
${EE} :is(.sc-breadcrumb-item-button, .sc-breadcrumb-item-action):hover { background: ${s3}; ${flush} }
${EE} .sc-breadcrumb-item-action .separator_7 { background: ${art(RIGHT)}; }
${EE} .sc-breadcrumb .scContentButton { display: block; height: auto; padding: 0; margin: 0 0 0 4px; }
${EE} .sc-breadcrumb .btn.sc-button { height: 22px; min-width: 60px; padding: 0 10px; line-height: 20px; }

/* ==== Control Panel: a Metal desktop of internal frames, one per group, each a white list of tasks ==== */
${SPX} body:has(.sc-controlpanel-box), ${SPX} body:has(.sc-controlpanel-box) .sc-applicationContent { background: ${p2}; }
${SPX} body:has(.sc-controlpanel-box) .sc-applicationContent { min-height: 100vh; }
${appHeader(`${SPX} body:has(.sc-controlpanel-box)`)}
${SPX} .sc-applicationContent-main { background: none; }
${SPX} .sc-controlpanel-box { margin-top: 20px; }
${internalFrame(`${SPX} .sc-controlpanel-box`, `${SPX} .sc-controlpanel-box-header h4`)}
${SPX} .sc-controlpanel-box-header { margin: 0; padding: 0; color: #000; text-transform: none; }
${SPX} .sc-controlpanel-box-header h4 img { flex: none; width: 16px; height: 16px; margin: 0; }
${SPX} .sc-controlpanel-box-content { box-sizing: border-box; margin: 0; padding: 2px 0; border: 0; border-radius: 0; background: #fff; box-shadow: none; }
${SPX} .sc-controlpanel-box-content li { height: auto; padding: 0; border: 0; }
${SPX} .sc-controlpanel-box-content li a { display: block; padding: 3px 8px; color: #000; font: 12px/16px ${FONT}; text-decoration: none; }
${SPX} .sc-controlpanel-box-content li a:is(:hover, :focus) { background: ${p3}; color: #000; text-decoration: none; }
${SPX} .sc-controlpanel-no-items { color: ${s1}; }
`;

// Launchpad: the internal frame border in Metal's inactive colours, and title panes, inactive (control grey,
// grey bumps) unless listed as selected (primary3, primary bumps). Each starts with the frame icon.
const frameIn = frame.replaceAll(p1, s1).replaceAll(p2, s2);
const pane = (sel) => `${sel} {
  display: flex;
  align-items: center;
  gap: 6px;
  box-sizing: border-box;
  height: 22px;
  padding: 0 0 0 5px;
  background: ${s3};
  border-bottom: 1px solid ${s2};
  color: #000;
  font: bold 12px/21px ${FONT};
  text-transform: none;
  white-space: nowrap;
}
${sel}::before { content: ""; flex: none; width: 16px; height: 16px; background: ${art(WINDOW)}; }
${sel}::after { content: ""; flex: 1; align-self: stretch; min-width: 24px; margin: 4px 5px 5px 0; background: ${bumps("#fff", s1)}; }`;
const paneActive = (sels) => `${sels.join(",\n")} { background: ${p3}; border-bottom-color: ${p2}; }
${sels.map((x) => x + "::after").join(",\n")} { background: ${bumps("#fff", p1)}; }`;
const LP = SURFACE("launchpad"), LPX = `${LP}:not(#sct-ms)`;
const launchpad = `/* Metal Steel: Launchpad. Generated by tools/build-metal-css.cjs.
   A Metal desktop: each group is an internal frame, its applications Metal buttons with their icon. */
${speakCommon(LP, 47)}
${LPX} body, ${LPX} .sc-applicationContent { background: ${p2}; }
${LPX} .sc-applicationContent { min-height: 100vh; }
${LPX} .sc-applicationContent-main { background: none; }
/* The page title sits in the global header: it stands on the title colour like the logo */
${LPX} .sc-applicationHeader { border: 0; background: none; box-shadow: none; }
${LPX} .sc-applicationHeader-row1 { border: 0; }
/* the logo's title-colour block runs on under the page title, which Sitecore fixes at 44px */
${LPX} .sc-globalHeader .sc-globalHeader-startButton { padding-right: 6px; }
${LPX} .sc-applicationHeader-row1.no-breadcrumb .sc-applicationHeader-title { display: flex; align-items: center; top: 0; left: 44px; box-sizing: border-box; height: 47px; padding: 0 8px; background: ${p3}; }
${LPX} .sc-applicationHeader-row1.no-breadcrumb .sc-applicationHeader-title::before { flex: none; }
${LPX} .sc-applicationHeader-title, ${LPX} .sc-applicationHeader-title .sc-text { color: #000; font: bold 12px/24px ${FONT}; }
/* ==== The page is the JFrame's JDesktopPane: the desktop colour under the frame's title pane (the SPEAK
   header), tiled with one JInternalFrame per group and one for the analytics message. The selected frame
   (hovered or holding the focus; the first group otherwise) has the primary3 title pane and the primary
   frame border, the others Metal's inactive grey ones. Frames hold large rollover buttons, a 32px icon
   over the label, as SwingSet's demo launcher did. No title pane carries window buttons: they would not
   work here. ==== */
${LPX} .sc-applicationContent { padding: 0; }
${LPX} .sc-applicationContent-main { min-width: 0; margin: 0; padding: 0; }
${LPX} .sc-applicationContent-main > .row { margin: 0; }
${LPX} [data-sc-id="ColumnPanel1"] {
  display: grid;
  grid-template-columns: minmax(0, max-content) auto;
  justify-content: start;
  align-items: start;
  gap: 12px;
  box-sizing: border-box;
  width: auto;
  min-height: calc(100vh - 48px);
  margin: 0;
  padding: 12px;
  float: none;
}
${LPX} .sc-launchpad {
  grid-column: 1;
  grid-row: 1;
  display: flex;
  flex-wrap: wrap;
  align-items: stretch;
  gap: 12px;
  max-width: none;
  margin: 0;
  padding: 0;
  float: none;
}

/* the internal frames, tiled: frames in a row share its height; inactive unless selected */
${LPX} .sc-launchpad-group {
  --sct-cols: 1;
  display: grid;
  grid-template-columns: repeat(var(--sct-cols), minmax(104px, 1fr));
  align-content: start;
  gap: 4px;
  flex: none;
  box-sizing: border-box;
  min-width: 240px;
  margin: 0;
  padding: 4px 8px 10px;
  border-radius: 0;
  background: ${s3};
  ${frameIn}
}
/* columns for the group's size: up to four, five and six as two rows of three */
${LPX} .sc-launchpad-group:has(> a.sc-launchpad-item:nth-of-type(2)) { --sct-cols: 2; }
${LPX} .sc-launchpad-group:has(> a.sc-launchpad-item:nth-of-type(3)) { --sct-cols: 3; }
${LPX} .sc-launchpad-group:has(> a.sc-launchpad-item:nth-of-type(4)) { --sct-cols: 4; }
${LPX} .sc-launchpad-group:has(> a.sc-launchpad-item:nth-of-type(5)) { --sct-cols: 3; }
${LPX} .sc-launchpad-group:has(> a.sc-launchpad-item:nth-of-type(7)) { --sct-cols: 4; }
${pane(`${LPX} .sc-launchpad-group-title`)}
${LPX} .sc-launchpad-group-title { grid-column: 1 / -1; margin: 0 -4px 6px; }

/* the analytics message: its own frame, the label laid over the frame's top as its title pane */
${LPX} :is([data-sc-id="CustomAnalyticsLabel"], [data-sc-id="FallBackMessageBorder"], [data-sc-id="RowPanelTilesWrapper"]) { grid-column: 2; grid-row: 1; float: none; margin: 0; }
${pane(`${LPX} .sc-text[data-sc-id="CustomAnalyticsLabel"]`)}
${LPX} .sc-text[data-sc-id="CustomAnalyticsLabel"] { position: relative; z-index: 1; margin: 5px 5px 0; }
${LPX} .sc-border[data-sc-id="FallBackMessageBorder"] {
  box-sizing: border-box;
  width: 280px;
  padding: 27px 5px 5px;
  border-radius: 0;
  background: ${s3};
  ${frameIn}
}
${LPX} .sc-border[data-sc-id="FallBackMessageBorder"] :is(.row, [class*="col-"]) { float: none; width: auto; margin: 0; padding: 0; }
${LPX} .sc-border[data-sc-id="FallBackMessageBorder"] .sc-border { min-height: 0; border: 0; background: none; box-shadow: none; }
${LPX} .sc-text[data-sc-id="FallBackMessage"] { position: static; display: block; padding: 6px 8px 8px; color: #000; font: 12px/16px ${FONT}; text-align: left; }

/* the selected frame */
${LPX} .sc-launchpad-group:is(:hover, :focus-within),
${LPX} [data-sc-id="ColumnPanel1"]:not(:has(:is(.sc-launchpad-group, [data-sc-id="FallBackMessageBorder"], [data-sc-id="CustomAnalyticsLabel"]):is(:hover, :focus-within))) .sc-launchpad-group.first,
${LPX} .sc-border[data-sc-id="FallBackMessageBorder"]:hover,
${LPX} .sc-text[data-sc-id="CustomAnalyticsLabel"]:has(+ .sc-border:hover) + .sc-border { ${frame} }
${paneActive([
  `${LPX} .sc-launchpad-group:is(:hover, :focus-within) > .sc-launchpad-group-title`,
  `${LPX} [data-sc-id="ColumnPanel1"]:not(:has(:is(.sc-launchpad-group, [data-sc-id="FallBackMessageBorder"], [data-sc-id="CustomAnalyticsLabel"]):is(:hover, :focus-within))) .sc-launchpad-group.first > .sc-launchpad-group-title`,
  `${LPX} .sc-text[data-sc-id="CustomAnalyticsLabel"]:is(:hover, :has(+ .sc-border:hover))`,
])}

/* the launch buttons: flat until the pointer rolls over them, then Metal's flush border; secondary2 while
   pressed; Metal's primary2 focus rectangle */
${LPX} .sc-launchpad-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  justify-self: center;
  box-sizing: border-box;
  width: 104px;
  height: 78px;
  margin: 0;
  padding: 7px 4px 4px;
  border: 1px solid transparent;
  border-radius: 0;
  background: none;
  box-shadow: none;
  color: #000;
  text-align: center;
  text-decoration: none;
}
${LPX} .sc-launchpad-item:hover { background: ${s3}; box-shadow: none; ${flush} }
${LPX} .sc-launchpad-item:active { background: ${s2}; ${flush} }
${LPX} .sc-launchpad-item:focus { outline: none; }
${LPX} .sc-launchpad-item:focus-visible { outline: 1px solid ${p2}; outline-offset: -4px; }
${LPX} .sc-launchpad-item .icon { flex: none; width: 32px; height: 32px; margin: 0; border-radius: 0; background: none; }
${LPX} .sc-launchpad-item .icon img { display: block; width: 32px; height: 32px; margin: 0; }
${LPX} .sc-launchpad-item .sc-launchpad-text { display: block; float: none; max-width: none; overflow: visible; color: #000; font: bold 12px/14px ${FONT}; white-space: normal; }
`;

const LG = SURFACE("login");
const login = `/* Metal Steel: Identity Server login. Generated by tools/build-metal-css.cjs.
   A Metal internal frame on the desktop colour: a title pane, then the fields and a default button. */
${LG} body, ${LG} .main-wrap { background: ${p2} none; color: #000; font: 12px ${FONT}; }
${internalFrame(`${LG} .main`, `${LG} .main::before`)}
${LG} .main { padding: 4px 4px 20px; }
/* a pseudo-element has no ::after for the bumps: they are its background, masked behind the title */
${LG} .main::before {
  content: "Log in";
  margin: 0 0 16px;
  background: linear-gradient(${p3}, ${p3}) 0 0 / 52px 100% no-repeat, linear-gradient(${p3}, ${p3}) right 0 top 0 / 5px 100% no-repeat,
    ${bumps("#fff", p1)}, ${p3};
  box-shadow: inset 0 4px ${p3}, inset 0 -4px ${p3};
}
${LG} .logo-wrap, ${LG} .login-page { margin: 0 56px; }
${LG} .logo-wrap { margin-bottom: 16px; }
/* the logo is white art: drawn dark on the grey frame */
${LG} .logo-wrap img { filter: brightness(0); opacity: 0.75; }
${LG} label { color: #000; font: bold 12px ${FONT}; }
${LG} .form-control {
  box-sizing: border-box;
  height: 22px;
  padding: 0 4px;
  border-radius: 0;
  background: #fff;
  color: #000;
  font: 12px/20px ${FONT};
  ${flush}
}
${LG} .form-control:focus { outline: none; box-shadow: inset 1px 1px #fff, inset -1px -1px ${s1}; border-color: ${s1} #fff #fff ${s1}; }
${LG} .btn.btn-primary {
  box-sizing: border-box;
  display: block;
  width: auto;
  min-width: 88px;
  height: 26px;
  margin-left: auto;
  padding: 0 14px;
  border-radius: 0;
  background: ${s3};
  color: #000;
  font: bold 12px/24px ${FONT};
  text-transform: none;
  border: 1px solid;
  border-color: ${s1} #fff #fff ${s1};
  box-shadow: inset 1px 1px #fff, inset -1px -1px ${s1}, 0 0 0 1px ${s1};
}
${LG} .btn.btn-primary:is(:hover, :focus) { background: ${s3}; color: #000; }
${LG} .btn.btn-primary:active { background: ${s2}; }
${LG} .btn.btn-primary:focus-visible { outline: 1px solid ${p2}; outline-offset: -4px; }
${LG} input[type="checkbox"] { appearance: none; width: 13px; height: 13px; margin-top: 1px; border: 0; background: ${s3}; box-shadow: ${flushShadow}; }
${LG} input[type="checkbox"]:checked { background: ${art(CHECK, [0, 3])}, ${s3}; }
${LG} .remember-me { color: #000; font: 12px ${FONT}; }
${LG} a, ${LG} .forgot-password { color: #333399; font: 12px ${FONT}; }
${LG} :is(.text-danger, .validation-summary-errors, .field-validation-error) { color: #900; }
`;

const dir = path.join(__dirname, "..", "extension", "themes", "metalsteel");
for (const [name, text] of Object.entries({ shell: css, speak, launchpad, login })) {
  fs.writeFileSync(path.join(dir, `${name}.css`), pixelate(text));
  console.log(`${name}.css: ${(text.length / 1024).toFixed(1)} KB`);
}
