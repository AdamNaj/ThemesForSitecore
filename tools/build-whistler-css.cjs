// Dev tool: writes extension/themes/whistler/{shell,speak,launchpad,login}.css and the glyphs they use.
// Whistler recreates Windows XP's Luna Blue. Its caption buttons, scroll arrows, check marks and chevrons are
// glyphs (PNG plus vector SVG pairs, see art()), so the theme is generated here rather than written by hand.
//
// Measured Luna Blue (XP SP2 at 96 dpi):
//   window face #ece9d8; tab page #fcfcfe; 3D shadow #aca899; tab border #919b9c; Tahoma 8pt (11px)
//   caption 30px with the frame, gradient #0997ff > #0053ee > #0050ee > #0066ff > #003dd7, bold Trebuchet MS
//     13px white with a #0f1089 shadow; top corners 8px; frame 3-4px blue (#0831d9 outer)
//   caption buttons 21x21, 1px white border, 3px radius; close red-orange; glyphs white
//   inactive caption #7a96df > #9db9eb, text #d8e4f8: 3.1:1, fails AA. Whistler darkens the text band to
//     #5470c0 under white text (4.7:1).
//   tabs: white to #ecebe6, border #919b9c, 3px top corners; the open tab #fcfcfe, an orange top line
//     (#e68b2c, then 2px #ffc83c), also shown while hovered
//   push buttons 23px, 1px #003c74 border, 3px radius, white to #d6d0c5; hover an orange inner glow
//     (#ffe8a6 top, #f8b330 bottom), the default button a blue one
//   fields 21px, 1px #7f9db9; combo button light blue with a #4d6185 chevron
//   tree +/- boxes 9x9, 1px #7b9ebd border, white to #e0e0e0 face; selection #316ac5, white text
//   taskbar 30px #245edb gradient; start button green, italic bold; tray light blue (darkened from XP's
//     #18b9f4 to #0b72cc behind the white text: XP's fails AA at 2.9:1)
//   start menu: blue header with the portrait, white left list, #d3e5fa right list, blue footer with Log Off
//   task pane: #7ba2e7 > #6375d6; pane header white > #c6d3f7, bold #215dc6 text; pane body #d6dff7
const fs = require("fs");
const zlib = require("zlib");
const crypto = require("crypto");
const path = require("path");

const ID = "whistler";
const SURFACE = (s) => `html[data-sct-theme="${ID}"][data-sct-surface="${s}"]`;
const P = SURFACE("shell");
// :not(#sct-xp) matches every page; its id weight lets a rule win over Sitecore's id- and class-heavy selectors.
const X = `${P}:not(#sct-xp)`;
// A desktop window's document while another window has the focus (set by dom.js).
const PI = `${P}[data-sct-window="inactive"]`;
const FONT = 'Tahoma, Verdana, "Segoe UI", sans-serif';
const CAPFONT = '"Trebuchet MS", Tahoma, sans-serif';
// Colours of the pixel art: W white, K black, B the scroll and combo arrow blue-grey, G the check mark green,
// N the task pane's chevron blue.
const COLORS = { W: "#fff", K: "#000", B: "#4d6185", G: "#21a121", N: "#215dc6" };

// ---- Pixel art (as in tools/build-metal-css.cjs): one character per pixel, '.' transparent. Each glyph is
// written to themes/whistler/glyphs twice, as a PNG (1x) and as a vector SVG (every other scale), and named
// sct-ext:, which background.js points at the extension (some installs' CSP blocks data:). Placed centred, at
// [x, y] from the box's top left, or, given a number, that many pixels in from the right, centred vertically.
const GLYPHS = path.join(__dirname, "..", "extension", "themes", ID, "glyphs");
fs.rmSync(GLYPHS, { recursive: true, force: true });
fs.mkdirSync(GLYPHS, { recursive: true });
const VECTORS = new Map();
const vector = (rows, body) => VECTORS.set(rows.join("|"), body);
function art(rows, at) {
  const h = rows.length, w = rows[0].length;
  if (rows.some((r) => r.length !== w || /[^.WKBGN]/.test(r))) throw new Error(`bad pixel art: ${rows.join("|")}`);
  // a transparent 1px margin keeps Chrome's softening of an image placed between device pixels off the art
  const pad = ".".repeat(w + 2);
  const name = crypto.createHash("sha1").update(rows.join("|")).digest("hex").slice(0, 10);
  fs.writeFileSync(path.join(GLYPHS, `${name}.png`), png([pad, ...rows.map((r) => `.${r}.`), pad]));
  fs.writeFileSync(path.join(GLYPHS, `${name}.svg`),
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w + 2}" height="${h + 2}" viewBox="-1 -1 ${w + 2} ${h + 2}">${VECTORS.get(rows.join("|")) || squares(rows)}</svg>\n`);
  const pos = Array.isArray(at) ? `${at[0] - 1}px ${at[1] - 1}px` : typeof at === "number" ? `right ${at - 1}px center` : "center";
  const url = (ext) => `url("sct-ext:themes/${ID}/glyphs/${name}.${ext}")`;
  return `image-set(${url("png")} 1x, ${url("svg")} 2x) ${pos} / ${w + 2}px ${h + 2}px no-repeat`;
}
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
// At exactly 100% the PNGs are drawn nearest-neighbour; the property inherits, so a zero-specificity reset
// keeps it off children.
function pixelate(text) {
  const sels = [...text.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .filter((m) => /(^|[;\s])background(-image)?\s*:[^;]*(sct-ext:|var\(--sct-xp-)/.test(m[2]))
    .map((m) => m[1].trim());
  if (!sels.length) return text;
  const all = `:where(html[data-sct-theme="${ID}"] *)`;
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

// ---- Glyphs ----
const MIN = ["WWWWWW", "WWWWWW", "WWWWWW"];
const MAX = ["WWWWWWWWW", "WWWWWWWWW", "WWWWWWWWW", "W.......W", "W.......W", "W.......W", "W.......W", "W.......W", "WWWWWWWWW"];
const RESTORE = [
  "...WWWWWW", "...WWWWWW", "...W....W", "WWWWWW..W", "WWWWWW..W",
  "W....WWWW", "W....W...", "W....W...", "WWWWWW...",
];
const CLOSE = [
  "WW.....WW", "WWW...WWW", ".WWW.WWW.", "..WWWWW..", "...WWW...",
  "..WWWWW..", ".WWW.WWW.", "WWW...WWW", "WW.....WW",
];
vector(CLOSE, `<path d="M0.9 0.9L8.1 8.1M8.1 0.9L0.9 8.1" stroke="#fff" stroke-width="2.3" stroke-linecap="square"/>`);
// scroll and combo arrows: 2px chevrons
const UP = ["...B...", "..BBB..", ".BB.BB.", "BB...BB"];
const DOWN = [...UP].reverse();
const LEFT = ["...B", "..BB", ".BB.", "BB..", ".BB.", "..BB", "...B"];
const RIGHT = LEFT.map((r) => [...r].reverse().join(""));
vector(UP, `<path d="M0.6 3.6L3.5 0.7L6.4 3.6" fill="none" stroke="${COLORS.B}" stroke-width="1.6"/>`);
vector(DOWN, `<path d="M0.6 0.4L3.5 3.3L6.4 0.4" fill="none" stroke="${COLORS.B}" stroke-width="1.6"/>`);
vector(LEFT, `<path d="M3.6 0.6L0.7 3.5L3.6 6.4" fill="none" stroke="${COLORS.B}" stroke-width="1.6"/>`);
vector(RIGHT, `<path d="M0.4 0.6L3.3 3.5L0.4 6.4" fill="none" stroke="${COLORS.B}" stroke-width="1.6"/>`);
// menu fly-out and ribbon drop-down triangles: black
const TRI_RIGHT = ["K...", "KK..", "KKK.", "KKKK", "KKK.", "KK..", "K..."];
const TRI_DOWN = ["KKKKK", ".KKK.", "..K.."];
vector(TRI_RIGHT, `<path d="M0 0L4 3.5L0 7Z" fill="#000"/>`);
vector(TRI_DOWN, `<path d="M0 0H5L2.5 3Z" fill="#000"/>`);
// the check mark: XP's green tick
const CHECK = ["......G", ".....GG", "G...GGG", "GG.GGG.", "GGGGG..", ".GGG...", "..G...."];
vector(CHECK, `<path d="M0.7 3.2L2.5 5.2L6.4 1" fill="none" stroke="${COLORS.G}" stroke-width="2.1"/>`);
// XP's green "go" arrow (All Programs, the Welcome screen's log-in button): white on green
const GO = ["....W..", "....WW.", "WWWWWWW", "WWWWWWW", "....WW.", "....W.."];
// the task pane's collapse and expand chevrons (doubled), in their round button
const DUP = ["...N...", "..NNN..", ".NN.NN.", "NN...NN", "...N...", "..NNN..", ".NN.NN.", "NN...NN"];
const DDOWN = [...DUP].reverse();
vector(DUP, `<path d="M0.6 3.6L3.5 0.7L6.4 3.6M0.6 7.6L3.5 4.7L6.4 7.6" fill="none" stroke="${COLORS.N}" stroke-width="1.5"/>`);
vector(DDOWN, `<path d="M0.6 0.4L3.5 3.3L6.4 0.4M0.6 4.4L3.5 7.3L6.4 4.4" fill="none" stroke="${COLORS.N}" stroke-width="1.5"/>`);

// ---- Luna recipes ----
// Drop-down selects include size="1" ones (SPE's Read-Variable writes it); list boxes are multiple or size > 1.
const CAP = "linear-gradient(#0997ff, #0053ee 8%, #0050ee 40%, #0066ff 88%, #0066ff 93%, #005bff 95%, #003dd7 96%, #003dd7)";
const CAP_IN = "linear-gradient(#9db3e8, #6d89d4 6%, #5470c0 18%, #5470c0 88%, #4a64ad)";
const capText = `color: #fff; font: bold 13px/1 ${CAPFONT}; text-shadow: 1px 1px #0f1089;`;
const BTN_FACE = "linear-gradient(135deg, #79a6fc, #2d68e8 45%, #1d55da 80%, #3f78ef)";
const BTN_CLOSE = "linear-gradient(135deg, #f4a487, #e1552d 45%, #c93a17 80%, #e3643c)";
// a caption button: g is one of the --sct-xp-* glyph-and-face backgrounds
const capBtn = (g) => `box-sizing: border-box; width: 21px; height: 21px; margin: 0; padding: 0; border: 1px solid #fff; border-radius: 3px; ${paint(g)}`;
// the window frame drawn outside an element (a desktop window's iframe): blue rings, dark outside

// tabs
const tab = `border: 1px solid #919b9c; border-bottom: 0; border-radius: 3px 3px 0 0; background: linear-gradient(#fff, #f3f3ef 60%, #ecebe6); box-shadow: none; color: #000; text-transform: none; text-shadow: none;`;
const tabHot = "border-top-color: #e68b2c; box-shadow: inset 0 2px #ffc83c;";
const tabOpen = `background: #fcfcfe; ${tabHot}`;
// push buttons
const push = `box-sizing: border-box; border: 1px solid #003c74; border-radius: 3px; background: linear-gradient(#fff, #f6f5f1 30%, #ecebe6 85%, #d6d0c5); color: #000; text-shadow: none; text-transform: none; box-shadow: none;`;
const pushHot = "box-shadow: inset 0 2px #ffe8a6, inset 0 -2px #f8b330, inset 2px 0 #fcd37a, inset -2px 0 #fcd37a;";
const pushDefault = "box-shadow: inset 0 2px #cee7ff, inset 0 -2px #6982ee, inset 2px 0 #bcd4f6, inset -2px 0 #89ade4;";
const pushDown = "background: linear-gradient(#e5e4de, #e3e2db 85%, #f2f1ec); box-shadow: none;";
const pushOff = "border-color: #c9c7ba; background: #f5f4ea; color: #aca899; box-shadow: none;";
// toolbar buttons (ribbon, header buttons): flat until hovered, then a soft raised face
const toolHot = "border-color: #cecec3; background: linear-gradient(#fff, #f7f6f2 60%, #ebeae3); box-shadow: none;";
const toolDown = "border-color: #9d9d92; background: #e3e3db; box-shadow: inset 1px 1px 2px rgba(0, 0, 0, 0.18);";
// fields
const field = "border: 1px solid #7f9db9; border-radius: 0; background-color: #fff; color: #000; box-shadow: none;";
const comboBtn = `${art(DOWN, 6)}, linear-gradient(135deg, #e3ebfd, #c1d3fb 60%, #b0c6f7) right 1px top 1px / 16px calc(100% - 2px) no-repeat`;
// the scroll bar's thumb and buttons
const scrollFace = (deg) => `linear-gradient(${deg}, #cad9fd, #b8cdf9 45%, #a9c0f4)`;
// task pane
const PANE_BG = "linear-gradient(#7ba2e7, #6375d6)";
const paneHead = `background: linear-gradient(90deg, #fff, #c6d3f7); border-radius: 3px 3px 0 0; color: #215dc6; font: bold 11px/25px ${FONT};`;
const roundChevron = (g) => `${art(g)}, radial-gradient(circle at 50% 50%, #fff 0 8px, #c6d3f7 8.5px 9px, transparent 9.5px)`;
// the Luna selection
const SEL = "background: #316ac5; color: #fff;";

const TABS = (state) => [".scRibbon a.scRibbonNavigatorButtons", ".scRibbon a.scRibbonNavigatorButtonsContextual"].map((s) => `${P} ${s}${state}`).join(",\n");
const RB = 'a[class*="scRibbonToolbar"][class*="Button"]:not(.scRibbonToolbarLargeComboButton > a)';
const LC = ":is(.scRibbonToolbarLargeComboButtonTop, .scRibbonToolbarLargeComboButtonBottom)";

// The global header (standalone Content Editor, SPEAK pages): a Luna caption.
const header = (S) => `/* ---- Global header: a Luna caption ---- */
${S} :is(.sc-globalHeader, .sc-flx-global-header) { background: ${CAP}; border-bottom: 1px solid #003dd7; box-shadow: none; color: #fff; }
${S} :is(.sc-globalHeader, .sc-flx-global-header) .sc-accountInformation li,
${S} :is(.sc-globalHeader, .sc-flx-global-header) .sc-accountInformation span,
${S} :is(.sc-globalHeader, .sc-flx-global-header) .sc-accountInformation a,
${S} :is(.sc-globalHeader, .sc-flx-global-header) a { color: #fff; font-family: ${FONT}; text-shadow: 1px 1px #0f1089; }
${S} :is(.sc-globalHeader, .sc-flx-global-header) .sc-accountInformation li::before, ${S} :is(.sc-globalHeader, .sc-flx-global-header) .sc-accountInformation li::after { color: #fff; }
${S} :is(.sc-globalHeader, .sc-flx-global-header) .sc-accountInformation img { border: 1px solid #fff; border-radius: 3px; }
/* Sitecore's logo is dark art: white on the caption */
${S} :is(.sc-globalHeader, .sc-flx-global-header) .sc-global-logo { filter: brightness(0) invert(1); }
`;

// The application header of a SPEAK page (title, Back): XP's toolbar under the caption.
const appHeader = (SX) => `${SX} .sc-applicationHeader { border: 0; background: #ece9d8; box-shadow: none; }
${SX} .sc-applicationHeader-row1 { display: flow-root; height: auto; min-height: 0; padding: 0; background: #ece9d8; border: 0; }
${SX} .sc-applicationHeader-row1::after { content: none; }
${SX} .sc-applicationHeader-row1 .sc-applicationHeader-content { height: auto; padding: 10px 15px 6px; }
${SX} .sc-applicationHeader-title, ${SX} .sc-applicationHeader-title .sc-text { color: #000; font: bold 16px/22px ${CAPFONT}; }
${SX} .sc-applicationHeader-row2 { display: flow-root; height: auto; min-height: 0; padding: 0 15px 8px; background: #ece9d8; border: 0; border-bottom: 1px solid #aca899; box-shadow: 0 1px #fff; }
${SX} .btn.sc-backbutton { display: inline-flex; align-items: center; gap: 6px; height: 23px; min-width: 0; padding: 0 12px 0 8px; }
${SX} .btn.sc-backbutton .sc-backbutton-text { position: static; min-width: 0; height: auto; margin: 0; padding: 0; color: #000; font: 11px/21px ${FONT}; text-decoration: none; }
${SX} .btn.sc-backbutton:hover .sc-backbutton-text { text-decoration: none; }
${SX} .btn.sc-backbutton::before, ${SX} .btn.sc-backbutton:is(:hover, :active)::before { position: static; flex: none; width: 4px; height: 7px; background: ${art(LEFT, [0, 0])}; mask: none; transform: none; }`;

const css = `/* Whistler: classic shell. Generated by tools/build-whistler-css.cjs; never hand-edit.
   Windows XP's Luna Blue: rounded blue captions, the #ece9d8 window face, orange-topped tabs, Tahoma. */

${P} {
  --sct-xp-min: ${art(MIN, [6, 12])}, ${BTN_FACE};
  --sct-xp-max: ${art(MAX)}, ${BTN_FACE};
  --sct-xp-restore: ${art(RESTORE)}, ${BTN_FACE};
  --sct-xp-close: ${art(CLOSE)}, ${BTN_CLOSE};
}

/* The SPE ISE's Ace editor measures its own monospace font; keep the theme font out of it. */
${P} body, ${P} input, ${P} select, ${P} textarea, ${P} button,
${P} :is(td, a, span, div):not(.ace_editor, .ace_editor *) {
  font-family: ${FONT};
}
${P} { scrollbar-color: auto; }

/* ---- Scrollbars: Luna's light blue thumb and buttons on a pale track (Chrome and Edge) ---- */
${P} ::-webkit-scrollbar { width: 17px; height: 17px; background: #f4f4f0; }
${P} ::-webkit-scrollbar-track { border-radius: 0; }
${P} ::-webkit-scrollbar-track:vertical { background: linear-gradient(90deg, #f3f1ec, #fefefe); }
${P} ::-webkit-scrollbar-track:horizontal { background: linear-gradient(#f3f1ec, #fefefe); }
${P} ::-webkit-scrollbar-thumb, ${P} :is(select, textarea)::-webkit-scrollbar-thumb { border: 0; border-radius: 3px; box-shadow: inset 1px 1px #fff, inset -1px -1px #8eaae6; }
${P} ::-webkit-scrollbar-thumb:vertical, ${P} :is(select, textarea)::-webkit-scrollbar-thumb:vertical { background: ${scrollFace("90deg")}; }
${P} ::-webkit-scrollbar-thumb:horizontal, ${P} :is(select, textarea)::-webkit-scrollbar-thumb:horizontal { background: ${scrollFace("180deg")}; }
${P} ::-webkit-scrollbar-corner { background: #f4f4f0; }
${P} ::-webkit-scrollbar-button:single-button { display: block; border-radius: 3px; box-shadow: inset 1px 1px #fff, inset -1px -1px #8eaae6; }
${P} ::-webkit-scrollbar-button:vertical:single-button { width: 17px; height: 17px; }
${P} ::-webkit-scrollbar-button:horizontal:single-button { width: 17px; height: 17px; }
${P} ::-webkit-scrollbar-button:vertical:decrement { background: ${art(UP)}, ${scrollFace("90deg")}; }
${P} ::-webkit-scrollbar-button:vertical:increment { background: ${art(DOWN)}, ${scrollFace("90deg")}; }
${P} ::-webkit-scrollbar-button:horizontal:decrement { background: ${art(LEFT)}, ${scrollFace("180deg")}; }
${P} ::-webkit-scrollbar-button:horizontal:increment { background: ${art(RIGHT)}, ${scrollFace("180deg")}; }
/* The rule editor's two lists (10.5) carry Sitecore's own ID-weighted scrollbar: Luna's again, at their weight. */
${P} :is(#Conditions, #Description)::-webkit-scrollbar { width: 17px; height: 17px; background: #f4f4f0; }
${P} :is(#Conditions, #Description)::-webkit-scrollbar-thumb { border: 0; border-radius: 3px; background: ${scrollFace("90deg")}; box-shadow: inset 1px 1px #fff, inset -1px -1px #8eaae6; }

${header(P)}
/* ---- Ribbon: XP tabs over a tab page ---- */
${P} .scRibbon, ${P} .scRibbonNavigator { background: #ece9d8; }
${P} .scRibbonNavigator { border-bottom: 0; }
${TABS("Normal")},
${TABS("Active")} {
  ${tab}
  position: relative;
  font: 11px/19px ${FONT};
  padding: 0 10px;
  margin: 0 0 0 -1px;
}
${TABS("Normal:hover")} { ${tabHot} }
/* The open tab runs into the toolbar, over its top line. */
${TABS("Active")} {
  ${tabOpen}
  z-index: 1;
  margin-bottom: -1px;
  padding-bottom: 2px;
}
${P} .scRibbonToolbar { background: linear-gradient(#fcfcfe, #f4f3ee); border-top: 1px solid #919b9c; border-bottom: 1px solid #919b9c; }
${P} .scRibbonToolbar .chunk {
  height: auto;
  background: transparent;
  border: 0;
  border-right: 1px solid #d5d2c1;
  box-shadow: 1px 0 #fff;
  border-radius: 0;
  margin: 3px 2px 3px 0;
}
${P} .scRibbonToolbar .chunk .caption { background: transparent; color: #444; font: 11px ${FONT}; }
${P} .scRibbonToolbar .panel, ${P} .scRibbonToolbar .panel span, ${P} .scRibbonToolbar .panel a { color: #000; font-size: 11px; }
${P} .scRibbonToolbar [class*="scRibbonToolbar"][class*="Button"] { border: 1px solid transparent; border-radius: 3px; }
/* Only the buttons react, not their icons or labels, and disabled buttons (spans) not at all. A large combo
   button shows its command and its drop-down as two faces while hovered, each pressed on its own. */
${P} .scRibbonToolbar ${RB}:hover { ${toolHot} }
${P} .scRibbonToolbar ${RB}:active { ${toolDown} }
${P} .scRibbonToolbar .scRibbonToolbarLargeComboButton:hover > ${LC} { ${toolHot} }
${P} .scRibbonToolbar .scRibbonToolbarLargeComboButton > ${LC}:active { ${toolDown} }
/* Copenhagen-tight on both versions: the strip keeps 1px plus the chunks' 3px margin above and below
   (10.5 pads it 12px over an 80px minimum), the panel 3px above the buttons and 4px at the sides (10.5
   16px, 10.4 10px 8px), a 16px caption, and large buttons cut from 55px to 46px so they end above the
   caption with their hover frame. */
${X} :is(.scRibbonToolbarStrip, .scRibbonToolbarContextualStrip) { display: flow-root; min-height: 0; padding: 1px 0; }
${X} .scRibbonToolbar .chunk > .panel { box-sizing: border-box; height: 52px; padding: 3px 4px 0; }
${X} .scRibbonToolbar .chunk > .caption { height: 16px; padding: 0 4px; line-height: 16px; }
${X} .scRibbonToolbar :is(a.scRibbonToolbarLargeButton, span.scRibbonToolbarLargeButtonDisabled, a.scRibbonToolbarLargeButtonDown, a.scRibbonToolbarLargeGalleryButton, span.scRibbonToolbarLargeGalleryButtonDisabled) { padding: 2px 5px 1px; }
${X} .scRibbonToolbar [class*="scRibbonToolbarLarge"] .header { padding: 3px 4px 1px; }
${X} .scRibbonToolbar :is(.scRibbonGallery, .scRibbonToolbarSmallButtons) { padding: 1px 5px 0; }
${X} .scRibbonToolbar .scRibbonToolbarSmallCheckButton { padding: 3px 4px; }
${X} .scRibbonToolbar :is(.scRibbonToolbarLargeComboButton, .scRibbonToolbarLargeComboButtonDisabled) { padding: 0; }
${X} .scRibbonToolbar [class*="scRibbonToolbarLargeComboButtonTop"] { padding: 0 5px; }
${X} .scRibbonToolbar [class*="scRibbonToolbarLargeComboButtonBottom"] { padding: 0 5px 1px; }

/* ---- Content tree: white, Luna selection, the +/- boxes as real 9px borders ---- */
${P} .scContentTree { background: #fff; }
${P} .scContentTree :is(a, span) { font-size: 11px; }
${P} .scContentTree a.scContentTreeNodeActive { ${SEL} outline: 0; border-radius: 0; }
${P} .scContentTree a.scContentTreeNodeActive span { color: #fff !important; }
${P} .scContentTree a.scContentTreeNodeNormal:hover { background: transparent; text-decoration: underline; }
${P} img[src*="/treemenu_"] {
  box-sizing: border-box;
  width: 9px;
  height: 9px;
  margin: 4px 3px 3px 4px;
  border: 1px solid #7b9ebd;
  border-radius: 1px;
  object-fit: none;
  object-position: -999px -999px;
}
/* Default.css gives tree glyphs a 5px 0 margin */
${P} .scContentTreeNode > img[src*="/treemenu_"] { margin: 9px 3px 8px 4px; }
${P} img[src*="/treemenu_collapsed"] {
  background: linear-gradient(#000, #000) center / 1px 5px no-repeat, linear-gradient(#000, #000) center / 5px 1px no-repeat, linear-gradient(#fff, #fff 40%, #e0ddd2);
}
${P} img[src*="/treemenu_expanded"] { background: linear-gradient(#000, #000) center / 5px 1px no-repeat, linear-gradient(#fff, #fff 40%, #e0ddd2); }

/* ---- Editor ---- */
${P} .scEditorHeaderTitle { font: bold 14px ${CAPFONT}; color: #000; }
${P} a.scRibbonEditorTabActive, ${P} a.scRibbonEditorTabNormal, ${P} a#BTAddNewSearch, ${P} a#BTAddNewSearch:hover {
  ${tab}
  height: 21px;
  margin: 35px 0 0 -1px;
}
${P} a.scRibbonEditorTabNormal:hover, ${P} a#BTAddNewSearch:hover { ${tabHot} }
${P} a.scRibbonEditorTabActive { ${tabOpen} position: relative; z-index: 1; height: 23px; }
${P} #EditorTabs { height: 57px; border-bottom: 1px solid #919b9c; }
${P} a#BTAddNewSearch { width: 30px; }
${P} .scEditorTabHeaderActive, ${P} .scEditorTabHeaderNormal {
  background-color: transparent;
  color: #000;
  font: 11px ${FONT};
  border: 0;
  height: 21px;
  line-height: 21px;
  padding: 0 10px;
}
/* sections: XP's task pane headers, white to blue, bold blue titles, the round chevron button */
${P} .scEditorSectionCaptionExpanded, ${P} .scEditorSectionCaptionCollapsed {
  ${paneHead}
  line-height: 25px;
  padding: 0 0 0 10px;
  margin: 0 0 2px;
  border: 0;
}
${P} :is(.scEditorSectionCaptionExpanded, .scEditorSectionCaptionCollapsed):hover { color: #428eff; }
${P} img.scEditorSectionCaptionGlyph { width: 19px; height: 19px; margin: 3px 4px 0 0; }
${P} img.scEditorSectionCaptionGlyph[src*="accordion_up"] { ${paint(roundChevron(DUP))} }
${P} img.scEditorSectionCaptionGlyph[src*="accordion_down"] { ${paint(roundChevron(DDOWN))} }
${P} .scEditorFieldLabel { color: #000; font: 11px ${FONT}; }

/* ---- Fields: white, a 1px #7f9db9 border ---- */
${P} .scContentControl,
${P} .scSearchInput,
${P} input:is([type="text"], [type="password"], [type="search"], [type="number"], [type="email"], [type="url"], :not([type])),
${P} textarea,
${P} select { ${field} }
${P} select:not([multiple], [size]:not([size="0"], [size="1"])) { appearance: none; padding-right: 20px; background: ${comboBtn}, #fff; }
${X} input[type="checkbox"], ${X} input[type="radio"] {
  appearance: none;
  box-sizing: border-box;
  width: 13px;
  height: 13px;
  margin: 0 4px 0 0;
  vertical-align: -2px;
  border: 1px solid #1c5180;
  border-radius: 0;
  background: linear-gradient(135deg, #dcdcd7, #fff 75%);
  box-shadow: none;
}
${X} input[type="radio"] { border-radius: 50%; }
${X} input[type="checkbox"]:checked { background: ${art(CHECK)}, linear-gradient(135deg, #dcdcd7, #fff 75%); }
${X} input[type="radio"]:checked { background: radial-gradient(circle, #55d551 0, #21a121 2.5px, transparent 3.2px), linear-gradient(135deg, #dcdcd7, #fff 75%); }
${X} :is(input[type="checkbox"], input[type="radio"]):hover:not(:disabled) { box-shadow: inset 0 0 0 1px #fcc87a, inset 0 0 0 2px #f8b636; }
${X} :is(input[type="checkbox"], input[type="radio"]):disabled { border-color: #cac8bb; background: #fff; opacity: 1; }
${P} :is(input[type="checkbox"], input[type="radio"]):focus-visible { outline: 1px dotted #000; outline-offset: 1px; }

/* ---- Push buttons: Luna's rounded face; an orange glow while hovered, a blue one on the default ---- */
${P} .scButton, ${P} button:not(.ui-button), ${P} input[type="button"], ${P} input[type="submit"] { ${push} font: 11px ${FONT}; }
${P} :is(.scButton, button:not(.ui-button), input[type="button"], input[type="submit"]):hover:not(:disabled) { ${pushHot} }
${P} .scButtonPrimary { ${pushDefault} }
${P} :is(.scButton, button:not(.ui-button), input[type="button"], input[type="submit"]):active:not(:disabled) { ${pushDown} }
${P} :is(.scButton, button:not(.ui-button), input[type="button"], input[type="submit"]):disabled { ${pushOff} }
${P} .scButton:focus-visible, ${P} button:focus-visible { outline: 1px dotted #000; outline-offset: -4px; }

/* ---- Bottom application tabs: XP tabs hanging from the bottom edge ---- */
${P} .scPager { width: auto; margin: 0; border: 0; border-radius: 0; padding: 0 4px 3px; background: #ece9d8; border-top: 1px solid #919b9c; }
${P} .scPagerButtonNormal, ${P} .scPagerButtonActive {
  color: #000;
  font: 11px ${FONT};
  background: linear-gradient(#ecebe6, #f3f3ef 40%, #fff);
  border: 1px solid #919b9c;
  border-top: 0;
  border-radius: 0 0 3px 3px;
  box-shadow: none;
  margin: 0 0 0 -1px;
}
${P} .scPagerButtonNormal:hover { border-bottom-color: #e68b2c; box-shadow: inset 0 -2px #ffc83c; }
${P} .scPagerButtonActive { background: #fcfcfe; border-bottom-color: #e68b2c; box-shadow: inset 0 -2px #ffc83c, 0 -1px #fcfcfe; position: relative; z-index: 1; }

/* ---- Dialog windows: an XP window. The page inside the dialog draws the caption (its header); Sitecore's
   empty jQuery title bar is laid over it, keeping the drag and carrying the caption buttons. ---- */
${P} .ui-dialog {
  background: #ece9d8;
  border: 3px solid #0d55e2;
  border-top: 0;
  border-radius: 8px 8px 0 0;
  padding: 0;
  overflow: hidden;
  box-shadow: 0 0 0 1px #0831d9, 2px 3px 8px rgba(0, 0, 0, 0.35);
}
/* The token layer's .ui-widget-content border (#aca899) outranks P: a greige band between the caption and the
   blue edge. Behind the caption's rounded corners the face is frame blue, so the clip blends blue into blue. */
${X} .ui-dialog { border-color: #0d55e2; background: linear-gradient(#0d55e2 0 28px, #ece9d8 0); }
${P} .ui-dialog .ui-dialog-titlebar {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 28px;
  min-height: 0;
  padding: 0;
  z-index: 2;
  background: transparent;
  border: 0;
  border-radius: 0;
}
${P} .ui-dialog .ui-dialog-titlebar-buttonpane {
  top: 4px !important;
  right: 3px !important;
  margin: 0 !important;
  height: 21px;
  display: flex;
  gap: 2px;
}
${P} .ui-dialog .ui-dialog-titlebar-buttonpane > * {
  box-sizing: border-box;
  width: 21px;
  height: 21px;
  margin: 0;
  padding: 0;
  border: 1px solid #fff;
  border-radius: 3px;
  box-shadow: none;
  overflow: hidden;
  text-indent: -999px;
}
${P} .ui-dialog .ui-dialog-titlebar-buttonpane > * > * { display: none; }
${P} .ui-dialog .ui-dialog-titlebar-buttonpane > button.ui-button {
  position: static !important;
  float: none !important;
  order: 9;
  margin: 0 !important;
  background: var(--sct-xp-close);
}
${P} .ui-dialog .ui-dialog-titlebar-maximize { background: var(--sct-xp-max); }
${P} .ui-dialog .ui-dialog-titlebar-restore { background: var(--sct-xp-restore); }
${P} .ui-dialog .ui-dialog-titlebar-minimize { background: var(--sct-xp-min); }
${P} .ui-dialog .ui-dialog-titlebar-collapse { background: ${art(["WWWWWWW", ".WWWWW.", "..WWW..", "...W..."])}, ${BTN_FACE}; }
${P} .ui-dialog .ui-dialog-titlebar-buttonpane > :hover { filter: brightness(1.15); }
${P} .ui-dialog .ui-dialog-titlebar-buttonpane > :active { filter: brightness(0.85); }
/* a faint shade marks the dialog as modal */
${P} .ui-widget-overlay { background: rgba(0, 0, 0, 0.18); opacity: 1; }

/* Inside a dialog page: the header is the caption, the window's icon, then the title. */
${P} :is(.scFormDialogHeader, .scDialogHeader) { background: #ece9d8; padding: 0; border: 0; min-height: 0 !important; }
/* the dialog page's header, and the ListView's, which SPE puts straight in the jQuery dialog */
${P} :is(:is(.scFormDialogHeader, .scDialogHeader) .DialogHeader, .ui-dialog > .DialogHeader) {
  display: flex;
  align-items: center;
  gap: 5px;
  box-sizing: border-box;
  height: 28px;
  margin: 0;
  padding: 0 80px 0 7px;
  background: ${CAP};
  border: 0;
  border-radius: 0;
  ${capText}
  line-height: 28px;
  white-space: nowrap;
}
${P} .DialogHeader #DialogIcon { width: 16px; height: 16px; margin: 0; }
${P} :is(.scFormDialogHeader, .scDialogHeader) .DialogHeaderDescription { color: #000; padding: 8px 10px; margin: 0; font: 11px ${FONT}; background: #fff; border-bottom: 1px solid #aca899; }
${P} .scFormDialogContent, ${P} .scFormDialogFooter, ${P} .scDialogContentContainer { background: #ece9d8; }
${P} .scFormDialogFooter { border-top: 0; border-radius: 0; }
${X} .scDialogContentContainer { padding: 8px; }
${X} .scFormDialogFooter { height: 39px; padding: 8px; line-height: normal; }
${X} .scFormDialogFooter .footerOkCancel { position: static; float: right; }
/* SPE's help (?) floats for 10.x's taller footer: centred on the 23px buttons instead */
${X} .scFormDialogFooter img#Copyright { margin: 0; }

/* ---- Tab strips (dialogs, the ISE's script tabs) ---- */
${P} .scTabstrip [class*="scTabActive"]::after { display: none; }
${P} .scTabstrip, ${P} .scTabstrip > nobr { display: flex; align-items: flex-end; }
${P} .scTabstrip { border-bottom: 1px solid #919b9c; }
/* Sitecore swaps scTab for scTab_Hover under the mouse; the stock hover class is uppercase on a light face. */
${P} .scTabstrip :is(.scTab, .scTab_Hover), ${P} .scTabstrip [class*="scTabActive"] {
  ${tab}
  height: auto;
  padding: 0 10px;
  margin: 0 0 0 -1px;
  font: 11px/19px ${FONT};
}
${P} .scTabstrip .scTab_Hover { ${tabHot} }
${P} .scTabstrip [class*="scTabActive"] { ${tabOpen} position: relative; z-index: 1; padding-bottom: 2px; margin-bottom: -1px; }
/* The open first tab lines up with the page's left edge and keeps the tabs' own border: Sitecore styles the first
   <nobr>'s open tab apart (its own border colour, position: static), and the colour map copies that over the theme's */
${X} .scTabstrip > nobr:first-child > [class*="scTabActive"] { position: relative; left: 0; border-left-color: #919b9c; }
/* focus: XP's dotted rectangle inside the tab, never Sitecore's black frame */
${X} .scTabstrip :is(.scTab, .scTab_Hover, [class*="scTabActive"]):focus { outline: none; box-shadow: none; }
${X} .scTabstrip [class*="scTabActive"]:focus { ${tabHot} }
${X} .scTabstrip :is(.scTab, .scTab_Hover, [class*="scTabActive"]):focus-visible { outline: 1px dotted #000; outline-offset: -4px; }
${P} .scTabstrip .closeTab { margin: 0 -2px 0 6px; }
/* the ISE's unsaved-script dot, darkened from SPE's #fc2929 to pass AA on the tab */
${P} .scTabstrip .scriptModified { color: #c4291c; }

/* ---- Window buttons (Desktop windows and the Content Editor's own): Luna's caption buttons ---- */
${P} :is(.scSystemButtons, .standartWindowButtons, .scWorkboxWindowButtons) { display: flex; align-items: center; gap: 2px; }
${P} .scSystemButtons { margin-right: 6px; }
${P} :is(.scSystemButtons, .standartWindowButtons, .scWorkboxWindowButtons) img { vertical-align: middle; filter: none; }
${P} :is(.scSystemButtons, .standartWindowButtons, .scWorkboxWindowButtons) img[src*="minimize"] { ${capBtn("var(--sct-xp-min)")} }
${P} :is(.scSystemButtons, .standartWindowButtons, .scWorkboxWindowButtons) img[src*="maximize"] { ${capBtn("var(--sct-xp-max)")} }
${P} :is(.scSystemButtons, .standartWindowButtons, .scWorkboxWindowButtons) img[src*="restore"] { ${capBtn("var(--sct-xp-restore)")} }
${P} :is(.scSystemButtons, .standartWindowButtons, .scWorkboxWindowButtons) img[src*="_close"] { ${capBtn("var(--sct-xp-close)")} }
${P} :is(.scSystemButtons, .standartWindowButtons, .scWorkboxWindowButtons) img:is([src*="minimize"], [src*="maximize"], [src*="restore"], [src*="_close"]):hover { filter: brightness(1.15); }
${P} :is(.scSystemButtons, .standartWindowButtons, .scWorkboxWindowButtons) img:is([src*="minimize"], [src*="maximize"], [src*="restore"], [src*="_close"]):active { filter: brightness(0.85); }
/* Standard windows (ISE, Console, Package Designer...): a Luna caption with rounded top corners. */
${P} .standardWindowCaption {
  height: 28px;
  background: ${CAP};
  border: 0;
  border-radius: 7px 7px 0 0;
}
/* Around the caption: the window's 1px #7f9db9 frame and the #d6dff7 body behind the rounded corners showed as
   a pale line between the caption and XP's blue frame. Both frame blue; the caption's 7px corners sit 1px inside
   the Desktop window's 8px clip. Workbox draws its own 1px sides (scWindowBorder2). */
${X} .scWindowFrame, ${X} .scWindowBorder2 { border-color: #0d55e2; }
${X} .scWindowFrame > .scStretch { background-color: #0d55e2; }
${PI}:not(#sct-xp) .scWindowFrame, ${PI}:not(#sct-xp) .scWindowBorder2 { border-color: #7a96df; }
${PI}:not(#sct-xp) .scWindowFrame > .scStretch { background-color: #7a96df; }
${P} .standardWindowCaption + .windowPlaceholderContainer { top: 28px; }
${P} .standardWindowCaption .windowCaptionIcon { display: inline-block; vertical-align: top; margin: 6px 0 0 6px; }
${P} .standardWindowCaption .scWindowCaption {
  display: inline-block;
  ${capText}
  line-height: 28px;
  padding: 0 6px;
  vertical-align: top;
}
${P} .standardWindowCaption .scWindowCaption * { font: inherit; }
/* The ISE writes its script's path into the caption in an inline #bbb: a light blue that reads on the caption. */
${P} .standardWindowCaption .scWindowCaption i { color: #c9dcff !important; }
${P} .standartWindowButtons { top: 4px; right: 5px; }
/* An inactive window (dom.js marks its document from the taskbar): the inactive caption, darkened to pass AA. */
${PI} .standardWindowCaption { background: ${CAP_IN}; }
${PI} .standardWindowCaption .scWindowCaption { text-shadow: none; }
/* an inactive window's buttons fade, on every kind of window */
${PI} :is(.standartWindowButtons, .scSystemButtons, .scWorkboxWindowButtons) img { filter: saturate(0.5) brightness(1.1); }
/* The Content Editor, Media Library and Workbox: Sitecore draws no caption over their windows. A Luna caption, as on every other window, is
   drawn on the caption's empty top line from the window's title (engine.js --sct-window-title), the window's
   buttons on it and the ribbon's menu button moved below it. */
${P}[data-sct-window-title] .scWindowBorder2 > .scCaption > #CaptionTopLine, ${P}[data-sct-window-title] .scWorkboxWindowCaption.scWindowHandle { box-sizing: border-box; height: 28px; background: ${CAP}; border-radius: 7px 7px 0 0; }
${P}[data-sct-window-title] .scWindowBorder2 > .scCaption > #CaptionTopLine::before, ${P}[data-sct-window-title] .scWorkboxWindowCaption.scWindowHandle::before { content: var(--sct-window-title, ""); display: block; box-sizing: border-box; height: 28px; padding: 0 96px 0 28px; background: var(--sct-window-icon, none) 6px center / 16px 16px no-repeat; ${capText} line-height: 28px; text-align: left; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
${P}[data-sct-window-title] .scWindowBorder2 > .scCaption > .scSystemButtons, ${P}[data-sct-window-title] .scWorkboxWindowButtons { top: 4px; right: 5px; margin-right: 0; height: 20px; z-index: 2; }
/* the Workbox's buttons float in its caption strip: placed on the bar like the Content Editor's */
${P}[data-sct-window-title] .scWorkboxWindowCaption.scWindowHandle { position: relative; }
${P}[data-sct-window-title] .scWorkboxWindowButtons { position: absolute; float: none; }
/* Under the bar the tabs start at its foot: the empty header over the tab group (17px, for a contextual group's
   name) goes while no contextual group shows, and the menu button, 17px down and 30px tall for that band, moves
   up into the tab row at the row's height */
${P}[data-sct-window-title] .scWindowBorder2 > .scCaption > #SystemMenu { top: 0; margin-top: 28px; height: 21px; }
${P}[data-sct-window-title] .scWindowBorder2 > .scCaption .scRibbonNavigator:not(:has(.scRibbonNavigatorButtonsContextualGroup)) .scRibbonNavigatorButtonsGroupHeader { display: none; }
/* 4px between the title bar and the tabs: they never touch it; the menu button moves down with them */
${P}[data-sct-window-title] .scWindowBorder2 > .scCaption .scRibbonNavigator { padding-top: 4px; }
${P}[data-sct-window-title] .scWindowBorder2 > .scCaption > #SystemMenu { translate: 0 4px; }
/* the same 4px on a standard window (the ISE...), whose ribbon is in the page inside the window's chrome */
${P}[data-sct-window-content] .scRibbonNavigator { padding-top: 4px; }
${PI}[data-sct-window-title] .scWindowBorder2 > .scCaption > #CaptionTopLine, ${PI}[data-sct-window-title] .scWorkboxWindowCaption.scWindowHandle { background: ${CAP_IN}; }
${PI}[data-sct-window-title] .scWindowBorder2 > .scCaption > #CaptionTopLine::before, ${PI}[data-sct-window-title] .scWorkboxWindowCaption.scWindowHandle::before { text-shadow: none; }


/* ---- Insert gallery scroller ---- */
${P} .scRibbonPanelButtons { background: transparent; }
${P} :is(img.scRibbonPanelUp, img.scRibbonPanelDown, img.scRibbonPanelOpen) { width: 17px; height: 15px; filter: none; border-radius: 2px; box-shadow: inset 1px 1px #fff, inset -1px -1px #8eaae6; }
${P} img.scRibbonPanelUp { ${paint(`${art(UP)}, ${scrollFace("90deg")}`)} }
${P} img.scRibbonPanelDown { ${paint(`${art(DOWN)}, ${scrollFace("90deg")}`)} }
${P} img.scRibbonPanelOpen { ${paint(`${art(["BB.BB.BB", "BB.BB.BB"])}, ${scrollFace("90deg")}`)} }

/* ==== Desktop: Bliss under the taskbar ==== */
/* XP had no header above the desktop: the start menu takes over the user name and Log Off (dom.js). */
${X}:has(#Desktop) .sc-globalHeader { display: none; }
${X}:has(#Desktop) .sc-globalHeader ~ :is(div, table) { padding-top: 0; }
${X}:has(#Desktop) .sc-globalHeader ~ div > .DesktopArea { margin-top: 0; }
${X} .DesktopArea {
  top: 0;
  bottom: 34px;
  overflow: clip;
  overflow-clip-margin: border-box;
  /* a rolling green hill under a blue sky with soft clouds; Sitecore sets its wallpaper inline */
  background:
    radial-gradient(ellipse 34% 9% at 22% 20%, rgba(255, 255, 255, 0.55), transparent 70%),
    radial-gradient(ellipse 22% 6% at 62% 12%, rgba(255, 255, 255, 0.45), transparent 70%),
    radial-gradient(ellipse 28% 7% at 82% 30%, rgba(255, 255, 255, 0.35), transparent 70%),
    radial-gradient(ellipse 120% 62% at 30% 118%, #5aa02c 0 50%, transparent 50.4%),
    radial-gradient(ellipse 120% 62% at 30% 118%, #79bd3d 0 52%, transparent 54%),
    radial-gradient(ellipse 90% 50% at 100% 118%, #3f7f1e 0 46%, transparent 46.5%),
    linear-gradient(#1f5fd0, #3d86e6 30%, #79b4f0 58%, #b9d9f7 74%, #d8ecfb) !important;
}
${X} .DesktopArea > :is(iframe, div[id^="FRAME"]) { top: 0; }

/* ---- Taskbar: Luna blue, 34px (XP's 30px read as cramped next to Sitecore's larger windows) ---- */
${X} .scStartbar { height: 34px; }
${X} #Startbar, ${X} #Startbar > table {
  height: 34px;
  background: linear-gradient(#3168d5, #4993e6 3%, #2157d7 10%, #2663e0 50%, #245edb 92%, #1941a5);
  border: 0;
  box-shadow: none;
}
${X} #Startbar > table > tbody > tr > td { height: 34px; padding: 0; border: 0; vertical-align: middle; }
/* the start button's cell: Sitecore sizes it 0px wide and lets the button overflow into the window list */
${X} .scStartButtonContainer { width: 108px; height: 34px; }
/* the start button: green, rounded on the right, "start" in white italics */
${X} .scStartButton, ${X} .scStartButton.scPopupOpener, ${X} .scStartButton:hover {
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 98px;
  height: 34px;
  padding: 0 12px 2px 6px;
  border: 0;
  border-radius: 0 12px 12px 0;
  background: linear-gradient(#5eac56, #3c9c3c 10%, #41a541 18%, #349734 60%, #2f8a2f 88%, #2d7f2d);
  box-shadow: inset -1px 0 #7cc174, inset 0 1px #79c071, 1px 0 2px rgba(0, 0, 0, 0.4);
}
${X} .scStartButton::after {
  content: "start";
  color: #fff;
  font: italic bold 18px/1 ${CAPFONT};
  text-shadow: 1px 1px 1px #1a4d1a;
}
${X} .scStartButton:hover { filter: brightness(1.1); }
${X} .scStartButton.scPopupOpener { background: linear-gradient(#3b8a36, #2c7a2a 15%, #297226 85%, #24691f); box-shadow: inset 1px 1px 2px rgba(0, 0, 0, 0.45); filter: none; }
${X} .scStartButton:focus-visible { outline: 1px dotted #fff; outline-offset: -4px; }
${X} .scStartBarScroller { height: 34px; padding: 0; border: 0; display: flex; align-items: center; }
${X} #StartbarApplications { height: 26px; margin: 0; border-spacing: 3px 0; }
${X} :is(.scActiveApplication, .scInactiveApplication) {
  box-sizing: border-box;
  height: 26px;
  max-width: 160px;
  padding: 0 8px;
  border: 1px solid #1c50c0;
  border-radius: 3px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
${X} .scInactiveApplication { background: linear-gradient(#5d9bf8, #3c81f3 15%, #3a7ef0 85%, #2f6fdf); box-shadow: inset 1px 1px rgba(255, 255, 255, 0.35); }
${X} .scInactiveApplication:hover { background: linear-gradient(#6faaff, #53a3ff 15%, #4f99fb 85%, #4085f0); }
${X} .scActiveApplication { background: #1e52b7; box-shadow: inset 1px 1px 3px rgba(0, 0, 0, 0.5); border-color: #10347f; }
${X} .scInactiveApplication::before, ${X} .scInactiveApplication::after { display: none; }
${X} :is(.scActiveApplication, .scInactiveApplication) * { color: #fff; font: 11px/24px ${FONT}; text-shadow: none; }
${X} .scStartBarApplication span img { margin: 0 4px 0 0 !important; vertical-align: middle; }
/* the tray: light blue, darkened under the white text (XP's #18b9f4 fails AA) */
${X} .scStartbarTray {
  height: 34px;
  border: 0;
  border-left: 1px solid #092e7b;
  background: linear-gradient(#0c59b9, #1185de 4%, #0b72cc 20%, #0b72cc 85%, #1a64c0);
  box-shadow: inset 1px 0 #1ba1ec;
}
${X} .scStartbarTray > tbody > tr > td { height: 34px; padding: 0 0 0 6px; line-height: 34px !important; vertical-align: middle; }
${X} .scStartbarTray, ${X} .scStartbarTray * { color: #fff; font: 11px ${FONT}; }
${X} #SearchBox { box-sizing: border-box; width: 150px; height: 20px; min-height: 0; margin: 0; padding: 0 4px; ${field} font: 11px ${FONT}; }
${X} #SearchBox::placeholder { color: #6d6d6d; }
${X} #DatabaseSelector { display: inline-flex; vertical-align: top; align-items: center; height: 34px; padding: 0 4px; border-radius: 0; background: transparent; }
${X} #DatabaseSelector img { width: 16px; height: 16px; margin: 0 4px 0 0 !important; }
${X} .sct-xp-clock { padding: 0 10px 0 6px !important; white-space: nowrap; color: #fff; font: 11px ${FONT}; }

/* ---- Start menu: XP's two columns between the blue header and footer (dom.js adds both) ---- */
${X} .scPopup:has(> .scStartMenu) { padding: 0; border: 0; border-radius: 8px 8px 0 0; box-shadow: 2px 2px 6px rgba(0, 0, 0, 0.45); background: transparent; overflow: hidden; }
${X} .scStartMenu {
  box-sizing: border-box;
  width: 400px;
  padding: 0;
  border: 0;
  border-radius: 8px 8px 0 0;
  background: #1c64de;
  box-shadow: none;
  overflow: hidden;
  font-family: ${FONT};
}
${X} .sct-xp-smtop {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 56px;
  padding: 0 10px;
  background: linear-gradient(#1868ce, #0e60cb 15%, #2b7be6 30%, #1b6ed9 70%, #0f5ac4 90%, #1857c2);
  border-bottom: 2px solid #e18d39;
  box-shadow: 0 1px #f8c26d;
}
${X} .sct-xp-smtop img { box-sizing: border-box; width: 44px; height: 44px; border: 2px solid #fff; border-radius: 3px; background: #d6dff7; object-fit: cover; }
${X} .sct-xp-smtop span { overflow: hidden; color: #fff; font: bold 14px/1.2 ${CAPFONT}; text-shadow: 1px 1px 1px #0f1089; text-overflow: ellipsis; white-space: nowrap; }
${X} .scStartMenuContent { margin: 0 2px; border: 0; background: #fff; }
${X} .scStartMenuContentColumns { width: 100%; border: 0; border-collapse: collapse; table-layout: fixed; }
${X} .scStartMenuLeft, ${X} .scStartMenuRight { padding: 4px 0; vertical-align: top; }
${X} .scStartMenuLeft { width: 50%; background: #fff; }
${X} .scStartMenuRight { background: #d3e5fa; border-left: 1px solid #95bdee; }
${X} :is(.scStartMenuLeft, .scStartMenuRight) * { color: #000; font-family: ${FONT}; }
${X} .scStartMenuRight * { color: #00136b; }
${X} :is(.scStartMenuLeftOption, .scStartMenuRightFolder) {
  box-sizing: border-box;
  display: flex;
  align-items: center;
  min-height: 0;
  height: auto;
  margin: 0;
  padding: 3px 6px;
  border: 0;
  border-radius: 0;
  background: transparent;
  text-decoration: none;
  white-space: nowrap;
}
${X} .scStartMenuLeft .scStartMenuLeftOption { height: 40px; }
${X} .scStartMenuRight :is(.scStartMenuLeftOption, .scStartMenuRightFolder) { height: 28px; }
${X} .scStartMenuLeftOptionIcon { flex: none; width: 32px; height: 32px; margin: 0 6px 0 0; float: none; }
${X} .scStartMenuRight :is(.scStartMenuLeftOptionIcon, .scStartMenuRightFolderIcon) { width: 24px; height: 24px; }
${X} .scStartMenuLeftOptionDescription { min-width: 0; overflow: hidden; }
${X} :is(.scStartMenuLeftOptionDisplayName, .scStartMenuRightFolderDisplayName) { padding: 0; font: bold 11px/14px ${FONT}; overflow: hidden; text-overflow: ellipsis; }
${X} .scStartMenuRight :is(.scStartMenuLeftOptionDisplayName, .scStartMenuRightFolderDisplayName) { font-weight: normal; }
${X} .scStartMenuLeftOptionTooltip { color: #555 !important; font: 11px/14px ${FONT}; overflow: hidden; text-overflow: ellipsis; }
${X} .scStartMenuRight .scStartMenuLeftOptionTooltip { display: none; }
${X} :is(.scStartMenuLeftOption, .scStartMenuRightFolder, .scStartMenuProgramsMenu):is(:hover, .scPopupOpener) { ${SEL} border: 0; padding: 3px 6px; }
${X} :is(.scStartMenuLeftOption, .scStartMenuRightFolder, .scStartMenuProgramsMenu):is(:hover, .scPopupOpener) > :not(table) { color: #fff !important; }
${X} .scStartMenuRightFolderDisplayName { flex: 1; }
${X} .scStartMenuDivider { height: 1px; margin: 3px 8px; border: 0; background: linear-gradient(90deg, transparent, #c5c2b2 20% 80%, transparent); }
${X} .scStartMenuRight .scStartMenuDivider { background: linear-gradient(90deg, transparent, #95bdee 20% 80%, transparent); }
${X} img.scStartMenuRightFolderGlyph { ${paint(art(TRI_RIGHT))} order: 2; width: 8px; height: 9px; margin: 0 0 0 6px; float: none; }
${X} .scStartMenuRightFolder:is(:hover, .scPopupOpener) img.scStartMenuRightFolderGlyph { filter: invert(1); }
/* All Applications: XP's All Programs, bold, with the green arrow after it */
${X} .scStartMenuPrograms { padding: 0 0 4px; background: #d3e5fa; border-left: 1px solid #95bdee; vertical-align: bottom; }
${X} .scStartMenuPrograms .scStartMenuDivider { margin: 0 8px 4px; }
${X} .scStartMenuProgramsMenu { display: flex; align-items: center; justify-content: center; gap: 8px; height: 28px; padding: 3px 6px; color: #000; text-decoration: none; }
${X} .scStartMenuProgramsMenuText { color: #000; font: bold 11px/16px ${FONT}; }
${X} img.scStartMenuProgramsGlyph { order: 2; box-sizing: border-box; width: 19px; height: 19px; margin: 0; border: 1px solid #fff; border-radius: 3px; ${paint(`${art(GO)}, linear-gradient(135deg, #7fd36a, #3c9c3c 50%, #2d7f2d)`)} }
${X} .sct-xp-smbottom {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 4px;
  height: 36px;
  padding: 0 8px;
  background: linear-gradient(#4282d6, #3b85e0 10%, #418ae3 30%, #3881dc 70%, #1c64de);
}
${X} .sct-xp-smbottom a { display: flex; align-items: center; gap: 5px; padding: 3px 6px; border-radius: 3px; color: #fff; font: 11px ${FONT}; text-decoration: none; }
${X} .sct-xp-smbottom a:hover { background: rgba(255, 255, 255, 0.2); }
${X} .sct-xp-smbottom a img { width: 24px; height: 24px; }

/* ==== Where 10.x's own metrics (34-36px controls, 6px corners, soft shadows) outrank the rules above. ==== */

/* ---- Fields: 21px ---- */
${X} input:is([type="text"], [type="password"], [type="search"], [type="number"], [type="email"], [type="url"], :not([type])),
${X} select:not([multiple], [size]:not([size="0"], [size="1"])) {
  box-sizing: border-box;
  height: 21px;
  min-height: 0;
  padding: 0 3px;
  font: 11px/19px ${FONT};
  ${field}
}
${X} select:not([multiple], [size]:not([size="0"], [size="1"])) { padding-right: 20px; background: ${comboBtn}, #fff; }
${X} textarea, ${X} select:is([multiple], [size]:not([size="0"], [size="1"])) { border-radius: 0; ${field} }
${X} :is(input, select, textarea):focus { outline: none; }
${X} :is(input, textarea):disabled, ${X} select:disabled { background-color: #ebebe4; color: #aca899; border-color: #c9c7ba; }

/* Quick Info: read-only text in 19px rows, as Sitecore draws it (no frames) */
${X} .scEditorQuickInfo tr { line-height: 19px; }
${X} .scEditorQuickInfo td { padding: 1px 4px; font-size: 11px; }
${X} .scEditorQuickInfo input { height: 19px; padding: 0; border: 0; background: transparent !important; font-size: 11px; }

/* ---- Combo tables (date and time pickers, item pickers): one Luna combo box ---- */
${X} table.scCombobox {
  box-sizing: border-box;
  height: 21px;
  min-height: 0;
  border-collapse: separate;
  border-spacing: 0;
  overflow: hidden;
  ${field}
}
${X} table.scCombobox :is(tbody, tr, td) { height: auto; }
${X} table.scCombobox td { padding: 0; border: 0; vertical-align: middle; }
${X} table.scCombobox input.scComboboxEdit {
  box-sizing: border-box;
  width: 100%;
  height: 19px !important;
  min-height: 0;
  margin: 0;
  padding: 0 3px;
  border: 0;
  border-radius: 0;
  box-shadow: none;
  background: transparent;
}
${X} table.scCombobox img.scComboboxDropDown {
  display: block;
  box-sizing: border-box;
  width: 17px;
  height: 19px;
  margin: 0;
  padding: 0;
  border: 1px solid #fff;
  border-radius: 2px;
  box-shadow: none;
  ${paint(`${art(DOWN)}, linear-gradient(135deg, #e3ebfd, #c1d3fb 60%, #b0c6f7)`)}
}
${X} table.scCombobox img.scComboboxDropDown:hover { filter: brightness(1.06); }

/* ---- Push buttons: 23px, wide enough for OK and Cancel ---- */
${X} :is(.scButton:not(.scEditorHeaderButton), input[type="button"], input[type="submit"]) {
  height: 23px;
  min-width: 75px;
  padding: 0 10px;
  border-radius: 3px;
  line-height: 21px;
}
${X} button:not(.ui-button) { border-radius: 3px; }
/* the default button: the token layer frames it in its fill colour */
${X} .scButton.scButtonPrimary { border-color: #003c74; ${pushDefault} }
${X} .scButton.scButtonPrimary:hover:not(:disabled) { ${pushHot} }
${X} .scButton.scButtonPrimary:active:not(:disabled) { ${pushDown} }

/* ---- Drop-down arrows: a small black triangle for Sitecore's chevrons ---- */
${X} img[src*="ribbondropdown" i] { ${paint(art(TRI_DOWN))} }

/* ---- Tree search: a field and two toolbar buttons on one line ---- */
${X} #SearchPanel { padding: 4px; background: #ece9d8; border-bottom: 1px solid #aca899; }
${X} #SearchPanel > table { width: 100%; border-spacing: 0; }
${X} #SearchPanel > table > tbody > tr > td { height: auto; padding: 0; vertical-align: middle; }
${X} #SearchPanel > table > tbody > tr > td:first-child { width: 100%; }
${X} #SearchPanel > table > tbody > tr > td > div { float: none !important; padding: 0 0 0 2px !important; }
${X} #SearchPanel .scElementHover { width: auto; height: auto; padding: 0; border: 0; background: none; }
${X} #TreeSearch { width: 100%; }
${X} :is(a.scSearchButton, a.scSearchOptionsButton) {
  display: block;
  box-sizing: border-box;
  width: 21px;
  height: 21px;
  padding: 1px;
  border: 1px solid transparent;
  border-radius: 3px;
}
${X} :is(a.scSearchButton, a.scSearchOptionsButton):hover { ${toolHot} }
${X} :is(a.scSearchButton, a.scSearchOptionsButton):active { ${toolDown} }
${X} :is(a.scSearchButton, a.scSearchOptionsButton) img { display: block; width: 16px; height: 16px; margin: 0; padding: 0; }
${X} a.scSearchOptionsButton img { ${paint(art(TRI_DOWN))} }
${X} #SearchOptionsList td { height: auto; padding: 2px 0; vertical-align: middle; }
${X} #TreeSearchOptions .scElementHover { padding: 0 4px 0 0; border: 0; background: none; }
${X} .scSearchAddCriteriaInput { padding-top: 2px; }
${X} :is(a.scSearchOptionName, a.scSearchAddCriteria) { display: flex; align-items: center; gap: 4px; padding: 0; color: #0033cc; font: 11px ${FONT}; }
${X} a.scSearchOptionName img.arrowDown { ${paint(art(TRI_DOWN))} }

/* ---- Language, version and navigator drop-downs above the editor: XP toolbar buttons ---- */
${X} .scEditorTabControls a.scEditorHeaderButton {
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 22px;
  min-width: 0;
  padding: 0 4px 0 6px;
  border: 1px solid transparent;
  border-radius: 3px;
  background: transparent;
  box-shadow: none;
  color: #000;
  font: 11px/20px ${FONT};
}
${X} .scEditorTabControls a.scEditorHeaderButton:hover { ${toolHot} }
${X} .scEditorTabControls a.scEditorHeaderButton:active { ${toolDown} }
${X} .scEditorTabControls a.scEditorHeaderButton img { margin: 0; }
${X} .scEditorTabControls a.scEditorHeaderButton span { display: inline-flex; align-items: center; gap: 4px; }

/* ---- Menus: XP's white menu, a #aca899 frame with a soft shadow, the Luna selection ---- */
${X} .scPopup:not(:has(> .scStartMenu)), ${X} .scMenu:not(.scPopup > .scMenu) {
  padding: 2px;
  background: #fff;
  border: 1px solid #aca899;
  border-radius: 0;
  box-shadow: 2px 2px 3px rgba(0, 0, 0, 0.3);
}
${X} .scPopup > .scMenu { padding: 0; background: transparent; border: 0; box-shadow: none; }
${X} .scMenu td {
  height: auto;
  padding: 3px 4px;
  background: transparent;
  color: #000;
  font: 11px ${FONT};
  line-height: 16px;
}
${X} .scMenu :is(.scMenuItemIcon, .scMenuItemIcon_Hover, .scMenuItemIcon_Disabled) { width: 16px; padding: 2px 2px 2px 4px; }
${X} .scMenu :is(.scMenuItemCaption, .scMenuItemCaption_Hover, .scMenuItemCaption_Disabled) { padding: 2px 16px 2px 4px; }
${X} .scMenu :is(.scMenuItemHotkey, .scMenuItemHotkey_Hover, .scMenuItemHotkey_Disabled) { padding: 2px 6px 2px 4px; text-align: right; }
${X} .scMenu :is(.scMenuItemIcon_Hover, .scMenuItemCaption_Hover, .scMenuItemHotkey_Hover, .scMenuPanelItem_Hover, .scMenuPanelItemSelected_Hover) { ${SEL} }
${X} .scMenu :is(.scGalleryMenuItem, tr:not([class]):has(> .scMenuItemIcon)):hover, ${X} .scMenu :is(.scGalleryMenuItem, tr:not([class]):has(> .scMenuItemIcon)):hover * { ${SEL} }
${X} .scMenu :is(.scGalleryMenuItem, tr:not([class]):has(> .scMenuItemIcon)):has(.scMenuItemCaption_Disabled):hover, ${X} .scMenu :is(.scGalleryMenuItem, tr:not([class]):has(> .scMenuItemIcon)):has(.scMenuItemCaption_Disabled):hover * { background: transparent; color: #aca899; }
${X} .scMenu :focus-visible, ${X} .scMenu:focus-visible { outline: 1px dotted #000; outline-offset: -1px; }
${X} iframe.scGalleryFrame { border: 1px solid #aca899; border-radius: 0; box-shadow: 2px 2px 3px rgba(0, 0, 0, 0.3); }
${X} .scMenu :is(.scMenuItemIcon_Disabled, .scMenuItemCaption_Disabled, .scMenuItemHotkey_Disabled) { color: #aca899; }
${X} .scMenu .scMenuItemIcon_Disabled > img { opacity: 0.5; }
${X} .scMenu img[src*="submenu16x16" i] { ${paint(art(TRI_RIGHT))} }
${X} .scMenu :is(.scMenuItemHotkey_Hover, .scMenuItemCaption_Hover) img[src*="submenu16x16" i] { filter: invert(1); }
${X} .scMenu :is(.scMenuDividerIcon, .scMenuDividerCaption, .scMenuDividerHotkey) {
  height: 7px;
  padding: 0;
  border: 0;
  background: linear-gradient(transparent 3px, #aca899 3px 4px, transparent 4px);
  font-size: 0;
  line-height: 0;
}
${X} .scMenu :is(.scMenuDividerIcon, .scMenuDividerCaption, .scMenuDividerHotkey) img { display: none; }
${X} .scMenuHeader { padding: 4px 6px; color: #000; font: bold 11px ${FONT}; }

/* ---- Dialog tab panes: the open tab joins a #fcfcfe page framed in #919b9c ---- */
${X} .scTabstrip { box-sizing: border-box; height: 22px; background: transparent; }
${X} .scTabstripContainer > .scTabs { top: 22px; left: -1px; background: #fcfcfe; border: 1px solid #919b9c; border-top: 0; box-shadow: none; }
${X} .scTabs .scTabPage .scScrollbox { background: #fff; ${field} }
${X} .scTabs > .scTabPage { border-color: transparent; }

/* ---- Ribbon galleries (Home > Insert, Security > Presets): rows of a list, the Luna selection ---- */
${X} .scRibbonGalleryList > a:is(:hover, :active) { ${SEL} border-color: transparent; box-shadow: none; }
${X} .scRibbonGalleryList > a:is(:hover, :active) * { color: #fff; }

/* The ribbon's fold button: the task pane's round chevron */
${X} a.scRibbonClose { background: ${roundChevron(DUP)}; }
${X} a.scRibbonOpen { background: ${roundChevron(DDOWN)}; }
${X} :is(a.scRibbonClose, a.scRibbonOpen)::before { content: none; }

/* ---- Bucket search: one white field holding the filter tokens and the Clear and Search buttons ---- */
${X} .search-box { border-radius: 0; ${field} }
${X} .search-box :is(.sb_down, .sb_up) { border: 0; border-right: 1px solid #7f9db9; border-radius: 0; }
${X} .search-box .sb_down { background: ${art(DOWN)}, ${scrollFace("90deg")}; }
${X} .search-box .sb_up { background: ${art(UP)}, ${scrollFace("90deg")}; }
${X} .search-box #raw-user-input { border: 0; box-shadow: none; background: transparent; }
${X} .filters .filter { border: 1px solid #7f9db9; border-radius: 3px; background: #d6dff7; color: #000; }
${X} .clear-search-box :is(.btn-clear, .btn-search) { ${push} }
${X} .clear-search-box .btn-clear { background: url("/sitecore/shell/Applications/Buckets/images/clear.png") center no-repeat, linear-gradient(#fff, #ecebe6 85%, #d6d0c5); }
${X} .clear-search-box .btn-search { background: url("/sitecore/shell/Applications/Buckets/images/edition-magnifier.png") center no-repeat, linear-gradient(#fff, #ecebe6 85%, #d6d0c5); }
${X} .clear-search-box :is(.btn-clear, .btn-search):hover { ${pushHot} }

${X} .scWorkboxWindowCaption:not([data-sct-window-title] *) { background: #ece9d8; }

/* SPEAK pages served in the shell (SPE Reports): XP's toolbar under the caption, as on SPEAK pages */
${appHeader(X)}
${X} .sc-applicationHeader-row1 { background-image: none; }
/* jQuery UI's highlight box (the ISE's tip of the session): XP's yellow info balloon */
${X} .ui-state-highlight { border: 1px solid #000; border-radius: 3px; background: #ffffe1; color: #000; }
${X} .ui-state-highlight :is(p, b, span, a, div) { color: #000; }
${X} .ui-state-highlight a { color: #0033cc; }

/* ---- Desktop windows: each is an iframe, so XP's blue frame is drawn outside it as rings ---- */
/* XP's frame is the iframe's own 4px border on the sides and bottom, see-through to the iframe's background:
   the caption's gradient, laid from the border's outer edge so it runs across the frame unbroken, down to the caption's height, the frame's blue below. So the frame beside the caption
   is caption, and the window has one rounded corner, the iframe's own; a 1px dark line runs round it all. */
${X} #Desktop > iframe:not([style*="width: 100%"]) { border: 4px solid transparent; border-top: 0; border-radius: 8px 8px 0 0; background: ${CAP} top / 100% 28px no-repeat border-box, #0d55e2; box-shadow: 0 0 0 1px #0831d9, 2px 3px 8px 4px rgba(0, 0, 0, 0.3); }
${X} #Desktop > iframe[data-sct-window="inactive"]:not([style*="width: 100%"]) { background: ${CAP_IN} top / 100% 28px no-repeat border-box, #7a96df; box-shadow: 0 0 0 1px #5470c0, 2px 3px 8px 4px rgba(0, 0, 0, 0.2); }
/* inside a Desktop window the caption runs to the frame: no 1px window border, no inner rounding */
${X}[data-sct-window-title] :is(.scWindowFrame, .scWindowBorder2) { border-width: 0; }
${X}[data-sct-window-title] :is(.standardWindowCaption, .scWindowBorder2 > .scCaption > #CaptionTopLine, .scWorkboxWindowCaption) { border-radius: 0; }

`;

// ==== SPEAK pages (speak and launchpad areas) ====
// band: the header's height inside its bottom border (SPEAK pages 49px, Launchpad 47px).
const speakCommon = (S, band = 49) => {
  const SX = `${S}:not(#sct-xp)`;
  return `${SX} :is(body, input, button, select, textarea, h1, h2, h3, h4, h5, h6, p, a, span, div, li, label, td, th, nav, header, section):not([class*="glyphicon"], .fa, [class*="fa-"]) {
  font-family: ${FONT};
}
${header(SX)}
${SX} :is(.sc-globalHeader, .sc-flx-global-header) .sc-globalHeader-startButton { display: flex; align-items: center; box-sizing: border-box; width: auto; height: ${band}px; margin: 0; background: transparent; }
${SX} :is(.sc-globalHeader, .sc-flx-global-header) .sc-globalheader-appName:not(:empty) { height: ${band}px; margin: 0; padding: 0 8px; ${capText} line-height: ${band}px; }
${SX} :is(.sc-globalHeader, .sc-flx-global-header) .sc-accountInformation { height: ${band}px; line-height: ${band}px; vertical-align: top; box-shadow: none; background: transparent; }
${SX} :is(.sc-globalHeader, .sc-flx-global-header) .sc-accountInformation li { height: ${band}px; line-height: ${band}px; vertical-align: top; }
${SX} :is(.sc-globalHeader, .sc-flx-global-header) .sc-accountInformation img { vertical-align: top; margin-top: ${(band - 34) / 2}px; margin-bottom: 0; }
${SX} :is(.sc-globalHeader, .sc-flx-global-header) .sc-ext-dbName { line-height: ${band}px; }
${SX} :is(.sc-globalHeader, .sc-flx-global-header) .sc-accountInformation a { text-decoration: none; }
${SX} :is(.sc-globalHeader, .sc-flx-global-header) .sc-accountInformation a:hover { text-decoration: underline; }

/* ---- Fields, check boxes, push buttons ---- */
${SX} :is(input:is([type="text"], [type="password"], [type="search"], [type="number"], [type="email"], [type="url"], :not([type])), select:not([multiple], [size]:not([size="0"], [size="1"])), .form-control) {
  box-sizing: border-box;
  height: 21px;
  min-height: 0;
  padding: 0 3px;
  font: 11px/19px ${FONT};
  ${field}
}
${SX} select:not([multiple], [size]:not([size="0"], [size="1"])) { appearance: none; padding-right: 20px; background: ${comboBtn}, #fff; }
${SX} textarea { border-radius: 0; ${field} }
${SX} :is(input, select, textarea, .form-control):focus { outline: none; box-shadow: none; border-color: #316ac5; }
${SX} input[type="checkbox"], ${SX} input[type="radio"] {
  appearance: none;
  box-sizing: border-box;
  width: 13px;
  height: 13px;
  margin: 0 4px 0 0;
  vertical-align: -2px;
  border: 1px solid #1c5180;
  border-radius: 0;
  outline: none;
  background: linear-gradient(135deg, #dcdcd7, #fff 75%);
}
${SX} input[type="radio"] { border-radius: 50%; }
${SX} input[type="checkbox"]:checked { background: ${art(CHECK)}, linear-gradient(135deg, #dcdcd7, #fff 75%); }
${SX} input[type="radio"]:checked { background: radial-gradient(circle, #55d551 0, #21a121 2.5px, transparent 3.2px), linear-gradient(135deg, #dcdcd7, #fff 75%); }
${SX} .btn {
  height: 23px;
  min-width: 75px;
  padding: 0 10px;
  font: 11px/21px ${FONT};
  ${push}
}
${SX} .btn :is(span, .sc-button-text) { color: inherit; font: inherit; }
${SX} .btn:hover, ${SX} .btn:focus { ${push} ${pushHot} }
${SX} .btn:active, ${SX} .btn.active { ${pushDown} }
${SX} .btn:focus-visible { outline: 1px dotted #000; outline-offset: -4px; }
${SX} .btn:disabled, ${SX} .btn.disabled { ${pushOff} opacity: 1; }
${SX} .btn.btn-primary { ${pushDefault} }
${SX} .btn.btn-primary :is(span, .sc-button-text) { color: #000; }
`;
};

// An XP task pane group: the white-to-blue header with a bold blue title, a light blue body.
const taskPane = (root, title, body) => `${root} { box-sizing: border-box; margin: 0 0 12px; padding: 0; border: 0; border-radius: 0; background: transparent; box-shadow: none; }
${title} {
  display: flex;
  align-items: center;
  box-sizing: border-box;
  height: 25px;
  margin: 0;
  padding: 0 4px 0 12px;
  ${paneHead}
  text-transform: none;
  white-space: nowrap;
}
${body} { box-sizing: border-box; margin: 0; padding: 8px 12px; border: 1px solid #fff; border-top: 0; border-radius: 0; background: #d6dff7; box-shadow: none; }`;

const SP = SURFACE("speak"), SPX = `${SP}:not(#sct-xp)`;
const EE = `${SPX} .sc-pageeditbar`;
const speak = `/* Whistler: SPEAK pages and the Experience Editor ribbon. Generated by tools/build-whistler-css.cjs. */
${speakCommon(SP)}
/* ==== Experience Editor ribbon: the SPEAK ribbon dressed as the Content Editor's XP ribbon ==== */
${EE} { color: #000; font: 11px ${FONT}; }
${EE} .sc-quickbar {
  display: flex;
  align-items: flex-end;
  height: auto;
  padding: 5px 4px 0;
  border: 0;
  background: #ece9d8;
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
  border-radius: 3px;
  background: none;
  box-shadow: none;
  opacity: 1;
}
${EE} .sc-quickbar-button:not(.disabled):hover { ${toolHot} }
${EE} .sc-quickbar-button:not(.disabled):active { ${toolDown} }
${EE} .sc-quickbar-button.disabled { opacity: 0.45; }
${EE} .sc-quickbar-button[data-sc-id="QuickRibbon"] { order: 1; margin-left: auto; }
${EE} .sc-quickbar-button :is(.navigate_up, .navigate_down) { float: none; margin: 0; background: none; mask: none; }
${EE} .sc-quickbar-button :is(.navigate_up, .navigate_down)::before { content: ""; display: block; width: 19px; height: 19px; }
${EE} .sc-quickbar-button .navigate_up::before { background: ${roundChevron(DUP)}; }
${EE} .sc-quickbar-button .navigate_down::before { background: ${roundChevron(DDOWN)}; }
${EE} .sc-quickbar-button[data-sc-id="QuickInsert-Component"] { margin-right: 8px; }
${EE} .sc-quickbar-tab, ${EE} .sc-quickbar-tab:hover {
  ${tab}
  position: relative;
  height: auto;
  padding: 0 10px;
  margin: 0 0 0 -1px;
  font: 11px/19px ${FONT};
  text-decoration: none;
}
${EE} .sc-quickbar-tab:not(.sc-quickbar-tab-selected):hover { ${tabHot} }
${EE} .sc-quickbar-item:focus { outline: none; }
${EE} .sc-quickbar-item:focus-visible { outline: 1px dotted #000; outline-offset: -3px; }
${EE} .sc-quickbar-tab.sc-quickbar-tab-selected { ${tabOpen} z-index: 1; margin-bottom: -1px; padding-bottom: 2px; }

${EE} .sc-ribbon { background: linear-gradient(#fcfcfe, #f4f3ee); border: 0; border-top: 1px solid #919b9c; border-bottom: 1px solid #919b9c; box-shadow: none; }
${EE} .sc-strip { min-height: 0; padding: 0 0 0 1px; }
${EE} .sc-chunk {
  float: left;
  height: auto;
  margin: 3px 2px 3px 0;
  padding: 0;
  background: transparent;
  border: 0;
  border-right: 1px solid #d5d2c1;
  border-radius: 0;
  box-shadow: 1px 0 #fff;
}
${EE} .sc-chunk::before, ${EE} .sc-chunk::after { content: none; }
/* As tight as the Content Editor's: 46px buttons 3px below the chunk's top, 4px from its sides, clear of the caption */
${EE} :is(.sc-chunk-button-list, .sc-chunk-check-list) { display: flow-root; box-sizing: border-box; height: 50px; min-height: 0; margin: 0; padding: 3px 4px 0; }
${EE} .sc-chunk-label { height: 18px; margin: 0; padding: 0 6px; color: #444; font: 11px/18px ${FONT}; text-align: center; text-transform: none; }
${EE} :is(.sc-chunk-button, .sc-chunk-button-dropdown, .sc-chunk-gallerybutton) {
  float: left;
  box-sizing: border-box;
  height: 46px;
  margin: 0;
  padding: 2px 5px 1px;
  border: 1px solid transparent;
  border-radius: 3px;
  background: none;
  box-shadow: none;
  color: #000;
  text-align: center;
}
${EE} :is(.sc-chunk-button, .sc-chunk-button-dropdown, .sc-chunk-gallerybutton) > [class*="sprite"] { display: block; margin: 0 auto; }
${EE} .sc-chunk-button-label { margin: 0; padding: 3px 0 0; color: #000; font: 11px/12px ${FONT}; text-transform: none; }
${EE} :is(.sc-chunk-button, .sc-chunk-button-dropdown, .sc-chunk-gallerybutton, .sc-chunk-button-small, .sc-chunk-check-small):not(.disabled):hover { ${toolHot} }
${EE} :is(.sc-chunk-button, .sc-chunk-button-dropdown, .sc-chunk-gallerybutton, .sc-chunk-button-small):not(.disabled):active,
${EE} :is(.sc-chunk-button, .sc-chunk-button-dropdown, .sc-chunk-gallerybutton, .sc-chunk-button-small).pressed { ${toolDown} }
${EE} .disabled .sc-chunk-button-label, ${EE} .disabled.sc-chunk-check-small .sc-chunk-check-small-label { color: #aca899; }
${EE} .disabled > [class*="sprite"] { opacity: 0.45; }
${EE} :is(.sc-chunk-button, .sc-chunk-button-small, .sc-chunk-button-dropdown, .sc-chunk-gallerybutton).disabled { opacity: 1; }
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
  border-radius: 3px;
  background: none;
  box-shadow: none;
  color: #000;
  white-space: nowrap;
}
${EE} .sc-chunk-button-small > [class*="sprite"] { float: none; margin: 0; }
${EE} :is(.sc-chunk-button-small .sc-chunk-button-label, .sc-chunk-check-small-label) { display: inline; float: none; padding: 0; color: #000; font: 11px/16px ${FONT}; }
${EE} .sc-chunk-check-list { float: left; padding-top: 2px; }
${EE} input.sc-smallcheckbox { margin: 0; }
${EE} :is(.sc-chunk-button-dropdown, .sc-chunk-gallerybutton)::after { content: none; }
${EE} :is(.sc-chunk-button-dropdown, .sc-chunk-gallerybutton) .sc-chunk-button-label::after {
  content: "";
  display: inline-block;
  width: 7px;
  height: 5px;
  margin: 0 0 1px 3px;
  background: ${art(TRI_DOWN, [0, 0])};
}
/* The date box fills the button row (3px down), not 55px of SPEAK's padded panel over the caption */
${EE} .sc-chunk-panel:has(> .sc-chunk-datepanel) { height: auto; margin: 0; padding: 0; }
${EE} .sc-chunk-datepanel { display: flex; align-items: center; height: 46px; margin: 0; padding: 0 2px; border: 0; border-radius: 0; background: none; box-shadow: none; }
${EE} .sc-chunk-datepanel > * { max-height: 46px; }
${EE} .sc-chunk-datepanel-selector { display: flex; align-items: center; gap: 4px; box-sizing: border-box; height: 46px; padding: 0 6px; overflow: hidden; background: #fff; color: #000; ${field} }
${EE} .sc-chunk-datepanel-monthyear { height: auto; padding: 0; }
${EE} .sc-chunk-datepanel-selector * { color: #000; font-family: ${FONT}; }

/* The item path under the ribbon: XP's address bar */
${EE} .sc-breadcrumb {
  display: flex;
  align-items: center;
  gap: 4px;
  box-sizing: border-box;
  height: 30px;
  min-height: 0;
  margin: 0;
  padding: 0 6px;
  background: #ece9d8;
  border: 0;
  border-top: 1px solid #fff;
  border-bottom: 1px solid #aca899;
  box-shadow: none;
}
${EE} .sc-breadcrumb-item { display: flex; align-items: center; gap: 4px; float: none; height: auto; margin: 0; padding: 0; }
${EE} .sc-breadcrumb-item > * { margin-top: 0; margin-bottom: 0; }
${EE} .sc-breadcrumb-item-path { color: #000; font: 11px ${FONT}; text-decoration: none; }
${EE} .sc-breadcrumb-item-path:hover { color: #0033cc; text-decoration: underline; }
${EE} :is(.sc-breadcrumb-item-button, .sc-breadcrumb-item-action) {
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 22px;
  min-width: 14px;
  padding: 0 2px;
  border: 1px solid transparent;
  border-radius: 3px;
  background: none;
}
${EE} .sc-breadcrumb-item-button { width: 22px; }
${EE} :is(.sc-breadcrumb-item-button, .sc-breadcrumb-item-action):hover { ${toolHot} }
${EE} .sc-breadcrumb-item-action .separator_7 { background: ${art(TRI_RIGHT)}; }
${EE} .sc-breadcrumb .scContentButton { display: block; height: auto; padding: 0; margin: 0 0 0 4px; }
${EE} .sc-breadcrumb .btn.sc-button { height: 22px; min-width: 60px; padding: 0 10px; line-height: 20px; }

/* ==== Control Panel: XP's Control Panel, task pane groups on the window face ==== */
${SPX} body:has(.sc-controlpanel-box), ${SPX} body:has(.sc-controlpanel-box) .sc-applicationContent { background: #fff; }
${SPX} body:has(.sc-controlpanel-box) .sc-applicationContent { min-height: 100vh; }
/* every SPEAK application's header (Control Panel, SPE Reports, Forms): XP's toolbar under the caption */
${appHeader(SPX)}
${SPX} .sc-applicationHeader-row1 { background-image: none; }
${SPX} .sc-applicationContent-main { background: none; }
${SPX} .sc-controlpanel-box { margin-top: 16px; }
${taskPane(`${SPX} .sc-controlpanel-box`, `${SPX} .sc-controlpanel-box-header h4`, `${SPX} .sc-controlpanel-box-content`)}
${SPX} .sc-controlpanel-box-header { margin: 0; padding: 0; color: #215dc6; text-transform: none; }
${SPX} .sc-controlpanel-box-header h4 img { flex: none; width: 16px; height: 16px; margin: 0 6px 0 0; }
${SPX} .sc-controlpanel-box-content li { height: auto; padding: 0; border: 0; }
${SPX} .sc-controlpanel-box-content li a { display: block; padding: 2px 0; color: #0c32a4; font: 11px/16px ${FONT}; text-decoration: none; }
${SPX} .sc-controlpanel-box-content li a:is(:hover, :focus) { color: #2d6ff7; text-decoration: underline; background: transparent; }
${SPX} .sc-controlpanel-no-items { color: #555; }

/* ==== Forms: the selected navigation entry and tab sit on the Luna selection ==== */
${SPX} .header.menuItem :is(a, span) { color: #fff; }
${SPX} .sc-tab-control-tab-item.selected :is(a, span) { color: #fff; }
`;

// ==== Launchpad: an Explorer window. The header is the caption; the left column is the blue task pane
// (the analytics message as a Details pane); the right column shows the groups in Tiles view. A pane or
// group collapses from its header (dom.js).
const LP = SURFACE("launchpad"), LPX = `${LP}:not(#sct-xp)`;
const TP = 232; // the task pane's width
const launchpad = `/* Whistler: Launchpad. Generated by tools/build-whistler-css.cjs.
   An Explorer window: the blue task pane on the left, the applications in Tiles view, shown in groups. */
${speakCommon(LP, 47)}
${LPX} body, ${LPX} .sc-applicationContent { background: #fff; }
${LPX} .sc-applicationContent { min-height: 100vh; padding: 0; }
${LPX} .sc-applicationContent-main { min-width: 0; margin: 0; padding: 0; background: none; }
${LPX} .sc-applicationContent-main > .row { margin: 0; }
/* The page title sits in the caption, after the logo */
${LPX} .sc-applicationHeader { border: 0; background: none; box-shadow: none; }
${LPX} .sc-applicationHeader-row1 { border: 0; }
${LPX} .sc-applicationHeader-row1.no-breadcrumb .sc-applicationHeader-title { display: flex; align-items: center; top: 0; left: 44px; box-sizing: border-box; height: 47px; padding: 0 8px; background: transparent; }
${LPX} .sc-applicationHeader-title, ${LPX} .sc-applicationHeader-title .sc-text { ${capText} line-height: 24px; }
/* the title's dark icon, white on the caption */
${LPX} .sc-applicationHeader-title::before { flex: none; filter: brightness(0) invert(1); }
${LPX} [data-sc-id="ColumnPanel1"] {
  display: grid;
  grid-template-columns: ${TP}px minmax(0, 1fr);
  align-items: start;
  column-gap: 0;
  box-sizing: border-box;
  width: auto;
  grid-template-rows: auto auto auto 1fr;
  min-height: calc(100vh - 48px);
  margin: 0;
  padding: 0;
  float: none;
  background: ${PANE_BG} 0 0 / ${TP}px 100% no-repeat, #fff;
}
/* the task pane: the analytics message as a Details pane */
${LPX} :is([data-sc-id="CustomAnalyticsLabel"], [data-sc-id="FallBackMessageBorder"], [data-sc-id="RowPanelTilesWrapper"]) { grid-column: 1; float: none; width: auto; margin: 0 12px; }
${LPX} [data-sc-id="CustomAnalyticsLabel"] { grid-row: 1; margin-top: 12px; }
${LPX} [data-sc-id="FallBackMessageBorder"] { grid-row: 2; }
${LPX} [data-sc-id="RowPanelTilesWrapper"] { grid-row: 3; }
${taskPane(`${LPX} .sc-border[data-sc-id="FallBackMessageBorder"]`, `${LPX} .sc-text[data-sc-id="CustomAnalyticsLabel"]`, `${LPX} .sc-border[data-sc-id="FallBackMessageBorder"]`)}
${LPX} .sc-text[data-sc-id="CustomAnalyticsLabel"] { position: static; margin: 12px 12px 0; cursor: pointer; }
${LPX} .sc-border[data-sc-id="FallBackMessageBorder"] { margin: 0 12px 12px; }
${LPX} .sc-text[data-sc-id="CustomAnalyticsLabel"]::after { content: ""; flex: none; width: 19px; height: 19px; margin-left: auto; background: ${roundChevron(DUP)}; }
${LPX} .sc-text[data-sc-id="CustomAnalyticsLabel"]:hover { color: #428eff; }
${LPX} .sc-text[data-sc-id="CustomAnalyticsLabel"][data-sct-collapsed="1"]::after { background: ${roundChevron(DDOWN)}; }
${LPX} .sc-text[data-sc-id="CustomAnalyticsLabel"][data-sct-collapsed="1"] + .sc-border { display: none; }
${LPX} .sc-border[data-sc-id="FallBackMessageBorder"] :is(.row, [class*="col-"]) { float: none; width: auto; margin: 0; padding: 0; }
${LPX} .sc-border[data-sc-id="FallBackMessageBorder"] .sc-border { min-height: 0; border: 0; background: none; box-shadow: none; }
${LPX} .sc-text[data-sc-id="FallBackMessage"] { position: static; display: block; padding: 0; color: #000; font: 11px/15px ${FONT}; text-align: left; }

/* the content pane: Tiles view, shown in groups */
${LPX} .sc-launchpad {
  grid-column: 2;
  grid-row: 1 / 5;
  display: block;
  max-width: none;
  margin: 0;
  padding: 10px 16px;
  float: none;
}
${LPX} .sc-launchpad-group {
  display: flex;
  flex-wrap: wrap;
  align-content: flex-start;
  gap: 4px 12px;
  box-sizing: border-box;
  width: auto;
  min-width: 0;
  margin: 0 0 14px;
  padding: 0;
  border: 0;
  border-radius: 0;
  background: none;
  box-shadow: none;
}
${LPX} .sc-launchpad-group-title {
  flex: 0 0 100%;
  box-sizing: border-box;
  height: 22px;
  margin: 0 0 4px;
  padding: 0 0 0 2px;
  border: 0;
  background: linear-gradient(90deg, #6c95e8, #c5d6f7 55%, transparent) left bottom / 100% 1px no-repeat;
  color: #0e3c9c;
  font: bold 11px/20px ${FONT};
  text-transform: none;
  cursor: pointer;
}
${LPX} .sc-launchpad-group-title::after { content: ""; display: inline-block; width: 9px; height: 6px; margin: 0 0 1px 6px; background: ${art(UP.map((r) => r.replace(/B/g, "N")), [1, 1])}; vertical-align: middle; }
${LPX} .sc-launchpad-group[data-sct-collapsed="1"] > .sc-launchpad-group-title::after { background: ${art(DOWN.map((r) => r.replace(/B/g, "N")), [1, 1])}; }
${LPX} .sc-launchpad-group[data-sct-collapsed="1"] > .sc-launchpad-item { display: none; }
${LPX} .sc-launchpad-group-title:hover { color: #428eff; }
/* a tile: the 48px icon, the name and, below it in grey, where it opens */
${LPX} .sc-launchpad-item {
  display: flex;
  align-items: center;
  gap: 8px;
  box-sizing: border-box;
  width: 236px;
  height: 58px;
  margin: 0;
  padding: 4px;
  border: 1px solid transparent;
  border-radius: 0;
  background: none;
  box-shadow: none;
  color: #000;
  text-align: left;
  text-decoration: none;
}
${LPX} .sc-launchpad-item .icon { flex: none; width: 48px; height: 48px; margin: 0; border-radius: 0; background: none; }
${LPX} .sc-launchpad-item .icon img { display: block; width: 48px; height: 48px; margin: 0; }
${LPX} .sc-launchpad-item .sc-launchpad-text { display: block; float: none; max-width: none; padding: 1px 2px; overflow: visible; color: #000; font: 11px/14px ${FONT}; white-space: normal; text-align: left; }
${LPX} .sc-launchpad-item .sc-launchpad-text::after { content: "Application"; display: block; color: #6d6d6d; }
${LPX} .sc-launchpad-item:hover { background: none; box-shadow: none; text-decoration: none; }
${LPX} .sc-launchpad-item:hover .sc-launchpad-text { color: #0033cc; text-decoration: underline; }
${LPX} .sc-launchpad-item:is(:focus, :active) { outline: none; }
${LPX} .sc-launchpad-item:is(:focus-visible, :active) .sc-launchpad-text { ${SEL} text-decoration: none; }
${LPX} .sc-launchpad-item:is(:focus-visible, :active) .sc-launchpad-text::after { color: #fff; }
${LPX} .sc-launchpad-item:is(:focus-visible, :active) .icon img { filter: sepia(1) hue-rotate(180deg) saturate(3) brightness(0.8); }
`;

// ==== Login: XP's Welcome screen. Blue bands top and bottom with an orange and a light rule, the logo
// and a hint left of the vertical divider, the sign-in form as the user's tile on the right.
const LG = SURFACE("login");
const login = `/* Whistler: Identity Server login. Generated by tools/build-whistler-css.cjs.
   Windows XP's Welcome screen. */
${LG} body {
  min-height: 100vh;
  margin: 0;
  background:
    linear-gradient(#00309c, #00309c) top / 100% 78px no-repeat,
    linear-gradient(90deg, transparent, #e7a65b 30%, #e7a65b 70%, transparent) 0 78px / 100% 2px no-repeat,
    linear-gradient(90deg, transparent, #f1b46b 15% 85%, transparent) 0 calc(100% - 92px) / 100% 2px no-repeat,
    linear-gradient(#003399, #003399) bottom / 100% 92px no-repeat,
    radial-gradient(ellipse 60% 55% at 22% 32%, #7aa1e6, transparent 70%),
    #5a7edc;
  color: #fff;
  font: 11px ${FONT};
}
${LG} .top { position: absolute; top: 0; right: 0; z-index: 1; height: auto; padding: 30px 20px; border: 0; background: transparent; box-shadow: none; color: #fff; font: 11px ${FONT}; }
${LG} .top a { color: #fff; }
${LG} .main-wrap { display: flex; align-items: center; justify-content: center; min-height: 100vh; background: transparent; }
${LG} .main {
  display: grid;
  grid-template-columns: 1fr 2px 1fr;
  align-items: center;
  column-gap: 32px;
  box-sizing: border-box;
  width: min(760px, 100% - 32px);
  margin: 0 auto;
  padding: 0;
  border: 0;
  border-radius: 0;
  background: linear-gradient(transparent, rgba(255, 255, 255, 0.8) 30% 70%, transparent) center / 2px 100% no-repeat;
  box-shadow: none;
  color: #fff;
}
${LG} .main::before { content: none; }
${LG} .logo-wrap { grid-column: 1; margin: 0; text-align: right; }
${LG} .logo-wrap img { max-width: 220px; height: auto; }
${LG} .logo-wrap::after { content: "To begin, enter your user name and password"; display: block; margin-top: 18px; color: #fff; font: 14px ${CAPFONT}; }
${LG} .login-page { grid-column: 3; margin: 0; padding: 14px 16px; border-radius: 8px; background: linear-gradient(90deg, #0d3b9e, rgba(13, 59, 158, 0)); }
${LG} .login-page fieldset { margin: 0; padding: 0; border: 0; }
${LG} .login-page .form-group { margin: 0 0 8px; color: #fff; }
${LG} label { color: #fff; font: bold 11px ${FONT}; }
${LG} .form-control {
  box-sizing: border-box;
  display: block;
  width: 100%;
  height: 21px;
  margin: 2px 0 6px;
  padding: 0 3px;
  font: 11px/19px ${FONT};
  ${field}
}
${LG} .form-control:focus { outline: none; border-color: #fff; box-shadow: 0 0 0 1px #f8b330; }
${LG} .form-control::placeholder { color: #6d6d6d; }
${LG} .btn.btn-primary {
  box-sizing: border-box;
  display: block;
  width: auto;
  min-width: 75px;
  height: 23px;
  margin-left: auto;
  padding: 0 10px 0 28px;
  border: 1px solid #fff;
  border-radius: 3px;
  background: ${art(GO, [8, 8])}, linear-gradient(135deg, #7fd36a, #3c9c3c 50%, #2d7f2d);
  color: #fff;
  font: bold 11px/21px ${FONT};
  text-shadow: 1px 1px #1a4d1a;
  text-transform: none;
  box-shadow: none;
}
${LG} .btn.btn-primary:is(:hover, :focus) { background-color: #3c9c3c; filter: brightness(1.1); color: #fff; }
${LG} .btn.btn-primary:active { filter: brightness(0.9); }
${LG} .btn.btn-primary:focus-visible { outline: 1px dotted #fff; outline-offset: 2px; }
${LG} input[type="checkbox"] { appearance: none; box-sizing: border-box; width: 13px; height: 13px; margin: 0 4px 0 0; vertical-align: -2px; border: 1px solid #1c5180; border-radius: 0; background: linear-gradient(135deg, #dcdcd7, #fff 75%); }
${LG} input[type="checkbox"]:checked { background: ${art(CHECK)}, linear-gradient(135deg, #dcdcd7, #fff 75%); }
${LG} .remember-me { display: inline-flex; align-items: center; padding: 0; color: #fff; font: 11px ${FONT}; }
${LG} .remember-me input[type="checkbox"] { position: static; flex: none; }
${LG} a, ${LG} .forgot-password { color: #fff; font: 11px ${FONT}; }
${LG} :is(.text-danger, .validation-summary-errors, .field-validation-error) { color: #ffe08a; }
`;

const dir = path.join(__dirname, "..", "extension", "themes", ID);
for (const [name, text] of Object.entries({ shell: css, speak, launchpad, login })) {
  fs.writeFileSync(path.join(dir, `${name}.css`), pixelate(text));
  console.log(`${name}.css: ${(text.length / 1024).toFixed(1)} KB`);
}
