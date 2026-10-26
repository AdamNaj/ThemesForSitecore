// Dev tool: writes extension/themes/warp/{shell,speak,launchpad,login}.css and the glyphs they use.
// Warp recreates OS/2 Warp 4. Its title bar buttons' marks, scroll arrows, check marks and folder icons are
// glyphs (PNG plus vector SVG pairs, see art()), so the theme is generated here rather than written by hand.
//
// Measured Warp 4 (Presentation Manager and the Workplace Shell at 96 dpi, the default scheme):
//   windows #cccccc; text #000; WarpSans 9pt (11px; Verdana and Tahoma stand in, WarpSans ships with OS/2)
//   bevels 2px: #fff top and left, #404040 bottom and right, a 1px black edge outside a window; sunken
//     #808080 top and left, #fff bottom and right
//   title bar 22px, #3c5a9a, the title white bold and centred; the system menu button at the left (it holds
//     Close, as PM's system menu does), hide (a small black square) and maximize (a box with a heavy top) at
//     the right, each an 18x16 bevelled grey button; an inactive window's bar grey (#b4b4b4, black title)
//   menu bar under the title, each title's mnemonic underlined; the selected title and menu row on the blue
//   push buttons 24px, raised; pressed sunken; the default one with a 1px black outline
//   fields 22px, sunken white; check boxes 13px sunken white with a black tick; radio buttons round
//   notebooks: the major tabs stand on the right edge of the page, the open one joined to it (Sitecore's
//     dialog tab strips, where the page is a box of its own); elsewhere tabs along the top
//   scroll bar 16px: a #e6e6e6 track, a raised grey slider, raised arrow buttons with black triangles
//   tree view: folders, closed and open, for the nodes' expand and collapse buttons
//   WarpCenter: a 28px grey bar along the top of the screen; its buttons raised, the open window's sunken; the
//     clock in a black window with green figures (#00ff66 on #000, 15.5:1)
//   desktop #2a5a8c
const fs = require("fs");
const zlib = require("zlib");
const crypto = require("crypto");
const path = require("path");

const ID = "warp";
const SURFACE = (s) => `html[data-sct-theme="${ID}"][data-sct-surface="${s}"]`;
const P = SURFACE("shell");
// :not(#sct-wp) matches every page; its id weight lets a rule win over Sitecore's id- and class-heavy selectors.
const X = `${P}:not(#sct-wp)`;
// A desktop window's document while another window has the focus (set by dom.js).
const PI = `${P}[data-sct-window="inactive"]`;
// Pages with notebooks: every one but the ISE.
const NB = `${P}:not(:has(#TreeViewToggle)):not(#sct-wp)`;
const FONT = 'WarpSans, "Workplace Sans", Verdana, Tahoma, sans-serif';
// Colours of the pixel art: W white, K black, O a folder's outline, Y its face, H its lit edge, G grey.
const COLORS = { W: "#fff", K: "#000", O: "#806010", Y: "#e8c55a", H: "#fff2b0", G: "#808080" };

// ---- Pixel art (as in tools/build-metal-css.cjs): one character per pixel, '.' transparent. Each glyph is
// written to themes/warp/glyphs twice, as a PNG (1x) and as a vector SVG (every other scale), and named
// sct-ext:, which background.js points at the extension (a site's CSP can block data:). Placed centred, at
// [x, y] from the box's top left, or, given a number, that many pixels in from the right, centred vertically.
const GLYPHS = path.join(__dirname, "..", "extension", "themes", ID, "glyphs");
fs.rmSync(GLYPHS, { recursive: true, force: true });
fs.mkdirSync(GLYPHS, { recursive: true });
const VECTORS = new Map();
const vector = (rows, body) => VECTORS.set(rows.join("|"), body);
function art(rows, at) {
  const h = rows.length, w = rows[0].length;
  if (rows.some((r) => r.length !== w || /[^.WKOYHG]/.test(r))) throw new Error(`bad pixel art: ${rows.join("|")}`);
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
  return `<g shape-rendering="crispEdges">${rects.join("")}</g>`;
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
    .filter((m) => /(^|[;\s])background(-image)?\s*:[^;]*(sct-ext:|var\(--sct-wp-)/.test(m[2]))
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
// title bar marks: hide's small square, maximize's box with its heavy top, the system menu's small window
const HIDE = ["KKKK", "KKKK", "KKKK", "KKKK"];
const MAX = ["KKKKKKKKKK", "KKKKKKKKKK", "K........K", "K........K", "K........K", "K........K", "K........K", "KKKKKKKKKK"];
const RESTORE = ["...KKKKKKK", "...KKKKKKK", "...K.....K", "KKKKKKK..K", "KKKKKKK..K", "K.....KKKK", "K.....K...", "K.....K...", "KKKKKKK..."];
const SYSMENU = ["KKKKKKKKKK", "KGGGGGGGGK", "KGGGGGGGGK", "KWWWWWWWWK", "KWWWWWWWWK", "KWWWWWWWWK", "KWWWWWWWWK", "KKKKKKKKKK"];
// scroll arrows and drop-down arrows: solid black triangles
const UP = ["...K...", "..KKK..", ".KKKKK.", "KKKKKKK"];
const DOWN = [...UP].reverse();
const LEFT = ["...K", "..KK", ".KKK", "KKKK", ".KKK", "..KK", "...K"];
const RIGHT = LEFT.map((r) => [...r].reverse().join(""));
vector(UP, `<path d="M0 4L3.5 0.5L7 4Z" fill="#000"/>`);
vector(DOWN, `<path d="M0 0L3.5 3.5L7 0Z" fill="#000"/>`);
vector(LEFT, `<path d="M4 0L0.5 3.5L4 7Z" fill="#000"/>`);
vector(RIGHT, `<path d="M0 0L3.5 3.5L0 7Z" fill="#000"/>`);
const TRI_RIGHT = RIGHT;
const TRI_RIGHT_W = TRI_RIGHT.map((r) => r.replace(/K/g, "W"));
vector(TRI_RIGHT_W, `<path d="M0 0L3.5 3.5L0 7Z" fill="#fff"/>`);
const TRI_DOWN = ["KKKKK", ".KKK.", "..K.."];
vector(TRI_DOWN, `<path d="M0 0H5L2.5 3Z" fill="#000"/>`);
// the check mark
const CHECK = ["......K", ".....KK", "K...KKK", "KK.KKK.", "KKKKK..", ".KKK...", "..K...."];
vector(CHECK, `<path d="M0.7 3.2L2.5 5.2L6.4 1" fill="none" stroke="#000" stroke-width="2"/>`);
// folders: closed for a collapsed node, open for an expanded one
const FOLDER = [
  "OOOOO.........", "OHHHHO........", "OOOOOOOOOOOOOO", "OHHHHHHHHHHHHO", "OHYYYYYYYYYYYO",
  "OHYYYYYYYYYYYO", "OHYYYYYYYYYYYO", "OHYYYYYYYYYYYO", "OHYYYYYYYYYYYO", "OOOOOOOOOOOOOO",
];
const FOLDER_OPEN = [
  "OOOOO..........", "OHHHHO.........", "OHYYYOOOOOOOO..", "OHYYYYYYYYYYO..", "OHY.OOOOOOOOOOO",
  "OHYOHHHHHHHHHO.", "OHOHYYYYYYYYO..", "OOHYYYYYYYYO...", "OHYYYYYYYYO....", "OOOOOOOOOO.....",
];

// ---- Presentation Manager recipes ----
const FACE = "#cccccc", LIGHT = "#ffffff", SHADE = "#808080", DARK = "#404040", BLUE = "#3c5a9a", DESK = "#2a5a8c";
const raised = (l = LIGHT, d = DARK, w = 2) => `border: ${w}px solid; border-color: ${l} ${d} ${d} ${l};`;
const sunken = (l = LIGHT, d = SHADE, w = 2) => `border: ${w}px solid; border-color: ${d} ${l} ${l} ${d};`;
const RAISED = raised();
const SUNKEN = sunken();
const capText = `color: #fff; font: bold 11px/1 ${FONT}; text-shadow: none;`;
// a window's edge drawn outside an element (a desktop window's iframe): the bevel, the black edge
const FRAME_RING = `-2px -2px 0 0 ${LIGHT}, 2px 2px 0 0 ${DARK}, 3px 3px 0 0 #000, 0 0 0 4px ${FACE}`;
const FRAME_RING_IN = FRAME_RING;
// tabs
const tab = `${RAISED} border-radius: 0; background: #b8b8b8; box-shadow: none; color: #000; text-transform: none; text-shadow: none;`;
const tabOpen = `background: ${FACE}; font-weight: bold;`;
// push buttons
const push = `box-sizing: border-box; ${RAISED} border-radius: 0; background: ${FACE}; color: #000; text-shadow: none; text-transform: none; box-shadow: none;`;
const pushHot = "background: #d4d4d4;";
const pushDefault = "outline: 1px solid #000; outline-offset: 0;";
const pushDown = `${SUNKEN} background: #c0c0c0;`;
const pushOff = "color: #808080;";
// toolbar buttons: flat until the pointer is over them, then raised; pressed sunken
const toolHot = `border-color: ${LIGHT} ${DARK} ${DARK} ${LIGHT}; background: transparent;`;
const toolDown = `border-color: ${SHADE} ${LIGHT} ${LIGHT} ${SHADE}; background: #c0c0c0;`;
// fields
const field = `${SUNKEN} border-radius: 0; background-color: #fff; color: #000; box-shadow: none;`;
const fieldFocus = "outline: 1px dotted #000; outline-offset: -4px;";
// the selection
const SEL = `background: ${BLUE}; color: #fff;`;
// the scroll bar's slider and arrow buttons: raised grey
const slider = `background: ${FACE}; box-shadow: inset 1px 1px ${LIGHT}, inset -1px -1px ${DARK}, inset 2px 2px #e6e6e6, inset -2px -2px ${SHADE};`;
// a title bar button: a bevelled grey box holding its mark
const capBtn = (mark) => `box-sizing: border-box; width: 18px; height: 16px; margin: 0; padding: 0; border: 1px solid; border-color: ${LIGHT} ${DARK} ${DARK} ${LIGHT}; border-radius: 0; ${paint(`${art(mark)}, ${FACE}`)}`;

const TABS = (state) => [".scRibbon a.scRibbonNavigatorButtons", ".scRibbon a.scRibbonNavigatorButtonsContextual"].map((s) => `${P} ${s}${state}`).join(",\n");
const RB = 'a[class*="scRibbonToolbar"][class*="Button"]:not(.scRibbonToolbarLargeComboButton > a)';
const LC = ":is(.scRibbonToolbarLargeComboButtonTop, .scRibbonToolbarLargeComboButtonBottom)";

// The global header (standalone Content Editor, SPEAK pages): the blue title bar.
const header = (S) => `/* ---- Global header: the blue title bar ---- */
${S} :is(.sc-globalHeader, .sc-flx-global-header) { background: ${BLUE}; border: 0; border-bottom: 2px solid ${FACE}; box-shadow: 0 1px ${DARK}; color: #fff; }
${S} :is(.sc-globalHeader, .sc-flx-global-header) .sc-accountInformation li,
${S} :is(.sc-globalHeader, .sc-flx-global-header) .sc-accountInformation span,
${S} :is(.sc-globalHeader, .sc-flx-global-header) .sc-accountInformation a,
${S} :is(.sc-globalHeader, .sc-flx-global-header) a { color: #fff; font-family: ${FONT}; text-shadow: none; }
${S} :is(.sc-globalHeader, .sc-flx-global-header) .sc-accountInformation li::before, ${S} :is(.sc-globalHeader, .sc-flx-global-header) .sc-accountInformation li::after { color: #fff; }
${S} :is(.sc-globalHeader, .sc-flx-global-header) .sc-accountInformation img { box-sizing: border-box; ${raised(LIGHT, DARK, 1)} border-radius: 0; }
/* Sitecore's logo is dark art: white on the blue */
${S} :is(.sc-globalHeader, .sc-flx-global-header) .sc-global-logo { filter: brightness(0) invert(1); }
`;

// The application header of a SPEAK page (title, Back): the window face under the title bar.
const appHeader = (SX) => `${SX} .sc-applicationHeader { border: 0; background: ${FACE}; box-shadow: none; }
${SX} .sc-applicationHeader-row1 { display: flow-root; height: auto; min-height: 0; padding: 0; background: ${FACE}; border: 0; }
${SX} .sc-applicationHeader-row1::after { content: none; }
${SX} .sc-applicationHeader-row1 .sc-applicationHeader-content { height: auto; padding: 8px 15px 6px; }
${SX} .sc-applicationHeader-title, ${SX} .sc-applicationHeader-title .sc-text { color: #000; font: bold 15px/22px ${FONT}; }
${SX} .sc-applicationHeader-row2 { display: flow-root; height: auto; min-height: 0; padding: 0 15px 8px; background: ${FACE}; border: 0; border-bottom: 1px solid ${SHADE}; box-shadow: 0 1px ${LIGHT}; }
${SX} .btn.sc-backbutton { display: inline-flex; align-items: center; gap: 6px; height: 24px; min-width: 0; padding: 0 12px 0 8px; ${push} }
${SX} .btn.sc-backbutton:active { ${pushDown} }
${SX} .btn.sc-backbutton .sc-backbutton-text { position: static; min-width: 0; height: auto; margin: 0; padding: 0; color: #000; font: 11px/20px ${FONT}; text-decoration: none; }
${SX} .btn.sc-backbutton::before, ${SX} .btn.sc-backbutton:is(:hover, :active)::before { position: static; flex: none; width: 6px; height: 9px; background: ${art(LEFT)}; mask: none; transform: none; }`;

const css = `/* Warp: classic shell. Generated by tools/build-warp-css.cjs; never hand-edit.
   OS/2 Warp 4: grey bevelled windows, blue title bars, menu bars with mnemonics, notebook tabs, folders. */

/* The SPE ISE's Ace editor measures its own monospace font; keep the theme font out of it. */
${P} body, ${P} input, ${P} select, ${P} textarea, ${P} button,
${P} :is(td, a, span, div):not(.ace_editor, .ace_editor *) {
  font-family: ${FONT};
}
${P} { scrollbar-color: auto; }

/* ---- Scrollbars: a pale track, a raised grey slider, raised arrow buttons ---- */
${P} ::-webkit-scrollbar { width: 16px; height: 16px; background: #e6e6e6; }
${P} ::-webkit-scrollbar-track { border-radius: 0; background: #e6e6e6; }
${P} ::-webkit-scrollbar-thumb, ${P} :is(select, textarea)::-webkit-scrollbar-thumb { border: 0; border-radius: 0; ${slider} }
${P} ::-webkit-scrollbar-corner { background: ${FACE}; }
${P} ::-webkit-scrollbar-button:single-button { display: block; ${slider} }
${P} ::-webkit-scrollbar-button:vertical:single-button { width: 16px; height: 16px; }
${P} ::-webkit-scrollbar-button:horizontal:single-button { width: 16px; height: 16px; }
${P} ::-webkit-scrollbar-button:vertical:decrement { background: ${art(UP)}, ${FACE}; }
${P} ::-webkit-scrollbar-button:vertical:increment { background: ${art(DOWN)}, ${FACE}; }
${P} ::-webkit-scrollbar-button:horizontal:decrement { background: ${art(LEFT)}, ${FACE}; }
${P} ::-webkit-scrollbar-button:horizontal:increment { background: ${art(RIGHT)}, ${FACE}; }
/* The rule editor's two lists (10.5) carry Sitecore's own ID-weighted scrollbar: Warp's again, at their weight. */
${P} :is(#Conditions, #Description)::-webkit-scrollbar { width: 16px; height: 16px; background: #e6e6e6; }
${P} :is(#Conditions, #Description)::-webkit-scrollbar-thumb { border: 0; border-radius: 0; ${slider} }

${header(P)}
/* ---- Ribbon: the tab row is the window's menu bar (mnemonics underlined, the open title on the blue); the
   toolbar's groups are separated by etched lines ---- */
${P} .scRibbon, ${P} .scRibbonNavigator { background: ${FACE}; }
${P} .scRibbonNavigator { border-bottom: 0; }
${TABS("Normal")},
${TABS("Active")} {
  position: relative;
  box-sizing: border-box;
  height: 20px;
  margin: 0 0 2px;
  padding: 0 8px;
  border: 0;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
  color: #000;
  font: 11px/20px ${FONT};
  text-transform: none;
}
${TABS("Normal")}::first-letter, ${TABS("Active")}::first-letter { text-decoration: underline; }
${TABS("Normal:hover")} { background: #b8b8b8; }
${TABS("Active")} { ${SEL} }
${P} .scRibbonToolbar { background: ${FACE}; border-top: 1px solid ${SHADE}; border-bottom: 1px solid ${SHADE}; box-shadow: inset 0 1px ${LIGHT}, 0 1px ${LIGHT}; }
${P} .scRibbonToolbar .chunk {
  height: auto;
  background: transparent;
  border: 0;
  border-right: 1px solid ${SHADE};
  box-shadow: 1px 0 ${LIGHT};
  border-radius: 0;
  margin: 3px 3px 3px 0;
}
${P} .scRibbonToolbar .chunk .caption { background: transparent; color: #000; font: 11px ${FONT}; }
${P} .scRibbonToolbar .panel, ${P} .scRibbonToolbar .panel span, ${P} .scRibbonToolbar .panel a { color: #000; font-size: 11px; }
${P} .scRibbonToolbar [class*="scRibbonToolbar"][class*="Button"] { border: 2px solid transparent; border-radius: 0; }
/* Only the buttons react, not their icons or labels, and disabled buttons (spans) not at all. A large combo
   button shows its command and its drop-down as two faces while hovered, each pressed on its own. */
${P} .scRibbonToolbar ${RB}:hover { ${toolHot} }
${P} .scRibbonToolbar ${RB}:active { ${toolDown} }
${P} .scRibbonToolbar .scRibbonToolbarLargeComboButton:hover > ${LC} { ${toolHot} }
${P} .scRibbonToolbar .scRibbonToolbarLargeComboButton > ${LC}:active { ${toolDown} }
/* Copenhagen-tight on both versions: the strip keeps 1px plus the chunks' 3px margin above and below
   (10.5 pads it 12px over an 80px minimum), the panel 3px above the buttons and 4px at the sides (10.5
   16px, 10.4 10px 8px), a 16px caption, and large buttons cut from 55px to 46px so they end above the
   caption with their bevel. */
${X} :is(.scRibbonToolbarStrip, .scRibbonToolbarContextualStrip) { display: flow-root; min-height: 0; padding: 1px 0; }
${X} .scRibbonToolbar .chunk > .panel { box-sizing: border-box; height: 52px; padding: 3px 4px 0; }
${X} .scRibbonToolbar .chunk > .caption { height: 16px; padding: 0 4px; line-height: 16px; }
${X} .scRibbonToolbar :is(a.scRibbonToolbarLargeButton, span.scRibbonToolbarLargeButtonDisabled, a.scRibbonToolbarLargeButtonDown, a.scRibbonToolbarLargeGalleryButton, span.scRibbonToolbarLargeGalleryButtonDisabled) { padding: 1px 4px 0; }
${X} .scRibbonToolbar [class*="scRibbonToolbarLarge"] .header { padding: 3px 4px 1px; }
${X} .scRibbonToolbar :is(.scRibbonGallery, .scRibbonToolbarSmallButtons) { padding: 1px 5px 0; }
${X} .scRibbonToolbar .scRibbonToolbarSmallCheckButton { padding: 2px 3px; }
${X} .scRibbonToolbar :is(.scRibbonToolbarLargeComboButton, .scRibbonToolbarLargeComboButtonDisabled) { padding: 0; }
${X} .scRibbonToolbar [class*="scRibbonToolbarLargeComboButtonTop"] { padding: 0 4px; }
${X} .scRibbonToolbar [class*="scRibbonToolbarLargeComboButtonBottom"] { padding: 0 4px 1px; }
/* 10.4's chunk launchers are pale grey: inked like the captions */
${X} .scRibbonChunkEndLink img.glyph { filter: brightness(0.45); }

/* ---- Content tree: white, the selection blue with a dotted focus edge, folders for expand and collapse ---- */
${P} .scContentTree { background: #fff; }
${P} .scContentTree :is(a, span) { font-size: 11px; }
${P} .scContentTree :is(a.scContentTreeNodeNormal, a.scContentTreeNodeActive) { outline: 1px dotted transparent; outline-offset: -1px; }
${P} .scContentTree a.scContentTreeNodeActive { ${SEL} outline-color: #000; border-radius: 0; }
${P} .scContentTree a.scContentTreeNodeActive span { color: #fff !important; }
${P} .scContentTree a.scContentTreeNodeNormal:hover { background: #e6e6e6; text-decoration: none; }
${P} img[src*="/treemenu_collapsed"] { ${paint(art(FOLDER))} }
${P} img[src*="/treemenu_expanded"] { ${paint(art(FOLDER_OPEN))} }

/* ---- Editor ---- */
${P} .scEditorHeaderTitle { font: bold 14px ${FONT}; color: #000; }
${P} a.scRibbonEditorTabActive, ${P} a.scRibbonEditorTabNormal, ${P} a#BTAddNewSearch, ${P} a#BTAddNewSearch:hover {
  ${tab}
  border-bottom: 0;
  height: 21px;
  margin: 35px 1px 0 0;
}
${P} a.scRibbonEditorTabNormal:hover, ${P} a#BTAddNewSearch:hover { background: #c4c4c4; }
${P} a.scRibbonEditorTabActive { ${tabOpen} position: relative; z-index: 1; height: 24px; }
${P} #EditorTabs { height: 58px; border-bottom: 2px solid ${LIGHT}; }
${P} a#BTAddNewSearch { width: 30px; }
/* the Search tab's magnifier is a pale grey drawn for white: inked on the grey tab */
${X} a#BTAddNewSearch img { filter: brightness(0.45); }
${P} .scEditorTabHeaderActive, ${P} .scEditorTabHeaderNormal {
  background-color: transparent;
  color: #000;
  font: 11px ${FONT};
  border: 0;
  height: 19px;
  line-height: 19px;
  padding: 0 10px;
}
${P} .scEditorTabHeaderActive { font-weight: bold; }
/* sections: raised bars, a folder before the bold name */
${P} .scEditorSectionCaptionExpanded, ${P} .scEditorSectionCaptionCollapsed {
  box-sizing: border-box;
  height: 24px;
  margin: 0 0 3px;
  padding: 0 0 0 4px;
  ${RAISED}
  border-radius: 0;
  background: #d8d8d8;
  color: #000;
  font: bold 11px/20px ${FONT};
}
${P} :is(.scEditorSectionCaptionExpanded, .scEditorSectionCaptionCollapsed):hover { background: #e0e0e0; }
${P} img.scEditorSectionCaptionGlyph { float: left; width: 18px; height: 16px; margin: 2px 4px 0 0; }
${P} img.scEditorSectionCaptionGlyph[src*="accordion_up"] { ${paint(art(FOLDER_OPEN))} }
${P} img.scEditorSectionCaptionGlyph[src*="accordion_down"] { ${paint(art(FOLDER))} }
${P} .scEditorFieldLabel { color: #000; font: 11px ${FONT}; }

/* ---- Fields: sunken white ---- */
${P} .scContentControl,
${P} .scSearchInput,
${P} input:is([type="text"], [type="password"], [type="search"], [type="number"], [type="email"], [type="url"], :not([type])),
${P} textarea,
${P} select { ${field} }
${P} select:not([multiple], [size]:not([size="0"], [size="1"])) { appearance: none; padding-right: 22px; background: ${art(DOWN, 5)}, linear-gradient(${FACE}, ${FACE}) right / 17px 100% no-repeat, #fff; }
${X} input[type="checkbox"], ${X} input[type="radio"] {
  appearance: none;
  box-sizing: border-box;
  width: 13px;
  height: 13px;
  margin: 0 4px 0 0;
  vertical-align: -2px;
  ${SUNKEN}
  border-radius: 0;
  background: #fff;
  box-shadow: none;
}
${X} input[type="radio"] { border-radius: 50%; }
${X} input[type="checkbox"]:checked { background: ${art(CHECK)}, #fff; }
${X} input[type="radio"]:checked { background: radial-gradient(circle, #000 0 2.2px, transparent 2.8px), #fff; }
${X} :is(input[type="checkbox"], input[type="radio"]):disabled { background: ${FACE}; opacity: 1; }
${P} :is(input[type="checkbox"], input[type="radio"]):focus-visible { outline: 1px dotted #000; outline-offset: 1px; }

/* ---- Push buttons: raised grey; pressed sunken; the default one outlined ---- */
${P} .scButton, ${P} button:not(.ui-button), ${P} input[type="button"], ${P} input[type="submit"] { ${push} font: 11px ${FONT}; }
${P} :is(.scButton, button:not(.ui-button), input[type="button"], input[type="submit"]):hover:not(:disabled) { ${pushHot} }
${P} .scButtonPrimary { ${pushDefault} }
${P} :is(.scButton, button:not(.ui-button), input[type="button"], input[type="submit"]):active:not(:disabled) { ${pushDown} }
${P} :is(.scButton, button:not(.ui-button), input[type="button"], input[type="submit"]):disabled { ${pushOff} }
${P} .scButton:focus-visible, ${P} button:focus-visible { outline: 1px dotted #000; outline-offset: -5px; }

/* ---- Bottom application tabs: a notebook's minor tabs along the bottom ---- */
${P} .scPager { width: auto; margin: 0; border: 0; border-radius: 0; padding: 0 4px 3px; background: ${FACE}; border-top: 2px solid ${LIGHT}; }
${P} .scPagerButtonNormal, ${P} .scPagerButtonActive {
  color: #000;
  font: 11px ${FONT};
  ${tab}
  border-top: 0;
  margin: 0 1px 0 0;
}
${P} .scPagerButtonNormal:hover { background: #c4c4c4; }
${P} .scPagerButtonActive { ${tabOpen} position: relative; z-index: 1; top: -2px; padding-top: 2px; }

/* ---- Dialog windows: a Presentation Manager window. The page inside the dialog draws the title bar (its
   header); Sitecore's empty jQuery title bar is laid over it, keeping the drag and carrying the buttons: Close
   as the system menu button at the left, the rest at the right. ---- */
${P} .ui-dialog {
  background: ${FACE};
  border: 2px solid;
  border-color: ${LIGHT} ${DARK} ${DARK} ${LIGHT};
  border-radius: 0;
  padding: 2px;
  overflow: hidden;
  box-shadow: 1px 1px 0 #000, 3px 3px 0 1px rgba(0, 0, 0, 0.3);
}
${X} .ui-dialog { border-color: ${LIGHT} ${DARK} ${DARK} ${LIGHT}; background: ${FACE}; }
${P} .ui-dialog .ui-dialog-titlebar {
  position: absolute;
  top: 2px;
  left: 2px;
  right: 2px;
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
  left: 3px;
  right: 3px !important;
  margin: 0 !important;
  height: 16px;
  display: flex;
  justify-content: flex-end;
  gap: 0;
  pointer-events: none;
}
${P} .ui-dialog .ui-dialog-titlebar-buttonpane > * {
  box-sizing: border-box;
  width: 18px;
  height: 16px;
  margin: 0;
  padding: 0;
  border: 1px solid;
  border-color: ${LIGHT} ${DARK} ${DARK} ${LIGHT};
  border-radius: 0;
  box-shadow: none;
  overflow: hidden;
  text-indent: -999px;
  pointer-events: auto;
}
${P} .ui-dialog .ui-dialog-titlebar-buttonpane > * > * { display: none; }
${P} .ui-dialog .ui-dialog-titlebar-buttonpane > button.ui-button {
  position: static !important;
  float: none !important;
  order: -1;
  margin: 0 auto 0 0 !important;
  background: ${art(SYSMENU)}, ${FACE};
}
${P} .ui-dialog .ui-dialog-titlebar-minimize { background: ${art(HIDE)}, ${FACE}; }
${P} .ui-dialog .ui-dialog-titlebar-maximize { background: ${art(MAX)}, ${FACE}; }
${P} .ui-dialog .ui-dialog-titlebar-restore { background: ${art(RESTORE)}, ${FACE}; }
${P} .ui-dialog .ui-dialog-titlebar-collapse { background: ${art(["KKKKKKKKK", ".KKKKKKK.", "..KKKKK..", "...KKK...", "....K...."])}, ${FACE}; }
${P} .ui-dialog .ui-dialog-titlebar-buttonpane > :active { border-color: ${SHADE} ${LIGHT} ${LIGHT} ${SHADE}; }
/* a faint shade marks the dialog as modal */
${P} .ui-widget-overlay { background: rgba(0, 0, 0, 0.16); opacity: 1; }

/* Inside a dialog page: the header is the blue title bar, the title centred between the buttons. */
${P} :is(.scFormDialogHeader, .scDialogHeader) { background: ${FACE}; padding: 0; border: 0; min-height: 0 !important; }
/* the dialog page's header, and the ListView's, which SPE puts straight in the jQuery dialog */
${P} :is(:is(.scFormDialogHeader, .scDialogHeader) .DialogHeader, .ui-dialog > .DialogHeader) {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  box-sizing: border-box;
  height: 22px;
  margin: 0;
  padding: 0 60px 0 26px;
  background: ${BLUE};
  border: 0;
  border-radius: 0;
  ${capText}
  line-height: 22px;
  white-space: nowrap;
}
${P} .DialogHeader #DialogIcon { width: 16px; height: 16px; margin: 0; }
${P} :is(.scFormDialogHeader, .scDialogHeader) .DialogHeaderDescription { color: #000; padding: 8px 10px; margin: 0; font: 11px ${FONT}; background: ${FACE}; border-bottom: 1px solid ${SHADE}; box-shadow: 0 1px ${LIGHT}; }
${P} .scFormDialogContent, ${P} .scFormDialogFooter, ${P} .scDialogContentContainer { background: ${FACE}; }
${P} .scFormDialogFooter { border-top: 1px solid ${SHADE}; border-radius: 0; box-shadow: inset 0 1px ${LIGHT}; }
${X} .scDialogContentContainer { padding: 8px; }
${X} .scFormDialogFooter { height: 42px; padding: 8px; line-height: normal; }
${X} .scFormDialogFooter .footerOkCancel { position: static; float: left; display: flex; gap: 8px; }
/* SPE's help (?) floats for 10.x's taller footer: centred on the 24px buttons instead */
${X} .scFormDialogFooter img#Copyright { margin: 0; }

/* ---- Tab strips (the ISE's script tabs, and dialogs before the notebook rules below): tabs along the top ---- */
${P} .scTabstrip [class*="scTabActive"]::after { display: none; }
${P} .scTabstrip, ${P} .scTabstrip > nobr { display: flex; align-items: flex-end; }
${P} .scTabstrip { border-bottom: 2px solid ${LIGHT}; }
/* Sitecore swaps scTab for scTab_Hover under the mouse; the stock hover class is uppercase on a light face. */
${P} .scTabstrip :is(.scTab, .scTab_Hover), ${P} .scTabstrip [class*="scTabActive"] {
  ${tab}
  border-bottom: 0;
  height: auto;
  padding: 0 10px 0 14px;
  margin: 0 1px 0 0;
  font: 11px/20px ${FONT};
}
${P} .scTabstrip .scTab_Hover { background: #c4c4c4; }
${P} .scTabstrip [class*="scTabActive"] { ${tabOpen} position: relative; z-index: 1; padding-bottom: 2px; margin-bottom: -2px; }
/* focus: a dotted rectangle inside the tab, never Sitecore's black frame */
${X} .scTabstrip :is(.scTab, .scTab_Hover, [class*="scTabActive"]):focus { outline: none; box-shadow: none; }
${X} .scTabstrip :is(.scTab, .scTab_Hover, [class*="scTabActive"]):focus-visible { outline: 1px dotted #000; outline-offset: -4px; }
${P} .scTabstrip .closeTab { margin: 0 -2px 0 6px; }
/* the ISE's unsaved-script dot, darkened from SPE's #fc2929 to pass AA on the grey */
${P} .scTabstrip .scriptModified { color: #8c1008; }

/* ---- Window buttons (Desktop windows and the Content Editor's own): grey bevelled buttons, Close as the system
   menu button at the left ---- */
${P} :is(.scSystemButtons, .standartWindowButtons, .scWorkboxWindowButtons) { display: flex; align-items: center; gap: 0; }
${P} :is(.scSystemButtons, .standartWindowButtons, .scWorkboxWindowButtons) img { vertical-align: middle; filter: none; }
${P} :is(.scSystemButtons, .standartWindowButtons, .scWorkboxWindowButtons) img[src*="minimize"] { order: 2; ${capBtn(HIDE)} }
${P} :is(.scSystemButtons, .standartWindowButtons, .scWorkboxWindowButtons) img[src*="maximize"] { order: 3; ${capBtn(MAX)} }
${P} :is(.scSystemButtons, .standartWindowButtons, .scWorkboxWindowButtons) img[src*="restore"] { order: 3; ${capBtn(RESTORE)} }
${P} :is(.scSystemButtons, .standartWindowButtons, .scWorkboxWindowButtons) img[src*="_close"] { order: -1; ${capBtn(SYSMENU)} }
${P} :is(.scSystemButtons, .standartWindowButtons, .scWorkboxWindowButtons) img[src*="page_switcher"] { order: 1; ${capBtn(TRI_DOWN)} }
${P} :is(.scSystemButtons, .standartWindowButtons, .scWorkboxWindowButtons) img:is([src*="minimize"], [src*="maximize"], [src*="restore"], [src*="_close"], [src*="page_switcher"]):active { border-color: ${SHADE} ${LIGHT} ${LIGHT} ${SHADE}; }
/* The Content Editor's own buttons: hide and maximize, then its system menu button nearest the edge */
${P} .scSystemButtons { margin-right: 6px; gap: 1px; }
${P} .scSystemButtons img[src*="_close"] { order: 9; margin-left: 4px; }
/* Standard windows (ISE, Console, Package Designer...): the blue title bar, the title centred */
${P} .standardWindowCaption {
  box-sizing: border-box;
  height: 22px;
  background: ${BLUE};
  border: 0;
  border-radius: 0;
  text-align: center;
}
/* Around the caption: the window's frame, grey */
${X} .scWindowFrame, ${X} .scWindowBorder2 { border-color: ${FACE}; }
${X} .scWindowFrame > .scStretch { background-color: ${FACE}; }
${P} .standardWindowCaption + .windowPlaceholderContainer { top: 22px; }
${P} .standardWindowCaption .windowCaptionIcon { display: inline-block; vertical-align: top; margin: 3px 0 0 0; }
${P} .standardWindowCaption .scWindowCaption {
  display: inline-block;
  ${capText}
  line-height: 22px;
  padding: 0 6px;
  vertical-align: top;
}
${P} .standardWindowCaption .scWindowCaption * { font: inherit; }
/* The ISE writes its script's path into the caption in an inline #bbb: pale blue on the bar. */
${P} .standardWindowCaption .scWindowCaption i { color: #dfe8f8 !important; }
/* The button box spans the bar: the system menu button at the left, hide and maximize at the right. */
${P} .standartWindowButtons { top: 3px; left: 3px; right: 3px; height: 16px; display: flex; justify-content: flex-end; pointer-events: none; }
${P} .standartWindowButtons img { pointer-events: auto; }
${P} .standartWindowButtons img[src*="_close"] { margin-right: auto; }
/* SPE's ISE (ise.js) gives its title the room the .standartWindowButtons box leaves; here that box spans the
   bar, so the title would get none. The title bar's own padding keeps it clear of the buttons. */
${P} .standardWindowCaption #WindowCaption { max-width: calc(100% - 80px) !important; margin-left: 0 !important; }
/* An inactive window (dom.js marks its document from the taskbar): a grey title bar, the title black. */
${PI} .standardWindowCaption { background: #b4b4b4; }
${PI} .standardWindowCaption .scWindowCaption { color: #000; }
${PI} .standardWindowCaption .scWindowCaption i { color: #2a2a2a !important; }
/* The Content Editor, Media Library and Workbox: Sitecore draws no caption over their windows. OS/2's blue title bar, the title centred, as on every other window, is
   drawn on the caption's empty top line from the window's title (engine.js --sct-window-title), the window's
   buttons on it and the ribbon's menu button moved below it. */
${P}[data-sct-window-title] .scWindowBorder2 > .scCaption > #CaptionTopLine, ${P}[data-sct-window-title] .scWorkboxWindowCaption.scWindowHandle { box-sizing: border-box; height: 22px; background: ${BLUE}; }
${P}[data-sct-window-title] .scWindowBorder2 > .scCaption > #CaptionTopLine::before, ${P}[data-sct-window-title] .scWorkboxWindowCaption.scWindowHandle::before { content: var(--sct-window-title, ""); display: block; box-sizing: border-box; height: 22px; padding: 0 80px; ${capText} line-height: 22px; text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
${P}[data-sct-window-title] .scWindowBorder2 > .scCaption > .scSystemButtons, ${P}[data-sct-window-title] .scWorkboxWindowButtons { top: 3px; right: 3px; margin-right: 0; height: 16px; z-index: 2; }
/* the Workbox's buttons float in its caption strip: placed on the bar like the Content Editor's */
${P}[data-sct-window-title] .scWorkboxWindowCaption.scWindowHandle { position: relative; }
${P}[data-sct-window-title] .scWorkboxWindowButtons { position: absolute; float: none; }
/* Under the bar the tabs start at its foot: the empty header over the tab group (17px, for a contextual group's
   name) goes while no contextual group shows, and the menu button, 17px down and 30px tall for that band, moves
   up into the tab row at the row's height */
${P}[data-sct-window-title] .scWindowBorder2 > .scCaption > #SystemMenu { top: 0; margin-top: 22px; height: 22px; }
${P}[data-sct-window-title] .scWindowBorder2 > .scCaption .scRibbonNavigator:not(:has(.scRibbonNavigatorButtonsContextualGroup)) .scRibbonNavigatorButtonsGroupHeader { display: none; }
/* 2px between the title bar and the tabs: they never touch it; the menu button moves down with them */
${P}[data-sct-window-title] .scWindowBorder2 > .scCaption .scRibbonNavigator { padding-top: 2px; }
${P}[data-sct-window-title] .scWindowBorder2 > .scCaption > #SystemMenu { translate: 0 2px; }
${PI}[data-sct-window-title] .scWindowBorder2 > .scCaption > #CaptionTopLine, ${PI}[data-sct-window-title] .scWorkboxWindowCaption.scWindowHandle { background: #b4b4b4; }
${PI}[data-sct-window-title] .scWindowBorder2 > .scCaption > #CaptionTopLine::before, ${PI}[data-sct-window-title] .scWorkboxWindowCaption.scWindowHandle::before { color: #000; }


/* ---- Insert gallery scroller: raised arrow buttons ---- */
${P} .scRibbonPanelButtons { background: transparent; }
${P} :is(img.scRibbonPanelUp, img.scRibbonPanelDown, img.scRibbonPanelOpen) { box-sizing: border-box; width: 17px; height: 15px; filter: none; ${raised(LIGHT, DARK, 1)} }
${P} img.scRibbonPanelUp { ${paint(`${art(UP)}, ${FACE}`)} }
${P} img.scRibbonPanelDown { ${paint(`${art(DOWN)}, ${FACE}`)} }
${P} img.scRibbonPanelOpen { ${paint(`${art(["KK.KK.KK", "KK.KK.KK"])}, ${FACE}`)} }

/* ==== Desktop: the Workplace Shell's blue desktop under the WarpCenter ==== */
/* The WarpCenter takes the top edge; the user name and Log off move into its menu (dom.js). */
${X}:has(#Desktop) .sc-globalHeader { display: none; }
${X}:has(#Desktop) .sc-globalHeader ~ :is(div, table) { padding-top: 0; }
${X}:has(#Desktop) .sc-globalHeader ~ div > .DesktopArea { margin-top: 0; }
${X} .DesktopArea {
  top: 30px;
  bottom: 0;
  overflow: clip;
  overflow-clip-margin: border-box;
  /* Sitecore sets its wallpaper inline */
  background: radial-gradient(ellipse 80% 70% at 50% 40%, #33689c, ${DESK} 70%, #234d79) !important;
}
${X} .DesktopArea > :is(iframe, div[id^="FRAME"]) { top: 0; }

/* ---- The WarpCenter: a grey bar along the top, its buttons raised, the open window's sunken ---- */
${X} .scStartbar { top: 0; bottom: auto; height: 30px; z-index: 900; border: 0; background: transparent; }
${X} #Startbar, ${X} #Startbar > table { height: 30px; border: 0; }
${X} #Startbar { box-sizing: border-box; background: ${FACE}; border-bottom: 2px solid ${SHADE}; box-shadow: inset 0 1px ${LIGHT}, 0 1px #000; }
${X} #Startbar > table { background: none; box-shadow: none; }
${X} #Startbar > table > tbody > tr > td { height: 28px; padding: 0; border: 0; vertical-align: middle; }
/* the start button: the WarpCenter's first button, Sitecore's start picture in a raised box */
${X} .scStartButtonContainer { position: relative; width: 40px; height: 28px; }
${X} :is(.scStartButton, .scStartButton:hover, .scStartButton.scPopupOpener) {
  position: absolute;
  top: 2px;
  left: 3px;
  box-sizing: border-box;
  width: 34px;
  height: 24px;
  margin: 0;
  padding: 0;
  ${raised(LIGHT, DARK, 2)}
  border-radius: 0;
  box-shadow: none;
  background: url("/sitecore/shell/themes/standard/Images/Startbar/StartButton.png") center / 46px 37px no-repeat, ${FACE};
}
${X} .scStartButton.scPopupOpener { border-color: ${SHADE} ${LIGHT} ${LIGHT} ${SHADE}; }
${X} .scStartButton:focus-visible { outline: 1px dotted #000; outline-offset: -5px; }
${X} .scStartBarScroller { height: 28px; padding: 0; border: 0; display: flex; align-items: center; }
${X} #StartbarApplications { height: 24px; margin: 0; border-spacing: 2px 0; }
${X} :is(.scActiveApplication, .scInactiveApplication) {
  box-sizing: border-box;
  height: 24px;
  max-width: 170px;
  padding: 0 8px;
  ${RAISED}
  border-radius: 0;
  background: ${FACE};
  box-shadow: none;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
${X} .scInactiveApplication:hover { background: #d8d8d8; }
${X} .scActiveApplication { border-color: ${SHADE} ${LIGHT} ${LIGHT} ${SHADE}; background: #c0c0c0; }
${X} .scInactiveApplication::before, ${X} .scInactiveApplication::after { display: none; }
${X} :is(.scActiveApplication, .scInactiveApplication) * { color: #000; font: 11px/20px ${FONT}; text-shadow: none; }
${X} .scActiveApplication * { font-weight: bold; }
${X} .scStartBarApplication span img { margin: 0 4px 0 0 !important; vertical-align: middle; }
${X} .scStartbarTray { height: 28px; border: 0; background: transparent; }
${X} .scStartbarTray > tbody > tr > td { height: 28px; padding: 0 0 0 4px; line-height: 28px !important; vertical-align: middle; }
${X} .scStartbarTray, ${X} .scStartbarTray * { color: #000; font: 11px ${FONT}; }
${X} #SearchBox { box-sizing: border-box; width: 160px; height: 22px; min-height: 0; margin: 0; padding: 0 4px; ${field} font: 11px ${FONT}; }
${X} #SearchBox::placeholder { color: #404040; }
${X} #SearchBox:focus { ${fieldFocus} }
${X} #DatabaseSelector { display: inline-flex; vertical-align: top; align-items: center; box-sizing: border-box; height: 24px; margin-top: 2px; padding: 0 6px; ${RAISED} border-radius: 0; background: ${FACE}; }
${X} #DatabaseSelector:hover { background: #d8d8d8; }
${X} #DatabaseSelector img { width: 16px; height: 16px; margin: 0 4px 0 0 !important; }
/* the clock: a black window, green figures */
${X} .sct-wp-clock { padding: 0 6px 0 4px !important; }
${X} .sct-wp-clock span { display: inline-block; box-sizing: border-box; height: 22px; padding: 0 8px; ${sunken(LIGHT, SHADE, 2)} background: #000; color: #00ff66 !important; font: bold 13px/18px "Courier New", Courier, monospace !important; white-space: nowrap; }

/* ---- Start menu: the WarpCenter's menu, dropping from its first button (dom.js adds the account row and
   Log off) ---- */
${X} .scPopup:has(> .scStartMenu) { top: 30px !important; bottom: auto !important; padding: 0; border: 0; border-radius: 0; box-shadow: 2px 2px 0 rgba(0, 0, 0, 0.4); background: transparent; overflow: hidden; }
${X} .scStartMenu {
  box-sizing: border-box;
  width: 400px;
  padding: 2px;
  ${RAISED}
  border-radius: 0;
  background: ${FACE};
  box-shadow: 1px 1px 0 #000;
  overflow: hidden;
  font-family: ${FONT};
}
${X} .sct-wp-smtop { display: flex; align-items: center; gap: 8px; height: 36px; padding: 0 8px; margin: 0 0 2px; background: ${BLUE}; }
${X} .sct-wp-smtop img { box-sizing: border-box; width: 28px; height: 28px; ${raised(LIGHT, DARK, 1)} background: #fff; object-fit: cover; }
${X} .sct-wp-smtop span { overflow: hidden; color: #fff; font: bold 12px/1.2 ${FONT}; text-overflow: ellipsis; white-space: nowrap; }
${X} .scStartMenuContent { margin: 0; border: 0; background: transparent; }
${X} .scStartMenuContentColumns { width: 100%; border: 0; border-collapse: collapse; table-layout: fixed; }
${X} .scStartMenuLeft, ${X} .scStartMenuRight { padding: 2px 0; vertical-align: top; background: transparent; }
${X} .scStartMenuLeft { width: 50%; }
${X} .scStartMenuRight { box-shadow: inset 1px 0 ${SHADE}, inset 2px 0 ${LIGHT}; padding-left: 3px; }
${X} :is(.scStartMenuLeft, .scStartMenuRight) * { color: #000; font-family: ${FONT}; }
${X} :is(.scStartMenuLeftOption, .scStartMenuRightFolder) {
  box-sizing: border-box;
  display: flex;
  align-items: center;
  min-height: 0;
  height: auto;
  margin: 0;
  padding: 2px 6px;
  border: 0;
  border-radius: 0;
  background: transparent;
  text-decoration: none;
  white-space: nowrap;
}
${X} .scStartMenuLeft .scStartMenuLeftOption { height: 40px; }
${X} .scStartMenuRight :is(.scStartMenuLeftOption, .scStartMenuRightFolder) { height: 24px; }
${X} .scStartMenuLeftOptionIcon { flex: none; width: 32px; height: 32px; margin: 0 6px 0 0; float: none; }
${X} .scStartMenuRight :is(.scStartMenuLeftOptionIcon, .scStartMenuRightFolderIcon) { width: 16px; height: 16px; margin: 0 6px 0 0; }
${X} .scStartMenuLeftOptionDescription { min-width: 0; overflow: hidden; }
${X} :is(.scStartMenuLeftOptionDisplayName, .scStartMenuRightFolderDisplayName) { padding: 0; font: bold 11px/14px ${FONT}; overflow: hidden; text-overflow: ellipsis; }
${X} .scStartMenuRight :is(.scStartMenuLeftOptionDisplayName, .scStartMenuRightFolderDisplayName) { font-weight: normal; }
${X} .scStartMenuLeftOptionTooltip { color: #404040 !important; font: 11px/14px ${FONT}; overflow: hidden; text-overflow: ellipsis; }
${X} .scStartMenuRight .scStartMenuLeftOptionTooltip { display: none; }
${X} :is(.scStartMenuLeftOption, .scStartMenuRightFolder, .scStartMenuProgramsMenu):is(:hover, .scPopupOpener) { ${SEL} }
${X} :is(.scStartMenuLeftOption, .scStartMenuRightFolder, .scStartMenuProgramsMenu):is(:hover, .scPopupOpener) * { color: #fff !important; }
${X} .scStartMenuRightFolderDisplayName { flex: 1; }
${X} .scStartMenuDivider { height: 0; margin: 3px 4px; border: 0; border-top: 1px solid ${SHADE}; border-bottom: 1px solid ${LIGHT}; background: none; }
${X} img.scStartMenuRightFolderGlyph { ${paint(art(TRI_RIGHT))} order: 2; width: 8px; height: 9px; margin: 0 0 0 6px; float: none; }
${X} :is(.scStartMenuRightFolder, .scStartMenuProgramsMenu):is(:hover, .scPopupOpener) img:is(.scStartMenuRightFolderGlyph, .scStartMenuProgramsGlyph) { background: ${art(TRI_RIGHT_W)}; }
${X} .scStartMenuPrograms { padding: 0 0 2px; background: transparent; vertical-align: bottom; }
${X} .scStartMenuPrograms .scStartMenuDivider { margin: 0 4px 3px; }
${X} .scStartMenuProgramsMenu { display: flex; align-items: center; gap: 8px; height: 24px; padding: 0 6px; color: #000; text-decoration: none; }
${X} .scStartMenuProgramsMenuText { flex: 1; color: #000; font: bold 11px/16px ${FONT}; }
${X} img.scStartMenuProgramsGlyph { order: 2; width: 8px; height: 9px; margin: 0; ${paint(art(TRI_RIGHT))} }
${X} .sct-wp-smbottom { display: flex; justify-content: flex-end; gap: 6px; padding: 6px 4px 4px; border-top: 1px solid ${SHADE}; box-shadow: inset 0 1px ${LIGHT}; }
${X} .sct-wp-smbottom a { display: flex; align-items: center; gap: 5px; height: 24px; padding: 0 10px; ${push} font: 11px ${FONT}; text-decoration: none; }
${X} .sct-wp-smbottom a:hover { ${pushHot} }
${X} .sct-wp-smbottom a:active { ${pushDown} }
${X} .sct-wp-smbottom a img { width: 16px; height: 16px; }

/* ==== Where 10.x's own metrics (34-36px controls, 6px corners, soft shadows) outrank the rules above. ==== */

/* ---- Fields: 22px ---- */
${X} input:is([type="text"], [type="password"], [type="search"], [type="number"], [type="email"], [type="url"], :not([type])),
${X} select:not([multiple], [size]:not([size="0"], [size="1"])) {
  box-sizing: border-box;
  height: 22px;
  min-height: 0;
  padding: 0 4px;
  font: 11px/18px ${FONT};
  ${field}
}
${X} select:not([multiple], [size]:not([size="0"], [size="1"])) { padding-right: 22px; background: ${art(DOWN, 5)}, linear-gradient(${FACE}, ${FACE}) right / 17px 100% no-repeat, #fff; }
${X} textarea, ${X} select:is([multiple], [size]:not([size="0"], [size="1"])) { ${field} }
${X} :is(input, select, textarea):focus { ${fieldFocus} }
${X} :is(input, textarea):disabled, ${X} select:disabled { background-color: ${FACE}; color: #808080; }

/* Quick Info: read-only text in 19px rows, as Sitecore draws it (no frames) */
${X} .scEditorQuickInfo tr { line-height: 19px; }
${X} .scEditorQuickInfo td { padding: 1px 4px; font-size: 11px; }
${X} .scEditorQuickInfo input { height: 19px; padding: 0; border: 0; background: transparent !important; outline: 0; font-size: 11px; }

/* ---- Combo tables (date and time pickers, item pickers): one sunken field, a raised arrow button at its end ---- */
${X} table.scCombobox {
  box-sizing: border-box;
  height: 22px;
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
  height: 18px !important;
  min-height: 0;
  margin: 0;
  padding: 0 4px;
  border: 0;
  border-radius: 0;
  box-shadow: none;
  outline: 0;
  background: transparent;
}
${X} table.scCombobox img.scComboboxDropDown {
  display: block;
  box-sizing: border-box;
  width: 17px;
  height: 18px;
  margin: 0;
  padding: 0;
  ${raised(LIGHT, DARK, 1)}
  border-radius: 0;
  box-shadow: none;
  ${paint(`${art(DOWN)}, ${FACE}`)}
}
${X} table.scCombobox img.scComboboxDropDown:active { border-color: ${SHADE} ${LIGHT} ${LIGHT} ${SHADE}; }

/* ---- Push buttons: 24px, wide enough for OK and Cancel ---- */
${X} :is(.scButton:not(.scEditorHeaderButton), input[type="button"], input[type="submit"]) {
  height: 24px;
  min-width: 75px;
  padding: 0 10px;
  border-radius: 0;
  line-height: 20px;
}
${X} button:not(.ui-button) { border-radius: 0; }
/* the default button: the token layer frames it in its fill colour */
${X} .scButton.scButtonPrimary { ${push} ${pushDefault} }
${X} .scButton.scButtonPrimary:hover:not(:disabled) { ${pushHot} }
${X} .scButton.scButtonPrimary:active:not(:disabled) { ${pushDown} }

/* ---- Drop-down arrows: a small black triangle for Sitecore's chevrons ---- */
${X} img[src*="ribbondropdown" i] { ${paint(art(TRI_DOWN))} }

/* ---- Tree search: a field and two toolbar buttons on one line ---- */
${X} #SearchPanel { padding: 4px; background: ${FACE}; border-bottom: 1px solid ${SHADE}; }
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
  padding: 1px;
  border: 2px solid transparent;
  border-radius: 0;
}
${X} :is(a.scSearchButton, a.scSearchOptionsButton):hover { ${toolHot} }
${X} :is(a.scSearchButton, a.scSearchOptionsButton):active { ${toolDown} }
${X} :is(a.scSearchButton, a.scSearchOptionsButton) img { display: block; width: 16px; height: 16px; margin: 0; padding: 0; }
${X} a.scSearchOptionsButton img { ${paint(art(TRI_DOWN))} }
${X} #SearchOptionsList td { height: auto; padding: 2px 0; vertical-align: middle; }
${X} #TreeSearchOptions .scElementHover { padding: 0 4px 0 0; border: 0; background: none; }
${X} .scSearchAddCriteriaInput { padding-top: 2px; }
${X} :is(a.scSearchOptionName, a.scSearchAddCriteria) { display: flex; align-items: center; gap: 4px; padding: 0; color: #1a3a7a; font: 11px ${FONT}; }
${X} a.scSearchOptionName img.arrowDown { ${paint(art(TRI_DOWN))} }

/* ---- Language, version and navigator drop-downs above the editor: toolbar buttons ---- */
${X} .scEditorTabControls a.scEditorHeaderButton {
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 22px;
  min-width: 0;
  padding: 0 4px 0 6px;
  border: 2px solid transparent;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
  outline: 0;
  color: #000;
  font: 11px/18px ${FONT};
}
${X} .scEditorTabControls a.scEditorHeaderButton:hover { ${toolHot} }
${X} .scEditorTabControls a.scEditorHeaderButton:active { ${toolDown} }
${X} .scEditorTabControls a.scEditorHeaderButton img { margin: 0; }
${X} .scEditorTabControls a.scEditorHeaderButton span { display: inline-flex; align-items: center; gap: 4px; }

/* ---- Menus: a raised grey menu, the selected row on the blue ---- */
${X} .scPopup:not(:has(> .scStartMenu)), ${X} .scMenu:not(.scPopup > .scMenu) {
  padding: 1px;
  background: ${FACE};
  ${RAISED}
  border-radius: 0;
  box-shadow: 1px 1px 0 #000, 3px 3px 0 rgba(0, 0, 0, 0.25);
}
${X} .scPopup > .scMenu { padding: 0; background: transparent; border: 0; box-shadow: none; }
${X} .scMenu td {
  height: auto;
  padding: 3px 4px;
  background: transparent;
  color: #000;
  font: 11px ${FONT};
  line-height: 15px;
}
${X} .scMenu :is(.scMenuItemIcon, .scMenuItemIcon_Hover, .scMenuItemIcon_Disabled) { width: 16px; padding: 2px 2px 2px 5px; }
${X} .scMenu :is(.scMenuItemCaption, .scMenuItemCaption_Hover, .scMenuItemCaption_Disabled) { padding: 2px 16px 2px 4px; }
${X} .scMenu :is(.scMenuItemHotkey, .scMenuItemHotkey_Hover, .scMenuItemHotkey_Disabled) { padding: 2px 6px 2px 4px; text-align: right; }
${X} .scMenu :is(.scMenuItemIcon_Hover, .scMenuItemCaption_Hover, .scMenuItemHotkey_Hover, .scMenuPanelItem_Hover, .scMenuPanelItemSelected_Hover) { ${SEL} }
${X} .scMenu :is(.scGalleryMenuItem, tr:not([class]):has(> .scMenuItemIcon)):hover, ${X} .scMenu :is(.scGalleryMenuItem, tr:not([class]):has(> .scMenuItemIcon)):hover * { ${SEL} }
${X} .scMenu :is(.scGalleryMenuItem, tr:not([class]):has(> .scMenuItemIcon)):has(.scMenuItemCaption_Disabled):hover, ${X} .scMenu :is(.scGalleryMenuItem, tr:not([class]):has(> .scMenuItemIcon)):has(.scMenuItemCaption_Disabled):hover * { background: transparent; color: #808080; }
${X} .scMenu :focus-visible, ${X} .scMenu:focus-visible { outline: 1px dotted #000; outline-offset: -1px; }
${X} iframe.scGalleryFrame { border: 0; border-radius: 0; box-shadow: 1px 1px 0 #000, 3px 3px 0 rgba(0, 0, 0, 0.25); }
${X} .scMenu :is(.scMenuItemIcon_Disabled, .scMenuItemCaption_Disabled, .scMenuItemHotkey_Disabled) { color: #808080; }
${X} .scMenu .scMenuItemIcon_Disabled > img { opacity: 0.5; }
${X} .scMenu img[src*="submenu16x16" i] { ${paint(art(TRI_RIGHT))} }
${X} .scMenu :is(.scMenuItemHotkey_Hover, .scMenuItemCaption_Hover) img[src*="submenu16x16" i] { background: ${art(TRI_RIGHT_W)}; }
${X} .scMenu :is(.scMenuDividerIcon, .scMenuDividerCaption, .scMenuDividerHotkey) {
  height: 8px;
  padding: 0;
  border: 0;
  background: linear-gradient(transparent 3px, ${SHADE} 3px 4px, ${LIGHT} 4px 5px, transparent 5px);
  font-size: 0;
  line-height: 0;
}
${X} .scMenu :is(.scMenuDividerIcon, .scMenuDividerCaption, .scMenuDividerHotkey) img { display: none; }
${X} .scMenuHeader { padding: 4px 6px; color: #000; font: bold 11px ${FONT}; }

/* ---- Dialog notebooks: the major tabs stand on the page's right edge, the open one joined to it. Not the ISE's
   script tabs, which stay along the top (SPE places its tree and variables toggles beside the first). ---- */
${NB} .scTabstripContainer { position: relative; }
${NB} .scTabstripContainer > .scTabstrip {
  position: absolute;
  top: 10px;
  right: 0;
  z-index: 2;
  box-sizing: border-box;
  width: 118px;
  height: auto;
  border: 0;
  background: transparent;
}
${NB} .scTabstripContainer > .scTabstrip, ${NB} .scTabstripContainer > .scTabstrip > nobr { flex-direction: column; align-items: stretch; gap: 3px; }
${NB} .scTabstripContainer > .scTabstrip :is(.scTab, .scTab_Hover, [class*="scTabActive"]) { margin: 0 0 0 6px; border-bottom: 2px solid ${DARK}; border-left-color: ${LIGHT}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
${NB} .scTabstripContainer > .scTabstrip [class*="scTabActive"] { margin: 0 0 0 -2px; padding-bottom: 0; border-left: 0; }
${NB} .scTabstripContainer > .scTabs { top: 0; right: 118px; left: 0; background: ${FACE}; ${RAISED} border-right: 0; box-shadow: none; }
${X} .scTabs .scTabPage .scScrollbox { background: #fff; ${field} }
${X} .scTabs > .scTabPage { border-color: transparent; }

/* ---- Ribbon galleries (Home > Insert, Security > Presets): rows of a list, the blue selection ---- */
${X} .scRibbonGalleryList > a:is(:hover, :active) { ${SEL} border-color: transparent; box-shadow: none; }
${X} .scRibbonGalleryList > a:is(:hover, :active) * { color: #fff; }

/* The ribbon's fold button: a black arrow */
${X} a.scRibbonClose { background: ${art(UP)}; }
${X} a.scRibbonOpen { background: ${art(DOWN)}; }
${X} :is(a.scRibbonClose, a.scRibbonOpen)::before { content: none; }

/* ---- Bucket search: one sunken field holding the filter tokens and the Clear and Search buttons ---- */
${X} .search-box { ${field} }
${X} .search-box :is(.sb_down, .sb_up) { border: 0; border-right: 1px solid ${SHADE}; border-radius: 0; }
${X} .search-box .sb_down { background: ${art(DOWN)}, ${FACE}; }
${X} .search-box .sb_up { background: ${art(UP)}, ${FACE}; }
${X} .search-box #raw-user-input { border: 0; box-shadow: none; outline: 0; background: transparent; }
${X} .filters .filter { ${raised(LIGHT, DARK, 1)} border-radius: 0; background: #d8d8d8; color: #000; }
${X} .clear-search-box :is(.btn-clear, .btn-search) { ${push} }
${X} .clear-search-box .btn-clear { background: url("/sitecore/shell/Applications/Buckets/images/clear.png") center no-repeat, ${FACE}; }
${X} .clear-search-box .btn-search { background: url("/sitecore/shell/Applications/Buckets/images/edition-magnifier.png") center no-repeat, ${FACE}; }
${X} .clear-search-box :is(.btn-clear, .btn-search):active { ${pushDown} }

${X} .scWorkboxWindowCaption:not([data-sct-window-title] *) { background: ${FACE}; }

/* SPEAK pages served in the shell (SPE Reports): the window face under the title bar, as on SPEAK pages */
${appHeader(X)}
/* jQuery UI's highlight box (the ISE's tip of the session): a pale yellow note */
${X} .ui-state-highlight { ${raised(LIGHT, DARK, 1)} border-radius: 0; background: #ffffcc; color: #000; }
${X} .ui-state-highlight :is(p, b, span, a, div) { color: #000; }
${X} .ui-state-highlight a { color: #1a3a7a; }

/* ---- Desktop windows: each is an iframe, so its bevelled edge is drawn outside it ---- */
${X} #Desktop > iframe:not([style*="width: 100%"]) { box-shadow: ${FRAME_RING}; border-radius: 0; }
${X} #Desktop > iframe[data-sct-window="inactive"]:not([style*="width: 100%"]) { box-shadow: ${FRAME_RING_IN}; }
`;

// ==== SPEAK pages (speak and launchpad areas) ====
// band: the header's height inside its bottom border (SPEAK pages 49px, Launchpad 47px).
const speakCommon = (S, band = 49) => {
  const SX = `${S}:not(#sct-wp)`;
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
  height: 22px;
  min-height: 0;
  padding: 0 4px;
  font: 11px/18px ${FONT};
  ${field}
}
${SX} select:not([multiple], [size]:not([size="0"], [size="1"])) { appearance: none; padding-right: 22px; background: ${art(DOWN, 5)}, linear-gradient(${FACE}, ${FACE}) right / 17px 100% no-repeat, #fff; }
${SX} textarea { ${field} }
${SX} :is(input, select, textarea, .form-control):focus { box-shadow: none; ${fieldFocus} }
${SX} input[type="checkbox"], ${SX} input[type="radio"] {
  appearance: none;
  box-sizing: border-box;
  width: 13px;
  height: 13px;
  margin: 0 4px 0 0;
  vertical-align: -2px;
  ${SUNKEN}
  border-radius: 0;
  outline: none;
  background: #fff;
}
${SX} input[type="radio"] { border-radius: 50%; }
${SX} input[type="checkbox"]:checked { background: ${art(CHECK)}, #fff; }
${SX} input[type="radio"]:checked { background: radial-gradient(circle, #000 0 2.2px, transparent 2.8px), #fff; }
${SX} .btn {
  height: 24px;
  min-width: 75px;
  padding: 0 10px;
  font: 11px/20px ${FONT};
  ${push}
}
${SX} .btn :is(span, .sc-button-text) { color: inherit; font: inherit; }
${SX} .btn:hover, ${SX} .btn:focus { ${push} ${pushHot} }
${SX} .btn:active, ${SX} .btn.active { ${pushDown} }
${SX} .btn:focus-visible { outline: 1px dotted #000; outline-offset: -5px; }
${SX} .btn:disabled, ${SX} .btn.disabled { ${pushOff} opacity: 1; }
${SX} .btn.btn-primary { ${pushDefault} }
${SX} .btn.btn-primary :is(span, .sc-button-text) { color: #000; }
`;
};

// A Workplace Shell folder window: a bevelled grey frame, a blue title bar, an icon area.
const folderWindow = (root, title, body, { icons = false } = {}) => `${root} { box-sizing: border-box; margin: 0 0 14px; padding: 2px; ${RAISED} border-radius: 0; background: ${FACE}; box-shadow: 1px 1px 0 #000; }
${title} {
  display: flex;
  align-items: center;
  gap: 6px;
  box-sizing: border-box;
  height: 22px;
  margin: 0;
  padding: 0 6px;
  border: 0;
  border-radius: 0;
  background: ${BLUE};
  ${capText}
  line-height: 22px;
  text-transform: none;
  white-space: nowrap;
}
${body} { box-sizing: border-box; margin: 2px 0 0; padding: ${icons ? "8px" : "8px 10px"}; ${SUNKEN} border-radius: 0; background: #fff; box-shadow: none; }`;

const SP = SURFACE("speak"), SPX = `${SP}:not(#sct-wp)`;
const EE = `${SPX} .sc-pageeditbar`;
const speak = `/* Warp: SPEAK pages and the Experience Editor ribbon. Generated by tools/build-warp-css.cjs. */
${speakCommon(SP)}
/* ==== Experience Editor ribbon: the SPEAK ribbon dressed as the Content Editor's: a menu bar over the
   toolbar's groups ==== */
${EE} { color: #000; font: 11px ${FONT}; }
${EE} .sc-quickbar {
  display: flex;
  align-items: center;
  height: auto;
  padding: 3px 4px 2px;
  border: 0;
  background: ${FACE};
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
  border: 2px solid transparent;
  border-radius: 0;
  background: none;
  box-shadow: none;
  opacity: 1;
}
${EE} .sc-quickbar-button:not(.disabled):hover { ${toolHot} }
${EE} .sc-quickbar-button:not(.disabled):active { ${toolDown} }
${EE} .sc-quickbar-button.disabled { opacity: 0.45; }
${EE} .sc-quickbar-button[data-sc-id="QuickRibbon"] { order: 1; margin-left: auto; }
${EE} .sc-quickbar-button :is(.navigate_up, .navigate_down) { float: none; margin: 0; background: none; mask: none; }
${EE} .sc-quickbar-button :is(.navigate_up, .navigate_down)::before { content: ""; display: block; width: 16px; height: 16px; }
${EE} .sc-quickbar-button .navigate_up::before { background: ${art(UP)}; }
${EE} .sc-quickbar-button .navigate_down::before { background: ${art(DOWN)}; }
${EE} .sc-quickbar-button[data-sc-id="QuickInsert-Component"] { margin-right: 8px; }
${EE} .sc-quickbar-tab, ${EE} .sc-quickbar-tab:hover {
  position: relative;
  box-sizing: border-box;
  height: 20px;
  padding: 0 8px;
  margin: 0;
  border: 0;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
  color: #000;
  font: 11px/20px ${FONT};
  text-decoration: none;
}
${EE} .sc-quickbar-tab::first-letter { text-decoration: underline; }
${EE} .sc-quickbar-tab:not(.sc-quickbar-tab-selected):hover { background: #b8b8b8; }
${EE} .sc-quickbar-item:focus { outline: none; }
${EE} .sc-quickbar-item:focus-visible { outline: 1px dotted #000; outline-offset: -2px; }
${EE} .sc-quickbar-tab.sc-quickbar-tab-selected { ${SEL} }

${EE} .sc-ribbon { background: ${FACE}; border: 0; border-top: 1px solid ${SHADE}; border-bottom: 1px solid ${SHADE}; box-shadow: inset 0 1px ${LIGHT}; }
${EE} .sc-strip { min-height: 0; padding: 0 0 0 2px; }
${EE} .sc-chunk {
  float: left;
  height: auto;
  margin: 3px 3px 3px 0;
  padding: 0;
  background: transparent;
  border: 0;
  border-right: 1px solid ${SHADE};
  border-radius: 0;
  box-shadow: 1px 0 ${LIGHT};
}
${EE} .sc-chunk::before, ${EE} .sc-chunk::after { content: none; }
/* As tight as the Content Editor's: 46px buttons 3px below the chunk's top, 4px from its sides, clear of the caption */
${EE} :is(.sc-chunk-button-list, .sc-chunk-check-list) { display: flow-root; box-sizing: border-box; height: 50px; min-height: 0; margin: 0; padding: 3px 4px 0; }
${EE} .sc-chunk-label { height: 18px; margin: 0; padding: 0 6px; color: #000; font: 11px/18px ${FONT}; text-align: center; text-transform: none; }
${EE} :is(.sc-chunk-button, .sc-chunk-button-dropdown, .sc-chunk-gallerybutton) {
  float: left;
  box-sizing: border-box;
  height: 46px;
  margin: 0;
  padding: 1px 4px 0;
  border: 2px solid transparent;
  border-radius: 0;
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
${EE} .disabled .sc-chunk-button-label, ${EE} .disabled.sc-chunk-check-small .sc-chunk-check-small-label { color: #6a6a6a; }
${EE} .disabled > [class*="sprite"] { opacity: 0.45; }
${EE} :is(.sc-chunk-button, .sc-chunk-button-small, .sc-chunk-button-dropdown, .sc-chunk-gallerybutton).disabled { opacity: 1; }
${EE} .sc-chunk-button-small-list { float: left; margin: 0; padding: 0; }
${EE} :is(.sc-chunk-button-small, .sc-chunk-check-small) {
  display: flex;
  align-items: center;
  gap: 4px;
  box-sizing: border-box;
  height: 22px;
  margin: 0;
  padding: 0 3px;
  border: 2px solid transparent;
  border-radius: 0;
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
${EE} .sc-chunk-datepanel-selector { display: flex; align-items: center; gap: 4px; box-sizing: border-box; height: 46px; padding: 0 6px; overflow: hidden; color: #000; ${field} }
${EE} .sc-chunk-datepanel-monthyear { height: auto; padding: 0; }
${EE} .sc-chunk-datepanel-selector * { color: #000; font-family: ${FONT}; }

/* The item path under the ribbon */
${EE} .sc-breadcrumb {
  display: flex;
  align-items: center;
  gap: 4px;
  box-sizing: border-box;
  height: 30px;
  min-height: 0;
  margin: 0;
  padding: 0 6px;
  background: ${FACE};
  border: 0;
  border-bottom: 1px solid ${SHADE};
  box-shadow: none;
}
${EE} .sc-breadcrumb-item { display: flex; align-items: center; gap: 4px; float: none; height: auto; margin: 0; padding: 0; }
${EE} .sc-breadcrumb-item > * { margin-top: 0; margin-bottom: 0; }
${EE} .sc-breadcrumb-item-path { color: #000; font: 11px ${FONT}; text-decoration: none; }
${EE} .sc-breadcrumb-item-path:hover { color: #1a3a7a; text-decoration: underline; }
${EE} :is(.sc-breadcrumb-item-button, .sc-breadcrumb-item-action) {
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 22px;
  min-width: 14px;
  padding: 0 2px;
  border: 2px solid transparent;
  border-radius: 0;
  background: none;
}
${EE} .sc-breadcrumb-item-button { width: 22px; }
${EE} :is(.sc-breadcrumb-item-button, .sc-breadcrumb-item-action):hover { ${toolHot} }
${EE} .sc-breadcrumb-item-action .separator_7 { background: ${art(TRI_RIGHT)}; mask: none; filter: none; }
${EE} .sc-breadcrumb .scContentButton { display: block; height: auto; padding: 0; margin: 0 0 0 4px; }
${EE} .sc-breadcrumb .btn.sc-button { height: 22px; min-width: 60px; padding: 0 10px; line-height: 18px; }

/* ==== Control Panel: the System Setup folder, each category a folder window ==== */
${SPX} body:has(.sc-controlpanel-box), ${SPX} body:has(.sc-controlpanel-box) .sc-applicationContent { background: ${DESK}; }
${SPX} body:has(.sc-controlpanel-box) .sc-applicationContent { min-height: 100vh; }
/* every SPEAK application's header (Control Panel, SPE Reports, Forms): the window face under the title bar */
${appHeader(SPX)}
${SPX} .sc-applicationContent-main { background: none; }
${SPX} .sc-controlpanel-box { margin-top: 14px; }
${folderWindow(`${SPX} .sc-controlpanel-box`, `${SPX} .sc-controlpanel-box-header h4`, `${SPX} .sc-controlpanel-box-content`)}
${SPX} .sc-controlpanel-box-header { margin: 0; padding: 0; color: #fff; text-transform: none; }
${SPX} .sc-controlpanel-box-header h4 img { flex: none; width: 16px; height: 16px; margin: 0; filter: brightness(0) invert(1); }
${SPX} .sc-controlpanel-box-content li { height: auto; padding: 0; border: 0; }
${SPX} .sc-controlpanel-box-content li a { display: block; padding: 2px 0; color: #1a3a7a; font: 11px/15px ${FONT}; text-decoration: none; }
${SPX} .sc-controlpanel-box-content li a:is(:hover, :focus) { ${SEL} text-decoration: none; }
${SPX} .sc-controlpanel-no-items { color: #404040; }

/* ==== Forms: the selected navigation entry and tab sit on the blue ==== */
${SPX} .header.menuItem :is(a, span) { color: #fff; }
${SPX} .sc-tab-control-tab-item.selected :is(a, span) { color: #fff; }
`;

// ==== Launchpad: the Workplace Shell desktop. Each group is an open folder window (its name in the blue title
// bar, a click on the bar rolls it up), the applications its icons; the analytics message a window of its own.
const LP = SURFACE("launchpad"), LPX = `${LP}:not(#sct-wp)`;
const SIDE = 250;
const launchpad = `/* Warp: Launchpad. Generated by tools/build-warp-css.cjs.
   The Workplace Shell's desktop: each group an open folder window of icons. */
${speakCommon(LP, 47)}
${LPX} body, ${LPX} .sc-applicationContent { background: ${DESK}; }
${LPX} .sc-applicationContent { padding: 0; }
${LPX} .sc-applicationContent-main { min-width: 0; margin: 0; padding: 0; background: none; }
/* Sitecore gives the main section min-height: 100vh under the 48px header, so every page scrolled 48px; the
   grid below fills the window instead */
${LPX} .sc-applicationContent-main > .row { margin: 0; }
/* The page title sits in the title bar, after the logo */
${LPX} .sc-applicationHeader { border: 0; background: none; box-shadow: none; }
${LPX} .sc-applicationHeader-row1 { border: 0; }
${LPX} .sc-applicationHeader-row1.no-breadcrumb .sc-applicationHeader-title { display: flex; align-items: center; top: 0; left: 44px; box-sizing: border-box; height: 47px; padding: 0 8px; background: ${BLUE}; }
${LPX} .sc-applicationHeader-title, ${LPX} .sc-applicationHeader-title .sc-text { ${capText} line-height: 24px; }
${LPX} .sc-applicationHeader-title::before { flex: none; filter: brightness(0) invert(1); }
${LPX} [data-sc-id="ColumnPanel1"] {
  display: grid;
  grid-template-columns: ${SIDE}px minmax(0, 1fr);
  grid-template-rows: auto auto auto 1fr;
  align-items: start;
  column-gap: 0;
  box-sizing: border-box;
  width: auto;
  min-height: calc(100vh - 51px);
  margin: 0;
  padding: 16px 0 0;
  float: none;
}
${LPX} :is([data-sc-id="CustomAnalyticsLabel"], [data-sc-id="FallBackMessageBorder"], [data-sc-id="RowPanelTilesWrapper"]) { grid-column: 1; float: none; width: auto; margin: 0 8px 0 16px; }
${LPX} [data-sc-id="CustomAnalyticsLabel"] { grid-row: 1; }
${LPX} [data-sc-id="FallBackMessageBorder"] { grid-row: 2; }
${LPX} [data-sc-id="RowPanelTilesWrapper"] { grid-row: 3; }
/* the analytics: a small window, its title bar rolling it up */
${LPX} .sc-text[data-sc-id="CustomAnalyticsLabel"] {
  position: static;
  display: flex;
  align-items: center;
  box-sizing: border-box;
  height: 26px;
  margin: 0 8px 0 16px;
  padding: 2px 8px;
  border: 2px solid;
  border-color: ${LIGHT} ${DARK} ${FACE} ${LIGHT};
  border-radius: 0;
  background: ${BLUE};
  box-shadow: inset 0 0 0 2px ${FACE};
  ${capText}
  line-height: 22px;
  text-transform: none;
  white-space: nowrap;
  cursor: pointer;
}
${LPX} .sc-text[data-sc-id="CustomAnalyticsLabel"][data-sct-collapsed="1"] { border-bottom-color: ${DARK}; box-shadow: inset 0 0 0 2px ${FACE}, 1px 1px 0 #000; }
${LPX} .sc-text[data-sc-id="CustomAnalyticsLabel"][data-sct-collapsed="1"] + .sc-border { display: none; }
${LPX} .sc-border[data-sc-id="FallBackMessageBorder"] { box-sizing: border-box; margin: 0 8px 14px 16px; padding: 10px; border: 2px solid; border-color: ${FACE} ${DARK} ${DARK} ${LIGHT}; border-radius: 0; background: #fff padding-box; box-shadow: inset 0 0 0 2px ${FACE}, 1px 1px 0 #000; }
${LPX} .sc-border[data-sc-id="FallBackMessageBorder"] :is(.row, [class*="col-"]) { float: none; width: auto; margin: 0; padding: 0; }
${LPX} .sc-border[data-sc-id="FallBackMessageBorder"] .sc-border { min-height: 0; border: 0; background: none; box-shadow: none; }
${LPX} .sc-text[data-sc-id="FallBackMessage"] { position: static; display: block; padding: 0; color: #000; font: 11px/15px ${FONT}; text-align: left; }

/* the groups: open folder windows of icons */
${LPX} .sc-launchpad {
  grid-column: 2;
  grid-row: 1 / 5;
  display: block;
  box-sizing: border-box;
  max-width: none;
  margin: 0;
  padding: 0 16px 16px 8px;
  float: none;
}
${LPX} .sc-launchpad-group {
  display: flex;
  flex-wrap: wrap;
  align-content: flex-start;
  gap: 4px;
  box-sizing: border-box;
  width: auto;
  min-width: 0;
  margin: 0 0 14px;
  padding: 0 2px 8px;
  ${RAISED}
  border-radius: 0;
  background: linear-gradient(${FACE}, ${FACE}) top / 100% 24px no-repeat, #fff;
  box-shadow: 1px 1px 0 #000, inset 0 0 0 2px ${FACE};
}
${LPX} .sc-launchpad-group-title {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 0 0 100%;
  box-sizing: border-box;
  height: 22px;
  margin: 2px 0 6px;
  padding: 0 8px;
  border: 0;
  background: ${BLUE};
  ${capText}
  line-height: 22px;
  text-transform: none;
  cursor: pointer;
}
${LPX} .sc-launchpad-group-title::before { content: ""; flex: none; width: 16px; height: 13px; background: ${art(FOLDER_OPEN)}; }
${LPX} .sc-launchpad-group[data-sct-collapsed="1"] { padding-bottom: 0; background: ${FACE}; }
${LPX} .sc-launchpad-group[data-sct-collapsed="1"] > .sc-launchpad-group-title { margin-bottom: 2px; }
${LPX} .sc-launchpad-group[data-sct-collapsed="1"] > .sc-launchpad-group-title::before { width: 16px; height: 12px; background: ${art(FOLDER)}; }
${LPX} .sc-launchpad-group[data-sct-collapsed="1"] > .sc-launchpad-item { display: none; }
/* an icon: 48px over its name; selected, the name on the blue with a dotted edge */
${LPX} .sc-launchpad-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  box-sizing: border-box;
  width: 96px;
  height: 92px;
  margin: 0 0 0 6px;
  padding: 4px 2px;
  border: 0;
  border-radius: 0;
  background: none;
  box-shadow: none;
  color: #000;
  text-align: center;
  text-decoration: none;
}
${LPX} .sc-launchpad-item .icon { flex: none; width: 48px; height: 48px; margin: 0; border-radius: 0; background: none; }
${LPX} .sc-launchpad-item .icon img { display: block; width: 48px; height: 48px; margin: 0; }
${LPX} .sc-launchpad-item .sc-launchpad-text { display: block; float: none; max-width: 100%; padding: 0 3px; overflow: hidden; outline: 1px dotted transparent; color: #000; font: 11px/14px ${FONT}; white-space: normal; text-align: center; }
${LPX} .sc-launchpad-item:hover { text-decoration: none; }
${LPX} .sc-launchpad-item:hover .icon { background: #e6e6e6; }
${LPX} .sc-launchpad-item:is(:focus, :active) { outline: none; }
${LPX} .sc-launchpad-item:is(:hover, :focus-visible, :active) .sc-launchpad-text { ${SEL} outline-color: #000; }
`;

// ==== Login: a logon dialog on the Workplace Shell's blue desktop: the logo, User ID and Password, the buttons
// along the foot.
const LG = SURFACE("login");
const login = `/* Warp: Identity Server login. Generated by tools/build-warp-css.cjs.
   A Presentation Manager logon dialog. */
${LG} body {
  min-height: 100vh;
  margin: 0;
  background: radial-gradient(ellipse 80% 70% at 50% 40%, #33689c, ${DESK} 70%, #234d79);
  color: #000;
  font: 11px ${FONT};
}
${LG} .top { position: absolute; top: 0; right: 0; z-index: 1; height: auto; padding: 14px 18px; border: 0; background: transparent; box-shadow: none; color: #fff; font: 11px ${FONT}; }
${LG} .top a { color: #fff; }
${LG} .main-wrap { display: flex; align-items: center; justify-content: center; min-height: 100vh; background: transparent; }
${LG} .main {
  box-sizing: border-box;
  width: min(400px, 100% - 32px);
  margin: 0 auto;
  padding: 24px 2px 2px;
  ${RAISED}
  border-radius: 0;
  background: linear-gradient(${BLUE}, ${BLUE}) top / 100% 22px no-repeat, ${FACE};
  box-shadow: 1px 1px 0 #000, 4px 4px 0 rgba(0, 0, 0, 0.3);
  color: #000;
  position: relative;
}
${LG} .main::before { content: "Logon"; position: absolute; top: 0; left: 0; right: 0; height: 22px; ${capText} line-height: 22px; text-align: center; }
${LG} .logo-wrap { margin: 0; padding: 14px 12px 10px; text-align: center; border-bottom: 1px solid ${SHADE}; box-shadow: 0 1px ${LIGHT}; }
${LG} .logo-wrap img { max-width: 180px; height: auto; filter: brightness(0) opacity(0.85); }
${LG} .login-page { margin: 0; padding: 12px 14px 10px; background: transparent; }
${LG} .login-page fieldset { margin: 0; padding: 0; border: 0; }
${LG} .login-page .form-group { margin: 0 0 8px; color: #000; }
${LG} label { color: #000; font: 11px ${FONT}; }
${LG} .form-control {
  box-sizing: border-box;
  display: block;
  width: 100%;
  height: 24px;
  margin: 3px 0 6px;
  padding: 0 4px;
  font: 12px/20px ${FONT};
  ${field}
}
${LG} .form-control:focus { box-shadow: none; ${fieldFocus} }
${LG} .form-control::placeholder { color: #404040; }
${LG} .btn.btn-primary {
  box-sizing: border-box;
  display: block;
  width: auto;
  min-width: 80px;
  height: 24px;
  margin: 8px 0 0;
  padding: 0 14px;
  ${push}
  ${pushDefault}
  font: 11px/20px ${FONT};
}
${LG} .btn.btn-primary:is(:hover, :focus) { ${pushHot} color: #000; }
${LG} .btn.btn-primary:active { ${pushDown} }
${LG} .btn.btn-primary:focus-visible { outline: 1px dotted #000; outline-offset: -5px; }
${LG} input[type="checkbox"] { appearance: none; box-sizing: border-box; width: 13px; height: 13px; margin: 0 4px 0 0; vertical-align: -2px; ${SUNKEN} border-radius: 0; background: #fff; }
${LG} input[type="checkbox"]:checked { background: ${art(CHECK)}, #fff; }
${LG} .remember-me { display: inline-flex; align-items: center; padding: 0; color: #000; font: 11px ${FONT}; }
${LG} .remember-me input[type="checkbox"] { position: static; flex: none; }
${LG} a, ${LG} .forgot-password { color: #1a3a7a; font: 11px ${FONT}; }
${LG} :is(.text-danger, .validation-summary-errors, .field-validation-error) { color: #8c1008; font-weight: bold; }
`;

const dir = path.join(__dirname, "..", "extension", "themes", ID);
for (const [name, text] of Object.entries({ shell: css, speak, launchpad, login })) {
  fs.writeFileSync(path.join(dir, `${name}.css`), pixelate(text));
  console.log(`${name}.css: ${(text.length / 1024).toFixed(1)} KB`);
}
